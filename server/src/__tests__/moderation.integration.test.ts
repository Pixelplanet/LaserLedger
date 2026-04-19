import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';

const app = createApp();
const ORIGIN = 'http://localhost:5173';

async function makeUser(email: string, role: 'user' | 'moderator' | 'admin' = 'user') {
  const reg = await request(app)
    .post('/api/auth/register')
    .set('Origin', ORIGIN)
    .send({ email, password: 'TestPass1!', display_name: email.split('@')[0] });
  expect(reg.status).toBe(201);
  await db('users').where({ email }).update({ email_verified: true, role });
  const login = await request(app)
    .post('/api/auth/login')
    .set('Origin', ORIGIN)
    .send({ email, password: 'TestPass1!' });
  expect(login.status).toBe(200);
  return login.headers['set-cookie'] as unknown as string[];
}

async function submit(cookies: string[], title: string) {
  const r = await request(app)
    .post('/api/settings')
    .set('Origin', ORIGIN)
    .set('Cookie', cookies)
    .send({
      title,
      device_id: 1,
      laser_type_id: 1,
      material_id: 1,
      operation_type_id: 1,
      power: 50,
      speed: 1000,
      passes: 1,
    });
  expect(r.status).toBe(201);
  return r.body.data.uuid as string;
}

describe('moderation flow', () => {
  it('approves and rejects pending submissions, writing to moderation_log', async () => {
    const userCookies = await makeUser('mod-author@example.com');
    const modCookies = await makeUser('mod1@example.com', 'moderator');

    const a = await submit(userCookies, 'To approve');
    const b = await submit(userCookies, 'To reject');

    const queue = await request(app)
      .get('/api/mod/settings/pending')
      .set('Cookie', modCookies);
    expect(queue.status).toBe(200);
    expect(queue.body.data.length).toBe(2);

    const ok = await request(app)
      .post(`/api/mod/settings/${a}/approve`)
      .set('Origin', ORIGIN)
      .set('Cookie', modCookies);
    expect([200, 204]).toContain(ok.status);

    const rej = await request(app)
      .post(`/api/mod/settings/${b}/reject`)
      .set('Origin', ORIGIN)
      .set('Cookie', modCookies)
      .send({ reason: 'duplicate of another setting' });
    expect([200, 204]).toContain(rej.status);

    const after = await db('laser_settings').select('uuid', 'status');
    const map = Object.fromEntries(after.map((r) => [r.uuid, r.status]));
    expect(map[a]).toBe('approved');
    expect(map[b]).toBe('rejected');

    const log = await db('moderation_log').select('action', 'target_type');
    const actions = log.map((r) => r.action).sort();
    expect(actions).toContain('approve');
    expect(actions).toContain('reject');
    expect(log.every((r) => r.target_type === 'setting')).toBe(true);
  });

  it('bulk-approves up to 100 in one call', async () => {
    const userCookies = await makeUser('bulk-author@example.com');
    const modCookies = await makeUser('mod2@example.com', 'moderator');
    const uuids = [
      await submit(userCookies, 'bulk-a'),
      await submit(userCookies, 'bulk-b'),
      await submit(userCookies, 'bulk-c'),
    ];
    const r = await request(app)
      .post('/api/mod/settings/bulk-approve')
      .set('Origin', ORIGIN)
      .set('Cookie', modCookies)
      .send({ uuids });
    expect(r.status).toBe(200);
    expect(r.body.data.approved).toBe(3);

    const rows = await db('laser_settings').whereIn('uuid', uuids).select('status');
    expect(rows.every((row) => row.status === 'approved')).toBe(true);
  });

  it('forbids non-mod from accessing the queue', async () => {
    const userCookies = await makeUser('plain@example.com');
    const r = await request(app).get('/api/mod/settings/pending').set('Cookie', userCookies);
    expect(r.status).toBe(403);
  });
});
