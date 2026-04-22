import { describe, expect, it } from 'vitest';
import { parseXcs, XcsParseError } from './xcs.js';

describe('parseXcs', () => {
  it('rejects empty input', () => {
    expect(() => parseXcs('')).toThrow(XcsParseError);
  });

  it('rejects non-JSON input', () => {
    expect(() => parseXcs('not json')).toThrow(XcsParseError);
  });

  it('rejects non-object root', () => {
    expect(() => parseXcs('[]')).toThrow(XcsParseError);
  });

  it('parses minimal valid XCS', () => {
    const xcs = JSON.stringify({
      extId: 'GS009-CLASS-4',
      device: {
        data: {
          value: [
            [
              null,
              {
                data: {
                  LASER_PLANE: { lightSourceMode: '355nm', material: 1323 },
                },
              },
            ],
          ],
        },
      },
      canvas: [],
    });
    const out = parseXcs(xcs);
    expect(out.ext_id).toBe('GS009-CLASS-4');
    expect(out.ext_name).toBeNull();
    expect(out.light_source).toBe('355nm');
    expect(out.xtool_material_id).toBe(1323);
    expect(out.layers).toEqual([]);
  });

  it('extracts layer parameters', () => {
    const xcs = JSON.stringify({
      extId: 'GS009-CLASS-4',
      canvas: [
        {
          displays: [
            {
              data: {
                node1: {
                  parameter: {
                    customize: {
                      power: 50,
                      speed: 1000,
                      frequency: 30,
                      density: 254,
                      pulseWidth: 100,
                      repeat: 2,
                      crossAngle: true,
                      bitmapScanMode: 'normal',
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    });
    const out = parseXcs(xcs);
    expect(out.layers).toHaveLength(1);
    expect(out.layers[0]).toEqual({
      power: 50,
      speed: 1000,
      frequency: 30,
      lpi: 254,
      pulse_width: 100,
      passes: 2,
      cross_hatch: true,
      scan_mode: 'normal',
    });
  });

  it('deduplicates identical layers', () => {
    const layer = {
      parameter: {
        customize: { power: 80, speed: 500, frequency: 20, density: 200 },
      },
    };
    const xcs = JSON.stringify({
      canvas: [{ displays: [{ data: { a: layer, b: layer } }] }],
    });
    const out = parseXcs(xcs);
    expect(out.layers).toHaveLength(1);
  });

  it('handles missing optional fields with nulls', () => {
    const xcs = JSON.stringify({
      canvas: [
        {
          displays: [
            { data: { n: { parameter: { customize: { power: 10, speed: 200 } } } } },
          ],
        },
      ],
    });
    const out = parseXcs(xcs);
    expect(out.layers[0].power).toBe(10);
    expect(out.layers[0].frequency).toBeNull();
    expect(out.layers[0].lpi).toBeNull();
    expect(out.ext_id).toBeNull();
    expect(out.ext_name).toBeNull();
    expect(out.light_source).toBeNull();
  });

  it('extracts extName when present', () => {
    const xcs = JSON.stringify({ extId: 'GS001', extName: 'F2' });
    const out = parseXcs(xcs);
    expect(out.ext_name).toBe('F2');
  });

  it('rejects oversized files', () => {
    const huge = 'x'.repeat(6 * 1024 * 1024);
    expect(() => parseXcs(huge)).toThrow(XcsParseError);
  });
});
