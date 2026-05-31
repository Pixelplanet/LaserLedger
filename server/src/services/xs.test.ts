import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { parseXcs, XcsParseError } from './xcs.js';

interface XsBuilderOptions {
  omitFormat?: boolean;
  badProtocol?: boolean;
  omitDeviceFile?: boolean;
  omitLaserPlane?: boolean;
  extraEntries?: Record<string, Uint8Array>;
  deviceFamily?: 'f2-ultra-uv' | 'f2';
}

/** Build a minimal valid v2 .xs ZIP buffer in memory. */
function buildXs(opts: XsBuilderOptions = {}): Buffer {
  const family = opts.deviceFamily ?? 'f2-ultra-uv';
  const deviceId = family === 'f2' ? 'GS006-1' : 'GS009-CLASS-4-1';
  const extId = family === 'f2' ? 'GS006' : 'GS009-CLASS-4';
  const extName = family === 'f2' ? 'F2' : 'F2 Ultra UV';
  const lightSource = family === 'f2' ? 'blue' : 'uv';
  const canvasId = '11111111-1111-4111-8111-111111111111';
  const profileId = 'profile:K2l7TWbevF6U';

  // F2 uses dwellTime; other families use delayPerLine. Verifies the
  // dispatcher reads the same v2 keys regardless of dwell-time variant.
  const dwellKeys = family === 'f2'
    ? { enableDwellTime: false, dwellTime: 0.3 }
    : { enableDelayPerLine: false, delayPerLine: 0.3 };

  const profile = {
    id: profileId,
    processingType: 'FILL_VECTOR_ENGRAVING',
    values: {
      processingType: 'FILL_VECTOR_ENGRAVING',
      power: 70,
      speed: 425,
      frequency: 80,
      density: 683,
      pulseWidth: 100,
      repeat: 1,
      crossAngle: true,
      bitmapScanMode: 'crossMode',
      processingLightSource: lightSource === 'blue' ? 'blue' : 'red',
      ...dwellKeys,
    },
  };

  const deviceJson = opts.omitLaserPlane
    ? { id: deviceId, extId, extName, processing: { [canvasId]: { id: canvasId, modes: {} } } }
    : {
        id: deviceId,
        deviceCode: extId,
        extId,
        extName,
        power: family === 'f2' ? [5, 15] : [5],
        processing: {
          [canvasId]: {
            id: canvasId,
            activeMode: 'LASER_PLANE',
            modes: {
              LASER_PLANE: {
                data: {
                  material: 1323,
                  lightSourceMode: lightSource,
                  thickness: 0,
                  isProcessByLayer: false,
                  pathPlanning: 'auto',
                  fillPlanning: 'separate',
                },
                profileRefs: [profileId],
                patches: {},
                bindings: [],
              },
            },
          },
        },
      };

  const entries: Record<string, Uint8Array> = {
    'meta/persistence-meta.json': strToU8(
      JSON.stringify(
        opts.badProtocol
          ? { schemaVersion: '2.0.0', protocol: 'wrong' }
          : { schemaVersion: '2.0.0', protocol: 'xcs-workspace-v2' },
      ),
    ),
    'project.json': strToU8(
      JSON.stringify({
        __v2__: true,
        version: '2.0.0',
        projectId: 'proj-1',
        projectName: 'Test Project',
        activeCanvasId: canvasId,
        activeDeviceId: deviceId,
        modules: { canvases: [canvasId], devices: [deviceId] },
      }),
    ),
    'profiles.json': strToU8(JSON.stringify({ profiles: { [profileId]: profile } })),
    ...(opts.omitDeviceFile
      ? {}
      : { [`devices/device-${deviceId}.json`]: strToU8(JSON.stringify(deviceJson)) }),
    ...(opts.extraEntries ?? {}),
  };
  if (!opts.omitFormat) {
    entries['.format'] = strToU8('v2');
  }
  return Buffer.from(zipSync(entries));
}

describe('parseXcs (xs / v2)', () => {
  it('parses a minimal F2 Ultra UV .xs file', () => {
    const out = parseXcs(buildXs());
    expect(out.ext_id).toBe('GS009-CLASS-4');
    expect(out.ext_name).toBe('F2 Ultra UV');
    expect(out.light_source).toBe('uv');
    expect(out.xtool_material_id).toBe(1323);
    expect(out.layers).toEqual([
      {
        power: 70,
        speed: 425,
        frequency: 80,
        lpi: 683,
        pulse_width: 100,
        passes: 1,
        cross_hatch: true,
        scan_mode: 'crossMode',
      },
    ]);
  });

  it('parses an F2 (.xs) file (dwellTime key variant)', () => {
    const out = parseXcs(buildXs({ deviceFamily: 'f2' }));
    expect(out.ext_id).toBe('GS006');
    expect(out.light_source).toBe('blue');
    // Same layer extraction — dwellTime vs delayPerLine doesn't affect any
    // ParsedXcsLayer field (it's profile metadata, not a layer parameter).
    expect(out.layers[0].power).toBe(70);
    expect(out.layers[0].speed).toBe(425);
  });

  it('rejects a non-ZIP buffer as not-JSON', () => {
    // Buffer that lacks ZIP magic falls through to the v1 JSON parser.
    expect(() => parseXcs(Buffer.from('not json'))).toThrow(XcsParseError);
  });

  it('rejects a .xs missing the .format marker', () => {
    expect(() => parseXcs(buildXs({ omitFormat: true }))).toThrow(/\.format/);
  });

  it('rejects a .xs with the wrong protocol', () => {
    expect(() => parseXcs(buildXs({ badProtocol: true }))).toThrow(/protocol/);
  });

  it('rejects a .xs missing the active device file', () => {
    expect(() => parseXcs(buildXs({ omitDeviceFile: true }))).toThrow(/device file/);
  });

  it('rejects a .xs whose device has no LASER_PLANE mode', () => {
    expect(() => parseXcs(buildXs({ omitLaserPlane: true }))).toThrow(/LASER_PLANE/);
  });

  it('rejects a .xs with an oversized entry (zip-bomb guard)', () => {
    const huge = new Uint8Array(11 * 1024 * 1024); // 11 MB — over the 10 MB per-entry cap
    expect(() => parseXcs(buildXs({ extraEntries: { 'resources/huge.bin': huge } }))).toThrow(
      /size limit/,
    );
  });
});
