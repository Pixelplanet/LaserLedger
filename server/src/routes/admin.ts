import { Router } from 'express';
import path from 'node:path';
import multer from 'multer';
import { db } from '../db/index.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  ManufacturerInput,
  DeviceFamilyInput,
  DeviceInput,
  LaserTypeInput,
  MaterialCategoryInput,
  MaterialInput,
  OperationTypeInput,
  DeviceLaserTypesInput,
  TagInput,
  type DeviceLaserTypesInput as DeviceLaserTypesInputType,
} from '@shared/schemas.js';
import { slugify, nowIso } from '../utils/ids.js';
import { notFound, badRequest } from '../utils/errors.js';
import { parseXcs, XcsParseError } from '../services/xcs.js';

const router = Router();
const xcsUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(requireRole('admin'));

function suggestLaserTypeSlugs(parsed: {
  ext_id: string | null;
  light_source: string | null;
  layers: { pulse_width: number | null }[];
}): string[] {
  const source = parsed.light_source?.toLowerCase() ?? '';
  const extId = parsed.ext_id?.toLowerCase() ?? '';
  const hasPulseWidth = parsed.layers.some((layer) => layer.pulse_width !== null);

  if (source.includes('355') || source.includes('uv')) return ['uv'];
  if (source.includes('455') || source.includes('blue')) {
    if (extId === 'gs001') return ['blue-f2'];
    return ['blue-ultra', 'blue-f2'];
  }
  if (source.includes('1064') || source.includes('red') || hasPulseWidth) {
    if (extId === 'gs001') return ['ir'];
    if (extId === 'gs009-class-1') return ['mopa-single'];
    if (hasPulseWidth) return ['mopa', 'mopa-single'];
    return ['ir'];
  }

  return [];
}

function inferSuggestedName(originalName: string, parsedName: string | null): string {
  if (parsedName) return parsedName;
  const base = path.parse(originalName).name.trim();
  return base || 'New device';
}

// Generic CRUD helper
function crud(
  table: string,
  schema: { parse: (v: unknown) => Record<string, unknown>; partial?: () => { parse: (v: unknown) => Record<string, unknown> } },
  hooks: {
    beforeInsert?: (data: Record<string, unknown>) => Record<string, unknown>;
    beforeUpdate?: (data: Record<string, unknown>) => Record<string, unknown>;
  } = {},
) {
  const r = Router();
  async function audit(modId: string, action: 'create' | 'update' | 'delete', id: number, notes?: string) {
    await db('moderation_log').insert({
      moderator_id: modId,
      target_type: 'cms_entity',
      target_id: id,
      action,
      reason: null,
      notes: notes ?? `${table}#${id}`,
      created_at: nowIso(),
    });
  }
  r.get('/', async (_req, res, next) => {
    try {
      const rows = await db(table).select('*');
      res.json({ data: rows });
    } catch (e) {
      next(e);
    }
  });
  r.post('/', async (req, res, next) => {
    try {
      const parsed = schema.parse(req.body);
      const data = hooks.beforeInsert ? hooks.beforeInsert(parsed) : parsed;
      const [id] = await db(table).insert({ ...data, created_at: nowIso() });
      await audit(req.user!.id, 'create', Number(id));
      res.status(201).json({ data: await db(table).where({ id }).first() });
    } catch (e) {
      next(e);
    }
  });
  r.patch('/:id', async (req, res, next) => {
    try {
      const partial = schema.partial?.() ?? schema;
      const parsed = partial.parse(req.body);
      const data = hooks.beforeUpdate ? hooks.beforeUpdate(parsed) : parsed;
      const updated = await db(table).where({ id: req.params.id }).update({ ...data, updated_at: nowIso() });
      if (!updated) throw notFound(`${table} not found`);
      await audit(req.user!.id, 'update', Number(req.params.id));
      res.json({ data: await db(table).where({ id: req.params.id }).first() });
    } catch (e) {
      next(e);
    }
  });
  r.delete('/:id', async (req, res, next) => {
    try {
      const deleted = await db(table).where({ id: req.params.id }).delete();
      if (!deleted) throw notFound(`${table} not found`);
      await audit(req.user!.id, 'delete', Number(req.params.id));
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });
  return r;
}

router.use('/manufacturers', crud('manufacturers', ManufacturerInput, {
  beforeInsert: (d) => ({ ...d, slug: slugify(String(d.name)) }),
  beforeUpdate: (d) => (d.name ? { ...d, slug: slugify(String(d.name)) } : d),
}));

router.use('/device-families', crud('device_families', DeviceFamilyInput, {
  beforeInsert: (d) => ({ ...d, slug: slugify(String(d.name)) }),
  beforeUpdate: (d) => (d.name ? { ...d, slug: slugify(String(d.name)) } : d),
}));

router.post('/devices/parse-xcs', xcsUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw badRequest('Missing file');

    let parsed;
    try {
      parsed = parseXcs(req.file.buffer);
    } catch (error) {
      if (error instanceof XcsParseError) throw badRequest(error.message);
      throw error;
    }

    const existingDevice = parsed.ext_id
      ? await db('devices').where({ ext_id: parsed.ext_id }).first()
      : null;

    const suggestedSlugs = suggestLaserTypeSlugs(parsed);
    const matchingLaserTypes = suggestedSlugs.length === 0
      ? []
      : await db('laser_types').whereIn('slug', suggestedSlugs).select('id', 'name', 'slug');

    res.json({
      data: {
        parsed,
        existing_device: existingDevice,
        matching_laser_types: matchingLaserTypes,
        suggested_name: inferSuggestedName(req.file.originalname, parsed.ext_name),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.use('/devices', crud('devices', DeviceInput, {
  beforeInsert: (d) => ({ ...d, slug: slugify(String(d.name)) }),
  beforeUpdate: (d) => (d.name ? { ...d, slug: slugify(String(d.name)) } : d),
}));

router.use('/laser-types', crud('laser_types', LaserTypeInput, {
  beforeInsert: (d) => ({ ...d, slug: slugify(String(d.name)) }),
  beforeUpdate: (d) => (d.name ? { ...d, slug: slugify(String(d.name)) } : d),
}));

router.use('/material-categories', crud('material_categories', MaterialCategoryInput, {
  beforeInsert: (d) => ({ ...d, slug: slugify(String(d.name)) }),
  beforeUpdate: (d) => (d.name ? { ...d, slug: slugify(String(d.name)) } : d),
}));

router.use('/materials', crud('materials', MaterialInput, {
  beforeInsert: (d) => ({ ...d, slug: slugify(String(d.name)) }),
  beforeUpdate: (d) => (d.name ? { ...d, slug: slugify(String(d.name)) } : d),
}));

router.use('/operation-types', crud('operation_types', OperationTypeInput, {
  beforeInsert: (d) => ({ ...d, slug: slugify(String(d.name)) }),
  beforeUpdate: (d) => (d.name ? { ...d, slug: slugify(String(d.name)) } : d),
}));

router.use('/tags', crud('setting_tags', TagInput, {
  beforeInsert: (d) => ({ ...d, slug: slugify(String(d.name)) }),
  beforeUpdate: (d) => (d.name ? { ...d, slug: slugify(String(d.name)) } : d),
}));

// Device-laser-type junction
router.put('/devices/:id/laser-types', validate(DeviceLaserTypesInput), async (req, res, next) => {
  try {
    const deviceId = Number(req.params.id);
    const input = req.body as DeviceLaserTypesInputType;
    await db.transaction(async (trx) => {
      await trx('device_laser_types').where({ device_id: deviceId }).delete();
      for (const lt of input.laser_types) {
        await trx('device_laser_types').insert({
          device_id: deviceId,
          laser_type_id: lt.laser_type_id,
          power_watts: JSON.stringify(lt.power_watts ?? []),
          is_default: lt.is_default,
        });
      }
    });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ─── Users ─────────────────────────────────────────────────────────────────
router.get('/users', async (_req, res, next) => {
  try {
    const rows = await db('users')
      .select('id', 'email', 'display_name', 'role', 'email_verified', 'submission_count', 'reputation', 'created_at', 'last_login_at')
      .orderBy('created_at', 'desc')
      .limit(200);
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

router.patch('/users/:id', async (req, res, next) => {
  try {
    const { role } = req.body as Record<string, unknown>;
    const update: Record<string, unknown> = { updated_at: nowIso() };
    if (role && ['user', 'moderator', 'admin'].includes(String(role))) {
      update.role = role;
    } else {
      throw badRequest('Invalid role');
    }
    const updated = await db('users').where({ id: req.params.id }).update(update);
    if (!updated) throw notFound('User not found');
    res.json({ data: await db('users').where({ id: req.params.id }).first() });
  } catch (e) {
    next(e);
  }
});

// ─── System settings ───────────────────────────────────────────────────────
router.get('/system-settings', async (_req, res, next) => {
  try {
    const rows = await db('system_settings').select('*');
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

router.patch('/system-settings/:key', async (req, res, next) => {
  try {
    const { value } = req.body as { value: unknown };
    if (value === undefined) throw badRequest('Missing value');
    const updated = await db('system_settings')
      .where({ key: req.params.key })
      .update({ value: String(value), updated_at: nowIso() });
    if (!updated) throw notFound('Setting not found');
    res.json({ data: await db('system_settings').where({ key: req.params.key }).first() });
  } catch (e) {
    next(e);
  }
});

// ─── Audit log ─────────────────────────────────────────────────────────────
router.get('/moderation-log', async (_req, res, next) => {
  try {
    const rows = await db('moderation_log as ml')
      .leftJoin('users as u', 'u.id', 'ml.moderator_id')
      .orderBy('ml.created_at', 'desc')
      .limit(200)
      .select('ml.*', 'u.display_name as moderator_name');
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

// ─── Dashboard stats ───────────────────────────────────────────────────────
router.get('/stats', async (_req, res, next) => {
  try {
    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const [u] = await db('users').count<{ c: number }[]>({ c: '*' });
    const [uNew] = await db('users').where('created_at', '>=', since7).count<{ c: number }[]>({ c: '*' });
    const [s] = await db('laser_settings').count<{ c: number }[]>({ c: '*' });
    const [sApproved] = await db('laser_settings').where({ status: 'approved' }).count<{ c: number }[]>({ c: '*' });
    const [sPending] = await db('laser_settings').where({ status: 'pending' }).count<{ c: number }[]>({ c: '*' });
    const [sRejected] = await db('laser_settings').where({ status: 'rejected' }).count<{ c: number }[]>({ c: '*' });
    const [iPending] = await db('setting_images').where({ status: 'pending' }).count<{ c: number }[]>({ c: '*' });
    const [rPending] = await db('content_reports').where({ status: 'pending' }).count<{ c: number }[]>({ c: '*' });
    const [c] = await db('comments').where({ is_deleted: false }).count<{ c: number }[]>({ c: '*' });
    res.json({
      data: {
        users: { total: Number(u?.c ?? 0), new_7d: Number(uNew?.c ?? 0) },
        settings: {
          total: Number(s?.c ?? 0),
          approved: Number(sApproved?.c ?? 0),
          pending: Number(sPending?.c ?? 0),
          rejected: Number(sRejected?.c ?? 0),
        },
        images_pending: Number(iPending?.c ?? 0),
        reports_pending: Number(rPending?.c ?? 0),
        comments: Number(c?.c ?? 0),
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
