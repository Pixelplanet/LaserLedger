import { describe, expect, it } from 'vitest';
import { signToken, verifyToken, hashPassword, verifyPassword } from './tokens.js';

describe('JWT tokens', () => {
  it('roundtrips a payload', () => {
    const t = signToken({ sub: 'abc1234567890def', role: 'user' });
    const decoded = verifyToken(t);
    expect(decoded).not.toBeNull();
    expect(decoded!.sub).toBe('abc1234567890def');
    expect(decoded!.role).toBe('user');
  });

  it('returns null for tampered tokens', () => {
    const t = signToken({ sub: 'abc1234567890def', role: 'user' });
    const tampered = t.slice(0, -2) + 'xx';
    expect(verifyToken(tampered)).toBeNull();
  });

  it('returns null for garbage', () => {
    expect(verifyToken('not-a-token')).toBeNull();
  });
});

describe('password hashing', () => {
  it('produces a verifiable hash', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('produces unique hashes for the same password (salt)', async () => {
    const a = await hashPassword('hello');
    const b = await hashPassword('hello');
    expect(a).not.toBe(b);
  });
});
