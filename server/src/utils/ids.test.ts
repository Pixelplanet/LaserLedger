import { describe, expect, it } from 'vitest';
import { slugify, hexId, uuid, nowIso, token } from './ids.js';

describe('slugify', () => {
  it('lowercases and dashes', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });
  it('strips non-alphanumeric', () => {
    expect(slugify('xTool F2 Ultra (UV)!')).toBe('xtool-f2-ultra-uv');
  });
  it('collapses repeated dashes', () => {
    expect(slugify('a   b---c')).toBe('a-b-c');
  });
  it('trims leading/trailing dashes', () => {
    expect(slugify('--abc--')).toBe('abc');
  });
  it('truncates to 150 chars', () => {
    const s = slugify('x'.repeat(300));
    expect(s.length).toBeLessThanOrEqual(150);
  });
  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });
  it('handles unicode by stripping', () => {
    expect(slugify('café résumé')).toBe('cafe-resume');
  });
});

describe('hexId', () => {
  it('produces 16 lowercase hex chars', () => {
    const id = hexId();
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });
  it('produces unique ids', () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(hexId());
    expect(set.size).toBe(1000);
  });
});

describe('uuid', () => {
  it('produces valid v4 uuid', () => {
    expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe('nowIso', () => {
  it('produces MySQL DATETIME format', () => {
    expect(nowIso()).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
});

describe('token', () => {
  it('produces hex token of expected length', () => {
    expect(token(32)).toMatch(/^[0-9a-f]{64}$/);
    expect(token(16)).toMatch(/^[0-9a-f]{32}$/);
  });
});
