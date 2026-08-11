import { test, expect } from '@playwright/test';
import { installVercelAutomationBypass } from './helpers/vercel-bypass.mjs';

const previewOrigin = process.env.E2E_BASE_URL;
if (!previewOrigin) throw new Error('E2E_BASE_URL is required');

test('protected preview automation bypass reaches ClerkAI root', async ({ page }) => {
  await installVercelAutomationBypass(page);
  const response = await page.goto(`${previewOrigin}/`, { waitUntil: 'domcontentloaded' });
  expect(response, 'preview response missing').not.toBeNull();
  expect(response.status(), 'preview document status').toBe(200);
  await expect(page.locator('#root')).toBeVisible();
  await expect(page.getByText('Log in to Vercel', { exact: false })).toHaveCount(0);
});
