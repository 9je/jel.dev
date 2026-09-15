// Renders the card that every link to jel.dev unfurls with, on the real GPU, from the rooms as they
// stand today. The one it replaced was a greybox bay from before the walk was built, so anything
// Jordan posted showed a room the site no longer has. Re-run it whenever the rooms change. Usage,
// against a dev server or a preview of dist:
//   node scripts/social-card.mjs 0.05 public/bay-still.jpg [http://127.0.0.1:4322]
import { chromium } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const [list = '0.05', out = 'public/bay-still.jpg', url = 'http://127.0.0.1:4322'] = process.argv.slice(2);
const points = list.split(',').map(Number);
// Everything the walk lays over the room. A card is the room and nothing else.
const HIDE = '[data-walk] .stops, [data-dock], [data-ticker], [data-hotspot-label], [data-exhibit-card], [data-preloader] { display: none !important; }';

const tmp = mkdtempSync(join(tmpdir(), 'jel-card-'));
const browser = await chromium.launch({ args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page = await context.newPage();
await page.goto(`${url}/?quality=high`);
await page.waitForFunction(() => document.querySelector('[data-preloader]')?.getAttribute('data-state') === 'hidden', null, { timeout: 180_000 });
await page.addStyleTag({ content: HIDE });
// The rooms past the gate build in the background once the preloader clears.
await page.waitForTimeout(12_000);
for (const t of points) {
  await page.evaluate((t) => { const max = document.documentElement.scrollHeight - window.innerHeight; window.scrollTo(0, t * max); }, t);
  await page.waitForTimeout(2600);
  const raw = join(tmp, `${t}.png`);
  await page.screenshot({ path: raw });
  const file = points.length > 1 ? out.replace(/\.jpg$/, `-${t}.jpg`) : out;
  const info = await sharp(raw).jpeg({ quality: 84, mozjpeg: true }).toFile(file);
  console.log(`${file} ${(info.size / 1024).toFixed(0)} KB`);
}
await browser.close();
rmSync(tmp, { recursive: true, force: true });
