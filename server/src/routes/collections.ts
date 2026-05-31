import { Router } from 'express';
import { db } from '../db/index.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { CollectionInput, CollectionItemInput } from '@shared/schemas.js';
import { uuid as makeUuid, nowIso } from '../utils/ids.js';
import { notFound, forbidden } from '../utils/errors.js';

const router = Router();

interface CollectionRow {
  id: number;
  uuid: string;
  user_id: string;
  name: string;
  description: string | null;
  is_public: boolean | number;
  created_at: string;
  updated_at: string;
}

async function loadItems(collectionId: number) {
  const rows = await db('collection_items as ci')
    .join('laser_settings as s', 's.id', 'ci.setting_id')
    .join('materials as m', 'm.id', 's.material_id')
    .join('devices as d', 'd.id', 's.device_id')
    .where('ci.collection_id', collectionId)
    .orderBy('ci.sort_order', 'asc')
    .orderBy('ci.added_at', 'asc')
    .select(
      's.id',
      's.uuid',
      's.title',
      's.status',
      's.power',
      's.speed',
      's.vote_score',
      'm.name as material_name',
      'd.name as device_name',
    );
  const ids = rows.map((r) => r.id);
  const images = ids.length
    ? await db('setting_images')
        .whereIn('setting_id', ids)
        .andWhere('status', 'approved')
        .orderByRaw('is_primary desc, sort_order asc')
        .select('setting_id', 'card_path', 'thumbnail_path', 'stored_path', 'caption')
    : [];
  const imgBySetting = new Map<number, (typeof images)[number]>();
  for (const img of images) {
    if (!imgBySetting.has(img.setting_id)) imgBySetting.set(img.setting_id, img);
  }
  return rows.map(({ id, ...rest }) => ({ ...rest, image: imgBySetting.get(id) ?? null }));
}

function publicCollection(c: CollectionRow, itemCount?: number) {
  return {
    uuid: c.uuid,
    name: c.name,
    description: c.description,
    is_public: !!c.is_public,
    created_at: c.created_at,
    updated_at: c.updated_at,
    ...(itemCount !== undefined ? { item_count: itemCount } : {}),
  };
}

// ─── My collections ──────────────────────────────────────────────────────────
router.get('/collections', requireAuth, async (req, res, next) => {
  try {
    const user = req.user!;
    const rows = (await db('collections')
      .where({ user_id: user.id })
      .orderBy('created_at', 'desc')) as CollectionRow[];
    const counts = await db('collection_items')
      .whereIn(
        'collection_id',
        rows.map((r) => r.id),
      )
      .groupBy('collection_id')
      .select('collection_id')
      .count<{ collection_id: number; c: number }[]>({ c: '*' });
    const countMap = new Map(counts.map((c) => [Number(c.collection_id), Number(c.c)]));
    res.json({ data: rows.map((r) => publicCollection(r, countMap.get(r.id) ?? 0)) });
  } catch (e) {
    next(e);
  }
});

// ─── Public collections for a user ───────────────────────────────────────────
router.get('/users/:id/collections', async (req, res, next) => {
  try {
    const rows = (await db('collections')
      .where({ user_id: req.params.id, is_public: true })
      .orderBy('updated_at', 'desc')) as CollectionRow[];
    const counts = await db('collection_items')
      .whereIn(
        'collection_id',
        rows.map((r) => r.id),
      )
      .groupBy('collection_id')
      .select('collection_id')
      .count<{ collection_id: number; c: number }[]>({ c: '*' });
    const countMap = new Map(counts.map((c) => [Number(c.collection_id), Number(c.c)]));
    res.json({ data: rows.map((r) => publicCollection(r, countMap.get(r.id) ?? 0)) });
  } catch (e) {
    next(e);
  }
});

// ─── Create ──────────────────────────────────────────────────────────────────
router.post('/collections', requireAuth, validate(CollectionInput), async (req, res, next) => {
  try {
    const user = req.user!;
    const input = req.body as CollectionInput;
    const now = nowIso();
    const uuid = makeUuid();
    await db('collections').insert({
      uuid,
      user_id: user.id,
      name: input.name,
      description: input.description ?? null,
      is_public: input.is_public ?? false,
      created_at: now,
      updated_at: now,
    });
    const row = (await db('collections').where({ uuid }).first()) as CollectionRow;
    res.status(201).json({ data: publicCollection(row, 0) });
  } catch (e) {
    next(e);
  }
});

// ─── Read one (public or owner) ──────────────────────────────────────────────
router.get('/collections/:uuid', async (req, res, next) => {
  try {
    const row = (await db('collections').where({ uuid: req.params.uuid }).first()) as
      | CollectionRow
      | undefined;
    if (!row) throw notFound('Collection not found');
    const isowner = req.user?.id === row.user_id;
    if (!row.is_public && !isowner) throw notFound('Collection not found');
    const owner = await db('users').where({ id: row.user_id }).first();
    const items = await loadItems(row.id);
    res.json({
      data: {
        ...publicCollection(row, items.length),
        owner: owner ? { id: owner.id, display_name: owner.display_name } : null,
        is_owner: isowner,
        items,
      },
    });
  } catch (e) {
    next(e);
  }
});

// ─── Update ──────────────────────────────────────────────────────────────────
router.patch('/collections/:uuid', requireAuth, validate(CollectionInput), async (req, res, next) => {
  try {
    const user = req.user!;
    const input = req.body as CollectionInput;
    const row = (await db('collections').where({ uuid: req.params.uuid }).first()) as
      | CollectionRow
      | undefined;
    if (!row) throw notFound('Collection not found');
    if (row.user_id !== user.id) throw forbidden('Not your collection');
    await db('collections')
      .where({ id: row.id })
      .update({
        name: input.name,
        description: input.description ?? null,
        is_public: input.is_public ?? false,
        updated_at: nowIso(),
      });
    const updated = (await db('collections').where({ id: row.id }).first()) as CollectionRow;
    res.json({ data: publicCollection(updated) });
  } catch (e) {
    next(e);
  }
});

// ─── Delete ──────────────────────────────────────────────────────────────────
router.delete('/collections/:uuid', requireAuth, async (req, res, next) => {
  try {
    const user = req.user!;
    const row = (await db('collections').where({ uuid: req.params.uuid }).first()) as
      | CollectionRow
      | undefined;
    if (!row) throw notFound('Collection not found');
    if (row.user_id !== user.id) throw forbidden('Not your collection');
    await db('collections').where({ id: row.id }).delete();
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ─── Add item ────────────────────────────────────────────────────────────────
router.post(
  '/collections/:uuid/items',
  requireAuth,
  validate(CollectionItemInput),
  async (req, res, next) => {
    try {
      const user = req.user!;
      const input = req.body as CollectionItemInput;
      const row = (await db('collections').where({ uuid: req.params.uuid }).first()) as
        | CollectionRow
        | undefined;
      if (!row) throw notFound('Collection not found');
      if (row.user_id !== user.id) throw forbidden('Not your collection');
      const setting = await db('laser_settings')
        .where({ uuid: input.setting_uuid, status: 'approved' })
        .first();
      if (!setting) throw notFound('Setting not found');
      const existing = await db('collection_items')
        .where({ collection_id: row.id, setting_id: setting.id })
        .first();
      if (!existing) {
        await db('collection_items').insert({
          collection_id: row.id,
          setting_id: setting.id,
          sort_order: 0,
          added_at: nowIso(),
        });
        await db('collections').where({ id: row.id }).update({ updated_at: nowIso() });
      }
      const items = await loadItems(row.id);
      res.status(201).json({ data: { items } });
    } catch (e) {
      next(e);
    }
  },
);

// ─── Remove item ─────────────────────────────────────────────────────────────
router.delete('/collections/:uuid/items/:settingUuid', requireAuth, async (req, res, next) => {
  try {
    const user = req.user!;
    const row = (await db('collections').where({ uuid: req.params.uuid }).first()) as
      | CollectionRow
      | undefined;
    if (!row) throw notFound('Collection not found');
    if (row.user_id !== user.id) throw forbidden('Not your collection');
    const setting = await db('laser_settings').where({ uuid: req.params.settingUuid }).first();
    if (setting) {
      await db('collection_items')
        .where({ collection_id: row.id, setting_id: setting.id })
        .delete();
      await db('collections').where({ id: row.id }).update({ updated_at: nowIso() });
    }
    const items = await loadItems(row.id);
    res.json({ data: { items } });
  } catch (e) {
    next(e);
  }
});

export default router;
