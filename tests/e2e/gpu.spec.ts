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
