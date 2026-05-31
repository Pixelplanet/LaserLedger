/**
 * xTool Studio v2 (`.xs`) file parser.
 *
 * The `.xs` container is a ZIP archive whose layout is documented in
 * docs/XS_FORMAT.md. This parser only extracts the metadata we already
 * surface from `.xcs` (device id, light source, material, processing
 * parameters) — it does not read display geometry or vector buckets.
 *
 * Output is intentionally the same `ParsedXcs` shape as the v1 parser
 * so downstream route handlers and UI code don't need to branch on
 * format. Defense in depth against zip-bombs: per-entry and total
 * uncompressed size are capped.
 */

import { unzipSync, strFromU8 } from 'fflate';
import { XcsParseError, type ParsedXcs, type ParsedXcsLayer } from './xcs.js';

const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const MAX_ENTRY_BYTES = 10 * 1024 * 1024; // 10 MB per file inside the ZIP
const MAX_TOTAL_BYTES = 25 * 1024 * 1024; // 25 MB total uncompressed

export function isXsZipBuffer(buf: Buffer): boolean {
  return buf.length >= 4 && buf.subarray(0, 4).equals(ZIP_MAGIC);
}

export function parseXsV2(buffer: Buffer): ParsedXcs {
  if (!isXsZipBuffer(buffer)) {
    throw new XcsParseError('Not a valid .xs archive (missing ZIP magic)');
  }

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(buffer), {
      // fflate's filter runs before decompression — we use it to enforce
      // a per-entry size cap. Returning false skips the entry entirely.
      filter: (file) => {
        if (file.originalSize > MAX_ENTRY_BYTES) {
          throw new XcsParseError(`Archive entry "${file.name}" exceeds size limit`);
        }
        return true;
      },
    });
  } catch (error) {
    if (error instanceof XcsParseError) throw error;
    throw new XcsParseError('Failed to unzip .xs archive');
  }

  let total = 0;
  for (const data of Object.values(entries)) {
    total += data.length;
    if (total > MAX_TOTAL_BYTES) {
      throw new XcsParseError('Archive uncompressed size exceeds limit');
    }
  }

  const format = entries['.format'];
  if (!format || strFromU8(format).slice(0, 2) !== 'v2') {
    throw new XcsParseError('Missing or invalid .format marker (expected "v2")');
  }

  const persistenceMeta = readJson(entries, 'meta/persistence-meta.json');
  if (!isObject(persistenceMeta) || persistenceMeta.protocol !== 'xcs-workspace-v2') {
    throw new XcsParseError('Unsupported .xs protocol');
  }

  const project = readJson(entries, 'project.json');
  if (!isObject(project)) throw new XcsParseError('Missing or invalid project.json');

  const activeDeviceId = typeof project.activeDeviceId === 'string' ? project.activeDeviceId : null;
  if (!activeDeviceId) throw new XcsParseError('project.json is missing activeDeviceId');

  const deviceFile = entries[`devices/device-${activeDeviceId}.json`];
  if (!deviceFile) {
    throw new XcsParseError(`Missing device file for active device "${activeDeviceId}"`);
  }
  const device = parseJsonBytes(deviceFile, `devices/device-${activeDeviceId}.json`);
  if (!isObject(device)) throw new XcsParseError('Device file root must be an object');

  const extId = typeof device.extId === 'string' ? device.extId : null;
  const extName = typeof device.extName === 'string' ? device.extName : null;

  // Find the first canvas's LASER_PLANE mode (Studio always writes one).
  const processing = isObject(device.processing) ? device.processing : {};
  let laserPlane: Record<string, unknown> | null = null;
  let referencedProfileIds: string[] = [];
  for (const canvas of Object.values(processing)) {
    if (!isObject(canvas)) continue;
    const modes = isObject(canvas.modes) ? canvas.modes : null;
    const plane = modes && isObject(modes.LASER_PLANE) ? modes.LASER_PLANE : null;
    if (!plane) continue;
    laserPlane = plane;
    if (Array.isArray(plane.profileRefs)) {
      referencedProfileIds = plane.profileRefs.filter((id): id is string => typeof id === 'string');
    }
    break;
  }
  if (!laserPlane) {
    throw new XcsParseError('Active device has no LASER_PLANE mode');
  }

  const planeData = isObject(laserPlane.data) ? laserPlane.data : {};
  const lightSource =
    typeof planeData.lightSourceMode === 'string' ? planeData.lightSourceMode : null;
  const xtoolMaterial = numOrNull(planeData.material);

  // profiles.json is optional (a device with zero profiles is legal in
  // a freshly-saved empty canvas), but normal projects always have one.
  const profilesJson = entries['profiles.json'];
  const layers: ParsedXcsLayer[] = [];
  if (profilesJson) {
    const profilesDoc = parseJsonBytes(profilesJson, 'profiles.json');
    const profiles = isObject(profilesDoc) && isObject(profilesDoc.profiles)
      ? profilesDoc.profiles
      : {};
    const targetIds = referencedProfileIds.length > 0
      ? referencedProfileIds
      : Object.keys(profiles);
    for (const id of targetIds) {
      const profile = profiles[id];
      if (!isObject(profile)) continue;
      const values = isObject(profile.values) ? profile.values : null;
      if (!values) continue;
      const layer = layerFromProfileValues(values);
      if (layer) layers.push(layer);
    }
  }

  return {
    ext_id: extId,
    ext_name: extName,
    light_source: lightSource,
    xtool_material_id: xtoolMaterial,
    layers: deduplicateLayers(layers),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function readJson(entries: Record<string, Uint8Array>, name: string): unknown {
  const bytes = entries[name];
  if (!bytes) return null;
  return parseJsonBytes(bytes, name);
}

function parseJsonBytes(bytes: Uint8Array, name: string): unknown {
  try {
    return JSON.parse(strFromU8(bytes));
  } catch {
    throw new XcsParseError(`Invalid JSON in archive entry "${name}"`);
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function numOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function intOrNull(v: unknown): number | null {
  const n = numOrNull(v);
  return n === null ? null : Math.round(n);
}

function boolOrNull(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  return null;
}

function stringOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

function firstDefined(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined) return source[key];
  }
  return undefined;
}

/**
 * Project a v2 `profile.values` block into a ParsedXcsLayer. v2 field
 * names match v1 for almost everything; the one cross-family rename is
 * `delayPerLine` (UV / Blue Ultra / MOPA families) vs `dwellTime` (F2).
 */
function layerFromProfileValues(values: Record<string, unknown>): ParsedXcsLayer | null {
  const layer: ParsedXcsLayer = {
    power: numOrNull(values.power),
    speed: numOrNull(values.speed),
    frequency: numOrNull(values.frequency),
    lpi: intOrNull(firstDefined(values, ['density', 'lpi', 'dpi'])),
    pulse_width: intOrNull(values.pulseWidth),
    passes: intOrNull(values.repeat),
    cross_hatch: boolOrNull(values.crossAngle),
    scan_mode: stringOrNull(values.bitmapScanMode),
  };
  if (Object.values(layer).every((v) => v === null)) return null;
  return layer;
}

function deduplicateLayers(layers: ParsedXcsLayer[]): ParsedXcsLayer[] {
  const seen = new Set<string>();
  const out: ParsedXcsLayer[] = [];
  for (const layer of layers) {
    const key = JSON.stringify(layer);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(layer);
    }
  }
  return out;
}
