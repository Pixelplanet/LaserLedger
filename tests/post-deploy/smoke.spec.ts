import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * Post-deployment verification — runs against the LIVE test deployment
 * (https://test.ledger.lasertools.org by default). These assertions cover
 * things that can only be confirmed once the real container is running
 * behind Caddy with a migrated database, and therefore are NOT exercised
 * by the in-process integration suite:
 *   - the process is up and serving the health endpoint
 *   - TLS terminates and security headers are applied by the edge
 *   - reference/seed data migrated into the live database
 *   - the built SPA shell is served and hydrates
 *   - file-export endpoints serve the correct binary content types end-to-end
 */

async function expectJson(req: APIRequestContext, path: string) {
  const res = await req.get(path);
  expect(res.status(), `${path} should be 200`).toBe(200);
  return res;
}

test.describe('post-deploy API', () => {
  test('health endpoint reports ok', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'ok' });
  });

  test('responses carry app hardening headers', async ({ request }) => {
    const res = await request.get('/health');
    const headers = res.headers();
    // These are set by the Express app itself, so they must be present on
    // every deployment regardless of the edge proxy configuration.
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  test('stats endpoint returns numeric counts', async ({ request }) => {
    const res = await expectJson(request, '/api/stats');
    const { data } = await res.json();
    expect(typeof data.devices).toBe('number');
    expect(typeof data.materials).toBe('number');
    expect(typeof data.settings).toBe('number');
  });

  test('seed reference data migrated into the live database', async ({ request }) => {
    const [devices, materials, lasers] = await Promise.all([
      (await expectJson(request, '/api/devices')).json(),
      (await expectJson(request, '/api/materials')).json(),
      (await expectJson(request, '/api/laser-types')).json(),
    ]);
    expect(Array.isArray(devices.data)).toBe(true);
    expect(devices.data.length).toBeGreaterThan(0);
    expect(materials.data.length).toBeGreaterThan(0);
    expect(lasers.data.length).toBeGreaterThan(0);
    // Every device should expose a slug we can build landing pages from.
    expect(devices.data[0].slug).toBeTruthy();
  });

  test('device overview endpoint resolves for a seeded device', async ({ request }) => {
    const { data: devices } = await (await expectJson(request, '/api/devices')).json();
    const slug = devices[0].slug as string;
    const res = await request.get(`/api/devices/${slug}/overview`);
    expect(res.status()).toBe(200);
  });

  test('export endpoints serve correct content types when data exists', async ({ request }) => {
    const res = await expectJson(request, '/api/gallery?limit=1');
    const { data } = await res.json();
    test.skip(!Array.isArray(data) || data.length === 0, 'No approved settings on the test server yet');
    const uuid = data[0].uuid as string;

    const xcs = await request.get(`/api/settings/${uuid}/export?format=xcs`);
    expect(xcs.status()).toBe(200);
    expect(xcs.headers()['content-type']).toContain('application/json');
    expect(xcs.headers()['content-disposition']).toContain('.xcs');

    const xs = await request.get(`/api/settings/${uuid}/export?format=xs`);
    expect(xs.status()).toBe(200);
    expect(xs.headers()['content-type']).toContain('application/zip');
    expect(xs.headers()['content-disposition']).toContain('.xs');

    const bad = await request.get(`/api/settings/${uuid}/export?format=stl`);
    expect(bad.status()).toBe(400);
  });
});

test.describe('post-deploy SPA', () => {
  test('homepage shell hydrates', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'LaserLedger' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Search' })).toBeVisible();
  });

  test('gallery route loads client-side', async ({ page }) => {
    const res = await page.goto('/gallery');
    expect(res?.status()).toBeLessThan(400);
    // SPA fallback serves index.html for unknown deep links; the app shell mounts.
    await expect(page.getByRole('heading', { name: 'LaserLedger' })).toBeVisible();
  });
});
