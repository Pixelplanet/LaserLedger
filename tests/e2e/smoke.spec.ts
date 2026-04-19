import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('homepage smoke', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'LaserLedger' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Search' })).toBeVisible();
});

test('homepage accessibility audit (axe)', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
