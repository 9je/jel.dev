// Converts assets/raw/ into public/assets/{desktop,phone}/ with WebP textures and Draco meshes, and writes runtime manifests and CREDITS.md.
import { readFileSync, writeFileSync, mkdirSync, statSync, cpSync, existsSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import sharp from 'sharp';

const SRC = JSON.parse(readFileSync('scripts/assets/manifest.json', 'utf8'));

export function planTargets(src, tier) {
  const sz = src.sizes[tier];
  const textures = Object.fromEntries(Object.entries(src.textures).map(([k, e]) => [k, {
    ...e, size: sz.texture,
    raw: { diffuse: `assets/raw/textures/${k}/diffuse.jpg`, normal: `assets/raw/textures/${k}/normal.jpg`, arm: `assets/raw/textures/${k}/arm.jpg` },
    out: { diffuse: `public/assets/${tier}/textures/${k}/diffuse.webp`, normal: `public/assets/${tier}/textures/${k}/normal.webp`, arm: `public/assets/${tier}/textures/${k}/arm.webp` },
  }]));
  const models = Object.fromEntries(Object.entries(src.models).map(([k, e]) => [k, {
    ...e, size: sz.model, raw: `assets/raw/models/${k}/${e.id}_1k.gltf`, out: `public/assets/${tier}/models/${k}.glb`,
  }]));
  return { textures, models };
}

async function convertTexture(raw, out, size, quality) {
  mkdirSync(out.slice(0, out.lastIndexOf('/')), { recursive: true });
  await sharp(raw).resize(size, size).webp({ quality, effort: 5 }).toFile(out);
}

function convertModel(raw, out, size) {
  mkdirSync(out.slice(0, out.lastIndexOf('/')), { recursive: true });
  // gltf-transform's intermediate resize/webp steps write sidecar .bin and
  // texture files next to the temp .gltf, named after the *source* buffer/
  // texture URIs (not the temp filename), so a same-directory glob can miss
  // them. Isolate every intermediate in its own tmp dir and delete the whole
  // thing once the final self-contained .glb has been written.
  const tmpDir = `${out}.tmp`;
  mkdirSync(tmpDir, { recursive: true });
  const tmp1 = `${tmpDir}/1.gltf`, tmp2 = `${tmpDir}/2.gltf`;
  execSync(`npx gltf-transform resize "${raw}" "${tmp1}" --width ${size} --height ${size}`, { stdio: 'pipe' });
  execSync(`npx gltf-transform webp "${tmp1}" "${tmp2}"`, { stdio: 'pipe' });
  execSync(`npx gltf-transform draco "${tmp2}" "${out}"`, { stdio: 'pipe' });
  rmSync(tmpDir, { recursive: true, force: true });
}

const bytes = (p) => statSync(p).size;

async function buildTier(tier) {
  const plan = planTargets(SRC, tier);
  const groups = {};
  const group = (g) => (groups[g] ??= { bytes: 0, textures: {}, models: {} });
  for (const [k, t] of Object.entries(plan.textures)) {
    await convertTexture(t.raw.diffuse, t.out.diffuse, t.size, 82);
    await convertTexture(t.raw.normal, t.out.normal, t.size, 90);
    await convertTexture(t.raw.arm, t.out.arm, t.size, 88);
    const b = bytes(t.out.diffuse) + bytes(t.out.normal) + bytes(t.out.arm);
    group(t.group).textures[k] = { diffuse: t.out.diffuse.replace(/^public/, ''), normal: t.out.normal.replace(/^public/, ''), arm: t.out.arm.replace(/^public/, ''), repeat: t.repeat, bytes: b };
    group(t.group).bytes += b;
    console.log(tier, 'texture', k, b);
  }
  for (const [k, m] of Object.entries(plan.models)) {
    convertModel(m.raw, m.out, m.size);
    const b = bytes(m.out);
    group(m.group).models[k] = { url: m.out.replace(/^public/, ''), bytes: b };
    group(m.group).bytes += b;
    console.log(tier, 'model', k, b);
  }
  writeFileSync(`public/assets/manifest.${tier}.json`, JSON.stringify({ tier, groups }));
}

function credits() {
  const lines = ['# Asset credits', '', 'All assets are CC0 from [Poly Haven](https://polyhaven.com). Converted to WebP and Draco at build time by `scripts/assets/build.mjs`.', '', '| Key | Poly Haven asset | Type |', '|---|---|---|'];
  for (const [k, e] of Object.entries(SRC.textures)) lines.push(`| ${k} | [${e.id}](https://polyhaven.com/a/${e.id}) | texture |`);
  for (const [k, e] of Object.entries(SRC.models)) lines.push(`| ${k} | [${e.id}](https://polyhaven.com/a/${e.id}) | model |`);
  mkdirSync('assets', { recursive: true });
  writeFileSync('assets/CREDITS.md', lines.join('\n') + '\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!existsSync('public/draco/draco_decoder.wasm')) cpSync('node_modules/three/examples/jsm/libs/draco/gltf', 'public/draco', { recursive: true });
  await buildTier('desktop');
  await buildTier('phone');
  credits();
  console.log('assets built');
}
