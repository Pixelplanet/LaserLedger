import { Router } from 'express';
import { db } from '../db/index.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { RejectInput } from '@shared/schemas.js';
import { nowIso } from '../utils/ids.js';
import { notFound, badRequest } from '../utils/errors.js';
import {
  sendEmail,
  submissionApprovedMessage,
  submissionRejectedMessage,
  imageRejectedMessage,
} from '../services/email.js';
import { findSimilarSettings } from '../services/moderation.js';
import { env } from '../config.js';
import type { User } from '@shared/types.js';

const router = Router();

router.use(requireRole('moderator'));

// ─── Queue counts ──────────────────────────────────────────────────────────
router.get('/queue', async (_req, res, next) => {
  try {
    const [s] = await db('laser_settings').where({ status: 'pending' }).count<{ c: number }[]>({ c: '*' });
    const [i] = await db('setting_images').where({ status: 'pending' }).count<{ c: number }[]>({ c: '*' });
    const [r] = await db('content_reports').where({ status: 'pending' }).count<{ c: number }[]>({ c: '*' });
    res.json({
      data: {
        settings: Number(s?.c ?? 0),
        images: Number(i?.c ?? 0),
        reports: Number(r?.c ?? 0),
      },
    });
  } catch (e) {
    next(e);
  }
});

// ─── Pending settings ──────────────────────────────────────────────────────
router.get('/settings/pending', async (_req, res, next) => {
  try {
    const rows = await db('laser_settings as s')
      .leftJoin('users as u', 'u.id', 's.submitted_by')
      .leftJoin('devices as d', 'd.id', 's.device_id')
      .leftJoin('materials as m', 'm.id', 's.material_id')
      .where('s.status', 'pending')
      .orderBy('s.created_at', 'asc')
      .select('s.*', 'u.display_name as author_name', 'd.name as device_name', 'm.name as material_name');
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

// ─── Setting duplicate check ───────────────────────────────────────────────
router.get('/settings/:uuid/duplicates', async (req, res, next) => {
  try {
    const setting = await db('laser_settings').where({ uuid: req.params.uuid }).first();
    if (!setting) throw notFound('Setting not found');
    const thresholdRow = await db('system_settings').where({ key: 'duplicate_similarity_threshold' }).first();
    const threshold = Number(thresholdRow?.value ?? 0.9);
    const dups = await findSimilarSettings(
      {
        device_id: setting.device_id,
        material_id: setting.material_id,
        laser_type_id: setting.laser_type_id,
      },
      {
        power: setting.power,
        speed: setting.speed,
        frequency: setting.frequency,
        lpi: setting.lpi,
      },
      threshold,
      setting.id,
    );
    res.json({ data: dups });
  } catch (e) {
    next(e);
  }
});

// ─── Approve setting ───────────────────────────────────────────────────────
router.post('/settings/:uuid/approve', async (req, res, next) => {
  try {
    const mod = req.user!;
    const setting = await db('laser_settings').where({ uuid: req.params.uuid }).first();
    if (!setting) throw notFound('Setting not found');
    if (setting.status === 'approved') throw badRequest('Already approved');
    const now = nowIso();
    await db.transaction(async (trx) => {
      await trx('laser_settings').where({ id: setting.id }).update({
        status: 'approved',
        moderated_by: mod.id,
        moderated_at: now,
        updated_at: now,
      });
      await trx('users').where({ id: setting.submitted_by }).increment('submission_count', 1);
      await trx('moderation_log').insert({
        moderator_id: mod.id,
        target_type: 'setting',
        target_id: setting.id,
        action: 'approve',
        reason: null,
        notes: null,
        created_at: now,
      });
    });
    const author = await db<User>('users').where({ id: setting.submitted_by }).first();
    if (author?.email) {
      await sendEmail(
        submissionApprovedMessage(
          author.email,
          setting.title,
          `${env.APP_BASE_URL}/settings/${setting.uuid}`,
        ),
      );
    }
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ─── Reject setting ────────────────────────────────────────────────────────
router.post('/settings/:uuid/reject', validate(RejectInput), async (req, res, next) => {
  try {
    const mod = req.user!;
    const setting = await db('laser_settings').where({ uuid: req.params.uuid }).first();
    if (!setting) throw notFound('Setting not found');
    const { reason, notes } = req.body as RejectInput;
    const now = nowIso();
    await db.transaction(async (trx) => {
      await trx('laser_settings').where({ id: setting.id }).update({
        status: 'rejected',
        moderated_by: mod.id,
        moderated_at: now,
        rejection_reason: reason,
        updated_at: now,
      });
      await trx('moderation_log').insert({
        moderator_id: mod.id,
        target_type: 'setting',
        target_id: setting.id,
        action: 'reject',
        reason,
        notes: notes ?? null,
        created_at: now,
      });
    });
    const author = await db<User>('users').where({ id: setting.submitted_by }).first();
    if (author?.email) {
      await sendEmail(
        submissionRejectedMessage(
          author.email,
          setting.title,
          reason,
          `${env.APP_BASE_URL}/settings/${setting.uuid}/edit`,
        ),
      );
    }
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ─── Moderator edit setting ────────────────────────────────────────────────
router.patch('/settings/:uuid', async (req, res, next) => {
  try {
    const mod = req.user!;
    const setting = await db('laser_settings').where({ uuid: req.params.uuid }).first();
    if (!setting) throw notFound('Setting not found');
    const update = { ...(req.body as Record<string, unknown>), updated_at: nowIso() };
    delete (update as Record<string, unknown>).id;
    delete (update as Record<string, unknown>).uuid;
    delete (update as Record<string, unknown>).submitted_by;
    const rec = update as Record<string, unknown>;
    if (rec.extra_params !== undefined && rec.extra_params !== null && typeof rec.extra_params !== 'string') {
      rec.extra_params = JSON.stringify(rec.extra_params);
    }
    const beforeJson = JSON.stringify(
      Object.fromEntries(Object.keys(update).map((k) => [k, (setting as Record<string, unknown>)[k] ?? null])),
    );
    await db('laser_settings').where({ id: setting.id }).update(update);
    await db('moderation_log').insert({
      moderator_id: mod.id,
      target_type: 'setting',
      target_id: setting.id,
      action: 'edit',
      reason: null,
      notes: beforeJson.slice(0, 4000),
      created_at: nowIso(),
    });
    res.json({ data: await db('laser_settings').where({ id: setting.id }).first() });
  } catch (e) {
    next(e);
  }
});

// ─── Archive setting ───────────────────────────────────────────────────────
router.post('/settings/:uuid/archive', async (req, res, next) => {
  try {
    const mod = req.user!;
    const setting = await db('laser_settings').where({ uuid: req.params.uuid }).first();
    if (!setting) throw notFound('Setting not found');
    const now = nowIso();
    await db('laser_settings')
      .where({ id: setting.id })
      .update({ status: 'archived', moderated_by: mod.id, moderated_at: now, updated_at: now });
    await db('moderation_log').insert({
      moderator_id: mod.id,
      target_type: 'setting',
      target_id: setting.id,
      action: 'archive',
      reason: null,
      notes: null,
      created_at: now,
    });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ─── Pending images ────────────────────────────────────────────────────────
router.get('/images/pending', async (_req, res, next) => {
  try {
    const rows = await db('setting_images as i')
      .leftJoin('laser_settings as s', 's.id', 'i.setting_id')
      .leftJoin('users as u', 'u.id', 'i.uploaded_by')
      .where('i.status', 'pending')
      .orderBy('i.created_at', 'asc')
      .select('i.*', 's.uuid as setting_uuid', 's.title as setting_title', 'u.display_name as uploader_name');
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

router.post('/images/:uuid/approve', async (req, res, next) => {
  try {
    const mod = req.user!;
    const img = await db('setting_images').where({ uuid: req.params.uuid }).first();
    if (!img) throw notFound('Image not found');
    const now = nowIso();
    await db('setting_images').where({ id: img.id }).update({
      status: 'approved',
      moderated_by: mod.id,
      moderated_at: now,
    });
    await db('moderation_log').insert({
      moderator_id: mod.id,
      target_type: 'image',
      target_id: img.id,
      action: 'approve',
      reason: null,
      notes: null,
      created_at: now,
    });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

router.post('/images/:uuid/reject', validate(RejectInput), async (req, res, next) => {
  try {
    const mod = req.user!;
    const img = await db('setting_images').where({ uuid: req.params.uuid }).first();
    if (!img) throw notFound('Image not found');
    const { reason, notes } = req.body as RejectInput;
    const now = nowIso();
    await db('setting_images').where({ id: img.id }).update({
      status: 'rejected',
      moderated_by: mod.id,
      moderated_at: now,
      rejected_reason: reason,
    });
    await db('moderation_log').insert({
      moderator_id: mod.id,
      target_type: 'image',
      target_id: img.id,
      action: 'reject',
      reason,
      notes: notes ?? null,
      created_at: now,
    });
    const uploader = await db<User>('users').where({ id: img.uploaded_by }).first();
    if (uploader?.email) {
      await sendEmail(imageRejectedMessage(uploader.email, img.original_filename, reason));
    }
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ─── Reports ───────────────────────────────────────────────────────────────
router.get('/reports/pending', async (_req, res, next) => {
  try {
    const rows = await db('content_reports as r')
      .leftJoin('users as u', 'u.id', 'r.reporter_id')
      .where('r.status', 'pending')
      .orderBy('r.created_at', 'asc')
      .select('r.*', 'u.display_name as reporter_name');
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

router.post('/reports/:id/resolve', async (req, res, next) => {
  try {
    const mod = req.user!;
    const action = String((req.body as Record<string, unknown>)?.action ?? '');
    if (!['dismiss', 'remove_content', 'warn_user'].includes(action)) {
      throw badRequest('Invalid action');
    }
    const report = await db('content_reports').where({ id: req.params.id }).first();
    if (!report) throw notFound('Report not found');
    await db('content_reports')
      .where({ id: report.id })
      .update({ status: 'resolved', resolved_by: mod.id, resolved_at: nowIso(), resolution_action: action });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ─── Bulk approve / reject settings ────────────────────────────────────────
router.post('/settings/bulk-approve', async (req, res, next) => {
  try {
    const mod = req.user!;
    const uuids = (req.body as { uuids?: unknown })?.uuids;
    if (!Array.isArray(uuids) || uuids.length === 0 || uuids.length > 100) {
      throw badRequest('uuids must be a non-empty array of <=100 strings');
    }
    const rows = await db('laser_settings').whereIn('uuid', uuids as string[]).where({ status: 'pending' });
    const now = nowIso();
    let approved = 0;
    await db.transaction(async (trx) => {
      for (const setting of rows) {
        await trx('laser_settings').where({ id: setting.id }).update({
          status: 'approved',
          moderated_by: mod.id,
          moderated_at: now,
          updated_at: now,
        });
        await trx('users').where({ id: setting.submitted_by }).increment('submission_count', 1);
        await trx('moderation_log').insert({
          moderator_id: mod.id,
          target_type: 'setting',
          target_id: setting.id,
          action: 'approve',
          reason: null,
          notes: 'bulk',
          created_at: now,
        });
        approved += 1;
      }
    });
    res.json({ data: { approved, requested: uuids.length } });
  } catch (e) {
    next(e);
  }
});

router.post('/settings/bulk-reject', validate(RejectInput), async (req, res, next) => {
  try {
    const mod = req.user!;
    const uuids = (req.body as { uuids?: unknown })?.uuids;
    if (!Array.isArray(uuids) || uuids.length === 0 || uuids.length > 100) {
      throw badRequest('uuids must be a non-empty array of <=100 strings');
    }
    const { reason, notes } = req.body as RejectInput;
    const rows = await db('laser_settings').whereIn('uuid', uuids as string[]).where({ status: 'pending' });
    const now = nowIso();
    let rejected = 0;
    await db.transaction(async (trx) => {
      for (const setting of rows) {
        await trx('laser_settings').where({ id: setting.id }).update({
          status: 'rejected',
          moderated_by: mod.id,
          moderated_at: now,
          rejection_reason: reason,
          updated_at: now,
        });
        await trx('moderation_log').insert({
          moderator_id: mod.id,
          target_type: 'setting',
          target_id: setting.id,
          action: 'reject',
          reason,
          notes: notes ?? 'bulk',
          created_at: now,
        });
        rejected += 1;
      }
    });
    res.json({ data: { rejected, requested: uuids.length } });
  } catch (e) {
    next(e);
  }
});

export default router;
