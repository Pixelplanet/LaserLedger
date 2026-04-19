import { Router } from 'express';
import multer from 'multer';
import { db } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { imageUploadLimiter } from '../middleware/rate-limit.js';
import { processImage, deleteImageDir, imageVariantPath } from '../services/images.js';
import { moderateImage } from '../services/image-moderation.js';
import { badRequest, forbidden, notFound } from '../utils/errors.js';
import { nowIso } from '../utils/ids.js';
import path from 'node:path';
import { env } from '../config.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ─── Upload image to a setting ─────────────────────────────────────────────
router.post(
  '/settings/:uuid/images',
  requireAuth,
  imageUploadLimiter,
  upload.single('image'),
  async (req, res, next) => {
    try {
      const user = req.user!;
      if (!req.file) throw badRequest('Missing image file');
      const moderation = await moderateImage(req.file.buffer, req.file.mimetype);
      if (!moderation.allowed) {
        throw badRequest(moderation.reason ?? 'Image rejected by automated moderation');
      }
      const setting = await db('laser_settings').where({ uuid: req.params.uuid }).first();
      if (!setting) throw notFound('Setting not found');
      if (setting.submitted_by !== user.id && user.role === 'user') {
        throw forbidden('Only submission owner can add images');
      }
      // Enforce max images per setting
      const maxRow = await db('system_settings').where({ key: 'max_images_per_setting' }).first();
      const maxImages = Number(maxRow?.value ?? 5);
      const [imageCount] = await db('setting_images')
        .where({ setting_id: setting.id })
        .whereNot({ status: 'rejected' })
        .count<{ c: number }[]>({ c: '*' });
      const existingCount = Number(imageCount?.c ?? 0);
      if (existingCount >= maxImages) throw badRequest(`Maximum ${maxImages} images per setting`);

      const processed = await processImage(req.file.buffer, req.file.mimetype);
      const isPrimary = existingCount === 0;
      const [id] = await db('setting_images').insert({
        uuid: processed.uuid,
        setting_id: setting.id,
        uploaded_by: user.id,
        original_filename: req.file.originalname,
        stored_path: processed.storedPath,
        thumbnail_path: processed.thumbnailPath,
        card_path: processed.cardPath,
        mime_type: processed.mimeType,
        file_size: processed.fileSize,
        width: processed.width,
        height: processed.height,
        caption: null,
        is_primary: isPrimary,
        sort_order: existingCount,
        status: 'pending',
        moderated_by: null,
        moderated_at: null,
        rejected_reason: null,
        created_at: nowIso(),
      });
      res.status(201).json({ data: await db('setting_images').where({ id }).first() });
    } catch (e) {
      next(e);
    }
  },
);

// ─── Patch image (set primary, sort_order) ────────────────────────────────
router.patch('/images/:uuid', requireAuth, async (req, res, next) => {
  try {
    const user = req.user!;
    const img = await db('setting_images').where({ uuid: req.params.uuid }).first();
    if (!img) throw notFound('Image not found');
    if (img.uploaded_by !== user.id && user.role === 'user') {
      throw forbidden('Not your image');
    }
    const body = req.body as { is_primary?: boolean; sort_order?: number };
    const update: Record<string, unknown> = {};
    if (typeof body.sort_order === 'number') update.sort_order = body.sort_order;
    if (typeof body.is_primary === 'boolean') update.is_primary = body.is_primary;
    if (Object.keys(update).length === 0) throw badRequest('No fields to update');
    await db.transaction(async (trx) => {
      if (body.is_primary === true) {
        await trx('setting_images')
          .where({ setting_id: img.setting_id })
          .update({ is_primary: false });
      }
      await trx('setting_images').where({ id: img.id }).update(update);
    });
    res.json({ data: await db('setting_images').where({ id: img.id }).first() });
  } catch (e) {
    next(e);
  }
});

// ─── Delete own image ──────────────────────────────────────────────────────
router.delete('/images/:uuid', requireAuth, async (req, res, next) => {
  try {
    const user = req.user!;
    const img = await db('setting_images').where({ uuid: req.params.uuid }).first();
    if (!img) throw notFound('Image not found');
    if (img.uploaded_by !== user.id && user.role === 'user') {
      throw forbidden('Not your image');
    }
    await db('setting_images').where({ id: img.id }).delete();
    await deleteImageDir(img.stored_path).catch(() => {});
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ─── Serve image (public) ──────────────────────────────────────────────────
// URL form: /uploads/images/2026/04/{uuid}/original.webp
router.get('/uploads/images/:year/:month/:id/:variant', (req, res, next) => {
  try {
    const { year, month, id, variant } = req.params;
    const abs = imageVariantPath(year!, month!, id!, variant!);
    res.sendFile(path.resolve(abs), (err) => {
      if (err) next(notFound('Image not found'));
    });
  } catch (e) {
    next(e);
  }
});

export default router;
