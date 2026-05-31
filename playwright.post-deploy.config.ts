import { defineConfig, devices } from '@playwright/test';

/**
 * Post-deployment smoke configuration. Runs the specs in
 * `tests/post-deploy` against an ALREADY-RUNNING remote deployment
 * (no local webServer). Point it at the target with the `BASE_URL`
 * environment variable, e.g.:
 *
 *   BASE_URL=https://test.ledger.lasertools.org npm run test:post-deploy
 *
 * These checks verify things that can only be confirmed after the real
 * container is live behind Caddy: health endpoint, TLS/security headers,
 * seeded reference data, and that the SPA shell serves correctly.
 */
const baseURL = process.env.BASE_URL ?? 'https://test.ledger.lasertools.org';

export default defineConfig({
  testDir: './tests/post-deploy',
  // Allow time for the freshly-recreated container to finish booting and
  // running migrations before the first request succeeds.
  retries: 3,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    ignoreHTTPSErrors: false,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
