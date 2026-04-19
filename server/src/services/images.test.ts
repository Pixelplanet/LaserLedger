import { describe, expect, it } from 'vitest';
import { detectImageFormat } from './images.js';

describe('detectImageFormat', () => {
  it('detects JPEG magic bytes', () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    expect(detectImageFormat(buf)).toBe('jpeg');
  });

  it('detects PNG magic bytes', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    expect(detectImageFormat(buf)).toBe('png');
  });

  it('detects WebP magic bytes', () => {
    const buf = Buffer.concat([
      Buffer.from([0x52, 0x49, 0x46, 0x46]), // RIFF
      Buffer.from([0x00, 0x00, 0x00, 0x00]), // size
      Buffer.from([0x57, 0x45, 0x42, 0x50]), // WEBP
    ]);
    expect(detectImageFormat(buf)).toBe('webp');
  });

  it('returns null for arbitrary data', () => {
    expect(detectImageFormat(Buffer.from('hello'))).toBeNull();
  });

  it('returns null for short buffer', () => {
    expect(detectImageFormat(Buffer.from([0xff]))).toBeNull();
  });

  it('rejects RIFF without WEBP marker', () => {
    const buf = Buffer.concat([
      Buffer.from([0x52, 0x49, 0x46, 0x46]),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from([0x57, 0x41, 0x56, 0x45]), // WAVE not WEBP
    ]);
    expect(detectImageFormat(buf)).toBeNull();
  });
});
