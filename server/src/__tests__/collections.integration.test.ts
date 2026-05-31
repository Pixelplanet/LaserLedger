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
  const cookies = login.headers['set-cookie'] as unknown as string[];
  const user = await db('users').where({ email }).first();
  return { cookies, id: user.id as string };
}

async function approvedSetting(authorCookies: string[], modCookies: string[], title: string) {
  const r = await request(app)
    .post('/api/settings')
    .set('Origin', ORIGIN)
    .set('Cookie', authorCookies)
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
  const uuid = r.body.data.uuid as string;
  const ok = await request(app)
    .post(`/api/mod/settings/${uuid}/approve`)
    .set('Origin', ORIGIN)
    .set('Cookie', modCookies);
  expect([200, 204]).toContain(ok.status);
  return uuid;
}

describe('collections flow (integration)', () => {
  it('creates a collection, adds/removes items, enforces privacy, supports mod unpublish', async () => {
    const mod = await makeUser('coll-mod@example.com', 'moderator');
    const owner = await makeUser('coll-owner@example.com');
    const other = await makeUser('coll-other@example.com');

    const settingUuid = await approvedSetting(owner.cookies, mod.cookies, 'Collectible setting');

    // Create a private collection
    const created = await request(app)
      .post('/api/collections')
      .set('Origin', ORIGIN)
      .set('Cookie', owner.cookies)
      .send({ name: 'My favourites', description: 'good stuff' });
    expect(created.status).toBe(201);
    const collUuid = created.body.data.uuid as string;
    expect(created.body.data.is_public).toBe(false);

    // Add the setting
    const added = await request(app)
      .post(`/api/collections/${collUuid}/items`)
      .set('Origin', ORIGIN)
      .set('Cookie', owner.cookies)
      .send({ setting_uuid: settingUuid });
    expect(added.status).toBe(201);
    expect(added.body.data.items.length).toBe(1);
    expect(added.body.data.items[0].uuid).toBe(settingUuid);

    // Private collection is hidden from others
    const hidden = await request(app)
      .get(`/api/collections/${collUuid}`)
      .set('Cookie', other.cookies);
    expect(hidden.status).toBe(404);

    // Owner can read it
    const mine = await request(app)
      .get(`/api/collections/${collUuid}`)
      .set('Cookie', owner.cookies);
    expect(mine.status).toBe(200);
    expect(mine.body.data.is_owner).toBe(true);
    expect(mine.body.data.items.length).toBe(1);

    // Make it public
    const pub = await request(app)
      .patch(`/api/collections/${collUuid}`)
      .set('Origin', ORIGIN)
      .set('Cookie', owner.cookies)
      .send({ name: 'My favourites', is_public: true });
    expect(pub.status).toBe(200);
    expect(pub.body.data.is_public).toBe(true);

    // Now visible to others & in the user's public list
    const seen = await request(app).get(`/api/collections/${collUuid}`).set('Cookie', other.cookies);
    expect(seen.status).toBe(200);
    const publicList = await request(app).get(`/api/users/${owner.id}/collections`);
    expect(publicList.status).toBe(200);
    expect(publicList.body.data.length).toBe(1);
    expect(publicList.body.data[0].item_count).toBe(1);

    // Mod can see and unpublish it
    const modList = await request(app).get('/api/mod/collections').set('Cookie', mod.cookies);
    expect(modList.status).toBe(200);
    expect(modList.body.data.some((c: { uuid: string }) => c.uuid === collUuid)).toBe(true);

    const unpub = await request(app)
      .post(`/api/mod/collections/${collUuid}/unpublish`)
      .set('Origin', ORIGIN)
      .set('Cookie', mod.cookies);
    expect([200, 204]).toContain(unpub.status);

    const afterUnpub = await request(app)
      .get(`/api/collections/${collUuid}`)
      .set('Cookie', other.cookies);
    expect(afterUnpub.status).toBe(404);
    const log = await db('moderation_log').where({ target_type: 'collection' }).first();
    expect(log).toBeTruthy();

    // Remove the item
    const removed = await request(app)
      .delete(`/api/collections/${collUuid}/items/${settingUuid}`)
      .set('Origin', ORIGIN)
      .set('Cookie', owner.cookies);
    expect(removed.status).toBe(200);
    expect(removed.body.data.items.length).toBe(0);

    // Delete the collection
    const del = await request(app)
      .delete(`/api/collections/${collUuid}`)
      .set('Origin', ORIGIN)
      .set('Cookie', owner.cookies);
    expect(del.status).toBe(204);
  });

  it('rejects collection mutations from non-owners', async () => {
    const owner = await makeUser('coll-owner2@example.com');
    const other = await makeUser('coll-other2@example.com');
    const created = await request(app)
      .post('/api/collections')
      .set('Origin', ORIGIN)
      .set('Cookie', owner.cookies)
      .send({ name: 'Private set' });
    const collUuid = created.body.data.uuid as string;

    const patch = await request(app)
      .patch(`/api/collections/${collUuid}`)
      .set('Origin', ORIGIN)
      .set('Cookie', other.cookies)
      .send({ name: 'hijacked' });
    expect(patch.status).toBe(403);
  });
});
