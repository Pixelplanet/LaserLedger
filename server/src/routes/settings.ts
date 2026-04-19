import { Router } from 'express';
import { db } from '../db/index.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import {
  SettingInput,
  SearchQuery,
  CommentInput,
  ReportInput,
  type ReportInput as ReportInputType,
} from '@shared/schemas.js';
import { uuid as makeUuid, nowIso, slugify } from '../utils/ids.js';
import { buildSearchQuery } from '../services/search.js';
import { shouldAutoApprove } from '../services/moderation.js';
import { badRequest, forbidden, notFound } from '../utils/errors.js';
import { parseXcs, XcsParseError } from '../services/xcs.js';
import { submissionLimiter, voteLimiter, commentLimiter } from '../middleware/rate-limit.js';
import multer from 'multer';

const router = Router();

const xcsUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const FACET_CACHE_MS = 5 * 60 * 1000;
const facetCache = new Map<string, { expiresAt: number; data: unknown }>();

function facetCacheKey(q: SearchQuery): string {
  return JSON.stringify({
    q: q.q ?? null,
    device: q.device ?? null,
    laser_type: q.laser_type ?? null,
    material: q.material ?? null,
    material_category: q.material_category ?? null,
    operation: q.operation ?? null,
    manufacturer: q.manufacturer ?? null,
    tags: q.tags ?? null,
    power_min: q.power_min ?? null,
    power_max: q.power_max ?? null,
    speed_min: q.speed_min ?? null,
    speed_max: q.speed_max ?? null,
    frequency_min: q.frequency_min ?? null,
    frequency_max: q.frequency_max ?? null,
    lpi_min: q.lpi_min ?? null,
    lpi_max: q.lpi_max ?? null,
    min_rating: q.min_rating ?? null,
    has_image: q.has_image ?? null,
  });
}

// ─── Search ────────────────────────────────────────────────────────────────
router.get('/settings', validate(SearchQuery, 'query'), async (req, res, next) => {
  try {
    const q = req.query as unknown as SearchQuery;
    const [results, countRow] = await Promise.all([
      buildSearchQuery(db, q),
      buildSearchQuery(db, q, { count: true }).first<{ count: number }>(),
    ]);
    res.json({
      data: results,
      meta: {
        page: q.page,
        pageSize: q.pageSize,
        total: Number(countRow?.count ?? 0),
      },
    });
  } catch (e) {
    next(e);
  }
});

// ─── Filter-state contract ─────────────────────────────────────────────────
router.get('/settings/filter-state', validate(SearchQuery, 'query'), (req, res) => {
  const q = req.query as unknown as SearchQuery;
  res.json({
    data: {
      q: q.q ?? null,
      device: q.device ?? null,
      laser_type: q.laser_type ?? null,
      material: q.material ?? null,
      material_category: q.material_category ?? null,
      operation: q.operation ?? null,
      manufacturer: q.manufacturer ?? null,
      tags: q.tags ?? null,
      power_min: q.power_min ?? null,
      power_max: q.power_max ?? null,
      speed_min: q.speed_min ?? null,
      speed_max: q.speed_max ?? null,
      frequency_min: q.frequency_min ?? null,
      frequency_max: q.frequency_max ?? null,
      lpi_min: q.lpi_min ?? null,
      lpi_max: q.lpi_max ?? null,
      min_rating: q.min_rating ?? null,
      has_image: q.has_image ?? null,
      sort: q.sort,
      page: q.page,
      pageSize: q.pageSize,
    },
  });
});

// ─── Facet counts (cached 5 minutes) ──────────────────────────────────────
router.get('/settings/facets', validate(SearchQuery, 'query'), async (req, res, next) => {
  try {
    const q = req.query as unknown as SearchQuery;
    const cacheKey = facetCacheKey(q);
    const hit = facetCache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) {
      res.json({ data: hit.data, meta: { cached: true, ttl_ms: hit.expiresAt - Date.now() } });
      return;
    }

    const base = buildSearchQuery(db, { ...q, page: 1, pageSize: 100 }, { includeStatus: ['approved'] })
      .clearSelect()
      .clearOrder()
      .clear('limit')
      .clear('offset')
      .select(
        's.id',
        's.device_id',
        's.laser_type_id',
        's.material_id',
        's.operation_type_id',
        'd.family_id',
        'df.manufacturer_id',
        'm.category_id',
      );

    const baseSql = base.as('b');
    const [devices, laserTypes, materials, materialCategories, operations, manufacturers, tags] = await Promise.all([
      db(baseSql).select('device_id as id').count<{ id: number; count: number }[]>({ count: '*' }).groupBy('device_id').orderBy('count', 'desc'),
      db(baseSql).select('laser_type_id as id').count<{ id: number; count: number }[]>({ count: '*' }).groupBy('laser_type_id').orderBy('count', 'desc'),
      db(baseSql).select('material_id as id').count<{ id: number; count: number }[]>({ count: '*' }).groupBy('material_id').orderBy('count', 'desc'),
      db(baseSql).select('category_id as id').count<{ id: number; count: number }[]>({ count: '*' }).groupBy('category_id').orderBy('count', 'desc'),
      db(baseSql).select('operation_type_id as id').count<{ id: number; count: number }[]>({ count: '*' }).groupBy('operation_type_id').orderBy('count', 'desc'),
      db(baseSql).select('manufacturer_id as id').count<{ id: number; count: number }[]>({ count: '*' }).groupBy('manufacturer_id').orderBy('count', 'desc'),
      db('laser_setting_tags as lst')
        .join(baseSql, 'b.id', 'lst.setting_id')
        .join('setting_tags as t', 't.id', 'lst.tag_id')
        .select('t.id as id', 't.slug')
        .count<{ id: number; slug: string; count: number }[]>({ count: '*' })
        .groupBy('t.id', 't.slug')
        .orderBy('count', 'desc')
        .limit(100),
    ]);

    const data = {
      devices,
      laser_types: laserTypes,
      materials,
      material_categories: materialCategories,
      operations,
      manufacturers,
      tags,
    };

    facetCache.set(cacheKey, { expiresAt: Date.now() + FACET_CACHE_MS, data });
    res.json({ data, meta: { cached: false, ttl_ms: FACET_CACHE_MS } });
  } catch (e) {
    next(e);
  }
});

// ─── Get single setting ────────────────────────────────────────────────────
router.get('/settings/:uuid', async (req, res, next) => {
  try {
    const row = await db('laser_settings as s')
      .leftJoin('devices as d', 'd.id', 's.device_id')
      .leftJoin('laser_types as lt', 'lt.id', 's.laser_type_id')
      .leftJoin('materials as m', 'm.id', 's.material_id')
      .leftJoin('operation_types as ot', 'ot.id', 's.operation_type_id')
      .leftJoin('users as u', 'u.id', 's.submitted_by')
      .where('s.uuid', req.params.uuid)
      .select(
        's.*',
        'd.name as device_name',
        'd.slug as device_slug',
        'lt.name as laser_type_name',
        'lt.slug as laser_type_slug',
        'm.name as material_name',
        'm.slug as material_slug',
        'ot.name as operation_type_name',
        'ot.slug as operation_type_slug',
        'u.display_name as author_name',
        'u.id as author_id',
      )
      .first();
    if (!row) throw notFound('Setting not found');
    if (row.status !== 'approved') {
      // Only owner or moderators can see non-approved
      const isOwner = req.user?.id === row.submitted_by;
      const isMod = req.user?.role === 'moderator' || req.user?.role === 'admin';
      if (!isOwner && !isMod) throw notFound('Setting not found');
    }
    // Increment view count async (non-blocking, ignores errors)
    if (row.status === 'approved') {
      db('laser_settings')
        .where({ id: row.id })
        .increment('view_count', 1)
        .catch(() => {});
    }
    const tags = await db('laser_setting_tags as lst')
      .join('setting_tags as t', 't.id', 'lst.tag_id')
      .where('lst.setting_id', row.id)
      .select('t.id', 't.name', 't.slug');
    const images = await db('setting_images')
      .where({ setting_id: row.id, status: 'approved' })
      .orderBy('sort_order');
    res.json({ data: { ...row, tags, images } });
  } catch (e) {
    next(e);
  }
});

// ─── List images for a setting ─────────────────────────────────────────────
router.get('/settings/:uuid/images', async (req, res, next) => {
  try {
    const setting = await db('laser_settings').where({ uuid: req.params.uuid }).first();
    if (!setting) throw notFound('Setting not found');
    const images = await db('setting_images')
      .where({ setting_id: setting.id, status: 'approved' })
      .orderBy('sort_order');
    res.json({ data: images });
  } catch (e) {
    next(e);
  }
});

// ─── Create setting ────────────────────────────────────────────────────────
router.post('/settings', requireAuth, submissionLimiter, validate(SettingInput), async (req, res, next) => {
  try {
    const input = req.body as SettingInput;
    const user = req.user!;
    const autoApprove = await shouldAutoApprove(user.id);
    const status = autoApprove ? 'approved' : 'pending';
    const settingUuid = makeUuid();
    const now = nowIso();
    const id = await db.transaction(async (trx) => {
      const [insertedId] = await trx('laser_settings').insert({
        uuid: settingUuid,
        title: input.title,
        description: input.description ?? null,
        device_id: input.device_id,
        laser_type_id: input.laser_type_id,
        material_id: input.material_id,
        operation_type_id: input.operation_type_id,
        power: input.power ?? null,
        speed: input.speed ?? null,
        frequency: input.frequency ?? null,
        lpi: input.lpi ?? null,
        pulse_width: input.pulse_width ?? null,
        passes: input.passes ?? 1,
        cross_hatch: input.cross_hatch ?? null,
        focus_offset: input.focus_offset ?? null,
        scan_mode: input.scan_mode ?? null,
        extra_params: input.extra_params ? JSON.stringify(input.extra_params) : null,
        result_description: input.result_description ?? null,
        source_xcs: input.source_xcs ?? null,
        quality_rating: input.quality_rating ?? null,
        submitted_by: user.id,
        status,
        moderated_by: autoApprove ? user.id : null,
        moderated_at: autoApprove ? now : null,
        vote_score: 0,
        view_count: 0,
        comment_count: 0,
        created_at: now,
        updated_at: now,
      });
      const newId = Number(insertedId);
      // Tags
      if (input.tags?.length) {
        await attachTags(trx, newId, input.tags);
      }
      if (autoApprove) {
        await trx('users').where({ id: user.id }).increment('submission_count', 1);
      }
      return newId;
    });
    const created = await db('laser_settings').where({ id }).first();
    res.status(201).json({ data: created });
  } catch (e) {
    next(e);
  }
});

// ─── Update setting (own) ──────────────────────────────────────────────────
router.patch('/settings/:uuid', requireAuth, validate(SettingInput.partial()), async (req, res, next) => {
  try {
    const user = req.user!;
    const setting = await db('laser_settings').where({ uuid: req.params.uuid }).first();
    if (!setting) throw notFound('Setting not found');
    if (setting.submitted_by !== user.id) throw forbidden('Not your setting');
    const update = { ...(req.body as Partial<SettingInput>), updated_at: nowIso() };
    if (setting.status === 'approved') {
      (update as Record<string, unknown>).status = 'pending';
      (update as Record<string, unknown>).moderated_by = null;
      (update as Record<string, unknown>).moderated_at = null;
    }
    if ((update as Record<string, unknown>).extra_params) {
      (update as Record<string, unknown>).extra_params = JSON.stringify(update.extra_params);
    }
    const tags = (update as { tags?: string[] }).tags;
    delete (update as { tags?: string[] }).tags;
    await db.transaction(async (trx) => {
      await trx('laser_settings').where({ id: setting.id }).update(update);
      if (tags) {
        await trx('laser_setting_tags').where({ setting_id: setting.id }).delete();
        await attachTags(trx, setting.id, tags);
      }
    });
    res.json({ data: await db('laser_settings').where({ id: setting.id }).first() });
  } catch (e) {
    next(e);
  }
});

// ─── Delete setting (own — soft) ───────────────────────────────────────────
router.delete('/settings/:uuid', requireAuth, async (req, res, next) => {
  try {
    const user = req.user!;
    const setting = await db('laser_settings').where({ uuid: req.params.uuid }).first();
    if (!setting) throw notFound('Setting not found');
    if (setting.submitted_by !== user.id) throw forbidden('Not your setting');
    await db('laser_settings').where({ id: setting.id }).update({ status: 'archived', updated_at: nowIso() });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ─── Voting ────────────────────────────────────────────────────────────────
router.post('/settings/:uuid/vote', requireAuth, voteLimiter, async (req, res, next) => {
  try {
    const user = req.user!;
    const setting = await db('laser_settings').where({ uuid: req.params.uuid, status: 'approved' }).first();
    if (!setting) throw notFound('Setting not found');
    const existing = await db('votes').where({ setting_id: setting.id, user_id: user.id }).first();
    if (existing) throw badRequest('Already voted');
    await db.transaction(async (trx) => {
      await trx('votes').insert({ setting_id: setting.id, user_id: user.id, created_at: nowIso() });
      await trx('laser_settings').where({ id: setting.id }).increment('vote_score', 1);
      await trx('users').where({ id: setting.submitted_by }).increment('reputation', 1);
    });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

router.delete('/settings/:uuid/vote', requireAuth, async (req, res, next) => {
  try {
    const user = req.user!;
    const setting = await db('laser_settings').where({ uuid: req.params.uuid }).first();
    if (!setting) throw notFound('Setting not found');
    const deleted = await db('votes').where({ setting_id: setting.id, user_id: user.id }).delete();
    if (deleted > 0) {
      await db.transaction(async (trx) => {
        await trx('laser_settings').where({ id: setting.id }).decrement('vote_score', 1);
        await trx('users').where({ id: setting.submitted_by }).decrement('reputation', 1);
      });
    }
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ─── Comments ──────────────────────────────────────────────────────────────
router.get('/settings/:uuid/comments', async (req, res, next) => {
  try {
    const setting = await db('laser_settings').where({ uuid: req.params.uuid }).first();
    if (!setting) throw notFound('Setting not found');
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50));
    const rows = await db('comments as c')
      .leftJoin('users as u', 'u.id', 'c.user_id')
      .where('c.setting_id', setting.id)
      .whereNull('c.parent_id')
      .where('c.is_deleted', false)
      .orderBy('c.created_at', 'asc')
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .select('c.id', 'c.body', 'c.parent_id', 'c.created_at', 'c.updated_at', 'u.id as user_id', 'u.display_name');
    const countRow = await db('comments').where({ setting_id: setting.id, is_deleted: false }).count<{ count: number }[]>('* as count').first();
    res.json({ data: rows, meta: { page, pageSize, total: Number(countRow?.count ?? 0) } });
  } catch (e) {
    next(e);
  }
});

router.post('/settings/:uuid/comments', requireAuth, commentLimiter, validate(CommentInput), async (req, res, next) => {
  try {
    const user = req.user!;
    const setting = await db('laser_settings').where({ uuid: req.params.uuid, status: 'approved' }).first();
    if (!setting) throw notFound('Setting not found');
    const input = req.body as { body: string; parent_id?: number | null };
    const now = nowIso();
    const [id] = await db('comments').insert({
      setting_id: setting.id,
      user_id: user.id,
      parent_id: input.parent_id ?? null,
      body: input.body,
      is_deleted: false,
      created_at: now,
      updated_at: now,
    });
    await db('laser_settings').where({ id: setting.id }).increment('comment_count', 1);
    res.status(201).json({ data: await db('comments').where({ id }).first() });
  } catch (e) {
    next(e);
  }
});

router.patch('/comments/:id', requireAuth, async (req, res, next) => {
  try {
    const user = req.user!;
    const c = await db('comments').where({ id: req.params.id }).first();
    if (!c) throw notFound('Comment not found');
    if (c.user_id !== user.id) throw forbidden('Not your comment');
    if (Date.now() - new Date(c.created_at).getTime() > 15 * 60 * 1000) {
      throw badRequest('Comment edit window has passed (15 minutes)');
    }
    const body = String((req.body as Record<string, unknown>)?.body ?? '').trim();
    if (!body) throw badRequest('Body required');
    await db('comments').where({ id: c.id }).update({ body, updated_at: nowIso() });
    res.json({ data: await db('comments').where({ id: c.id }).first() });
  } catch (e) {
    next(e);
  }
});

router.delete('/comments/:id', requireAuth, async (req, res, next) => {
  try {
    const user = req.user!;
    const c = await db('comments').where({ id: req.params.id }).first();
    if (!c) throw notFound('Comment not found');
    if (c.user_id !== user.id) throw forbidden('Not your comment');
    await db('comments').where({ id: c.id }).update({ is_deleted: true, body: '[deleted]' });
    await db('laser_settings').where({ id: c.setting_id }).decrement('comment_count', 1);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ─── XCS parse ─────────────────────────────────────────────────────────────
router.post(
  '/settings/parse-xcs',
  requireAuth,
  xcsUpload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) throw badRequest('Missing file');
      let parsed;
      try {
        parsed = parseXcs(req.file.buffer);
      } catch (e) {
        if (e instanceof XcsParseError) throw badRequest(e.message);
        throw e;
      }
      // Resolve device
      let device = null;
      if (parsed.ext_id) {
        device = await db('devices').where({ ext_id: parsed.ext_id }).first();
      }
      let material = null;
      if (parsed.xtool_material_id !== null) {
        material = await db('materials').where({ xtool_material_id: parsed.xtool_material_id }).first();
      }
      const warnings: string[] = [];
      if (parsed.ext_id && !device) warnings.push(`Unknown device extId: ${parsed.ext_id}`);
      if (parsed.xtool_material_id !== null && !material)
        warnings.push(`Unknown xTool material id: ${parsed.xtool_material_id}`);
      res.json({
        data: { parsed, resolved: { device, material }, warnings },
      });
    } catch (e) {
      next(e);
    }
  },
);

// ─── Bookmarks ─────────────────────────────────────────────────────────────
router.get('/my/bookmarks', requireAuth, async (req, res, next) => {
  try {
    const user = req.user!;
    const rows = await db('user_bookmarks as b')
      .join('laser_settings as s', 's.id', 'b.setting_id')
      .where('b.user_id', user.id)
      .orderBy('b.created_at', 'desc')
      .select('s.uuid', 's.title', 's.created_at', 's.vote_score', 's.view_count');
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

router.post('/settings/:uuid/bookmark', requireAuth, async (req, res, next) => {
  try {
    const user = req.user!;
    const setting = await db('laser_settings').where({ uuid: req.params.uuid }).first();
    if (!setting) throw notFound('Setting not found');
    await db('user_bookmarks')
      .insert({ user_id: user.id, setting_id: setting.id, created_at: nowIso() })
      .onConflict(['user_id', 'setting_id'])
      .ignore();
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

router.delete('/settings/:uuid/bookmark', requireAuth, async (req, res, next) => {
  try {
    const user = req.user!;
    const setting = await db('laser_settings').where({ uuid: req.params.uuid }).first();
    if (!setting) throw notFound('Setting not found');
    await db('user_bookmarks').where({ user_id: user.id, setting_id: setting.id }).delete();
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ─── Reports ───────────────────────────────────────────────────────────────
router.post('/reports', requireAuth, validate(ReportInput), async (req, res, next) => {
  try {
    const user = req.user!;
    const input = req.body as ReportInputType;
    // Rate limit: 10/day
    const today = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const [reportCount] = await db('content_reports')
      .where({ reporter_id: user.id })
      .andWhere('created_at', '>=', today)
      .count<{ c: number }[]>({ c: '*' });
    if (Number(reportCount?.c ?? 0) >= 10) throw badRequest('Daily report limit reached');
    const [id] = await db('content_reports').insert({
      reporter_id: user.id,
      target_type: input.target_type,
      target_id: input.target_id,
      reason: input.reason,
      description: input.description ?? null,
      status: 'pending',
      created_at: nowIso(),
    });
    res.status(201).json({ data: { id } });
  } catch (e) {
    next(e);
  }
});

// ─── My content ────────────────────────────────────────────────────────────
router.get('/my/settings', requireAuth, async (req, res, next) => {
  try {
    const user = req.user!;
    const rows = await db('laser_settings')
      .where({ submitted_by: user.id })
      .whereNot({ status: 'archived' })
      .orderBy('created_at', 'desc');
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

router.get('/my/votes', requireAuth, async (req, res, next) => {
  try {
    const user = req.user!;
    const rows = await db('votes as v')
      .join('laser_settings as s', 's.id', 'v.setting_id')
      .where('v.user_id', user.id)
      .orderBy('v.created_at', 'desc')
      .select('s.uuid', 's.title', 'v.created_at');
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

// ─── Helpers ───────────────────────────────────────────────────────────────
async function attachTags(trx: typeof db, settingId: number, tags: string[]): Promise<void> {
  for (const raw of tags) {
    const name = raw.trim().toLowerCase();
    if (!name) continue;
    const slug = slugify(name);
    let tag = await trx('setting_tags').where({ slug }).first();
    if (!tag) {
      const [tagId] = await trx('setting_tags').insert({
        name,
        slug,
        usage_count: 1,
        created_at: nowIso(),
      });
      tag = { id: Number(tagId) };
    } else {
      await trx('setting_tags').where({ id: tag.id }).increment('usage_count', 1);
    }
    await trx('laser_setting_tags')
      .insert({ setting_id: settingId, tag_id: tag.id })
      .onConflict(['setting_id', 'tag_id'])
      .ignore();
  }
}

export default router;
