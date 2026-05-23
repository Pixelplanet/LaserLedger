import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { AppError } from '../utils/errors.js';
import { ZodError } from 'zod';
import { isProd, isTest } from '../config.js';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'not_found', message: `Not found: ${req.path}` } });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }
  if (err instanceof ZodError) {
    res.status(422).json({
      error: { code: 'validation_error', message: 'Validation failed', details: err.flatten() },
    });
    return;
  }
  if (err instanceof multer.MulterError) {
    const isTooLarge = err.code === 'LIMIT_FILE_SIZE';
    res.status(isTooLarge ? 413 : 400).json({
      error: {
        code: isTooLarge ? 'payload_too_large' : 'bad_request',
        message: isTooLarge ? 'Uploaded file is too large' : err.message,
      },
    });
    return;
  }
  if (!isTest()) {
    // eslint-disable-next-line no-console
    console.error('[error]', req.method, req.path, err);
  }
  const message = isProd() ? 'Internal server error' : (err as Error)?.message ?? 'Unknown error';
  res.status(500).json({ error: { code: 'internal', message } });
}
