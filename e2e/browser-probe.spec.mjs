import { test, expect } from '@playwright/test';
import { installVercelAutomationBypass } from './helpers/vercel-bypass.mjs';

const previewOrigin = process.env.E2E_BASE_URL;
if (!previewOrigin) throw new Error('E2E_BASE_URL is required');

test('protected preview automation bypass reaches ClerkAI root', async ({ page }) => {
  await installVercelAutomationBypass(page);
  const firstParty5xx = [];
  page.on('response', (candidate) => {
    try {
      if (new URL(candidate.url()).origin === previewOrigin && candidate.status() >= 500) {
        firstParty5xx.push({ status: candidate.status(), url: new URL(candidate.url()).pathname });
      }
    } catch {
      // Ignore malformed third-party URLs; the probe only classifies preview-origin traffic.
    }
  });

  const response = await page.goto(`${previewOrigin}/`, { waitUntil: 'domcontentloaded' });
  expect(response, 'preview response missing').not.toBeNull();
  expect(response.status(), 'preview document status').toBe(200);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#root')).toBeVisible();
  await expect(page.getByText('Log in to Vercel', { exact: false })).toHaveCount(0);

  const assets = await page.evaluate(() => ({
    scripts: [...document.scripts].filter((node) => node.src).length,
    styles: [...document.querySelectorAll('link[rel="stylesheet"]')].length,
  }));
  expect(assets.scripts, 'probe did not load a JS asset').toBeGreaterThan(0);
  expect(assets.styles, 'probe did not load a CSS asset').toBeGreaterThan(0);
  expect(firstParty5xx, 'probe saw first-party 5xx responses').toEqual([]);
});
