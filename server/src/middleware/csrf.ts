import type { Request, Response, NextFunction } from 'express';

interface CsrfOptions {
  ignorePaths?: RegExp | RegExp[];
  /** Origins that are explicitly allowed in addition to the request host. */
  allowedOrigins?: string[];
}

/**
 * CSRF protection via Origin header validation. Combined with SameSite=Lax cookies, this
 * blocks cross-site form posts and fetches.
 *
 * GET/HEAD/OPTIONS are always allowed. For state-changing methods, the Origin header
 * (or Referer) must match the request host or an explicitly allowed origin.
 */
export function csrfOriginCheck(opts: CsrfOptions = {}) {
  const { ignorePaths, allowedOrigins = [] } = opts;
  return (req: Request, res: Response, next: NextFunction): void => {
    const safe = ['GET', 'HEAD', 'OPTIONS'];
    if (safe.includes(req.method)) return next();
    if (ignorePaths) {
      const list = Array.isArray(ignorePaths) ? ignorePaths : [ignorePaths];
      if (list.some((re) => re.test(req.path))) return next();
    }

    const origin = req.get('Origin') || req.get('Referer');
    if (!origin) {
      res.status(403).json({
        error: { code: 'csrf', message: 'Missing Origin/Referer header' },
      });
      return;
    }
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      res.status(403).json({ error: { code: 'csrf', message: 'Invalid Origin' } });
      return;
    }
    const reqHost = req.get('Host') ?? '';
    const allowedHosts = new Set<string>([reqHost, ...allowedOrigins.map((o) => safeHost(o))]);
    if (!allowedHosts.has(originHost)) {
      res.status(403).json({
        error: { code: 'csrf', message: 'Origin not allowed' },
      });
      return;
    }
    next();
  };
}

function safeHost(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}
