import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';

const app = createApp();
const ORIGIN = 'http://localhost:5173';

async function registerAndLogin(email: string): Promise<string[]> {
  const r = await request(app)
    .post('/api/auth/register')
    .set('Origin', ORIGIN)
    .send({ email, password: 'TestPass1!', display_name: email.split('@')[0] });
  expect(r.status).toBe(201);
  return r.headers['set-cookie'] as unknown as string[];
}

describe('public reference data', () => {
  it('lists devices with laser types attached', async () => {
    const r = await request(app).get('/api/devices');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
    expect(r.body.data.length).toBeGreaterThan(0);
    expect(r.body.data[0].laser_types).toBeDefined();
  });

  it('seeds the design-document device and laser catalog', async () => {
    const [devices, lasers] = await Promise.all([
      request(app).get('/api/devices'),
      request(app).get('/api/laser-types'),
    ]);

    expect(devices.status).toBe(200);
    expect(lasers.status).toBe(200);

    const deviceNames = devices.body.data.map((row: { name: string }) => row.name);
    const laserSlugs = lasers.body.data.map((row: { slug: string }) => row.slug);

    expect(deviceNames).toEqual(expect.arrayContaining([
      'F2 Ultra (UV)',
      'F2 Ultra Dual',
      'F2 Ultra Single',
      'F2',
      'SVG Vector Export',
    ]));
    expect(laserSlugs).toEqual(expect.arrayContaining([
      'uv',
      'mopa',
      'mopa-single',
      'blue-ultra',
      'ir',
      'blue-f2',
    ]));
  });

  it('lists materials', async () => {
    const r = await request(app).get('/api/materials');
    expect(r.status).toBe(200);
    expect(r.body.data.length).toBeGreaterThan(0);
  });

  it('returns site stats', async () => {
    const r = await request(app).get('/api/stats');
    expect(r.status).toBe(200);
    expect(typeof r.body.data.devices).toBe('number');
  });
});

describe('settings flow', () => {
  it('rejects submission without verified email', async () => {
    const cookies = await registerAndLogin('unverified@example.com');
    const r = await request(app)
      .post('/api/settings')
      .set('Origin', ORIGIN)
      .set('Cookie', cookies)
      .send({
        title: 'Test',
        device_id: 1,
        laser_type_id: 1,
        material_id: 1,
        operation_type_id: 1,
        power: 50,
        speed: 1000,
      });
    expect(r.status).toBe(403);
  });

    it('parses partial XCS data and returns warnings for unknown references', async () => {
      const email = 'partial-xcs@example.com';
      const cookies = await registerAndLogin(email);
      await db('users').where({ email }).update({ email_verified: true });
      const xcs = JSON.stringify({
        device: { extId: 'UNSEEDED-LASER', name: 'Unseeded Laser' },
        project: { materialId: '999999' },
        objects: [{ settings: { power: '55', speed: '900', repeat: '3' } }],
      });

      const r = await request(app)
        .post('/api/settings/parse-xcs')
        .set('Origin', ORIGIN)
        .set('Cookie', cookies)
        .attach('file', Buffer.from(xcs, 'utf-8'), 'unknown-device.xcs');

      expect(r.status).toBe(200);
      expect(r.body.data.parsed.ext_id).toBe('UNSEEDED-LASER');
      expect(r.body.data.parsed.xtool_material_id).toBe(999999);
      expect(r.body.data.parsed.layers[0].power).toBe(55);
      expect(r.body.data.warnings).toEqual(expect.arrayContaining([
        'Unknown device extId: UNSEEDED-LASER',
        'Unknown xTool material id: 999999',
      ]));
    });
});

describe('search', () => {
  it('returns empty result for unknown filter', async () => {
    const r = await request(app).get('/api/settings?device=99999');
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual([]);
    expect(r.body.meta.total).toBe(0);
  });
});
