// Downloads the 1K sources listed in manifest.json from Poly Haven (CC0) into assets/raw/.
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const src = JSON.parse(readFileSync('scripts/assets/manifest.json', 'utf8'));
const API = 'https://api.polyhaven.com/files/';

async function files(id) { const r = await fetch(API + id); if (!r.ok) throw new Error(`${id}: ${r.status}`); return r.json(); }
async function download(url, to) {
  if (existsSync(to)) return;
  mkdirSync(dirname(to), { recursive: true });
  const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`);
  writeFileSync(to, Buffer.from(await r.arrayBuffer()));
  console.log('fetched', to);
}

for (const [key, e] of Object.entries(src.textures)) {
  const f = await files(e.id);
  const pick = (name) => f[name]?.['1k']?.jpg?.url ?? (() => { throw new Error(`${e.id} has no 1k ${name}`); })();
  await download(pick('Diffuse'), `assets/raw/textures/${key}/diffuse.jpg`);
  await download(pick('nor_gl'), `assets/raw/textures/${key}/normal.jpg`);
  await download(pick('arm'), `assets/raw/textures/${key}/arm.jpg`);
}
for (const [key, e] of Object.entries(src.models)) {
  if (e.source) continue;  // tracked in the repo, nothing to fetch
  const f = await files(e.id);
  const g = f.gltf?.['1k']?.gltf;
  if (!g) throw new Error(`${e.id} has no 1k gltf`);
  const dir = `assets/raw/models/${key}`;
  await download(g.url, join(dir, `${e.id}_1k.gltf`));
  for (const [rel, inc] of Object.entries(g.include ?? {})) await download(inc.url, join(dir, rel));
}
console.log('fetch complete');
