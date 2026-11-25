import { test, expect } from '@playwright/test';

// Runs on the machine's own card, not the suite's SwiftShader.
// SwiftShader never reaches the background build's warm draws inside a test's budget, so the bug
// this guards was invisible there: the old code passed this test on it. On the card it fails.
test.use({ launchOptions: { args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] } });
test('the low tier never puts a frame on screen outside the frame loop while rooms build behind it', async ({ page }) => {
  // The low tier runs no post, so the background build's warm up draws had no scratch target and
  // landed on the canvas between frames, everything but the far room hidden. Each was presented:
  // a black frame per batch, a run of them per room, which read as the booth flickering to black.
  test.setTimeout(300_000);
  await page.addInitScript(() => {
    const w = window as unknown as { __stray: number }; w.__stray = 0; let inFrame = 0;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf((t) => { inFrame++; try { cb(t); } finally { inFrame--; } });
    const P = WebGL2RenderingContext.prototype; const bound = new WeakMap<object, WebGLFramebuffer | null>();
    const bind = P.bindFramebuffer;
    P.bindFramebuffer = function (this: WebGL2RenderingContext, t: number, f: WebGLFramebuffer | null) { if (t === this.FRAMEBUFFER || t === this.DRAW_FRAMEBUFFER) bound.set(this, f); return bind.call(this, t, f); };
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced'] as const) {
      const orig = P[name] as (...a: unknown[]) => void;
      (P as unknown as Record<string, unknown>)[name] = function (this: WebGL2RenderingContext, ...a: unknown[]) {
        if (!bound.get(this) && !inFrame && document.querySelector('[data-preloader]')?.getAttribute('data-state') === 'hidden') w.__stray++;
        return orig.apply(this, a);
      };
    }
  });
  await page.goto('/?quality=low');
  await expect(page.locator('[data-walk]')).toHaveAttribute('data-tier', 'low');
  await expect(page.locator('[data-preloader]')).toHaveAttribute('data-state', 'hidden', { timeout: 120_000 });
  // The build waits for the camera to settle before it starts, so the window is generous.
  await page.waitForTimeout(90_000);
  expect(await page.evaluate(() => (window as unknown as { __stray: number }).__stray)).toBe(0);
});

test('a reader who scrolls on from the first frame never walks into a room that is not built', async ({ page }) => {
  // Jordan's laptop: the low tier on Iris Xe, scrolling fast the moment the loader cleared, reached
  // the break room before it was built and saw the greybox, then a hard stutter as it built in view.
  // A quarter speed CPU stands in for that GPU: the rooms then build slower than the scroll.
  test.setTimeout(300_000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.setViewportSize({ width: 1528, height: 828 });
  await page.goto('/?quality=low');
  await expect(page.locator('[data-preloader]')).toHaveAttribute('data-state', 'hidden', { timeout: 120_000 });
  // Every attribute change on the way: an unbuilt room is one the reader could see if the loading
  // sign is not over it.
  await page.evaluate(() => {
    const w = window as unknown as { __bad: string[] }; w.__bad = [];
    const root = document.querySelector('[data-walk]')!, pre = document.querySelector('[data-preloader]')!;
    const check = () => {
      if (pre.getAttribute('data-state') === 'hidden' && !root.hasAttribute('data-room-built')) w.__bad.push(location.hash);
    };
    new MutationObserver(check).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['data-room-built', 'data-state', 'data-active'] });
  });
  await page.mouse.move(700, 400);
  const start = Date.now();
  while (Date.now() - start < 90_000) {
    await page.mouse.wheel(0, 400); await page.waitForTimeout(60);
    if ((await page.evaluate(() => location.hash)) === '#file' && await page.locator('[data-walk]').evaluate((el) => el.hasAttribute('data-room-built'))) break;
  }
  const where = await page.evaluate(() => ({ hash: location.hash, waiting: document.querySelector<HTMLElement>('[data-walk]')?.dataset.waitingFor ?? '', loader: document.querySelector<HTMLElement>('[data-preloader]')?.dataset.state, y: Math.round(scrollY) }));
  expect(where.hash, `stopped short of the file: ${JSON.stringify(where)}`).toBe('#file');
  expect(await page.evaluate(() => (window as unknown as { __bad: string[] }).__bad)).toEqual([]);
});

test('a reader who opens a link deep in the walk and scrolls back never walks into a room that is not built', async ({ page }) => {
  // A deep link builds the room it opens in and leaves the rooms behind it for later.
  test.setTimeout(300_000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.setViewportSize({ width: 1528, height: 828 });
  await page.goto('/?quality=low#containment');
  await expect(page.locator('[data-preloader]')).toHaveAttribute('data-state', 'hidden', { timeout: 120_000 });
  await page.evaluate(() => {
    const w = window as unknown as { __bad: string[] }; w.__bad = [];
    const root = document.querySelector('[data-walk]')!, pre = document.querySelector('[data-preloader]')!;
    new MutationObserver(() => { if (pre.getAttribute('data-state') === 'hidden' && !root.hasAttribute('data-room-built')) w.__bad.push(location.hash); })
      .observe(document.body, { attributes: true, subtree: true, attributeFilter: ['data-room-built', 'data-state', 'data-active'] });
  });
  await page.mouse.move(700, 400);
  const start = Date.now();
  while (Date.now() - start < 90_000) {
    await page.mouse.wheel(0, -400); await page.waitForTimeout(60);
    if ((await page.evaluate(() => location.hash)) === '#booth') break;
  }
  expect(await page.evaluate(() => location.hash)).toBe('#booth');
  expect(await page.evaluate(() => (window as unknown as { __bad: string[] }).__bad)).toEqual([]);
});
