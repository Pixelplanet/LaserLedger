import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { nowIso } from '../utils/ids.js';

const app = createApp();
const ORIGIN = 'http://localhost:5173';

const OWNER_ID = 'verifyowner00001';

async function seedOwner(): Promise<void> {
  const now = nowIso();
  await db('users').insert({
    id: OWNER_ID,
    email: 'verifyowner@example.com',
    display_name: 'Verify Owner',
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

async function insertApprovedSetting(uuid: string): Promise<number> {
  const now = nowIso();
  const [id] = await db('laser_settings').insert({
    uuid,
    title: `Verify Setting ${uuid.slice(0, 6)}`,
    description: null,
    device_id: 1,
    laser_type_id: 1,
    material_id: 1,
    operation_type_id: 1,
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
    quality_rating: null,
    submitted_by: OWNER_ID,
    status: 'approved',
    moderated_by: OWNER_ID,
    moderated_at: now,
    rejection_reason: null,
    vote_score: 0,
    view_count: 0,
    comment_count: 0,
    created_at: now,
    updated_at: now,
  });
  return id as number;
}

async function registerVerified(email: string): Promise<string[]> {
  const reg = await request(app)
    .post('/api/auth/register')
    .set('Origin', ORIGIN)
    .send({ email, password: 'SuperSecret1!', display_name: email.split('@')[0] });
  expect(reg.status).toBe(201);
  await db('users').where({ email }).update({ email_verified: true });
  return reg.headers['set-cookie'];
}

describe('verification (integration)', () => {
  beforeEach(async () => {
    await seedOwner();
  });

  it('records a verification, updates counts, and exposes them on detail', async () => {
    const uuid = 'verify-uuid-000000000000000000000001';
    await insertApprovedSetting(uuid);
    const cookie = await registerVerified('verifier1@example.com');

    const post = await request(app)
      .post(`/api/settings/${uuid}/verify`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({ outcome: 'worked', note: 'Clean cut on first pass' });
    expect(post.status).toBe(200);
    expect(post.body.data.worked).toBe(1);
    expect(post.body.data.failed).toBe(0);
    expect(post.body.data.mine.outcome).toBe('worked');

    const detail = await request(app).get(`/api/settings/${uuid}`).set('Cookie', cookie);
    expect(detail.status).toBe(200);
    expect(detail.body.data.verified_worked_count).toBe(1);
    expect(detail.body.data.verification.worked).toBe(1);
    expect(detail.body.data.verification.mine.outcome).toBe('worked');
  });

  it('updates an existing verification instead of duplicating, then removes it', async () => {
    const uuid = 'verify-uuid-000000000000000000000002';
    await insertApprovedSetting(uuid);
    const cookie = await registerVerified('verifier2@example.com');

    await request(app)
      .post(`/api/settings/${uuid}/verify`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({ outcome: 'worked' });
    const changed = await request(app)
      .post(`/api/settings/${uuid}/verify`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({ outcome: 'failed', note: 'Scorched edges' });
    expect(changed.status).toBe(200);
    expect(changed.body.data.worked).toBe(0);
    expect(changed.body.data.failed).toBe(1);

    const removed = await request(app)
      .delete(`/api/settings/${uuid}/verify`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie);
    expect(removed.status).toBe(200);
    expect(removed.body.data.worked).toBe(0);
    expect(removed.body.data.failed).toBe(0);
    expect(removed.body.data.mine).toBeNull();
  });

  it('forbids verifying your own setting', async () => {
    const uuid = 'verify-uuid-000000000000000000000003';
    const settingId = await insertApprovedSetting(uuid);
    // Owner registers/logs in to obtain a session cookie tied to OWNER_ID.
    // Re-point the setting to the freshly registered user instead.
    const cookie = await registerVerified('selfverify@example.com');
    const newUser = await db('users').where({ email: 'selfverify@example.com' }).first<{ id: string }>();
    await db('laser_settings').where({ id: settingId }).update({ submitted_by: newUser!.id });

    const post = await request(app)
      .post(`/api/settings/${uuid}/verify`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({ outcome: 'worked' });
    expect(post.status).toBe(400);
  });
});
