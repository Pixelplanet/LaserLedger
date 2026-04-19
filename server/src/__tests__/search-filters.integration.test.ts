import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { nowIso } from '../utils/ids.js';

const app = createApp();

describe('search/filter contract', () => {
  it('returns validated URL filter state', async () => {
    const r = await request(app).get('/api/settings/filter-state?q=metal&device=1,2&page=3&pageSize=25&sort=top_rated');
    expect(r.status).toBe(200);
    expect(r.body.data.q).toBe('metal');
    expect(r.body.data.device).toBe('1,2');
    expect(r.body.data.page).toBe(3);
    expect(r.body.data.pageSize).toBe(25);
    expect(r.body.data.sort).toBe('top_rated');
  });

  it('returns facet counts and cache metadata', async () => {
    const now = nowIso();
    await db('users').insert({
      id: 'feedfacefeedface',
      email: 'facet@example.com',
      display_name: 'Facet User',
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

    await db('laser_settings').insert([
      {
        uuid: '11111111-1111-4111-8111-111111111111',
        title: 'Facet one',
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
        submitted_by: 'feedfacefeedface',
        status: 'approved',
        moderated_by: 'feedfacefeedface',
        moderated_at: now,
        rejection_reason: null,
        vote_score: 0,
        view_count: 0,
        comment_count: 0,
        created_at: now,
        updated_at: now,
      },
      {
        uuid: '22222222-2222-4222-8222-222222222222',
        title: 'Facet two',
        description: null,
        device_id: 2,
        laser_type_id: 2,
        material_id: 2,
        operation_type_id: 1,
        power: 60,
        speed: 1200,
        frequency: 50,
        lpi: 300,
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
        submitted_by: 'feedfacefeedface',
        status: 'approved',
        moderated_by: 'feedfacefeedface',
        moderated_at: now,
        rejection_reason: null,
        vote_score: 0,
        view_count: 0,
        comment_count: 0,
        created_at: now,
        updated_at: now,
      },
    ]);

    const r1 = await request(app).get('/api/settings/facets');
    expect(r1.status).toBe(200);
    expect(Array.isArray(r1.body.data.devices)).toBe(true);
    expect(r1.body.meta.cached).toBe(false);

    const r2 = await request(app).get('/api/settings/facets');
    expect(r2.status).toBe(200);
    expect(r2.body.meta.cached).toBe(true);
  });
});
