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
