import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

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
});

describe('search', () => {
  it('returns empty result for unknown filter', async () => {
    const r = await request(app).get('/api/settings?device=99999');
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual([]);
    expect(r.body.meta.total).toBe(0);
  });
});
