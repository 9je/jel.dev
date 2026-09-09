import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { cameraAt, stopAt, STOPS, type StopId } from './path';
import type { Tier } from './quality';
import { AssetStore } from './assets';
import { createPost, type Post } from './post';
import type { Stage, StageDef, StageContext } from './stages/types';
import { greybox } from './stages/greybox';
import { BOOTH_DEF } from './stages/booth';
import { FABRICATION_DEF } from './stages/fabrication';

export interface WalkOptions { tier: Tier; stages?: StageDef[]; onLoadProgress?(loaded: number, total: number): void; onDegraded?(): void; initialProgress?: number }
export interface WalkHandle { setProgress(t: number): void; anchors: Map<string, THREE.Vector3>; camera: THREE.PerspectiveCamera; store: AssetStore; dispose(): void }

const damp = (a: number, b: number, lambda: number, dt: number) => a + (b - a) * (1 - Math.exp(-lambda * dt));

export async function mountWalk(canvas: HTMLCanvasElement, opts: WalkOptions): Promise<WalkHandle> {
  // The low tier has no post stack, so it is the only one that needs the driver's own MSAA.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: opts.tier === 'low', powerPreference: 'high-performance', stencil: false, depth: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.tier === 'low' ? 1 : 1.5));
  // Exposure is set once here and read by whichever operator is live: three's own ACES when there is
  // no composer, postprocessing's ToneMappingEffect when there is. Both compile
  // `<tonemapping_pars_fragment>`, and the renderer pushes `toneMappingExposure` into every program,
  // so this stays the single exposure control across both paths.
  renderer.toneMappingExposure = 1.0;
  // three 0.185 deprecated PCFSoftShadowMap and silently substitutes PCFShadowMap, so ask for what
  // actually runs rather than taking a console warning on every high tier load.
  renderer.shadowMap.enabled = opts.tier === 'high'; renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e161e);
  scene.fog = new THREE.FogExp2(0x0e161e, 0.012);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 150);

  // Signage is drawn to a canvas, and canvas text does not wait for a webfont. Kick the load off
  // now so it overlaps the asset download, and await it just before a stage draws its stencils.
  const fontReady = (async () => { try { await document.fonts.load('600 190px Michroma'); await document.fonts.ready; } catch { /* the fallback stack still draws */ } })();

  // Every surface here is metal, and metal with nothing to reflect renders black. A small prefiltered
  // room gives the plate walls and the shutter something in their reflections, kept dim so it reads
  // as bounce rather than as a studio.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.14;
  pmrem.dispose();

  let disposed = false;
  const store = await AssetStore.open(opts.tier);
  const anchors = new Map<string, THREE.Vector3>();
  const ctx: StageContext = { scene, tier: opts.tier, anchors, store };
  const grey = greybox(ctx);
  // `defs.find` below takes the first stage claiming the opening stop, so the booth leads: both it
  // and the fabrication floor list `booth` in `near`, and the booth is the one that has to be up in
  // the first frame when the walk opens there.
  const defs = opts.stages ?? [BOOTH_DEF, FABRICATION_DEF];
  const built = new Map<string, Stage>(); const pending = new Map<string, Promise<void>>();

  // Every await here can outlive the handle: a stage that finishes building after dispose() would
  // add itself to a scene nobody renders and leak its GPU memory, so bail at each resumption point.
  async function ensure(def: StageDef) {
    if (built.has(def.id) || pending.has(def.id)) return pending.get(def.id);
    const p = (async () => {
      if (disposed) return;
      await Promise.all(def.groups.map((g) => store.loadGroup(g)));
      if (disposed) return;
      await fontReady;
      if (disposed) return;
      const stage = await def.build(ctx);
      if (disposed) { stage.dispose(); return; }
      built.set(def.id, stage); if (def.replaces) grey.hide(def.replaces);
    })().catch((err) => console.warn(`stage ${def.id} failed`, err)).finally(() => pending.delete(def.id));
    pending.set(def.id, p); return p;
  }

  // First frame: everything the stop we are opening at needs, reported to the preloader by bytes.
  const openingAt = stopAt(opts.initialProgress ?? 0).id;
  const first = defs.find((d) => d.near.includes(openingAt)) ?? defs.find((d) => d.id === BOOTH_DEF.id) ?? defs[0];
  if (first) {
    try {
      await Promise.all(first.groups.map((g) => store.loadGroup(g, (l, t) => opts.onLoadProgress?.(l, t))));
      await ensure(first);
      if (!disposed && !built.has(first.id)) throw new Error(`stage ${first.id} did not build`);
    } catch (err) {
      // The greybox still stands in for the space, so the walk stays usable. Say so out loud and
      // mark the document, rather than hanging the preloader on a room that will never arrive.
      console.warn(`the ${first.id} stage did not build, running on the greybox`, err);
      opts.onDegraded?.();
    }
  }
  opts.onLoadProgress?.(1, 1);

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false); post?.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    // A portrait phone crops a 55 degree horizontal cone down to almost nothing, so a taller frame
    // than it is wide gets a wider lens and keeps the room in shot.
    camera.fov = camera.aspect < 1 ? 72 : 55;
    camera.updateProjectionMatrix();
  }

  let target = opts.initialProgress ?? 0, current = opts.initialProgress ?? 0, raf = 0;
  const cam = { position: new THREE.Vector3(), target: new THREE.Vector3() };
  const clock = new THREE.Clock();
  cameraAt(current, cam); camera.position.copy(cam.position); camera.lookAt(cam.target);

  // Spec §8: sample the first 120 frames; under 24 fps average, drop the post stack and the pixel ratio once.
  let post: Post | null = createPost(renderer, scene, camera, opts.tier);
  // The composer tone maps in its own pass, so the renderer must hand it untouched linear HDR.
  // Without a composer the renderer has to do the mapping itself, or the frame renders raw.
  const applyToneMapping = () => { renderer.toneMapping = post ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping; };
  applyToneMapping();
  let frames = 0, elapsed = 0, downgraded = false;
  function sample(dt: number) {
    if (downgraded || frames >= 120) return;
    frames++; elapsed += dt;
    if (frames === 120 && frames / elapsed < 24) { downgraded = true; post?.dispose(); post = null; applyToneMapping(); renderer.setPixelRatio(1); resize(); }
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
