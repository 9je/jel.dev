import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { cameraAt, stopAt, STOPS, type StopId } from './path';
import type { Tier } from './quality';
import { AssetStore } from './assets';
import { createPost, type Post } from './post';
import type { Stage, StageDef, StageContext } from './stages/types';
import { greybox } from './stages/greybox';
import { BOOTH_DEF } from './stages/booth';

export interface WalkOptions { tier: Tier; stages?: StageDef[]; onLoadProgress?(loaded: number, total: number): void; initialProgress?: number }
export interface WalkHandle { setProgress(t: number): void; anchors: Map<string, THREE.Vector3>; camera: THREE.PerspectiveCamera; store: AssetStore; dispose(): void }

const damp = (a: number, b: number, lambda: number, dt: number) => a + (b - a) * (1 - Math.exp(-lambda * dt));

export async function mountWalk(canvas: HTMLCanvasElement, opts: WalkOptions): Promise<WalkHandle> {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, depth: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.tier === 'low' ? 1 : 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.62;
  renderer.shadowMap.enabled = opts.tier === 'high'; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e161e);
  scene.fog = new THREE.FogExp2(0x0e161e, 0.012);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 150);

  // Every surface here is metal, and metal with nothing to reflect renders black. A small prefiltered
  // room gives the plate walls and the shutter something in their reflections, kept dim so it reads
  // as bounce rather than as a studio.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.14;
  pmrem.dispose();

  const store = await AssetStore.open(opts.tier);
  const anchors = new Map<string, THREE.Vector3>();
  const ctx: StageContext = { scene, tier: opts.tier, anchors, store };
  const grey = greybox(ctx);
  const defs = opts.stages ?? [BOOTH_DEF];
  const built = new Map<string, Stage>(); const pending = new Map<string, Promise<void>>();

  async function ensure(def: StageDef) {
    if (built.has(def.id) || pending.has(def.id)) return pending.get(def.id);
    const p = (async () => {
      await Promise.all(def.groups.map((g) => store.loadGroup(g)));
      const stage = await def.build(ctx);
      built.set(def.id, stage); if (def.replaces) grey.hide(def.replaces);
    })().catch((err) => console.warn(`stage ${def.id} failed`, err)).finally(() => pending.delete(def.id));
    pending.set(def.id, p); return p;
  }

  // Signage is drawn to a canvas, and canvas text does not wait for a webfont, so make sure
  // the display face is decoded and ready before the first stage builds its stencils.
  try { await document.fonts.load('600 190px Michroma'); await document.fonts.ready; } catch { /* the fallback stack still draws */ }

  // First frame: everything the booth needs, reported to the preloader by bytes.
  const first = defs.find((d) => d.near.includes('booth'));
  if (first) { await Promise.all(first.groups.map((g) => store.loadGroup(g, (l, t) => opts.onLoadProgress?.(l, t)))); await ensure(first); }
  opts.onLoadProgress?.(1, 1);

  function resize() { renderer.setSize(window.innerWidth, window.innerHeight, false); post?.setSize(window.innerWidth, window.innerHeight); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); }

  let target = opts.initialProgress ?? 0, current = opts.initialProgress ?? 0, disposed = false, raf = 0;
  const cam = { position: new THREE.Vector3(), target: new THREE.Vector3() };
  const clock = new THREE.Clock();
  cameraAt(current, cam); camera.position.copy(cam.position); camera.lookAt(cam.target);

  // Spec §8: sample the first 120 frames; under 24 fps average, drop the post stack and the pixel ratio once.
  let post: Post | null = createPost(renderer, scene, camera, opts.tier);
  let frames = 0, elapsed = 0, downgraded = false;
  function sample(dt: number) {
    if (downgraded || frames >= 120) return;
    frames++; elapsed += dt;
    if (frames === 120 && frames / elapsed < 24) { downgraded = true; post?.dispose(); post = null; renderer.setPixelRatio(1); resize(); }
  }

  function stream(t: number) {
    const i = STOPS.findIndex((s) => s.id === stopAt(t).id);
    const near = new Set<StopId>([STOPS[i]?.id, STOPS[i - 1]?.id, STOPS[i + 1]?.id].filter(Boolean) as StopId[]);
    for (const d of defs) if (d.near.some((n) => near.has(n))) void ensure(d);
  }

  function frame() {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    sample(dt);
    current = damp(current, target, 8, dt);
    cameraAt(current, cam); camera.position.copy(cam.position); camera.lookAt(cam.target);
    grey.update(current, dt); for (const s of built.values()) s.update(current, dt);
    if (post) post.render(dt); else renderer.render(scene, camera);
  }
  resize(); window.addEventListener('resize', resize);
  frame();

  return {
    setProgress(t) { target = t; stream(t); },
    anchors, camera, store,
    dispose() {
      disposed = true; cancelAnimationFrame(raf); window.removeEventListener('resize', resize);
      for (const s of built.values()) s.dispose(); grey.dispose(); post?.dispose(); store.dispose();
      envRT.dispose(); renderer.dispose(); setTimeout(() => renderer.forceContextLoss(), 1000);
    },
  };
}
