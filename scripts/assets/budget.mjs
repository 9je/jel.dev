// Enforces spec §4 budgets from the generated runtime manifests and the built JS.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const STILLS_SET_LIMIT = 1.6 * 1048576;
const STILLS_FILE_LIMIT = 220 * 1024;

const src = JSON.parse(readFileSync('scripts/assets/manifest.json', 'utf8'));
const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
let fail = false;
const check = (label, actual, limit) => { const ok = actual <= limit; if (!ok) fail = true; console.log(`${ok ? 'ok  ' : 'OVER'} ${label}: ${mb(actual)} of ${mb(limit)}`); };

let js = 0;
try { for (const f of readdirSync('dist/_astro')) if (f.endsWith('.js')) js += gzipSync(readFileSync(`dist/_astro/${f}`)).length; } catch { console.log('dist/_astro missing, run npm run build first'); }

for (const tier of ['desktop', 'phone']) {
  const m = JSON.parse(readFileSync(`public/assets/manifest.${tier}.json`, 'utf8'));
  const total = Object.values(m.groups).reduce((a, g) => a + g.bytes, 0);
  const b = src.budgets[tier];
  check(`${tier} total`, total, b.total);
  if (tier === 'desktop') {
    const gate = Object.entries(m.groups).filter(([id]) => id === 'booth' || id.startsWith('fabrication')).reduce((a, [, g]) => a + g.bytes, 0);
    check('desktop first frame (booth + fabrication groups + JS gz)', gate + js, b.firstFrame);
    for (const [id, g] of Object.entries(m.groups)) if (id !== 'booth' && !id.startsWith('fabrication')) check(`desktop group ${id}`, g.bytes, b.group);
  }
}
// Lite path stills, outside the desktop/phone budgets above: capped as their own set. A missing set
// is a failure, not a pass: the lite path has nothing to show without it, and a try that swallowed
// the read left the gate reporting ok on a directory that was not there.
if (!existsSync('public/stills')) {
  fail = true;
  console.log('OVER stills: public/stills is missing, run npm run stills');
} else {
  const files = readdirSync('public/stills').filter((f) => f.endsWith('.webp'));
  if (files.length === 0) { fail = true; console.log('OVER stills: public/stills holds no .webp, run npm run stills'); }
  let stillsTotal = 0;
  for (const f of files) {
    const size = statSync(`public/stills/${f}`).size;
    stillsTotal += size;
    check(`still ${f}`, size, STILLS_FILE_LIMIT);
  }
  check('stills total', stillsTotal, STILLS_SET_LIMIT);
}

if (fail) { console.error('asset budget exceeded'); process.exit(1); }
