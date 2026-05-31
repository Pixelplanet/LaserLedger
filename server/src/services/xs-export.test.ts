import { describe, it, expect } from 'vitest';
import { exportSetting, buildXcsV1, buildXsV2, decodeSource, type ExportableSetting } from './xs-export.js';
import { parseXcs } from './xcs.js';

function base(overrides: Partial<ExportableSetting> = {}): ExportableSetting {
  return {
    title: 'Walnut Cut Test',
    power: 80,
    speed: 120,
    frequency: 30000,
    lpi: 254,
    pulse_width: 200,
    passes: 2,
    cross_hatch: true,
    scan_mode: 'bidirectional',
    source_xcs: null,
    source_format: null,
    ...overrides,
  };
}

describe('xs-export writer fallback', () => {
  it('builds a v1 .xcs that round-trips through parseXcs', () => {
    const buf = buildXcsV1(base());
    const parsed = parseXcs(buf);
    expect(parsed.layers).toHaveLength(1);
    const layer = parsed.layers[0];
    expect(layer.power).toBe(80);
    expect(layer.speed).toBe(120);
    expect(layer.frequency).toBe(30000);
    expect(layer.lpi).toBe(254);
    expect(layer.pulse_width).toBe(200);
    expect(layer.passes).toBe(2);
    expect(layer.cross_hatch).toBe(true);
    expect(layer.scan_mode).toBe('bidirectional');
  });

  it('builds a v2 .xs ZIP that round-trips through parseXcs (auto-detect)', () => {
    const buf = buildXsV2(base());
    const parsed = parseXcs(buf);
    expect(parsed.layers).toHaveLength(1);
    const layer = parsed.layers[0];
    expect(layer.power).toBe(80);
    expect(layer.speed).toBe(120);
    expect(layer.lpi).toBe(254);
    expect(layer.passes).toBe(2);
  });

  it('omits null parameters from the generated file', () => {
    const buf = buildXcsV1(base({ frequency: null, pulse_width: null }));
    const parsed = parseXcs(buf);
    expect(parsed.layers[0].frequency).toBeNull();
    expect(parsed.layers[0].pulse_width).toBeNull();
    expect(parsed.layers[0].power).toBe(80);
  });
});

describe('xs-export passthrough', () => {
  it('serves the original .xcs bytes unmodified', () => {
    const original = JSON.stringify({ extId: 'F1', canvas: [{ parameter: { power: 50 } }] });
    const setting = base({ source_xcs: original, source_format: 'xcs' });
    const result = exportSetting(setting, 'xcs');
    expect(result.passthrough).toBe(true);
    expect(result.buffer.toString('utf-8')).toBe(original);
    expect(result.contentType).toBe('application/json');
    expect(result.filename).toBe('walnut-cut-test.xcs');
  });

  it('serves the original .xs bytes (base64-decoded) byte-identically', () => {
    const realXs = buildXsV2(base());
    const setting = base({ source_xcs: realXs.toString('base64'), source_format: 'xs' });
    const result = exportSetting(setting, 'xs');
    expect(result.passthrough).toBe(true);
    expect(result.buffer.equals(realXs)).toBe(true);
    expect(result.contentType).toBe('application/zip');
    expect(result.filename).toBe('walnut-cut-test.xs');
  });

  it('falls back to the writer when the source format differs', () => {
    const setting = base({ source_xcs: '{"a":1}', source_format: 'xcs' });
    const result = exportSetting(setting, 'xs');
    expect(result.passthrough).toBe(false);
    // generated .xs must still parse
    const parsed = parseXcs(result.buffer);
    expect(parsed.layers).toHaveLength(1);
  });

  it('decodeSource returns null when there is no matching source', () => {
    expect(decodeSource(base(), 'xcs')).toBeNull();
    expect(decodeSource(base({ source_xcs: 'x', source_format: 'xs' }), 'xcs')).toBeNull();
  });
});
