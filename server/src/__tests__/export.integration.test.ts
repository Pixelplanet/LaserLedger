import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { uuid as makeUuid, nowIso } from '../utils/ids.js';
import { buildXsV2 } from '../services/xs-export.js';

const app = createApp();
const ORIGIN = 'http://localhost:5173';

// Force supertest to buffer the response body into a raw Buffer instead of
// trying to JSON-parse it.
function binaryParser(res: import('http').IncomingMessage, cb: (err: Error | null, body: Buffer) => void): void {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}

async function makeUser(email: string): Promise<string> {
  const r = await request(app)
    .post('/api/auth/register')
    .set('Origin', ORIGIN)
    .send({ email, password: 'TestPass1!', display_name: email.split('@')[0] });
  expect(r.status).toBe(201);
  await db('users').where({ email }).update({ email_verified: true });
  const user = await db('users').where({ email }).first();
  return user.id as string;
}

async function insertApproved(
  submittedBy: string,
  title: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const settingUuid = makeUuid();
  const now = nowIso();
  await db('laser_settings').insert({
    uuid: settingUuid,
    title,
    device_id: 1,
    laser_type_id: 1,
    material_id: 1,
    operation_type_id: 1,
    power: 80,
    speed: 120,
    frequency: 30000,
    lpi: 254,
    pulse_width: 200,
    passes: 2,
    cross_hatch: true,
    scan_mode: 'bidirectional',
    submitted_by: submittedBy,
    status: 'approved',
    created_at: now,
    updated_at: now,
    ...extra,
  });
  return settingUuid;
}

describe('setting export', () => {
  it('exports a generated .xcs when there is no source file', async () => {
    const userId = await makeUser('export-gen@example.com');
    const uuid = await insertApproved(userId, 'Generated Export');

    const r = await request(app).get(`/api/settings/${uuid}/export?format=xcs`).buffer().parse(binaryParser);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('application/json');
    expect(r.headers['content-disposition']).toContain('generated-export.xcs');
    const doc = JSON.parse(r.body.toString('utf-8'));
    expect(doc.meta.title).toBe('Generated Export');
  });

  it('exports a generated .xs ZIP when there is no source file', async () => {
    const userId = await makeUser('export-gen-xs@example.com');
    const uuid = await insertApproved(userId, 'Generated Xs');

    const r = await request(app).get(`/api/settings/${uuid}/export?format=xs`).buffer().parse(binaryParser);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('application/zip');
    // ZIP magic bytes
    expect(r.body.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  });

  it('serves the original .xs bytes byte-identically when a source exists', async () => {
    const userId = await makeUser('export-passthrough@example.com');
    const original = buildXsV2({
      title: 'x',
      power: 99,
      speed: 50,
      frequency: null,
      lpi: null,
      pulse_width: null,
      passes: null,
      cross_hatch: null,
      scan_mode: null,
      source_xcs: null,
      source_format: null,
    });
    const uuid = await insertApproved(userId, 'Passthrough Export', {
      source_xcs: original.toString('base64'),
      source_format: 'xs',
    });

    const r = await request(app).get(`/api/settings/${uuid}/export?format=xs`).buffer().parse(binaryParser);
    expect(r.status).toBe(200);
    expect(Buffer.from(r.body).equals(original)).toBe(true);
  });

  it('rejects an invalid format', async () => {
    const userId = await makeUser('export-bad@example.com');
    const uuid = await insertApproved(userId, 'Bad Format');
    const r = await request(app).get(`/api/settings/${uuid}/export?format=stl`);
    expect(r.status).toBe(400);
  });

  it('returns 404 for an unknown setting', async () => {
    const r = await request(app).get(`/api/settings/${makeUuid()}/export?format=xcs`);
    expect(r.status).toBe(404);
  });
});
