// Screenshots of the walk at scroll positions against a running dev or preview server, rendered on
// the real GPU. Made for a polish pass: point it at `astro dev` and it sees the working tree as it
// is, no build step between an edit and a look at the room. Usage:
//   node scripts/probe.mjs out/dir 0.2,0.4 [url=http://127.0.0.1:4322] [quality=high] [portrait]
// Each shot lands at out/dir/t0.40.png. A `look=x,y,z` fourth-position argument is not supported:
// the camera is the walk's own, so what the probe shows is what a visitor sees at that t.
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const [outDir = 'probe', list = '0.2', url = 'http://127.0.0.1:4322', quality = 'high', mode = 'landscape'] = process.argv.slice(2);
const points = list.split(',').map(Number);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const context = mode === 'portrait'
  ? await browser.newContext({ ...devices['iPhone 14 Pro Max'], deviceScaleFactor: 1 })
  : await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') console.log('[page]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${url}/?quality=${quality}`);
await page.waitForFunction(() => document.querySelector('[data-preloader]')?.getAttribute('data-state') === 'hidden', null, { timeout: 180_000 });
// The rooms past the gate build in the background after the preloader clears. Give them time to
// stand up before the first shot, or a probe of the last room shows the greybox.
await page.waitForTimeout(12_000);
const root = page.locator('[data-walk]');
console.log('tier', await root.getAttribute('data-tier'), 'renderer', await root.getAttribute('data-renderer'));
for (const t of points) {
  await page.evaluate((t) => { const max = document.documentElement.scrollHeight - window.innerHeight; window.scrollTo(0, t * max); }, t);
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${outDir}/t${t.toFixed(2)}.png` });
  console.log('shot', t);
}
await browser.close();
