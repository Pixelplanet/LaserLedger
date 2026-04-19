import { Router } from 'express';
import { db } from '../db/index.js';

const router = Router();

router.get('/devices', async (_req, res, next) => {
  try {
    const devices = await db('devices as d')
      .leftJoin('device_families as df', 'df.id', 'd.family_id')
      .leftJoin('manufacturers as mf', 'mf.id', 'df.manufacturer_id')
      .where('d.is_active', true)
      .orderBy(['mf.sort_order', 'df.sort_order', 'd.sort_order'])
      .select(
        'd.id',
        'd.name',
        'd.slug',
        'd.ext_id',
        'd.image_url',
        'd.product_url',
        'd.workspace_width',
        'd.workspace_height',
        'df.id as family_id',
        'df.name as family_name',
        'mf.id as manufacturer_id',
        'mf.name as manufacturer_name',
      );
    // Attach laser_types per device
    const laserMap = await db('device_laser_types as dlt')
      .join('laser_types as lt', 'lt.id', 'dlt.laser_type_id')
      .select(
        'dlt.device_id',
        'lt.id',
        'lt.name',
        'lt.slug',
        'lt.has_pulse_width',
        'lt.has_mopa_frequency',
        'dlt.is_default',
        'dlt.power_watts',
      );
    const byDevice = new Map<number, typeof laserMap>();
    for (const row of laserMap) {
      const arr = byDevice.get(row.device_id) ?? [];
      arr.push(row);
      byDevice.set(row.device_id, arr);
    }
    const out = devices.map((d) => ({ ...d, laser_types: byDevice.get(d.id) ?? [] }));
    res.json({ data: out });
  } catch (e) {
    next(e);
  }
});

router.get('/laser-types', async (_req, res, next) => {
  try {
    const rows = await db('laser_types').where({ is_active: true }).orderBy('sort_order');
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

router.get('/materials', async (_req, res, next) => {
  try {
    const rows = await db('materials as m')
      .leftJoin('material_categories as c', 'c.id', 'm.category_id')
      .where('m.is_active', true)
      .orderBy(['c.sort_order', 'm.sort_order'])
      .select('m.*', 'c.name as category_name', 'c.slug as category_slug');
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

router.get('/material-categories', async (_req, res, next) => {
  try {
    const rows = await db('material_categories').orderBy('sort_order');
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

router.get('/operation-types', async (_req, res, next) => {
  try {
    const rows = await db('operation_types').orderBy('sort_order');
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

router.get('/manufacturers', async (_req, res, next) => {
  try {
    const rows = await db('manufacturers').where({ is_active: true }).orderBy('sort_order');
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

router.get('/tags', async (_req, res, next) => {
  try {
    const rows = await db('setting_tags').orderBy('usage_count', 'desc').limit(50);
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

router.get('/tags/suggest', async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim().toLowerCase();
    if (!q) {
      res.json({ data: [] });
      return;
    }
    const rows = await db('setting_tags')
      .where('slug', 'like', `${q}%`)
      .orderBy('usage_count', 'desc')
      .limit(10);
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

router.get('/users/:id/profile', async (req, res, next) => {
  try {
    const user = await db('users').where({ id: req.params.id }).first();
    if (!user) {
      res.status(404).json({ error: { code: 'not_found', message: 'User not found' } });
      return;
    }
    const submissions = await db('laser_settings')
      .where({ submitted_by: user.id, status: 'approved' })
      .orderBy('created_at', 'desc')
      .limit(20)
      .select('id', 'uuid', 'title', 'created_at', 'vote_score', 'view_count');
    res.json({
      data: {
        id: user.id,
        display_name: user.display_name,
        bio: user.bio,
        avatar_url: user.avatar_url,
        submission_count: user.submission_count,
        reputation: user.reputation,
        created_at: user.created_at,
        recent_submissions: submissions,
      },
    });
  } catch (e) {
    next(e);
  }
});

router.get('/stats', async (_req, res, next) => {
  try {
    const [settings] = await db('laser_settings').where({ status: 'approved' }).count<{ c: number }[]>({ c: '*' });
    const [users] = await db('users').count<{ c: number }[]>({ c: '*' });
    const [devices] = await db('devices').where({ is_active: true }).count<{ c: number }[]>({ c: '*' });
    const [materials] = await db('materials').where({ is_active: true }).count<{ c: number }[]>({ c: '*' });
    res.json({
      data: {
        settings: Number(settings?.c ?? 0),
        users: Number(users?.c ?? 0),
        devices: Number(devices?.c ?? 0),
        materials: Number(materials?.c ?? 0),
      },
    });
  } catch (e) {
    next(e);
  }
});

// Public-facing system_settings — only keys prefixed with `public_` are exposed.
router.get('/system-settings', async (_req, res, next) => {
  try {
    const rows = await db('system_settings').where('key', 'like', 'public_%').select('key', 'value');
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

export default router;
