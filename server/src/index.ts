import { createApp } from './app.js';
import { db } from './db/index.js';
import { env } from './config.js';
import { bootstrapAdmin, startSchedulers } from './services/scheduler.js';

async function main(): Promise<void> {
  try {
    // eslint-disable-next-line no-console
    console.log('[laserledger] running migrations…');
    await db.migrate.latest();
    // eslint-disable-next-line no-console
    console.log('[laserledger] migrations complete');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[laserledger] migration failed:', err);
    process.exit(1);
  }

  await bootstrapAdmin().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[laserledger] admin bootstrap failed:', err);
  });

  startSchedulers();

  const app = createApp();
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[laserledger] listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[laserledger] startup error:', err);
  process.exit(1);
});
