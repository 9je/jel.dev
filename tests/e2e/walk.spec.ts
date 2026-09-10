import { test, expect } from '@playwright/test';

const STOPS = ['booth', 'fabrication', 'recreation', 'operations', 'credentials', 'containment', 'file'];

test('lite path renders every stop in order with a dock', async ({ page }) => {
  await page.goto('/?effects=off');
  await expect(page.locator('[data-walk]')).toHaveAttribute('data-mode', 'lite');
  const ids = await page.locator('section[data-stop]').evaluateAll((els) => els.map((e) => e.getAttribute('data-stop')));
  expect(ids).toEqual(STOPS);
  await expect(page.locator('[data-dock] a[data-stop-link]')).toHaveCount(7);
  await expect(page.locator('h1')).toHaveText(/Jordan Eldridge Labs/);
  await expect(page.locator('section[data-stop="credentials"] [data-cert-wall] li')).toHaveCount(6);
  await expect(page.locator('section[data-stop="operations"] details[data-project]')).toHaveCount(3);
});

test('dock anchors reach their sections on the lite path', async ({ page }) => {
  await page.goto('/?effects=off');
  await page.locator('a[data-stop-link="containment"]').click();
  await expect(page).toHaveURL(/#containment$/);
  const inView = await page.locator('section[data-stop="containment"]').evaluate((el) => el.getBoundingClientRect().top < 10);
  expect(inView).toBe(true);
});

test('old routes redirect to the walk', async ({ page }) => {
  await page.goto('/recreation');
  await expect(page).toHaveURL(/\/#recreation$/, { timeout: 10_000 });
  await page.goto('/about');
  await expect(page).toHaveURL(/\/#file$/, { timeout: 10_000 });
});

test('no JavaScript still shows every stop', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.locator('section[data-stop]')).toHaveCount(7);
  await expect(page.locator('[data-preloader]')).toBeHidden();
  await ctx.close();
});

test('full path mounts the scene and the dock flies to a stop', async ({ page }) => {
  await page.goto('/?quality=low');
  await expect(page.locator('[data-walk]')).toHaveAttribute('data-mode', 'full', { timeout: 30_000 });
  await expect(page.locator('[data-preloader]')).toHaveAttribute('data-state', 'hidden', { timeout: 60_000 });
  await expect(page.locator('section[data-stop="booth"]')).toHaveAttribute('data-active', '');
  await page.locator('a[data-stop-link="fabrication"]').click();
  // SwiftShader draws the dressed hall at about one frame a second, and the dock flight is a
  // Lenis animation that needs frames to advance. On a GPU the hash changes inside a second.
  await expect(page).toHaveURL(/#fabrication$/, { timeout: 60_000 });
  await expect(page.locator('section[data-stop="fabrication"]')).toHaveAttribute('data-active', '', { timeout: 30_000 });
  await expect(page.locator('section[data-stop="booth"]')).not.toHaveAttribute('data-active', '');
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
});

test('a hash on load opens at that stop on the full path', async ({ page }) => {
  await page.goto('/?quality=low#credentials');
  await expect(page.locator('[data-preloader]')).toHaveAttribute('data-state', 'hidden', { timeout: 60_000 });
  await expect(page.locator('section[data-stop="credentials"]')).toHaveAttribute('data-active', '', { timeout: 15_000 });
});

test('the fabrication flagship pins to its exhibit on the full path', async ({ page }) => {
  await page.goto('/?quality=low#fabrication');
  await expect(page.locator('[data-preloader]')).toHaveAttribute('data-state', 'hidden', { timeout: 60_000 });
  const bay = page.locator('section[data-stop="fabrication"] [data-flagship]');
  await expect(bay).toHaveAttribute('data-anchor', 'ezkey');
  await expect.poll(async () => bay.evaluate((el) => getComputedStyle(el).getPropertyValue('--ax').trim() !== ''), { timeout: 30_000 }).toBe(true);
});
