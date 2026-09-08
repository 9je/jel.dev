import { test, expect } from '@playwright/test';

const wings = [
  ['operations', 'Operations'],
  ['fabrication', 'Fabrication'],
  ['recreation', 'Recreation'],
  ['containment', 'Containment'],
] as const;

for (const [slug, name] of wings) {
  test(`/${slug} renders the ${name} wing`, async ({ page }) => {
    const res = await page.goto(`/${slug}`);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1[data-wing-name]')).toHaveText(name);
    await expect(page.locator('html')).toHaveAttribute('data-wing', slug);
    await expect(page.locator('nav[aria-label="Wayfinding"] a[aria-current="page"]')).toHaveText(name);
  });
}

test('wing pages ship no three.js', async ({ page }) => {
  const scripts: string[] = [];
  page.on('request', (r) => { if (r.resourceType() === 'script') scripts.push(r.url()); });
  await page.goto('/recreation');
  expect(scripts.some((s) => /three|bay|scene/i.test(s))).toBe(false);
});
