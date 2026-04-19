import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs/promises';
import { uuid } from '../utils/ids.js';
import { env } from '../config.js';
import { badRequest } from '../utils/errors.js';

export interface ProcessedImage {
  uuid: string;
  storedPath: string; // relative path: images/YYYY/MM/UUID/original.webp
  thumbnailPath: string; // relative path: images/YYYY/MM/UUID/thumb.webp
  cardPath: string; // relative path: images/YYYY/MM/UUID/card.webp
  mimeType: 'image/webp';
  fileSize: number;
  width: number;
  height: number;
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_DIMENSION = 8192;

// Magic bytes for image format detection — supplements MIME type check
const MAGIC = {
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF (with WEBP later in header)
};

/** Verify the buffer starts with valid magic bytes for an allowed image format. */
export function detectImageFormat(buf: Buffer): 'jpeg' | 'png' | 'webp' | null {
  if (matches(buf, MAGIC.jpeg)) return 'jpeg';
  if (matches(buf, MAGIC.png)) return 'png';
  if (matches(buf, MAGIC.webp) && buf.length >= 12 && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'webp';
  }
  return null;
}

function matches(buf: Buffer, magic: number[]): boolean {
  if (buf.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (buf[i] !== magic[i]) return false;
  }
  return true;
}

/**
 * Process an uploaded image:
 *   - validate magic bytes & MIME type
 *   - re-encode to WebP (strips EXIF metadata)
 *   - generate original (max 2048px), card (800x600), thumb (400x300) variants
 *   - save to {UPLOAD_DIR}/images/YYYY/MM/{uuid}/
 */
export async function processImage(
  buffer: Buffer,
  declaredMimeType: string,
): Promise<ProcessedImage> {
  if (!ALLOWED_MIME.has(declaredMimeType)) {
    throw badRequest(`Unsupported image type: ${declaredMimeType}`);
  }
  const detected = detectImageFormat(buffer);
  if (!detected) throw badRequest('Invalid or corrupt image file');
  // Cross-check declared MIME with magic bytes
  const expected = `image/${detected}`;
  if (declaredMimeType !== expected) {
    throw badRequest(`MIME type mismatch: declared ${declaredMimeType}, detected ${expected}`);
  }

  let pipeline = sharp(buffer, { failOn: 'error' });
  const meta = await pipeline.metadata();
  if (!meta.width || !meta.height) throw badRequest('Could not read image dimensions');
  if (meta.width > MAX_DIMENSION || meta.height > MAX_DIMENSION) {
    throw badRequest(`Image too large: ${meta.width}x${meta.height} (max ${MAX_DIMENSION})`);
  }

  const id = uuid();
  const now = new Date();
  const yy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dirRel = path.posix.join('images', yy, mm, id);
  const dirAbs = path.join(env.UPLOAD_DIR, dirRel);
  await fs.mkdir(dirAbs, { recursive: true });

  // Strip EXIF: sharp by default does not include metadata in output
  const original = await sharp(buffer)
    .rotate() // honor EXIF orientation before stripping
    .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer({ resolveWithObject: true });

  const card = await sharp(buffer)
    .rotate()
    .resize({ width: 800, height: 600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const thumb = await sharp(buffer)
    .rotate()
    .resize({ width: 400, height: 300, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();

  await Promise.all([
    fs.writeFile(path.join(dirAbs, 'original.webp'), original.data),
    fs.writeFile(path.join(dirAbs, 'card.webp'), card),
    fs.writeFile(path.join(dirAbs, 'thumb.webp'), thumb),
  ]);

  return {
    uuid: id,
    storedPath: path.posix.join(dirRel, 'original.webp'),
    cardPath: path.posix.join(dirRel, 'card.webp'),
    thumbnailPath: path.posix.join(dirRel, 'thumb.webp'),
    mimeType: 'image/webp',
    fileSize: original.info.size,
    width: original.info.width,
    height: original.info.height,
  };
}

/** Delete all variants for an image's directory. Safe if directory missing. */
export async function deleteImageDir(storedPath: string): Promise<void> {
  // storedPath is e.g. images/2026/04/{uuid}/original.webp
  const dirRel = path.posix.dirname(storedPath);
  const dirAbs = path.join(env.UPLOAD_DIR, dirRel);
  await fs.rm(dirAbs, { recursive: true, force: true });
}

/** Get absolute disk path for serving an image variant — caller must validate access. */
export function imageVariantPath(year: string, month: string, id: string, variant: string): string {
  // Whitelist variants
  if (!/^(original|card|thumb)\.webp$/.test(variant)) {
    throw badRequest('Invalid image variant');
  }
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month) || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw badRequest('Invalid image path');
  }
  return path.join(env.UPLOAD_DIR, 'images', year, month, id, variant);
}
