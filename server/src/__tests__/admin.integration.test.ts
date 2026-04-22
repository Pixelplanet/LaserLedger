import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';

const app = createApp();
const ORIGIN = 'http://localhost:5173';

async function adminCookies(email = 'admin1@example.com') {
  const reg = await request(app)
    .post('/api/auth/register')
    .set('Origin', ORIGIN)
    .send({ email, password: 'TestPass1!', display_name: 'Admin' });
  expect(reg.status).toBe(201);
  await db('users').where({ email }).update({ email_verified: true, role: 'admin' });
  const login = await request(app)
    .post('/api/auth/login')
    .set('Origin', ORIGIN)
    .send({ email, password: 'TestPass1!' });
  expect(login.status).toBe(200);
  return login.headers['set-cookie'] as unknown as string[];
}

describe('admin CMS CRUD', () => {
  it('creates, updates, lists, and deletes a tag, writing to moderation_log', async () => {
    const cookies = await adminCookies();

    const create = await request(app)
      .post('/api/admin/tags')
      .set('Origin', ORIGIN)
      .set('Cookie', cookies)
      .send({ name: 'Anodised aluminium' });
    expect(create.status).toBe(201);
    const id = create.body.data.id as number;
    expect(create.body.data.slug).toBe('anodised-aluminium');

    const list = await request(app).get('/api/admin/tags').set('Cookie', cookies);
    expect(list.status).toBe(200);
    expect(list.body.data.find((t: { id: number }) => t.id === id)).toBeTruthy();

    const update = await request(app)
      .patch(`/api/admin/tags/${id}`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookies)
      .send({ description: 'For 1mm anodised plates' });
    expect(update.status).toBe(200);

    const remove = await request(app)
      .delete(`/api/admin/tags/${id}`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookies);
    expect(remove.status).toBe(204);

    const log = await db('moderation_log').where({ target_type: 'cms_entity' }).select('action');
    const actions = log.map((r) => r.action).sort();
    expect(actions).toEqual(['create', 'delete', 'update']);
  });

  it('returns aggregated stats', async () => {
    const cookies = await adminCookies('admin2@example.com');
    const r = await request(app).get('/api/admin/stats').set('Cookie', cookies);
    expect(r.status).toBe(200);
    expect(typeof r.body.data.users.total).toBe('number');
    expect(typeof r.body.data.settings.total).toBe('number');
  });

  it('forbids non-admin from CMS endpoints', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .set('Origin', ORIGIN)
      .send({ email: 'plain2@example.com', password: 'TestPass1!', display_name: 'Plain' });
    expect(reg.status).toBe(201);
    const cookies = reg.headers['set-cookie'] as unknown as string[];

    const r = await request(app).get('/api/admin/tags').set('Cookie', cookies);
    expect(r.status).toBe(403);
  });

  it('parses an XCS file for device import assistance', async () => {
    const cookies = await adminCookies('admin3@example.com');
    const xcs = JSON.stringify({
      extId: 'GS009-CLASS-4',
      extName: 'F2 Ultra UV',
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

    const r = await request(app)
      .post('/api/admin/devices/parse-xcs')
      .set('Origin', ORIGIN)
      .set('Cookie', cookies)
      .attach('file', Buffer.from(xcs, 'utf-8'), 'F2 Ultra UV.xcs');

    expect(r.status).toBe(200);
    expect(r.body.data.parsed.ext_id).toBe('GS009-CLASS-4');
    expect(r.body.data.parsed.ext_name).toBe('F2 Ultra UV');
    expect(r.body.data.existing_device?.name).toBe('F2 Ultra (UV)');
    expect(r.body.data.suggested_name).toBe('F2 Ultra UV');
  });
});

describe('public system-settings', () => {
  it('exposes only public_* keys', async () => {
    const now = new Date().toISOString();
    await db('system_settings').insert([
      { key: 'public_donation_url', value: 'https://example.com/give', updated_at: now },
      { key: 'private_secret', value: 'shhh', updated_at: now },
    ]).onConflict('key').merge();

    const r = await request(app).get('/api/system-settings');
    expect(r.status).toBe(200);
    const keys = r.body.data.map((s: { key: string }) => s.key);
    expect(keys).toContain('public_donation_url');
    expect(keys).not.toContain('private_secret');
  });
});
