import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';

const app = createApp();
const ORIGIN = 'http://localhost:5173';

async function registerVerified(email: string): Promise<string[]> {
  const r = await request(app)
    .post('/api/auth/register')
    .set('Origin', ORIGIN)
    .send({ email, password: 'TestPass1!', display_name: email.split('@')[0] });
  expect(r.status).toBe(201);
  await db('users').where({ email }).update({ email_verified: true });
  return r.headers['set-cookie'] as unknown as string[];
}

describe('quick recipe submission (minimal payload)', () => {
  it('accepts a minimal payload with only required fields plus a couple of params', async () => {
    const cookies = await registerVerified('quick-recipe@example.com');
    const r = await request(app)
      .post('/api/settings')
      .set('Origin', ORIGIN)
      .set('Cookie', cookies)
      .send({
        title: 'Cut — Birch Plywood (3mm) — F2 / Blue',
        device_id: 1,
        laser_type_id: 1,
        material_id: 1,
        operation_type_id: 1,
        power: 30,
        speed: 300,
        passes: 1,
      });
    expect(r.status).toBe(201);
    expect(r.body.data.uuid).toBeTruthy();
    expect(r.body.data.title).toBe('Cut — Birch Plywood (3mm) — F2 / Blue');
    expect(Number(r.body.data.passes)).toBe(1);
    // Untouched optional fields default to null.
    expect(r.body.data.frequency ?? null).toBeNull();
    expect(r.body.data.description ?? null).toBeNull();
  });

  it('rejects a payload with a too-short title', async () => {
    const cookies = await registerVerified('quick-recipe-bad@example.com');
    const r = await request(app)
      .post('/api/settings')
      .set('Origin', ORIGIN)
      .set('Cookie', cookies)
      .send({
        title: 'x',
        device_id: 1,
        laser_type_id: 1,
        material_id: 1,
        operation_type_id: 1,
      });
    expect(r.status).toBe(422);
  });
});
