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

export interface ParsedXcs {
  ext_id: string | null;
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

  const ext_id = typeof json.extId === 'string' ? json.extId : null;

  const lightSource = pick<string>(
    json,
    ['device', 'data', 'value', 0, 1, 'data', 'LASER_PLANE', 'lightSourceMode'],
    'string',
  );
  const xtoolMaterial = pick<number>(
    json,
    ['device', 'data', 'value', 0, 1, 'data', 'LASER_PLANE', 'material'],
    'number',
  );

  const layers: ParsedXcsLayer[] = [];
  const canvas = (json as Record<string, unknown>).canvas;
  if (Array.isArray(canvas) && isObject(canvas[0])) {
    const displays = (canvas[0] as Record<string, unknown>).displays;
    if (Array.isArray(displays)) {
      for (const display of displays) {
        if (!isObject(display)) continue;
        const data = display.data;
        if (!isObject(data)) continue;
        for (const node of Object.values(data)) {
          if (!isObject(node)) continue;
          const customize = pick<Record<string, unknown>>(
            node,
            ['parameter', 'customize'],
            'object',
          );
          if (!customize) continue;
          layers.push({
            power: numOrNull(customize.power),
            speed: numOrNull(customize.speed),
            frequency: numOrNull(customize.frequency),
            lpi: intOrNull(customize.density),
            pulse_width: intOrNull(customize.pulseWidth),
            passes: intOrNull(customize.repeat),
            cross_hatch: typeof customize.crossAngle === 'boolean' ? customize.crossAngle : null,
            scan_mode: typeof customize.bitmapScanMode === 'string' ? customize.bitmapScanMode : null,
          });
        }
      }
    }
  }

  return {
    ext_id,
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
function intOrNull(v: unknown): number | null {
  const n = numOrNull(v);
  return n === null ? null : Math.round(n);
}

function pick<T>(
  root: unknown,
  path: (string | number)[],
  expect: 'string' | 'number' | 'object',
): T | null {
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
