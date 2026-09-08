// Fails if the JavaScript loaded by the Bay exceeds the 250 KB gzipped budget from the spec.
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const LIMIT = 250 * 1024;
const dir = 'dist/_astro';
let total = 0;
const rows = [];
for (const f of readdirSync(dir)) {
  if (!f.endsWith('.js')) continue;
  const gz = gzipSync(readFileSync(join(dir, f))).length;
  rows.push([f, gz]);
  total += gz;
}
rows.sort((a, b) => b[1] - a[1]);
for (const [f, gz] of rows) console.log(`${(gz / 1024).toFixed(1).padStart(7)} KB  ${f}`);
console.log(`${(total / 1024).toFixed(1).padStart(7)} KB  total gzipped JS in dist/_astro (limit ${LIMIT / 1024} KB)`);
if (total > LIMIT) { console.error('Bundle budget exceeded'); process.exit(1); }
