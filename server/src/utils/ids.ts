// Slug, UUID, hex-id helpers — shared across server code & tests.
import { randomBytes } from 'node:crypto';

/** Convert an arbitrary string to a URL-safe slug. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150);
}

/** 16-char lowercase hex id (matches Cloudify 3D user format). */
export function hexId(): string {
  return randomBytes(8).toString('hex');
}

/** RFC 4122 v4-style UUID via crypto.randomUUID (Node ≥ 19). */
export function uuid(): string {
  // crypto.randomUUID is stable in Node ≥ 19 LTS
  return crypto.randomUUID();
}

/** ISO timestamp suitable for DATETIME columns. */
export function nowIso(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

/** Generate a URL-safe random token (hex). */
export function token(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}
