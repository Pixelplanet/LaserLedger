import type { Knex } from 'knex';
import bcrypt from 'bcryptjs';

/**
 * Seed reference data — design doc §5.3.
 * Idempotent: skips if manufacturers already exist.
 */
export async function seed(knex: Knex): Promise<void> {
  const existing = await knex('manufacturers').count<{ c: number }[]>({ c: '*' });
  if (Number(existing[0]?.c ?? 0) > 0) return;

  const now = nowIso();

  // ───── manufacturers ─────
  const [xToolId] = await insert(knex, 'manufacturers', {
    name: 'xTool',
    slug: 'xtool',
    website: 'https://www.xtool.com',
    description: 'Maker of the F2 family of fiber and diode lasers.',
    is_active: true,
    sort_order: 0,
    created_at: now,
    updated_at: now,
  });
  const [virtualId] = await insert(knex, 'manufacturers', {
    name: 'Virtual',
    slug: 'virtual',
    website: null,
    description: 'Virtual devices used for export-only or non-hardware workflows.',
    is_active: true,
    sort_order: 99,
    created_at: now,
    updated_at: now,
  });

  // ───── device families ─────
  const [f2FamilyId] = await insert(knex, 'device_families', {
    manufacturer_id: xToolId,
    name: 'F2 Family',
    slug: 'f2-family',
    description: 'xTool F2 series desktop fiber/diode lasers.',
    sort_order: 0,
    created_at: now,
    updated_at: now,
  });
  const [virtualFamilyId] = await insert(knex, 'device_families', {
    manufacturer_id: virtualId,
    name: 'Virtual Export',
    slug: 'virtual-export',
    description: 'Non-hardware device targets for reusable exported settings.',
    sort_order: 99,
    created_at: now,
    updated_at: now,
  });

  // ───── laser types ─────
  const laserTypes = await insertMany(knex, 'laser_types', [
    {
      name: 'UV',
      slug: 'uv',
      light_source: 'uv',
      wavelength_nm: 355,
      has_pulse_width: false,
      has_mopa_frequency: false,
      processing_type: 'UV_LASER',
      sort_order: 0,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      name: 'MOPA',
      slug: 'mopa',
      light_source: 'red',
      wavelength_nm: 1064,
      has_pulse_width: true,
      has_mopa_frequency: true,
      processing_type: 'MOPA_LASER',
      sort_order: 1,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      name: 'MOPA',
      slug: 'mopa-single',
      light_source: 'red',
      wavelength_nm: 1064,
      has_pulse_width: true,
      has_mopa_frequency: true,
      processing_type: 'MOPA_LASER',
      sort_order: 2,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      name: 'Blue Diode',
      slug: 'blue-ultra',
      light_source: 'blue',
      wavelength_nm: 455,
      has_pulse_width: true,
      has_mopa_frequency: true,
      processing_type: 'BLUE_LASER',
      sort_order: 3,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      name: 'Infrared',
      slug: 'ir',
      light_source: 'red',
      wavelength_nm: 1064,
      has_pulse_width: false,
      has_mopa_frequency: false,
      processing_type: 'IR_LASER',
      sort_order: 4,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      name: 'Blue Diode',
      slug: 'blue-f2',
      light_source: 'blue',
      wavelength_nm: 455,
      has_pulse_width: false,
      has_mopa_frequency: false,
      processing_type: 'BLUE_LASER',
      sort_order: 5,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
  ]);
  const ltUv = laserTypes[0]!;
  const ltMopa = laserTypes[1]!;
  const ltMopaSingle = laserTypes[2]!;
  const ltBlueUltra = laserTypes[3]!;
  const ltIr = laserTypes[4]!;
  const ltBlueF2 = laserTypes[5]!;

  // ───── devices ─────
  const devices = await insertMany(knex, 'devices', [
    {
      family_id: f2FamilyId,
      name: 'F2 Ultra (UV)',
      slug: 'f2-ultra-uv',
      ext_id: 'GS009-CLASS-4',
      ext_name: 'F2 Ultra UV',
      description: 'F2 Ultra with UV laser module.',
      is_active: true,
      sort_order: 0,
      created_at: now,
      updated_at: now,
    },
    {
      family_id: f2FamilyId,
      name: 'F2 Ultra Dual',
      slug: 'f2-ultra-dual',
      ext_id: 'GS009-CLASS-2',
      ext_name: 'F2 Ultra Dual',
      description: 'F2 Ultra with MOPA + Blue Diode lasers.',
      is_active: true,
      sort_order: 1,
      created_at: now,
      updated_at: now,
    },
    {
      family_id: f2FamilyId,
      name: 'F2 Ultra Single',
      slug: 'f2-ultra-single',
      ext_id: 'GS009-CLASS-1',
      ext_name: 'F2 Ultra Single',
      description: 'F2 Ultra with single MOPA laser.',
      is_active: true,
      sort_order: 2,
      created_at: now,
      updated_at: now,
    },
    {
      family_id: f2FamilyId,
      name: 'F2',
      slug: 'f2',
      ext_id: 'GS001',
      ext_name: 'F2',
      description: 'Original F2 with IR + Blue Diode.',
      is_active: true,
      sort_order: 3,
      created_at: now,
      updated_at: now,
    },
    {
      family_id: virtualFamilyId,
      name: 'SVG Vector Export',
      slug: 'svg-vector-export',
      ext_id: 'SVG_EXPORT',
      ext_name: 'SVG Vector Export',
      description: 'Virtual export target for SVG-based workflows.',
      is_active: true,
      sort_order: 99,
      created_at: now,
      updated_at: now,
    },
  ]);
  const f2UltraUv = devices[0]!;
  const f2UltraDual = devices[1]!;
  const f2UltraSingle = devices[2]!;
  const f2 = devices[3]!;

  // ───── device_laser_types junctions ─────
  const dlt = (
    device_id: number,
    laser_type_id: number,
    is_default: boolean,
    power_watts: number[],
  ) => ({
    device_id,
    laser_type_id,
    is_default,
    power_watts: JSON.stringify(power_watts),
  });
  await knex('device_laser_types').insert([
    dlt(f2UltraUv, ltUv, true, [5]),
    dlt(f2UltraDual, ltMopa, true, [60, 40]),
    dlt(f2UltraDual, ltBlueUltra, false, [20]),
    dlt(f2UltraSingle, ltMopaSingle, true, [60]),
    dlt(f2, ltIr, true, [2]),
    dlt(f2, ltBlueF2, false, [20]),
  ]);

  // ───── material categories ─────
  const categories = await insertMany(
    knex,
    'material_categories',
    [
      'Metals',
      'Wood',
      'Acrylic/Plastic',
      'Leather',
      'Glass',
      'Stone',
      'Paper/Cardboard',
      'Fabric',
    ].map((name, i) => ({
      name,
      slug: slugify(name),
      sort_order: i,
      created_at: now,
      updated_at: now,
    })),
  );
  const metalsId = categories[0]!;

  // ───── materials ─────
  await knex('materials').insert([
    {
      category_id: metalsId,
      name: '304 Stainless Steel',
      slug: '304-stainless-steel',
      xtool_material_id: 1323,
      color: 'Silver',
      description: 'Standard 304 stainless steel sheet.',
      is_active: true,
      sort_order: 0,
      created_at: now,
      updated_at: now,
    },
    {
      category_id: metalsId,
      name: 'Titanium',
      slug: 'titanium',
      xtool_material_id: 458,
      color: 'Silver',
      description: 'Grade 2 titanium sheet.',
      is_active: true,
      sort_order: 1,
      created_at: now,
      updated_at: now,
    },
  ]);

  // ───── operation types ─────
  await insertMany(
    knex,
    'operation_types',
    ['Engrave', 'Cut', 'Color Engrave', 'Mark', 'Score'].map((name, i) => ({
      name,
      slug: slugify(name),
      sort_order: i,
      created_at: now,
      updated_at: now,
    })),
  );

  // ───── system settings (defaults) ─────
  const sys = (key: string, value: string) => ({ key, value, updated_at: now });
  await knex('system_settings').insert([
    sys('auto_approve_reputation_threshold', '50'),
    sys('auto_approve_min_approved_submissions', '5'),
    sys('rate_limit_submissions_per_day', '20'),
    sys('rate_limit_votes_per_day', '100'),
    sys('rate_limit_comments_per_day', '50'),
    sys('rate_limit_reports_per_day', '10'),
    sys('image_auto_moderation_enabled', 'false'),
    sys('max_images_per_setting', '5'),
    sys('duplicate_similarity_threshold', '0.9'),
    sys('public_donation_url', 'https://ko-fi.com/laserledger'),
    sys('public_donation_label', 'Support LaserLedger'),
  ]);

  // ───── admin bootstrap ─────
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (adminEmail && adminPassword) {
    const existing = await knex('users').where({ email: adminEmail }).first();
    if (!existing) {
      await knex('users').insert({
        id: hexId(),
        email: adminEmail,
        display_name: 'Administrator',
        password_hash: await bcrypt.hash(adminPassword, 12),
        google_id: null,
        role: 'admin',
        email_verified: true,
        cloudify_user_id: null,
        timezone: null,
        bio: null,
        avatar_url: null,
        submission_count: 0,
        reputation: 0,
        created_at: now,
        updated_at: now,
        last_login_at: null,
      });
    }
  }
}

async function insert(
  knex: Knex,
  table: string,
  row: Record<string, unknown>,
): Promise<[number]> {
  const result = await knex(table).insert(row);
  // SQLite returns [number]; MySQL returns [number]; both work
  return [Number((result as unknown as number[])[0])];
}

async function insertMany(
  knex: Knex,
  table: string,
  rows: Record<string, unknown>[],
): Promise<number[]> {
  // SQLite better-sqlite3 doesn't support RETURNING via Knex insert of arrays well —
  // do per-row inserts so we get the auto-incremented ids reliably.
  const ids: number[] = [];
  for (const row of rows) {
    const r = await knex(table).insert(row);
    ids.push(Number((r as unknown as number[])[0]));
  }
  return ids;
}

function nowIso(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function hexId(): string {
  const chars = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 16; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
