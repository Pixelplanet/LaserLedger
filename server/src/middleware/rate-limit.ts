import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { env } from '../config.js';

const userKey = (req: Request) => req.user?.id ?? req.ip ?? 'anon';
const skip = () => env.NODE_ENV === 'test';

/** 10 setting submissions per hour per user. */
export const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKey,
  skip,
  message: { error: { code: 'rate_limited', message: 'Too many submissions. Try again later.' } },
});

/** 60 votes per minute per user. */
export const voteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKey,
  skip,
  message: { error: { code: 'rate_limited', message: 'Slow down on voting.' } },
});

/** 30 comments per hour per user. */
export const commentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKey,
  skip,
  message: { error: { code: 'rate_limited', message: 'Too many comments. Try again later.' } },
});

/** 20 image uploads per hour per user. */
export const imageUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKey,
  skip,
  message: { error: { code: 'rate_limited', message: 'Too many image uploads. Try again later.' } },
});
