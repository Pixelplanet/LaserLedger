import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../config.js';

export interface JwtPayload {
  sub: string; // user id
  role: 'user' | 'moderator' | 'admin';
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    if (typeof decoded.sub !== 'string') return null;
    const role = decoded.role;
    if (role !== 'user' && role !== 'moderator' && role !== 'admin') return null;
    return { sub: decoded.sub, role };
  } catch {
    return null;
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export const COOKIE_NAME = env.COOKIE_NAME;

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}
