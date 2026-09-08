// Fails when user-visible copy contains em dashes, en dashes, or semicolons.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const BANNED = /[—–;]/;
const ROOTS = ['src/content', 'src/pages', 'src/components', 'src/layouts'];

export function findViolations(file, text) {
  const ext = extname(file);
  const out = [];
  const lines = text.split('\n');
  if (ext === '.md') {
    let fence = false, front = 0;
    lines.forEach((l, i) => {
      if (l.startsWith('---') && front < 2 && (i === 0 || front === 1)) { front++; return; }
      if (front === 1) return;
      if (l.startsWith('```')) { fence = !fence; return; }
      if (fence) return;
      if (BANNED.test(l)) out.push({ file, line: i + 1, text: l.trim() });
    });
  } else if (ext === '.astro') {
    let body = text.replace(/<script[\s\S]*?<\/script>/g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/<style[\s\S]*?<\/style>/g, (m) => m.replace(/[^\n]/g, ' '));
    const fm = body.indexOf('---');
    if (fm === 0) { const end = body.indexOf('\n---', 3); if (end > 0) body = body.slice(0, end + 4).replace(/[^\n]/g, ' ') + body.slice(end + 4); }
    body = body.replace(/<[^>]*>/g, (m) => m.replace(/[^\n]/g, ' ')).replace(/\{[^}]*\}/g, (m) => m.replace(/[^\n]/g, ' '));
    body.split('\n').forEach((l, i) => { if (BANNED.test(l)) out.push({ file, line: i + 1, text: lines[i].trim() }); });
  } else if (file.endsWith('site.ts')) {
    lines.forEach((l, i) => {
      const strings = l.match(/'([^'\\]|\\.)*'/g) ?? [];
      if (strings.some((s) => BANNED.test(s))) out.push({ file, line: i + 1, text: l.trim() });
    });
  }
  return out;
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc); else acc.push(p);
  }
  return acc;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = ROOTS.flatMap((r) => { try { return walk(r); } catch { return []; } })
    .filter((f) => f.endsWith('.md') || f.endsWith('.astro') || f.endsWith('site.ts'));
  const all = files.flatMap((f) => findViolations(f, readFileSync(f, 'utf8')));
  for (const v of all) console.error(`${v.file}:${v.line}: ${v.text}`);
  if (all.length) { console.error(`${all.length} banned character(s) in copy`); process.exit(1); }
  console.log(`copy lint: ${files.length} files clean`);
}
