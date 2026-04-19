import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodSchema } from 'zod';
import { validationError } from '../utils/errors.js';

type Source = 'body' | 'query' | 'params';

/** Validate `req[source]` against a Zod schema, replacing it with the parsed result. */
export function validate<T>(schema: ZodSchema<T>, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[source]);
      // express types make `req.query` etc. read-only-ish; assign via index
      (req as unknown as Record<string, unknown>)[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(validationError('Validation failed', err.flatten()));
      } else {
        next(err);
      }
    }
  };
}
