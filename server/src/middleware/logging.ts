import type { Request, Response, NextFunction } from 'express';
import { isTest } from '../config.js';

/**
 * Structured JSON request logger.
 * Emits one line per completed request with method, path, status, duration_ms,
 * remote IP, user id (if authenticated), and request id.
 * Silenced when NODE_ENV=test.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (isTest()) return next();
  const start = process.hrtime.bigint();
  const reqId = (req.headers['x-request-id'] as string | undefined) ?? cryptoRandomId();
  res.setHeader('X-Request-Id', reqId);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const entry = {
      ts: new Date().toISOString(),
      level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      req_id: reqId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      duration_ms: Math.round(durationMs * 100) / 100,
      ip: (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip ?? null,
      user_id: req.user?.id ?? null,
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(entry));
  });

  next();
}

function cryptoRandomId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
