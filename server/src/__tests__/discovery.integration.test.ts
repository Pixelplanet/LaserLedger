import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { nowIso } from '../utils/ids.js';

const app = createApp();

const USER_ID = 'dddddddddddddddd';

async function seedUser(): Promise<void> {
  const now = nowIso();
  await db('users').insert({
    id: USER_ID,
    email: 'discovery@example.com',
    display_name: 'Discovery User',
    password_hash: '$2a$12$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    google_id: null,
    role: 'user',
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

interface SettingOverrides {
  uuid: string;
  device_id?: number;
  material_id?: number;
  operation_type_id?: number;
  laser_type_id?: number;
  vote_score?: number;
  quality_rating?: number | null;
  status?: string;
}

async function insertSetting(o: SettingOverrides): Promise<number> {
  const now = nowIso();
  const [id] = await db('laser_settings').insert({
    uuid: o.uuid,
    title: `Setting ${o.uuid.slice(0, 8)}`,
    description: null,
    device_id: o.device_id ?? 1,
    laser_type_id: o.laser_type_id ?? 1,
    material_id: o.material_id ?? 1,
    operation_type_id: o.operation_type_id ?? 1,
    power: 40,
    speed: 800,
    frequency: null,
    lpi: null,
    pulse_width: null,
    passes: 1,
    cross_hatch: false,
    focus_offset: null,
    scan_mode: null,
    extra_params: null,
    result_description: null,
    result_image_url: null,
    source_xcs: null,
    quality_rating: o.quality_rating ?? null,
    submitted_by: USER_ID,
    status: o.status ?? 'approved',
    moderated_by: USER_ID,
    moderated_at: now,
    rejection_reason: null,
    vote_score: o.vote_score ?? 0,
    view_count: 0,
    comment_count: 0,
    created_at: now,
    updated_at: now,
  });
  return id as number;
}

async function insertApprovedImage(settingId: number, uuid: string): Promise<void> {
  const now = nowIso();
  await db('setting_images').insert({
    uuid,
    setting_id: settingId,
    uploaded_by: USER_ID,
    original_filename: 'result.jpg',
    stored_path: `/uploads/${uuid}.jpg`,
    thumbnail_path: `/uploads/${uuid}-thumb.jpg`,
    card_path: `/uploads/${uuid}-card.jpg`,
    mime_type: 'image/jpeg',
    file_size: 1024,
    width: 800,
    height: 600,
    caption: null,
    status: 'approved',
    moderated_by: USER_ID,
    moderated_at: now,
    rejected_reason: null,
    sort_order: 0,
    is_primary: true,
    created_at: now,
  });
}

describe('device overview endpoint', () => {
  beforeEach(async () => {
    await seedUser();
  });

  it('returns device, supported lasers, and best-per-pair rollup', async () => {
    // Two settings for the same (material 1, operation 1) pair — higher vote wins.
    await insertSetting({ uuid: '10000000-0000-4000-8000-000000000001', material_id: 1, operation_type_id: 1, vote_score: 5 });
    await insertSetting({ uuid: '10000000-0000-4000-8000-000000000002', material_id: 1, operation_type_id: 1, vote_score: 10 });
    // A different material → second pair.
    await insertSetting({ uuid: '10000000-0000-4000-8000-000000000003', material_id: 2, operation_type_id: 1, vote_score: 3 });

    const r = await request(app).get('/api/devices/f2-ultra-uv/overview');
    expect(r.status).toBe(200);
    expect(r.body.data.device.slug).toBe('f2-ultra-uv');
    expect(Array.isArray(r.body.data.laser_types)).toBe(true);
    expect(r.body.data.laser_types.length).toBeGreaterThan(0);
    expect(r.body.data.stats.approved_settings).toBe(3);
    expect(r.body.data.stats.materials_covered).toBe(2);

    const best = r.body.data.best_settings as Array<{ material_id: number; operation_type_id: number; uuid: string; vote_score: number }>;
    expect(best.length).toBe(2);
    const pairOne = best.find((b) => b.material_id === 1 && b.operation_type_id === 1);
    expect(pairOne?.uuid).toBe('10000000-0000-4000-8000-000000000002');
    expect(pairOne?.vote_score).toBe(10);
  });

  it('returns 404 for an unknown slug', async () => {
    const r = await request(app).get('/api/devices/does-not-exist/overview');
    expect(r.status).toBe(404);
  });
});

describe('gallery endpoint', () => {
  beforeEach(async () => {
    await seedUser();
  });

  it('returns only approved settings that have an approved image', async () => {
    const withImage = await insertSetting({ uuid: '20000000-0000-4000-8000-000000000001', vote_score: 1 });
    await insertApprovedImage(withImage, '20000000-0000-4000-8000-0000000000a1');
    // A setting with no image must not appear.
    await insertSetting({ uuid: '20000000-0000-4000-8000-000000000002', vote_score: 2 });

    const r = await request(app).get('/api/gallery');
    expect(r.status).toBe(200);
    expect(r.body.data.total).toBe(1);
    expect(r.body.data.items.length).toBe(1);
    const item = r.body.data.items[0];
    expect(item.uuid).toBe('20000000-0000-4000-8000-000000000001');
    expect(item.image).toBeTruthy();
    expect(item.image.card_path).toBe('/uploads/20000000-0000-4000-8000-0000000000a1-card.jpg');
  });

  it('paginates results', async () => {
    for (let i = 0; i < 3; i++) {
      const sid = await insertSetting({ uuid: `30000000-0000-4000-8000-00000000000${i}`, vote_score: i });
      await insertApprovedImage(sid, `30000000-0000-4000-8000-0000000000b${i}`);
    }
    const r = await request(app).get('/api/gallery?page=1&limit=2');
    expect(r.status).toBe(200);
    expect(r.body.data.total).toBe(3);
    expect(r.body.data.items.length).toBe(2);
    expect(r.body.data.limit).toBe(2);
  });
});
