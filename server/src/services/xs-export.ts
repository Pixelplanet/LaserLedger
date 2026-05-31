/**
 * xTool file export — produces downloadable `.xcs` (v1 JSON) and `.xs`
 * (v2 ZIP) files for a laser setting.
 *
 * Two strategies, in priority order:
 *   1. Passthrough — when the setting was created from an uploaded source
 *      file (`source_xcs` + `source_format`) that already matches the
 *      requested format, the ORIGINAL bytes are served back unmodified
 *      (byte-identical). This preserves geometry, profiles, and any
 *      Studio-specific data we never parse.
 *   2. Writer fallback — otherwise we synthesise a minimal but valid file
 *      from the structured parameters stored on the setting. The output is
 *      designed to round-trip through {@link parseXcs}.
 *
 * `source_xcs` stores v1 (`xcs`) as raw JSON text and v2 (`xs`) as a
 * base64-encoded ZIP (see migration 20260530120000_add_source_format).
 */

import { zipSync, strToU8 } from 'fflate';

export type ExportFormat = 'xcs' | 'xs';

export interface ExportableSetting {
  title: string;
  power: number | null;
  speed: number | null;
  frequency: number | null;
  lpi: number | null;
  pulse_width: number | null;
  passes: number | null;
  cross_hatch: boolean | null;
  scan_mode: string | null;
  source_xcs: string | null;
  source_format: ExportFormat | null;
}

export interface ExportResult {
  buffer: Buffer;
  contentType: string;
  filename: string;
  passthrough: boolean;
}

/**
 * Decode the stored source file back into raw bytes, when it matches the
 * requested format. Returns null when there is no usable source for that
 * format (caller should fall back to the writer).
 */
export function decodeSource(setting: ExportableSetting, format: ExportFormat): Buffer | null {
  if (!setting.source_xcs || setting.source_format !== format) return null;
  if (format === 'xcs') {
    return Buffer.from(setting.source_xcs, 'utf-8');
  }
  // v2 .xs is base64-encoded ZIP bytes.
  return Buffer.from(setting.source_xcs, 'base64');
}

/** Build the structured parameter values shared by both writers. */
function paramValues(setting: ExportableSetting): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  if (setting.power !== null) values.power = setting.power;
  if (setting.speed !== null) values.speed = setting.speed;
  if (setting.frequency !== null) values.frequency = setting.frequency;
  if (setting.lpi !== null) values.density = setting.lpi;
  if (setting.pulse_width !== null) values.pulseWidth = setting.pulse_width;
  if (setting.passes !== null) values.repeat = setting.passes;
  if (setting.cross_hatch !== null) values.crossAngle = setting.cross_hatch;
  if (setting.scan_mode !== null) values.bitmapScanMode = setting.scan_mode;
  return values;
}

/**
 * Synthesise a minimal v1 `.xcs` JSON document carrying the structured
 * parameters. Round-trips through {@link parseXcs}.
 */
export function buildXcsV1(setting: ExportableSetting): Buffer {
  const doc = {
    extId: null,
    extName: null,
    canvas: [
      {
        displays: [
          {
            parameter: paramValues(setting),
          },
        ],
      },
    ],
    meta: {
      generator: 'LaserLedger',
      title: setting.title,
    },
  };
  return Buffer.from(JSON.stringify(doc, null, 2), 'utf-8');
}

/**
 * Synthesise a minimal v2 `.xs` ZIP container carrying the structured
 * parameters. Round-trips through {@link parseXsV2}.
 */
export function buildXsV2(setting: ExportableSetting): Buffer {
  const deviceId = 'll-export';
  const profileId = 'p1';
  const device = {
    extId: null,
    extName: null,
    processing: {
      canvas0: {
        modes: {
          LASER_PLANE: {
            data: {},
            profileRefs: [profileId],
          },
        },
      },
    },
  };
  const profiles = {
    profiles: {
      [profileId]: {
        values: paramValues(setting),
      },
    },
  };
  const project = { activeDeviceId: deviceId };
  const persistenceMeta = { protocol: 'xcs-workspace-v2' };

  const entries: Record<string, Uint8Array> = {
    '.format': strToU8('v2'),
    'meta/persistence-meta.json': strToU8(JSON.stringify(persistenceMeta)),
    'project.json': strToU8(JSON.stringify(project)),
    [`devices/device-${deviceId}.json`]: strToU8(JSON.stringify(device)),
    'profiles.json': strToU8(JSON.stringify(profiles)),
  };
  return Buffer.from(zipSync(entries));
}

/** Slugify a title into a safe filename stem. */
function fileStem(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'laser-setting';
}

/**
 * Produce a downloadable export for the requested format, preferring the
 * original uploaded bytes when available.
 */
export function exportSetting(setting: ExportableSetting, format: ExportFormat): ExportResult {
  const original = decodeSource(setting, format);
  const buffer = original ?? (format === 'xcs' ? buildXcsV1(setting) : buildXsV2(setting));
  const contentType =
    format === 'xcs' ? 'application/json' : 'application/zip';
  return {
    buffer,
    contentType,
    filename: `${fileStem(setting.title)}.${format}`,
    passthrough: original !== null,
  };
}
