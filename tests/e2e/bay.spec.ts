import { test, expect } from '@playwright/test';

test('the Bay mounts, lights up, and the console navigates to a wing', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-bay]')).toHaveAttribute('data-mode', 'live', { timeout: 20_000 });
  await expect(page.locator('[data-console]')).toHaveAttribute('data-lit', '', { timeout: 20_000 });
  await page.locator('a[data-wing="recreation"]').click();
  await expect(page).toHaveURL(/\/recreation\/?$/);
  await expect(page.locator('h1[data-wing-name]')).toHaveText('Recreation');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the console links work without JavaScript', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-console]')).toBeVisible();
    await page.locator('a[data-wing="operations"]').click();
    await expect(page).toHaveURL(/\/operations\/?$/);
  });
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

test('the Bay falls back to the still when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    // @ts-expect-error overriding for the test
    HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) {
      if (/webgl/i.test(type)) return null;
      return (orig as unknown as (this: HTMLCanvasElement, t: string, ...r: unknown[]) => unknown).call(this, type, ...rest);
    };
  });
  const missing: string[] = [];
  page.on('response', (r) => { if (r.status() === 404) missing.push(r.url()); });
  await page.goto('/');
  await expect(page.locator('[data-bay]')).toHaveAttribute('data-mode', 'still');
  await expect(page.locator('[data-console]')).toHaveAttribute('data-lit', '');
  await expect(page.locator('.bay-still')).toBeVisible();
  expect(missing.filter((u) => u.includes('bay-still'))).toEqual([]);
});
