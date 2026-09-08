// Screenshots the fully lit Bay from the built site into public/bay-still.jpg. Run after `npm run build`.
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const PORT = 4399;
const server = spawn('npx', ['astro', 'preview', '--port', String(PORT)], { stdio: 'ignore' });
const url = `http://localhost:${PORT}/?still=1`;

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('preview server did not start');
}

try {
  await waitForServer();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(url);
  await page.waitForFunction(() => document.querySelector('[data-bay]')?.getAttribute('data-mode') === 'live', null, { timeout: 60_000 });
  await page.waitForTimeout(2500);
  const png = await page.screenshot({ type: 'png', timeout: 120_000 });
  await browser.close();
  await sharp(png).jpeg({ quality: 82, mozjpeg: true }).toFile('public/bay-still.jpg');
  console.log('wrote public/bay-still.jpg');
} finally {
  server.kill();
}
