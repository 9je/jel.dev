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

test('recreation shows torn.bet as flagship and the rest as plates', async ({ page }) => {
  await page.goto('/recreation');
  await expect(page.locator('[data-flagship] h2')).toHaveText('torn.bet');
  await expect(page.locator('[data-flagship] .plate')).toHaveText('Operational');
  await expect(page.locator('[data-flagship] [data-content-warning]')).toContainText('Torn City');
  const plates = page.locator('details[data-project]');
  await expect(plates).toHaveCount(3);
  await expect(plates.first().locator('summary')).toContainText('faction.tools');
  await plates.first().locator('summary').click();
  await expect(plates.first()).toHaveAttribute('open', '');
});

test('containment shows the redacted pending bay', async ({ page }) => {
  await page.goto('/containment');
  await expect(page.locator('[data-flagship] .plate')).toHaveText('Pending release');
  await expect(page.locator('[data-flagship] [data-redacted]')).toBeVisible();
  await expect(page.locator('[data-flagship] [data-unlocks]')).toContainText('disclosure');
});

test('project plates support content warnings', async ({ page }) => {
  await page.goto('/recreation');
  const plates = page.locator('details[data-project]');
  await plates.first().locator('summary').click();
  await expect(plates.first()).toHaveAttribute('open', '');
  const platesWarnings = page.locator('details[data-project] [data-content-warning]');
  await expect(platesWarnings).toHaveCount(0);
  const flagshipWarning = page.locator('[data-flagship] [data-content-warning]');
  await expect(flagshipWarning).toContainText('Torn City');
});

test('operations shows the six certifications', async ({ page }) => {
  await page.goto('/operations');
  const badges = page.locator('[data-cert-wall] li');
  await expect(badges).toHaveCount(6);
  await expect(badges.filter({ hasText: 'eJPT' }).locator('a')).toHaveAttribute('href', /credential\.net/);
});

test('/about renders the personnel file', async ({ page }) => {
  const res = await page.goto('/about');
  expect(res?.status()).toBe(200);
  await expect(page.locator('h1[data-about]')).toContainText('Jordan Eldridge');
  await expect(page.locator('[data-cert-wall] li')).toHaveCount(6);
  await expect(page.locator('nav[aria-label="Wayfinding"] a[aria-current="page"]')).toHaveText('Personnel file');
});
