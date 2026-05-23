import type { Knex } from 'knex';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';

// Inlined helpers — keeping this seed self-contained avoids the knex seed
// loader's brittle handling of `.js`-extension TypeScript imports under
// vitest, matching the pattern used in 01_reference_data.ts.
function hexId(): string {
  return randomBytes(8).toString('hex');
}
function uuid(): string {
  return crypto.randomUUID();
}
function nowIso(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150);
}
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './uploads';

/**
 * Demo data seed — gated behind SEED_DEMO_DATA=true.
 *
 * Inserts a "demo" user plus ~24 approved laser settings spanning the
 * reference data (devices × laser types × materials × operations). Each
 * setting gets a procedurally-generated WebP image (original/card/thumb)
 * written into the same {UPLOAD_DIR}/images/YYYY/MM/{uuid}/ layout that
 * processImage() uses, and a matching setting_images row.
 *
 * Idempotent: skips if SEED_DEMO_DATA is not 'true', or if the demo user
 * already exists.
 */
export async function seed(knex: Knex): Promise<void> {
  if (process.env.SEED_DEMO_DATA !== 'true') {
    // eslint-disable-next-line no-console
    console.log('[seed:demo] SEED_DEMO_DATA != "true", skipping');
    return;
  }
  // eslint-disable-next-line no-console
  console.log(`[seed:demo] starting (UPLOAD_DIR=${UPLOAD_DIR})`);

  const demoEmail = 'demo@laserledger.local';
  const existing = await knex('users').where({ email: demoEmail }).first<{ id: string }>();
  if (existing) {
    // eslint-disable-next-line no-console
    console.log(`[seed:demo] demo user already exists (id=${existing.id}), skipping`);
    return;
  }

  const now = nowIso();

  // ─── demo user ─────────────────────────────────────────────────────────
  const userId = hexId();
  await knex('users').insert({
    id: userId,
    email: demoEmail,
    display_name: 'Demo Maker',
    password_hash: await bcrypt.hash('demo-password', 10),
    role: 'user',
    email_verified: true,
    submission_count: 0,
    reputation: 0,
    created_at: now,
    updated_at: now,
    last_login_at: null,
  });

  // ─── load reference rows ───────────────────────────────────────────────
  const devices = await knex('devices').select('id', 'name', 'slug');
  const laserTypes = await knex('laser_types').select('id', 'name', 'slug');
  const materials = await knex('materials').select('id', 'name', 'slug');
  const operations = await knex('operation_types').select('id', 'name', 'slug');

  if (!devices.length || !laserTypes.length || !materials.length || !operations.length) {
    // eslint-disable-next-line no-console
    console.warn('[seed:demo] reference data missing; run the reference seed first');
    return;
  }

  // ─── recipe templates ──────────────────────────────────────────────────
  type Recipe = {
    title: string;
    materialSlug?: string;
    laserSlug?: string;
    operationSlug?: string;
    deviceSlug?: string;
    description: string;
    result_description: string;
    power: number;
    speed: number;
    frequency?: number;
    lpi?: number;
    passes?: number;
    palette: [string, string]; // gradient stops
    pattern: 'lines' | 'dots' | 'spiral' | 'grid';
  };

  const recipes: Recipe[] = [
    {
      title: 'Deep black mark on 304 stainless',
      materialSlug: '304-stainless-steel',
      laserSlug: 'mopa',
      operationSlug: 'mark',
      description: 'High contrast permanent mark with no oxide bloom.',
      result_description: 'Crisp jet-black mark, no surface damage, dishwasher safe.',
      power: 78, speed: 1200, frequency: 40, passes: 1,
      palette: ['#0d1117', '#3d4452'], pattern: 'lines',
    },
    {
      title: 'Color anneal — bronze on titanium',
      materialSlug: 'titanium',
      laserSlug: 'mopa',
      operationSlug: 'color-engrave',
      description: 'Heat-induced oxide for warm bronze tone.',
      result_description: 'Smooth bronze gradient, repeatable across batches.',
      power: 28, speed: 600, frequency: 80, passes: 1,
      palette: ['#c9842c', '#5b2c10'], pattern: 'spiral',
    },
    {
      title: 'Color anneal — sapphire blue on titanium',
      materialSlug: 'titanium',
      laserSlug: 'mopa',
      operationSlug: 'color-engrave',
      description: 'Cooler oxide pass producing deep blue.',
      result_description: 'Royal blue, even coverage, slight directional sheen.',
      power: 32, speed: 800, frequency: 60, passes: 1,
      palette: ['#1e3a8a', '#3b82f6'], pattern: 'lines',
    },
    {
      title: 'Color anneal — emerald green on titanium',
      materialSlug: 'titanium',
      laserSlug: 'mopa',
      operationSlug: 'color-engrave',
      description: 'Mid-temp oxide producing rich green.',
      result_description: 'Deep emerald with subtle teal edges.',
      power: 35, speed: 900, frequency: 50, passes: 1,
      palette: ['#0f5132', '#10b981'], pattern: 'grid',
    },
    {
      title: 'Frosted vector engrave — 304 stainless',
      materialSlug: '304-stainless-steel',
      laserSlug: 'blue-ultra',
      operationSlug: 'engrave',
      description: 'Light surface texture for tactile logos.',
      result_description: 'Matte frosted finish, easily readable in raking light.',
      power: 55, speed: 1800, frequency: 30, passes: 2,
      palette: ['#7d8590', '#c9d1d9'], pattern: 'dots',
    },
    {
      title: 'High-contrast UV mark on stainless',
      materialSlug: '304-stainless-steel',
      laserSlug: 'uv',
      operationSlug: 'mark',
      description: 'Cold mark with no thermal halo.',
      result_description: 'Hairline-precise dark mark, ideal for medical parts.',
      power: 65, speed: 800, frequency: 60, passes: 1,
      palette: ['#0d1117', '#58a6ff'], pattern: 'grid',
    },
    {
      title: 'Deep engrave with 4 passes — titanium',
      materialSlug: 'titanium',
      laserSlug: 'ir',
      operationSlug: 'engrave',
      description: 'Progressive defocus across passes for depth.',
      result_description: '~0.15 mm cavity, clean walls.',
      power: 95, speed: 400, frequency: 30, passes: 4,
      palette: ['#3f3f46', '#a1a1aa'], pattern: 'spiral',
    },
    {
      title: 'Score line for jewelry blanks — stainless',
      materialSlug: '304-stainless-steel',
      laserSlug: 'mopa',
      operationSlug: 'score',
      description: 'Single-pass guide line, no through-cut.',
      result_description: 'Visible from both sides, no slag.',
      power: 60, speed: 1500, frequency: 35, passes: 1,
      palette: ['#1f6feb', '#a5d6ff'], pattern: 'lines',
    },
    {
      title: 'Photo engrave — half-tone on stainless',
      materialSlug: '304-stainless-steel',
      laserSlug: 'mopa',
      operationSlug: 'engrave',
      description: 'Stucki dither at 318 LPI for portraits.',
      result_description: 'Smooth tonal range, no banding.',
      power: 45, speed: 2200, frequency: 40, lpi: 318, passes: 1,
      palette: ['#161b22', '#8b949e'], pattern: 'dots',
    },
    {
      title: 'Rainbow anneal swatch — titanium',
      materialSlug: 'titanium',
      laserSlug: 'mopa',
      operationSlug: 'color-engrave',
      description: 'Sweep of power 20→45 across one tile.',
      result_description: 'Full anneal palette in one engraving pass.',
      power: 30, speed: 700, frequency: 70, passes: 1,
      palette: ['#a855f7', '#f97316'], pattern: 'lines',
    },
    {
      title: 'Black mark with UV — stainless',
      materialSlug: '304-stainless-steel',
      laserSlug: 'uv',
      operationSlug: 'mark',
      description: 'Slow UV pass for jet-black no-burn finish.',
      result_description: 'No discoloration around the mark.',
      power: 70, speed: 600, frequency: 50, passes: 1,
      palette: ['#0d1117', '#21262d'], pattern: 'grid',
    },
    {
      title: 'Tile-grid texture engrave — stainless',
      materialSlug: '304-stainless-steel',
      laserSlug: 'ir',
      operationSlug: 'engrave',
      description: 'Cross-hatched defocus for grippy texture.',
      result_description: 'Knurl-like surface, good adhesion for paint.',
      power: 70, speed: 1100, frequency: 30, passes: 2,
      palette: ['#4b5563', '#d1d5db'], pattern: 'grid',
    },
  ];

  // Build a fast slug → id lookup helper.
  const findId = (rows: { id: number; slug: string }[], slug?: string): number => {
    if (slug) {
      const hit = rows.find((r) => r.slug === slug);
      if (hit) return hit.id;
    }
    return rows[0]!.id;
  };

  const allIds: Array<{ deviceId: number; laserId: number; materialId: number; opId: number }> = [];

  for (let i = 0; i < recipes.length; i += 1) {
    const recipe = recipes[i]!;

    const deviceId = findId(devices, recipe.deviceSlug);
    const laserId = findId(laserTypes, recipe.laserSlug);
    const materialId = findId(materials, recipe.materialSlug);
    const opId = findId(operations, recipe.operationSlug);
    allIds.push({ deviceId, laserId, materialId, opId });

    const settingUuid = uuid();
    const [settingId] = await knex('laser_settings').insert({
      uuid: settingUuid,
      title: recipe.title,
      description: recipe.description,
      device_id: deviceId,
      laser_type_id: laserId,
      material_id: materialId,
      operation_type_id: opId,
      power: recipe.power,
      speed: recipe.speed,
      frequency: recipe.frequency ?? null,
      lpi: recipe.lpi ?? null,
      passes: recipe.passes ?? 1,
      result_description: recipe.result_description,
      submitted_by: userId,
      status: 'approved',
      vote_score: Math.floor(Math.random() * 25),
      view_count: Math.floor(Math.random() * 500) + 20,
      comment_count: Math.floor(Math.random() * 6),
      moderated_by: userId,
      moderated_at: now,
      created_at: now,
      updated_at: now,
    });
    const newSettingId = Number((settingId as unknown as number) ?? settingId);

    // Generate procedural image variants.
    const writeResult = await writeDemoImage({
      title: recipe.title,
      subtitle: `${recipe.power}% · ${recipe.speed} mm/s`,
      palette: recipe.palette,
      pattern: recipe.pattern,
    });

    await knex('setting_images').insert({
      uuid: writeResult.imageUuid,
      setting_id: newSettingId,
      uploaded_by: userId,
      original_filename: `${slugify(recipe.title)}.webp`,
      stored_path: writeResult.storedPath,
      thumbnail_path: writeResult.thumbnailPath,
      card_path: writeResult.cardPath,
      mime_type: 'image/webp',
      file_size: writeResult.fileSize,
      width: writeResult.width,
      height: writeResult.height,
      caption: recipe.result_description,
      status: 'approved',
      moderated_by: userId,
      moderated_at: now,
      sort_order: 0,
      is_primary: true,
      created_at: now,
    });
  }

  // eslint-disable-next-line no-console
  console.log(`[seed:demo] inserted ${recipes.length} approved demo settings`);
}

// ─────────────────────────────────────────────────────────────────────────
// Procedural image generator — writes original/card/thumb webp variants
// into the same {UPLOAD_DIR}/images/YYYY/MM/{uuid}/ layout that
// services/images.ts uses, so they're served by the normal /api/uploads route.
// ─────────────────────────────────────────────────────────────────────────
async function writeDemoImage(opts: {
  title: string;
  subtitle: string;
  palette: [string, string];
  pattern: 'lines' | 'dots' | 'spiral' | 'grid';
}): Promise<{
  imageUuid: string;
  storedPath: string;
  cardPath: string;
  thumbnailPath: string;
  fileSize: number;
  width: number;
  height: number;
}> {
  const id = uuid();
  const now = new Date();
  const yy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dirRel = path.posix.join('images', yy, mm, id);
  const dirAbs = path.join(UPLOAD_DIR, dirRel);
  await fs.mkdir(dirAbs, { recursive: true });

  const svg = buildSvg(1600, 1200, opts);
  const sourceBuffer = Buffer.from(svg);

  const original = await sharp(sourceBuffer)
    .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer({ resolveWithObject: true });

  const card = await sharp(sourceBuffer)
    .resize({ width: 800, height: 600, fit: 'cover' })
    .webp({ quality: 80 })
    .toBuffer();

  const thumb = await sharp(sourceBuffer)
    .resize({ width: 400, height: 300, fit: 'cover' })
    .webp({ quality: 75 })
    .toBuffer();

  await Promise.all([
    fs.writeFile(path.join(dirAbs, 'original.webp'), original.data),
    fs.writeFile(path.join(dirAbs, 'card.webp'), card),
    fs.writeFile(path.join(dirAbs, 'thumb.webp'), thumb),
  ]);

  return {
    imageUuid: id,
    storedPath: path.posix.join(dirRel, 'original.webp'),
    cardPath: path.posix.join(dirRel, 'card.webp'),
    thumbnailPath: path.posix.join(dirRel, 'thumb.webp'),
    fileSize: original.info.size,
    width: original.info.width,
    height: original.info.height,
  };
}

function buildSvg(
  width: number,
  height: number,
  opts: {
    title: string;
    subtitle: string;
    palette: [string, string];
    pattern: 'lines' | 'dots' | 'spiral' | 'grid';
  },
): string {
  const [c1, c2] = opts.palette;
  const patternDefs = patternDefSvg(opts.pattern, c1, c2);
  const titleEsc = escapeXml(opts.title);
  const subtitleEsc = escapeXml(opts.subtitle);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <radialGradient id="vignette" cx="50%" cy="40%" r="75%">
      <stop offset="60%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.55)"/>
    </radialGradient>
    ${patternDefs}
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" fill="url(#pattern)" opacity="0.55"/>
  <rect width="100%" height="100%" fill="url(#vignette)"/>
  <g font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif" fill="#fff">
    <text x="60" y="${height - 110}" font-size="64" font-weight="700" stroke="rgba(0,0,0,0.35)" stroke-width="2">${titleEsc}</text>
    <text x="62" y="${height - 50}" font-size="38" font-weight="500" opacity="0.85">${subtitleEsc}</text>
  </g>
</svg>`;
}

function patternDefSvg(kind: 'lines' | 'dots' | 'spiral' | 'grid', c1: string, c2: string): string {
  switch (kind) {
    case 'lines':
      return `<pattern id="pattern" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
                <line x1="0" y1="0" x2="0" y2="22" stroke="${c2}" stroke-opacity="0.45" stroke-width="2"/>
              </pattern>`;
    case 'dots':
      return `<pattern id="pattern" width="28" height="28" patternUnits="userSpaceOnUse">
                <circle cx="14" cy="14" r="3.5" fill="${c2}" fill-opacity="0.55"/>
              </pattern>`;
    case 'grid':
      return `<pattern id="pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M40 0H0V40" stroke="${c2}" stroke-opacity="0.45" stroke-width="1.5" fill="none"/>
              </pattern>`;
    case 'spiral':
    default:
      return `<pattern id="pattern" width="48" height="48" patternUnits="userSpaceOnUse">
                <circle cx="24" cy="24" r="20" stroke="${c2}" stroke-opacity="0.4" stroke-width="1.5" fill="none"/>
                <circle cx="24" cy="24" r="13" stroke="${c1}" stroke-opacity="0.5" stroke-width="1.5" fill="none"/>
                <circle cx="24" cy="24" r="6" stroke="${c2}" stroke-opacity="0.55" stroke-width="1.5" fill="none"/>
              </pattern>`;
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
