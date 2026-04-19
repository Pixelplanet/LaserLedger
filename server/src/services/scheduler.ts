import { db } from '../db/index.js';
import { env, isTest } from '../config.js';
import { hashPassword } from '../auth/tokens.js';
import { hexId, nowIso } from '../utils/ids.js';
import { deleteImageDir } from './images.js';
import { sendEmail, moderatorDigestMessage } from './email.js';
import type { User } from '@shared/types.js';

/**
 * Bootstrap an admin user on startup if ADMIN_EMAIL + ADMIN_INITIAL_PASSWORD are set
 * and no admin exists yet.
 * §1.28
 */
export async function bootstrapAdmin(): Promise<void> {
  if (!env.ADMIN_EMAIL || !env.ADMIN_INITIAL_PASSWORD) return;
  const existing = await db('users').where({ role: 'admin' }).first();
  if (existing) return;
  const id = hexId();
  const now = nowIso();
  await db('users').insert({
    id,
    email: env.ADMIN_EMAIL,
    display_name: 'Admin',
    password_hash: await hashPassword(env.ADMIN_INITIAL_PASSWORD),
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
  // eslint-disable-next-line no-console
  console.log(`[laserledger] bootstrapped admin user ${env.ADMIN_EMAIL}`);
}

/**
 * Image cleanup job — §5.11 / §10.7
 * - Orphaned: pending images with no setting_id older than 24h
 * - Rejected: rejected images older than 7d
 * - Archived: images attached to archived settings older than 30d
 */
export async function cleanupOrphanImages(): Promise<{ removed: number }> {
  const now = Date.now();
  const orphanCutoff = new Date(now - 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  const rejectedCutoff = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  const archivedCutoff = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

  const orphans = await db('setting_images')
    .whereNull('setting_id')
    .andWhere('created_at', '<', orphanCutoff)
    .select('id', 'stored_path');
  const rejected = await db('setting_images')
    .where({ status: 'rejected' })
    .andWhere('moderated_at', '<', rejectedCutoff)
    .select('id', 'stored_path');
  const archived = await db('setting_images as i')
    .join('laser_settings as s', 's.id', 'i.setting_id')
    .where('s.status', 'archived')
    .andWhere('s.updated_at', '<', archivedCutoff)
    .select('i.id', 'i.stored_path');

  const all = [...orphans, ...rejected, ...archived];
  for (const img of all) {
    await deleteImageDir(img.stored_path).catch(() => {});
    await db('setting_images').where({ id: img.id }).delete();
  }
  return { removed: all.length };
}

/**
 * Moderator digest — §7.12
 * Sends a digest email to all moderators/admins if the queue has any pending items.
 * Throttled by caller (run once per hour).
 */
export async function sendModeratorDigest(): Promise<void> {
  const [s] = await db('laser_settings').where({ status: 'pending' }).count<{ c: number }[]>({ c: '*' });
  const [i] = await db('setting_images').where({ status: 'pending' }).count<{ c: number }[]>({ c: '*' });
  const [r] = await db('content_reports').where({ status: 'pending' }).count<{ c: number }[]>({ c: '*' });
  const totals = {
    settings: Number(s?.c ?? 0),
    images: Number(i?.c ?? 0),
    reports: Number(r?.c ?? 0),
  };
  if (totals.settings + totals.images + totals.reports === 0) return;
  const mods = await db<User>('users').whereIn('role', ['moderator', 'admin']).select('email');
  for (const m of mods) {
    if (m.email) await sendEmail(moderatorDigestMessage(m.email, totals));
  }
}

let intervals: NodeJS.Timeout[] = [];

/** Start background scheduled jobs. Safe to call once on boot. */
export function startSchedulers(): void {
  if (isTest()) return;
  // Image cleanup — every 6 hours
  intervals.push(
    setInterval(() => {
      cleanupOrphanImages()
        .then((r) => {
          if (r.removed) console.log(`[laserledger] cleaned up ${r.removed} orphan images`);
        })
        .catch((err) => console.error('[laserledger] image cleanup failed:', err));
    }, 6 * 60 * 60 * 1000),
  );
  // Moderator digest — hourly
  intervals.push(
    setInterval(() => {
      sendModeratorDigest().catch((err) =>
        console.error('[laserledger] moderator digest failed:', err),
      );
    }, 60 * 60 * 1000),
  );
}

/** Stop schedulers (used in tests / graceful shutdown). */
export function stopSchedulers(): void {
  for (const t of intervals) clearInterval(t);
  intervals = [];
}
