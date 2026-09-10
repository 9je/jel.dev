// scripts/shots.mjs
// Screenshots of the walk at scroll positions, rendered on the real GPU. Usage:
//   npm run preview &   (serves dist/ on 4321; build first)
//   npm run shots -- out/dir high 0.09,0.2,0.4 [portrait]
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const [outDir = 'shots', quality = 'high', list = '0,0.2,0.4', mode = 'landscape'] = process.argv.slice(2);
const points = list.split(',').map(Number);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const context = mode === 'portrait'
  ? await browser.newContext({ ...devices['iPhone 14 Pro Max'], deviceScaleFactor: 1 })
  : await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') console.log('[page]', m.text()); });
await page.goto(`http://127.0.0.1:4321/?quality=${quality}`);
await page.waitForFunction(() => document.querySelector('[data-preloader]')?.getAttribute('data-state') === 'hidden', null, { timeout: 120_000 });
const root = page.locator('[data-walk]');
console.log('tier', await root.getAttribute('data-tier'), 'renderer', await root.getAttribute('data-renderer'));
for (const t of points) {
  await page.evaluate((t) => { const max = document.documentElement.scrollHeight - window.innerHeight; window.scrollTo(0, t * max); }, t);
  // Lenis eases the scroll and the camera damps behind it. 2.6 s is long enough for both to settle.
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${outDir}/t${t.toFixed(2)}.png` });
  console.log('shot', t);
}
await browser.close();
