import { test, expect, devices } from '@playwright/test';

const STOPS = ['booth', 'fabrication', 'recreation', 'operations', 'credentials', 'containment', 'file'];

test('lite path renders every stop in order with a dock', async ({ page }) => {
  await page.goto('/?effects=off');
  await expect(page.locator('[data-walk]')).toHaveAttribute('data-mode', 'lite');
  const ids = await page.locator('section[data-stop]').evaluateAll((els) => els.map((e) => e.getAttribute('data-stop')));
  expect(ids).toEqual(STOPS);
  await expect(page.locator('[data-dock] a[data-stop-link]')).toHaveCount(7);
  await expect(page.locator('h1')).toHaveText(/Jordan Eldridge Labs/);
  const wall = page.locator('section[data-stop="credentials"] [data-cert-wall]');
  await expect(wall).toBeVisible();
  await expect(wall).toHaveAttribute('open', '');
  await expect(wall.locator('li')).toHaveCount(6);
  // The wall is a disclosure for the walk's sake. On the stacked page it is simply there, so its
  // control is not: the page reads as it did before the walk had a compact column.
  expect(await wall.locator('summary').evaluate((el) => getComputedStyle(el).display)).toBe('none');
  // Every project, the flagship included, is open on the stacked page.
  await expect(page.locator('section[data-stop="fabrication"] details[data-flagship]')).toHaveAttribute('open', '');
  await expect(page.locator('section[data-stop="operations"] details[data-project]')).toHaveCount(3);
  // Each stop paints its own still behind its copy, and the file it names is really there.
  for (const id of STOPS) {
    const bg = await page.locator(`section[data-stop="${id}"]`).evaluate((el) => getComputedStyle(el, '::before').backgroundImage);
    expect(bg).toContain(`/stills/${id}.webp`);
    const res = await page.request.get(`/stills/${id}.webp`);
    expect(res.status()).toBe(200);
  }
});

test('the full path never requests a still', async ({ page }) => {
  const stillRequests: string[] = [];
  page.on('request', (req) => { if (req.url().includes('/stills/')) stillRequests.push(req.url()); });
  await page.goto('/?quality=low');
  await expect(page.locator('[data-walk]')).toHaveAttribute('data-mode', 'full', { timeout: 30_000 });
  await expect(page.locator('[data-preloader]')).toHaveAttribute('data-state', 'hidden', { timeout: 60_000 });
  expect(stillRequests).toEqual([]);
});

test('the lite path lays the flagship out in two columns', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto('/?effects=off');
  const bay = page.locator('section[data-stop="fabrication"] [data-flagship]');
  // A details puts a box between itself and its children, and the picture and the copy stopped
  // being grid items: both ended up stacked in the first column with the second one empty.
  const cols = await bay.evaluate((el) => {
    const visual = el.querySelector('.bay-visual')!.getBoundingClientRect();
    const text = el.querySelector('.bay-text')!.getBoundingClientRect();
    return { visualLeft: visual.left, textLeft: text.left, sameRow: Math.abs(visual.top - text.top) < 2 };
  });
  expect(cols.textLeft).toBeGreaterThan(cols.visualLeft + 100);
  expect(cols.sameRow).toBe(true);
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

/**
 * Clicks (or taps) the canvas across a grid until every exhibit in the room has answered, and
 * reports which. Picking is a raycast off the click and not off a rendered frame, so this does not
 * wait on SwiftShader drawing anything; the grid is what stands in for a reader who can see where
 * the plinths are. `want` stops the sweep on that exhibit and leaves its card open.
 */
async function sweep(page: import('@playwright/test').Page, kind: 'click' | 'tap', want?: string) {
  return page.evaluate(({ how, want }) => {
    const canvas = document.querySelector('canvas')!;
    const card = document.querySelector<HTMLElement>('[data-exhibit-card]')!;
    const hit: Record<string, [number, number]> = {};
    const open = () => document.querySelectorAll('details[data-project][open], details[data-stop-more][open]').length;
    const send = (type: string, x: number, y: number) => canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
    for (let ry = 0.25; ry < 0.95; ry += 0.03) {
      for (let rx = 0.03; rx < 0.98; rx += 0.02) {
        const x = Math.round(rx * window.innerWidth), y = Math.round(ry * window.innerHeight);
        card.hidden = true;
        const before = open();
        if (how === 'click') canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
        else { send('pointerdown', x, y); send('pointerup', x, y); }
        const id = card.hidden ? null : card.dataset.anchor;
        const key = id ?? (open() > before ? 'sheet' : null);
        if (key && !(key in hit)) hit[key] = [x, y];
        if (id && id === want) {
          const box = card.getBoundingClientRect();
          return { hit, card: { anchor: id, text: card.textContent ?? '', left: box.left, right: box.right, top: box.top, bottom: box.bottom, vw: window.innerWidth, vh: window.innerHeight } };
        }
      }
    }
    card.hidden = true;
    return { hit, card: null };
  }, { how: kind, want });
}

test('every exhibit in the bay answers a click with the same card', async ({ page }) => {
  await page.goto('/?quality=low#fabrication');
  await expect(page.locator('[data-preloader]')).toHaveAttribute('data-state', 'hidden', { timeout: 120_000 });
  await expect(page.locator('section[data-stop="fabrication"]')).toHaveAttribute('data-active', '', { timeout: 30_000 });
  // Jordan's complaint: two of the three products unfolded a row in the list and the third threw up
  // a pinned panel. All three now open the one card.
  const all = await sweep(page, 'click');
  expect(Object.keys(all.hit).sort()).toEqual(['conch', 'ezkey', 'gc-bridge']);

  const card = page.locator('[data-exhibit-card]');
  const shot = (await sweep(page, 'click', 'conch')).card!;
  expect(shot.anchor).toBe('conch');
  expect(shot.text).toContain('conch.gg');
  // On the frame, both ways: a card hanging off the edge is a card nobody can read.
  expect(shot.left).toBeGreaterThanOrEqual(0);
  expect(shot.right).toBeLessThanOrEqual(shot.vw);
  expect(shot.top).toBeGreaterThanOrEqual(0);
  expect(shot.bottom).toBeLessThanOrEqual(shot.vh);
  await expect(card).toBeVisible();

  // Escape puts it away, and so does a click on the room with nothing behind it.
  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();
  await sweep(page, 'click', 'conch');
  await expect(card).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(card).toBeHidden();
});

test('the copy column on the walk is one line for each project in the room', async ({ page }) => {
  await page.goto('/?quality=low#fabrication');
  await expect(page.locator('[data-preloader]')).toHaveAttribute('data-state', 'hidden', { timeout: 90_000 });
  const section = page.locator('section[data-stop="fabrication"]');
  await expect(section).toHaveAttribute('data-active', '', { timeout: 30_000 });
  // The flagship is the first row of the same list, closed, wearing its status plate.
  const bay = section.locator('[data-flagship]');
  await expect(bay).not.toHaveAttribute('open', '');
  expect(await bay.evaluate((el) => el.parentElement?.hasAttribute('data-project-list'))).toBe(true);
  await expect(bay.locator('.bay-head .plate')).toBeVisible();
  await expect(bay.locator('.bay-body')).toBeHidden();
  // A project row is one line until it is opened: the summary line and the body wait behind it.
  const row = section.locator('details[data-project]').first();
  await expect(row.locator('.row-line')).toBeHidden();
  await row.locator('summary').click();
  await expect(row.locator('.row-line')).toBeVisible();
  // Narrow, and low enough to leave the room's middle band clear.
  const frame = page.viewportSize()!;
  const box = (await section.locator('.stop-inner').boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(400);
  expect(box.y).toBeGreaterThan(frame.height * 0.4);
});

test('the certification wall is one row on the walk, with its badges a click behind it', async ({ page }) => {
  await page.goto('/?quality=low#credentials');
  await expect(page.locator('[data-preloader]')).toHaveAttribute('data-state', 'hidden', { timeout: 120_000 });
  await expect(page.locator('section[data-stop="credentials"]')).toHaveAttribute('data-active', '', { timeout: 30_000 });
  const wall = page.locator('[data-cert-wall]');
  // One more row of the same list, closed, so the six plates in the room carry it.
  expect(await wall.evaluate((el) => el.parentElement?.hasAttribute('data-project-list'))).toBe(true);
  await expect(wall).not.toHaveAttribute('open', '');
  await expect(wall.locator('.wall-list')).toBeHidden();
  const summary = wall.locator('summary');
  await expect(summary).toBeVisible();
  await expect(summary).toHaveText('Certifications');
  // And still a disclosure, so a reader with no pointer on the room reaches every badge and its
  // verification link. Opened, it is the compact grid: small plates, no issuer.
  await summary.click();
  await expect(wall).toHaveAttribute('open', '');
  await expect(wall.locator('li')).toHaveCount(6);
  await expect(wall.locator('li').first()).toBeVisible();
  expect(await wall.locator('.badge img').first().evaluate((el) => el.clientWidth)).toBe(40);
  await expect(wall.locator('.badge-issuer').first()).toBeHidden();
});

test('the flagship bay sits in the copy column and is never pinned', async ({ page }) => {
  await page.goto('/?quality=low#fabrication');
  await expect(page.locator('[data-preloader]')).toHaveAttribute('data-state', 'hidden', { timeout: 90_000 });
  const bay = page.locator('section[data-stop="fabrication"] [data-flagship]');
  expect(await bay.evaluate((el) => getComputedStyle(el).position)).not.toBe('fixed');
  await expect(page.locator('[data-exhibit-card]')).toBeHidden();
});

test('every room builds in the background and a far dock jump lands', async ({ page }) => {
  // The preloader and the flight share the test's budget, and under SwiftShader the first can take
  // a minute on its own, so this one is not run against the file's default.
  test.setTimeout(240_000);
  await page.goto('/?quality=low');
  await expect(page.locator('[data-preloader]')).toHaveAttribute('data-state', 'hidden', { timeout: 120_000 });
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
  test('a tap opens the sheet, never a card, past the 900px breakpoint', async ({ page }) => {
    await page.goto('/?quality=low#fabrication');
    await expect(page.locator('[data-preloader]')).toHaveAttribute('data-state', 'hidden', { timeout: 120_000 });
    await expect(page.locator('section[data-stop="fabrication"]')).toHaveAttribute('data-active', '', { timeout: 30_000 });
    // A coarse pointer keeps the sheet flow: tapping an exhibit opens the sheet with that project's
    // row unfolded, and the card, which would cover the room on a touch screen, never appears.
    const all = await sweep(page, 'tap');
    expect(Object.keys(all.hit)).toEqual(['sheet']);
    await expect(page.locator('[data-exhibit-card]')).toBeHidden();
    expect(await page.locator('section[data-stop="fabrication"] [data-flagship]').evaluate((el) => getComputedStyle(el).position)).not.toBe('fixed');
  });
});

test('one stop is readable at a time, and the leaving one is gone inside 450 ms', async ({ page }) => {
  await page.goto('/?quality=low');
  await expect(page.locator('[data-preloader]')).toHaveAttribute('data-state', 'hidden', { timeout: 120_000 });
  // Every stop and every transition between them: the camera never has two panels of copy up.
  for (const t of [0, 0.05, 0.13, 0.2, 0.3, 0.4, 0.48, 0.56, 0.63, 0.7, 0.77, 0.84, 0.92, 1]) {
    await page.evaluate((v) => { const max = document.documentElement.scrollHeight - window.innerHeight; window.scrollTo(0, v * max); }, t);
    await page.waitForTimeout(800);
    await expect(page.locator('section[data-stop][data-active]')).toHaveCount(1);
  }
  // How the fade runs, read off the cascade rather than sampled off the screen: a CSS transition
  // advances on the compositor's frame clock, and this harness produces frames so slowly that a
  // leaving stop sits frozen part way out for as long as you care to poll it. What has to hold is
  // that the leaving stop's opacity transition starts at once and is short, and that the arriving
  // stop's does not start until after it has finished.
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
