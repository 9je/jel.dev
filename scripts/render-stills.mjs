// Renders the lite path's still images from the live rooms, on the real GPU, then compresses
// them with sharp. Builds on scripts/shots.mjs: same launch flags, same scroll-and-wait loop, but
// two full passes (landscape and portrait) with the HTML chrome hidden first, and every frame
// written straight to public/stills/ instead of a scratch outdir. Usage, with the preview server
// already serving dist/ on 4321:
//   npm run build && (npm run preview -- --host 127.0.0.1 --port 4321 &)
//   npm run stills
import { chromium } from '@playwright/test';
import { mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const STOPS = [
  ['booth', 0.05],
  ['fabrication', 0.2],
  ['recreation', 0.4],
  ['operations', 0.56],
  ['credentials', 0.7],
  ['containment', 0.84],
  ['file', 1.0],
];

const PER_FILE_LIMIT = 220 * 1024;
const SET_LIMIT = 1.6 * 1024 * 1024;
// Everything Task 12 laid over the room: the dock, the ticker, the hotspot label, the exhibit
// card, and the preloader. None of it belongs in a still of the room itself.
const HIDE_CHROME = '[data-walk] .stops, [data-dock], [data-ticker], [data-hotspot-label], [data-exhibit-card], [data-preloader] { display: none !important; }';

const outDir = 'public/stills';
mkdirSync(outDir, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'jel-stills-'));

const browser = await chromium.launch({ args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });

async function pass(viewport, suffix) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') console.log('[page]', m.text()); });
  await page.goto('http://127.0.0.1:4321/?quality=high');
  await page.waitForFunction(() => document.querySelector('[data-preloader]')?.getAttribute('data-state') === 'hidden', null, { timeout: 120_000 });
  await page.addStyleTag({ content: HIDE_CHROME });
  for (const [id, t] of STOPS) {
    await page.evaluate((t) => { const max = document.documentElement.scrollHeight - window.innerHeight; window.scrollTo(0, t * max); }, t);
    // Lenis eases the scroll and the camera damps behind it. 2.6 s is long enough for both to settle.
    await page.waitForTimeout(2600);
    const raw = join(tmp, `${id}${suffix}.png`);
    await page.screenshot({ path: raw });
    await sharp(raw).webp({ quality: 78 }).toFile(join(outDir, `${id}${suffix}.webp`));
    console.log('still', id + suffix);
  }
  await context.close();
}

await pass({ width: 1600, height: 900 }, '');
await pass({ width: 900, height: 1600 }, '-portrait');
await browser.close();
rmSync(tmp, { recursive: true, force: true });

let total = 0, fail = false;
for (const [id] of STOPS) {
  for (const suffix of ['', '-portrait']) {
    const path = join(outDir, `${id}${suffix}.webp`);
    const size = statSync(path).size;
    total += size;
    const ok = size <= PER_FILE_LIMIT;
    if (!ok) fail = true;
    console.log(`${ok ? 'ok  ' : 'OVER'} ${id}${suffix}.webp: ${(size / 1024).toFixed(1)} KB of ${PER_FILE_LIMIT / 1024} KB`);
  }
}
console.log(`${(total / 1024 / 1024).toFixed(2)} MB total of ${(SET_LIMIT / 1024 / 1024).toFixed(2)} MB`);
if (total > SET_LIMIT) fail = true;
if (fail) { console.error('Stills budget exceeded'); process.exit(1); }
