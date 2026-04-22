import { createApp } from './app.js';
import { db } from './db/index.js';
import { env } from './config.js';
import { bootstrapAdmin, startSchedulers } from './services/scheduler.js';
import { emailTransportStatus } from './services/email.js';

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

  const emailStatus = emailTransportStatus();
  // eslint-disable-next-line no-console
  console.log(
    `[laserledger] env runtime=${env.NODE_ENV} app=${env.APP_ENV} email_configured=${emailStatus.configured} smtp_host=${emailStatus.host ?? 'none'} smtp_port=${emailStatus.port ?? 'none'}`,
  );

  const app = createApp();
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[laserledger] listening on http://localhost:${env.PORT} (${env.NODE_ENV}/${env.APP_ENV})`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[laserledger] startup error:', err);
  process.exit(1);
});
