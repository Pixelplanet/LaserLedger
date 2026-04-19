import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env, isProd } from './config.js';
import { attachUser } from './middleware/auth.js';
import { csrfOriginCheck } from './middleware/csrf.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { requestLogger } from './middleware/logging.js';
import authRouter from './routes/auth.js';
import publicRouter from './routes/public.js';
import settingsRouter from './routes/settings.js';
import imagesRouter from './routes/images.js';
import modRouter from './routes/mod.js';
import adminRouter from './routes/admin.js';
import { db } from './db/index.js';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  // Trust the first proxy (Caddy/nginx in production)
  if (isProd()) app.set('trust proxy', 1);

  // Security headers (helmet-equivalent minimal set — Caddy adds the rest)
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(cors({ origin: env.APP_BASE_URL, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(
    csrfOriginCheck({
      ignorePaths: [/^\/api\/uploads\//, /^\/health$/, /^\/robots\.txt$/, /^\/sitemap\.xml$/],
      allowedOrigins: [env.APP_BASE_URL],
    }),
  );
  app.use(attachUser);
  app.use(requestLogger);

  // Health
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // SEO
  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain').send(
      `User-agent: *\nDisallow: /api/\nDisallow: /admin\nDisallow: /mod\nSitemap: ${env.APP_BASE_URL}/sitemap.xml\n`,
    );
  });

  app.get('/sitemap.xml', async (_req, res, next) => {
    try {
      const rows = await db('laser_settings')
        .where({ status: 'approved' })
        .orderBy('updated_at', 'desc')
        .limit(50_000)
        .select('uuid', 'updated_at');
      const base = env.APP_BASE_URL.replace(/\/+$/, '');
      const urls = [
        `<url><loc>${base}/</loc></url>`,
        `<url><loc>${base}/search</loc></url>`,
        ...rows.map(
          (r) =>
            `<url><loc>${base}/settings/${r.uuid}</loc><lastmod>${new Date(r.updated_at).toISOString()}</lastmod></url>`,
        ),
      ].join('');
      res
        .type('application/xml')
        .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
    } catch (e) {
      next(e);
    }
  });

  // Mount routes
  app.use('/api/auth', authRouter);
  app.use('/api', publicRouter);
  app.use('/api', settingsRouter);
  app.use('/api', imagesRouter);
  app.use('/api/mod', modRouter);
  app.use('/api/admin', adminRouter);

  // ─── Static client assets + SPA fallback ─────────────────────────────────
  // Resolve client/dist relative to compiled server/dist location.
  const here = path.dirname(fileURLToPath(import.meta.url));
  // Try common locations: dev (project root) and prod (next to compiled server).
  const candidates = [
    path.resolve(here, '../../../../client/dist'),
    path.resolve(here, '../../client/dist'),
    path.resolve(process.cwd(), 'client/dist'),
  ];
  const clientDist = candidates.find((p) => fs.existsSync(path.join(p, 'index.html')));
  if (clientDist) {
    app.use(express.static(clientDist, { index: false, maxAge: isProd() ? '1h' : 0 }));
    app.get(/^(?!\/api\/|\/uploads\/|\/health$|\/robots\.txt$|\/sitemap\.xml$).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
