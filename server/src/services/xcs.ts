/**
 * XCS file parser — extracts laser parameters from xTool Creative Space files.
 * Reference: DESIGN_DOCUMENT §9.
 *
 * Strict extraction only — never evaluates XCS contents (security: §16.3).
 */

export interface ParsedXcsLayer {
  power: number | null;
  speed: number | null;
  frequency: number | null;
  lpi: number | null;
  pulse_width: number | null;
  passes: number | null;
  cross_hatch: boolean | null;
  scan_mode: string | null;
}

type LayerSource = Record<string, unknown>;

export interface ParsedXcs {
  ext_id: string | null;
  ext_name: string | null;
  light_source: string | null;
  xtool_material_id: number | null;
  layers: ParsedXcsLayer[];
}

export class XcsParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XcsParseError';
  }
}

const MAX_XCS_BYTES = 5 * 1024 * 1024; // 5 MB

/** Parse an XCS file (raw text or buffer) into structured fields. */
export function parseXcs(input: string | Buffer): ParsedXcs {
  const text = Buffer.isBuffer(input) ? input.toString('utf-8') : input;
  if (text.length === 0) throw new XcsParseError('Empty XCS file');
  if (text.length > MAX_XCS_BYTES) throw new XcsParseError('XCS file too large');

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new XcsParseError('XCS file is not valid JSON');
  }
  if (!isObject(json)) throw new XcsParseError('XCS root must be an object');

  const ext_id = firstString(json, [
    ['extId'],
    ['ext_id'],
    ['device', 'extId'],
    ['device', 'ext_id'],
    ['device', 'id'],
    ['machine', 'extId'],
  ]);
  const ext_name = firstString(json, [
    ['extName'],
    ['ext_name'],
    ['device', 'extName'],
    ['device', 'ext_name'],
    ['device', 'name'],
    ['machine', 'name'],
  ]);

  const lightSource = firstString(json, [
    ['device', 'data', 'value', 0, 1, 'data', 'LASER_PLANE', 'lightSourceMode'],
    ['device', 'lightSourceMode'],
    ['device', 'lightSource'],
    ['device', 'light_source'],
    ['project', 'lightSourceMode'],
  ]);
  const xtoolMaterial = firstNumber(json, [
    ['device', 'data', 'value', 0, 1, 'data', 'LASER_PLANE', 'material'],
    ['material'],
    ['materialId'],
    ['material_id'],
    ['project', 'material'],
    ['project', 'materialId'],
    ['project', 'material_id'],
  ]);

  const layers = collectLayers(json);

  return {
    ext_id,
    ext_name,
    light_source: lightSource ?? null,
    xtool_material_id: xtoolMaterial ?? null,
    layers: deduplicateLayers(layers),
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function numOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function stringOrNull(v: unknown): string | null {
  if (typeof v === 'string' && v.trim() !== '') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

function intOrNull(v: unknown): number | null {
  const n = numOrNull(v);
  return n === null ? null : Math.round(n);
}

function boolOrNull(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    if (v.toLowerCase() === 'true') return true;
    if (v.toLowerCase() === 'false') return false;
  }
  return null;
}

function firstString(root: unknown, paths: (string | number)[][]): string | null {
  for (const path of paths) {
    const value = stringOrNull(pickUnknown(root, path));
    if (value !== null) return value;
  }
  return null;
}

function firstNumber(root: unknown, paths: (string | number)[][]): number | null {
  for (const path of paths) {
    const value = numOrNull(pickUnknown(root, path));
    if (value !== null) return value;
  }
  return null;
}

function firstValue(source: LayerSource, keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined) return source[key];
  }
  return undefined;
}

function layerFrom(source: LayerSource): ParsedXcsLayer | null {
  const layer = {
    power: numOrNull(firstValue(source, ['power', 'powerPercent'])),
    speed: numOrNull(firstValue(source, ['speed', 'speedMmS', 'speed_mm_s'])),
    frequency: numOrNull(firstValue(source, ['frequency', 'freq'])),
    lpi: intOrNull(firstValue(source, ['density', 'lpi'])),
    pulse_width: intOrNull(firstValue(source, ['pulseWidth', 'pulse_width'])),
    passes: intOrNull(firstValue(source, ['repeat', 'passes', 'pass'])),
    cross_hatch: boolOrNull(firstValue(source, ['crossAngle', 'crossHatch', 'cross_hatch'])),
    scan_mode: stringOrNull(firstValue(source, ['bitmapScanMode', 'scanMode', 'scan_mode'])),
  };
  if (Object.values(layer).every((value) => value === null)) return null;
  return layer;
}

function collectLayers(root: unknown): ParsedXcsLayer[] {
  const layers: ParsedXcsLayer[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!isObject(value)) return;

    const candidates = [
      pick<Record<string, unknown>>(value, ['parameter', 'customize'], 'object'),
      pick<Record<string, unknown>>(value, ['settings'], 'object'),
      pick<Record<string, unknown>>(value, ['customize'], 'object'),
      pick<Record<string, unknown>>(value, ['processParams'], 'object'),
      value,
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;
      const layer = layerFrom(candidate);
      if (layer) layers.push(layer);
    }

    for (const child of Object.values(value)) visit(child);
  };

  visit(root);
  return deduplicateLayers(layers);
}

function pickUnknown(root: unknown, path: (string | number)[]): unknown {
  let cur: unknown = root;
  for (const key of path) {
    if (typeof key === 'number') {
      if (!Array.isArray(cur)) return null;
      cur = cur[key];
    } else {
      if (!isObject(cur)) return null;
      cur = cur[key];
    }
    if (cur === undefined || cur === null) return null;
  }
  return cur;
}

function pick<T>(
  root: unknown,
  path: (string | number)[],
  expect: 'string' | 'number' | 'object',
): T | null {
  const cur = pickUnknown(root, path);
  if (expect === 'string' && typeof cur === 'string') return cur as T;
  if (expect === 'number' && typeof cur === 'number') return cur as T;
  if (expect === 'object' && isObject(cur)) return cur as T;
  return null;
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
