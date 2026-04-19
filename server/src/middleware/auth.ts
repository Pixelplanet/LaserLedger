import type { Request, Response, NextFunction } from 'express';
import { COOKIE_NAME, verifyToken, signToken, cookieOptions } from '../auth/tokens.js';
import { db } from '../db/index.js';
import type { User } from '@shared/types.js';
import { unauthorized, forbidden } from '../utils/errors.js';
import type { UserRole } from '@shared/schemas.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
  }
}

/**
 * Auth middleware: parse JWT cookie, attach req.user, refresh sliding window token.
 * Does NOT throw — call requireAuth() to enforce authentication on a route.
 */
export async function attachUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = (req.cookies as Record<string, string> | undefined)?.[COOKIE_NAME];
    if (!token) return next();
    const payload = verifyToken(token);
    if (!payload) return next();
    const user = await db<User>('users').where({ id: payload.sub }).first();
    if (!user) return next();
    req.user = user;
    // Sliding window refresh
    res.cookie(COOKIE_NAME, signToken({ sub: user.id, role: user.role }), cookieOptions());
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(unauthorized());
  if (!req.user.email_verified) return next(forbidden('Email verification required'));
  next();
}

/** Allow authenticated but not necessarily verified users (e.g. resend verification). */
export function requireAuthAny(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(unauthorized());
  next();
}

export function requireRole(min: UserRole) {
  const order: Record<UserRole, number> = { user: 0, moderator: 1, admin: 2 };
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(unauthorized());
    if (order[req.user.role] < order[min]) return next(forbidden('Insufficient permissions'));
    next();
  };
}
