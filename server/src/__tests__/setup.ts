import { beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../db/index.js';

// Each test file gets a fresh in-memory SQLite database with full schema + seeds.
beforeAll(async () => {
  process.env.APP_ENV = 'automated-test';
  process.env.DB_PROFILE = 'test';
  await db.migrate.latest();
  await db.seed.run();
});

afterAll(async () => {
  await db.destroy();
});

beforeEach(async () => {
  // Clear high-churn tables between tests; preserve reference data.
  await db('comments').delete();
  await db('votes').delete();
  await db('user_bookmarks').delete();
  await db('content_reports').delete();
  await db('moderation_log').delete();
  await db('email_verification_tokens').delete();
  await db('password_reset_tokens').delete();
  await db('laser_setting_tags').delete();
  await db('setting_tags').delete();
  await db('setting_images').delete();
  await db('laser_settings').delete();
  // Clear non-admin users
  await db('users').whereNot({ role: 'admin' }).delete();
});
