import { test, expect } from '@playwright/test';

test('the Bay mounts, lights up, and the console navigates to a wing', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-bay]')).toHaveAttribute('data-mode', 'live', { timeout: 20_000 });
  await expect(page.locator('[data-console]')).toHaveAttribute('data-lit', '', { timeout: 20_000 });
  await page.locator('a[data-wing="recreation"]').click();
  await expect(page).toHaveURL(/\/recreation\/?$/);
  await expect(page.locator('h1[data-wing-name]')).toHaveText('Recreation');
});

test('the console links work without JavaScript', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.locator('[data-console]')).toBeVisible();
  await page.locator('a[data-wing="operations"]').click();
  await expect(page).toHaveURL(/\/operations\/?$/);
  await ctx.close();
});

test('reduced motion lights the console immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('[data-bay]')).toHaveAttribute('data-mode', 'live', { timeout: 20_000 });
  await expect(page.locator('[data-console]')).toHaveAttribute('data-lit', '', { timeout: 1_000 });
});

test('the below-fold text lists the four wings', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main.below a[href="/operations"]')).toHaveText('Operations');
  await expect(page.locator('main.below a[href="/containment"]')).toHaveText('Containment');
});
