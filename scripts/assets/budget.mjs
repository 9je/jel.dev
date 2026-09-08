// Enforces spec §4 budgets from the generated runtime manifests and the built JS.
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

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
    check('desktop first frame (booth group + JS gz)', (m.groups.booth?.bytes ?? 0) + js, b.firstFrame);
    for (const [id, g] of Object.entries(m.groups)) if (id !== 'booth') check(`desktop group ${id}`, g.bytes, b.group);
  }
}
if (fail) { console.error('asset budget exceeded'); process.exit(1); }
