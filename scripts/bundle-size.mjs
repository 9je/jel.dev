// Enforces the spec's JavaScript budgets against the built chunks. The first visit bundle, which is
// everything except the rooms that build in the background, stays under 340 KB gzipped. Each of
// those later rooms is a chunk of its own, capped at 25 KB. 320 KB since 2026-09-10, when the
// shared Labs kit joined the first visit (it was 300 KB), and 340 KB since 2026-09-11, when the
// control room's console, monitor, pinboard and open file joined that kit alongside the three
// canvases they are painted with.
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const LIMIT = 340 * 1024;
const LATER_LIMIT = 25 * 1024;
// Rooms the preloader gates on. Their chunks count with the first visit.
const GATED = ['booth', 'fabrication'];
const dir = 'dist/_astro';
let total = 0, fail = false;
const rows = [], later = [];
for (const f of readdirSync(dir)) {
  if (!f.endsWith('.js')) continue;
  const gz = gzipSync(readFileSync(join(dir, f))).length;
  const stage = /^stage-([a-z]+)\./.exec(f)?.[1];
  if (stage && !GATED.includes(stage)) { later.push([f, gz]); continue; }
  rows.push([f, gz]);
  total += gz;
}
rows.sort((a, b) => b[1] - a[1]);
for (const [f, gz] of rows) console.log(`${(gz / 1024).toFixed(1).padStart(7)} KB  ${f}`);
console.log(`${(total / 1024).toFixed(1).padStart(7)} KB  total gzipped JS in dist/_astro (limit ${LIMIT / 1024} KB)`);
if (total > LIMIT) { console.error('Bundle budget exceeded'); fail = true; }
for (const [f, gz] of later) {
  const ok = gz <= LATER_LIMIT;
  if (!ok) fail = true;
  console.log(`${ok ? 'ok  ' : 'OVER'} later room ${f}: ${(gz / 1024).toFixed(1)} KB of ${LATER_LIMIT / 1024} KB`);
}
if (fail) process.exit(1);
