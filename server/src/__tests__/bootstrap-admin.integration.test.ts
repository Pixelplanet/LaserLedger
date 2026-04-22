import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { hashPassword } from '../auth/tokens.js';
import { env } from '../config.js';
import { db } from '../db/index.js';
import { hexId, nowIso } from '../utils/ids.js';
import { bootstrapAdmin } from '../services/scheduler.js';

const app = createApp();
const ORIGIN = 'http://localhost:5173';
const originalAdminEmail = env.ADMIN_EMAIL;
const originalAdminPassword = env.ADMIN_INITIAL_PASSWORD;

afterEach(() => {
  env.ADMIN_EMAIL = originalAdminEmail;
  env.ADMIN_INITIAL_PASSWORD = originalAdminPassword;
});

describe('bootstrapAdmin', () => {
  it('creates a loginable admin from normalized env credentials', async () => {
    await db('users').delete();
    env.ADMIN_EMAIL = '  Admin@Example.com  ';
    env.ADMIN_INITIAL_PASSWORD = 'AdminPass1!';

    await bootstrapAdmin();

    const admin = await db('users').where({ email: 'admin@example.com' }).first();
    expect(admin?.role).toBe('admin');

    const login = await request(app)
      .post('/api/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: 'admin@example.com', password: 'AdminPass1!' });

    expect(login.status).toBe(200);
  });

  it('does not overwrite an existing admin password on startup', async () => {
    await db('users').delete();
    const now = nowIso();
    await db('users').insert({
      id: hexId(),
      email: 'admin@example.com',
      display_name: 'Admin',
      password_hash: await hashPassword('OldPass1!'),
      google_id: null,
      role: 'admin',
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

    env.ADMIN_EMAIL = 'admin@example.com';
    env.ADMIN_INITIAL_PASSWORD = 'AdminPass1!';

    await bootstrapAdmin();

    const originalPasswordLogin = await request(app)
      .post('/api/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: 'admin@example.com', password: 'OldPass1!' });

    expect(originalPasswordLogin.status).toBe(200);

    const envPasswordLogin = await request(app)
      .post('/api/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: 'admin@example.com', password: 'AdminPass1!' });

    expect(envPasswordLogin.status).toBe(401);
  });
});