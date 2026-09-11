import { test, expect, devices } from '@playwright/test';

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

test('every room builds in the background and a far dock jump lands', async ({ page }) => {
  await page.goto('/?quality=low');
  await expect(page.locator('[data-preloader]')).toHaveAttribute('data-state', 'hidden', { timeout: 90_000 });
  // credentials now has a real room, so this click waits on its background build, not just the
  // dock click and preloader states.
  await page.locator('a[data-stop-link="credentials"]').click();
  await expect(page).toHaveURL(/#credentials$/, { timeout: 90_000 });
  await expect(page.locator('section[data-stop="credentials"]')).toHaveAttribute('data-active', '', { timeout: 30_000 });
  await expect(page.locator('[data-preloader]')).toHaveAttribute('data-state', 'hidden', { timeout: 30_000 });
  expect(await page.locator('[data-walk]').getAttribute('data-degraded')).toBeNull();
});

test.describe('phone', () => {
  // defaultBrowserType from the device descriptor cannot be set inside a describe block, only at
  // the top of a file or in the config, and this config already runs a single chromium project, so
  // it is dropped here rather than changing which browser the rest of the suite runs on.
  const { defaultBrowserType: _defaultBrowserType, ...pixel7 } = devices['Pixel 7'];
  test.use({ ...pixel7 });
  test('the body is a sheet the reader opens, and never a scroll trap', async ({ page }) => {
    await page.goto('/?quality=low');
    await expect(page.locator('[data-preloader]')).toHaveAttribute('data-state', 'hidden', { timeout: 90_000 });
    const details = page.locator('section[data-stop="booth"] details[data-stop-more]');
    const summary = page.locator('section[data-stop="booth"] .stop-more-toggle');
    const body = page.locator('section[data-stop="booth"] .stop-body');
    const sheet = page.locator('section[data-stop="booth"] .stop-inner');
    await expect(details).not.toHaveAttribute('open', '');
    await expect(summary).toHaveText('More');
    // The sheet itself is what sits over the room, and it peeks: the handle, the title and the
    // lead are on screen with the body shut behind them.
    expect(await sheet.evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
    expect(await body.evaluate((el) => getComputedStyle(el).overflowY)).toBe('hidden');
    await summary.tap();
    await expect(details).toHaveAttribute('open', '');
    // The behaviour that matters: the handle stays visible and tappable (a display:none summary
    // is what the cascade bug looked like), it says which way it goes, and the sheet scrolls on
    // its own rather than chaining the swipe back into the walk.
    expect(await summary.evaluate((el) => getComputedStyle(el).display)).not.toBe('none');
    await expect(summary).toHaveText('Less');
    expect(await body.evaluate((el) => getComputedStyle(el).overflowY)).toBe('auto');
  });

  test('the handle takes a swipe as well as a tap', async ({ page }) => {
    await page.goto('/?quality=low');
    await expect(page.locator('[data-preloader]')).toHaveAttribute('data-state', 'hidden', { timeout: 90_000 });
    const details = page.locator('section[data-stop="booth"] details[data-stop-more]');
    const summary = page.locator('section[data-stop="booth"] .stop-more-toggle');
    // page.touchscreen only taps, so the drag is dispatched: down on the handle, up 60 px away.
    const drag = (dy: number) => summary.evaluate((el, d) => {
      const box = el.getBoundingClientRect();
      const send = (type: string, y: number) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: box.x + box.width / 2, clientY: y }));
      send('pointerdown', box.y + 2);
      send('pointerup', box.y + 2 + d);
    }, dy);
    await expect(details).not.toHaveAttribute('open', '');
    await drag(-60);
    await expect(details).toHaveAttribute('open', '');
    await drag(60);
    await expect(details).not.toHaveAttribute('open', '');
  });
});

test.describe('wide coarse pointer', () => {
  // Same reasoning as the Pixel 7 block above: defaultBrowserType has to come out for this config's
  // single chromium project, everything else about the device (viewport, touch) stays.
  const { defaultBrowserType: _defaultBrowserType, ...ipad } = devices['iPad Pro 11 landscape'];
  test.use({ ...ipad });
  test('a pinned plate never takes a touch, even past the 900px breakpoint', async ({ page }) => {
    await page.goto('/?quality=low#fabrication');
    await expect(page.locator('[data-preloader]')).toHaveAttribute('data-state', 'hidden', { timeout: 90_000 });
    await expect(page.locator('section[data-stop="fabrication"]')).toHaveAttribute('data-active', '', { timeout: 30_000 });
    const anchor = page.locator('section[data-stop="fabrication"] [data-anchor]');
    expect(await anchor.evaluate((el) => getComputedStyle(el).position)).toBe('static');
  });
});

test('one stop is readable at a time, and the leaving one is gone inside 450 ms', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/?quality=low');
  await expect(page.locator('[data-preloader]')).toHaveAttribute('data-state', 'hidden', { timeout: 120_000 });
  // Every stop and every transition between them: the camera never has two panels of copy up.
  for (const t of [0, 0.05, 0.13, 0.2, 0.3, 0.4, 0.48, 0.56, 0.63, 0.7, 0.77, 0.84, 0.92, 1]) {
    await page.evaluate((v) => { const max = document.documentElement.scrollHeight - window.innerHeight; window.scrollTo(0, v * max); }, t);
    await page.waitForTimeout(1200);
    await expect(page.locator('section[data-stop][data-active]')).toHaveCount(1);
    const opacities = await page.locator('section[data-stop]:not([data-active])').evaluateAll((els) => els.map((e) => Number(getComputedStyle(e).opacity)));
    expect(Math.max(...opacities)).toBe(0);
  }
  // The crossfade itself: the leaving stop's opacity transition runs at once and is short, and the
  // arriving stop's does not start until after it has finished.
  const timing = await page.evaluate(() => {
    const ms = (el: Element) => { const s = getComputedStyle(el); return parseFloat(s.transitionDuration) * 1000 + parseFloat(s.transitionDelay) * 1000; };
    const delay = (el: Element) => parseFloat(getComputedStyle(el).transitionDelay) * 1000;
    const out = document.querySelector('section[data-stop]:not([data-active])')!;
    const on = document.querySelector('section[data-stop][data-active]')!;
    return { out: ms(out), outDelay: delay(out), inDelay: delay(on) };
  });
  expect(timing.out).toBeLessThanOrEqual(450);
  expect(timing.outDelay).toBe(0);
  expect(timing.inDelay).toBeGreaterThanOrEqual(timing.out);
});

test('the canvas follows the viewport with no band under it', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/?quality=low');
  await expect(page.locator('[data-preloader]')).toHaveAttribute('data-state', 'hidden', { timeout: 120_000 });
  for (const size of [{ width: 1400, height: 1200 }, { width: 900, height: 1400 }, { width: 1600, height: 900 }]) {
    await page.setViewportSize(size);
    // The box, not the drawing buffer: the box is what a band appears under, and the stylesheet
    // holds it to the frame with no script in the loop, so this is true in the same frame the
    // viewport changed. The buffer follows on the next rendered frame, which SwiftShader can take
    // tens of seconds over at this size, and a mismatched buffer only scales the image anyway.
    const box = await page.locator('[data-walk-canvas]').evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const r = c.getBoundingClientRect();
      return { h: c.clientHeight, w: c.clientWidth, bottom: r.bottom, right: r.right, innerH: window.innerHeight, innerW: window.innerWidth };
    });
    expect(box).toMatchObject({ h: size.height, w: size.width, bottom: size.height, right: size.width, innerH: size.height, innerW: size.width });
  }
});
