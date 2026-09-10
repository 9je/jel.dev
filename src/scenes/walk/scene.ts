import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { cameraAt, stopAt, STOPS, type StopId } from './path';
import { FrameGovernor, type Tier } from './quality';
import { AssetStore } from './assets';
import { createPost, type Post } from './post';
import type { Stage, StageDef, StageContext } from './stages/types';
import { greybox } from './stages/greybox';
import { STAGE_LOADERS } from './stages/registry';
import { LightRig, rigSizeFor } from './rig';
import { createPacer } from './pace';

export type FallbackReason = 'context-lost' | 'too-slow';
export interface WalkOptions { tier: Tier; stages?: StageDef[]; gate: StopId[]; onLoadProgress?(loaded: number, total: number): void; onDegraded?(): void; onFallback?(reason: FallbackReason): void; initialProgress?: number; coarse?: boolean; pixelRatioCap: number }
export interface WalkHandle { setProgress(t: number): void; anchors: Map<string, THREE.Vector3>; camera: THREE.PerspectiveCamera; store: AssetStore; ready(id: StopId): boolean; whenReady(id: StopId): Promise<void>; dispose(): void }

const damp = (a: number, b: number, lambda: number, dt: number) => a + (b - a) * (1 - Math.exp(-lambda * dt));

export async function mountWalk(canvas: HTMLCanvasElement, opts: WalkOptions): Promise<WalkHandle> {
  // The low tier has no post stack, so it is the only one that needs the driver's own MSAA.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: opts.tier === 'low', powerPreference: 'high-performance', stencil: false, depth: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.pixelRatioCap));
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

  // The scene's fixed set of lights: rooms declare placements into it rather than owning lights of
  // their own, so the light count never changes at a stop transition and no material recompiles.
  const rig = new LightRig(scene, rigSizeFor(opts.tier, !!opts.coarse), opts.tier === 'high');

  let disposed = false;
  const store = await AssetStore.open(opts.tier);
  const anchors = new Map<string, THREE.Vector3>();
  const pacer = createPacer(4);
  const ctx: StageContext = { scene, tier: opts.tier, anchors, store, pace: pacer.pace };
  const grey = greybox(ctx);
  // `defs.find` below takes the first stage claiming the opening stop, so the booth leads: both it
  // and the fabrication floor list `booth` in `near`, and the booth is the one that has to be up in
  // the first frame when the walk opens there.
  const defs = opts.stages ?? await Promise.all(STAGE_LOADERS.map((load) => load()));
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
      if (stage.lights) rig.register(def.stop, stage.lights);
    })().catch((err) => console.warn(`stage ${def.id} failed`, err)).finally(() => pending.delete(def.id));
    pending.set(def.id, p); return p;
  }

  // The preloader gates on the booth, the bay, and the room the page opens in. Their bytes fill the
  // tube to 85%. Their builds and the shader warm-up take it to 100%. Everything else builds after
  // the tube clears, in path order, paced against the frame budget.
  const gated = defs.filter((d) => opts.gate.includes(d.stop));
  const later = defs.filter((d) => !gated.includes(d));
  const progress = new Map<string, [number, number]>();
  const report = () => {
    let l = 0, t = 0; for (const [a, b] of progress.values()) { l += a; t += b; }
    if (t > 0) opts.onLoadProgress?.(Math.round(l * 0.85), t);
  };
  const gatedGroups = Array.from(new Set(gated.flatMap((d) => d.groups)));
  await Promise.all(gatedGroups.map((g) => store.loadGroup(g, (l, t) => { progress.set(g, [l, t]); report(); })));
  if (disposed) throw new Error('disposed during load');
  for (const d of gated) {
    try {
      await ensure(d);
      if (!disposed && !built.has(d.id)) throw new Error(`stage ${d.id} did not build`);
    } catch (err) {
      console.warn(`the ${d.id} stage did not build, running on the greybox`, err);
      opts.onDegraded?.();
    }
  }

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

  let post: Post | null = createPost(renderer, scene, camera, opts.tier);
  // The composer tone maps in its own pass, so the renderer must hand it untouched linear HDR.
  // Without a composer the renderer has to do the mapping itself, or the frame renders raw.
  const applyToneMapping = () => { renderer.toneMapping = post ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping; };
  applyToneMapping();

  // Spec §8: a scene tiered above what the GPU can hold is trimmed after two slow seconds, and
  // handed to the lite path after three more. Time based, so a machine at 6 fps is rescued in
  // seconds rather than after 120 frames.
  const governor = new FrameGovernor();
  function trim() {
    post?.dispose(); post = null; applyToneMapping();
    renderer.setPixelRatio(1);
    if (renderer.shadowMap.enabled) {
      renderer.shadowMap.enabled = false;
      scene.traverse((o) => {
        if ((o as THREE.Light).isLight) (o as THREE.Light).castShadow = false;
        const m = (o as THREE.Mesh).material;
        for (const mat of Array.isArray(m) ? m : m ? [m] : []) mat.needsUpdate = true;
      });
    }
    resize();
  }
  function sample(dt: number) {
    const verdict = governor.push(dt);
    if (verdict === 'trim') trim();
    else if (verdict === 'bail') opts.onFallback?.('too-slow');
  }
  // A lost context is what a tab crash looks like from the inside. Stop the loop and let the page
  // fall to the lite path instead of drawing to a dead canvas.
  const onContextLost = (e: Event) => { e.preventDefault(); opts.onFallback?.('context-lost'); };
  canvas.addEventListener('webglcontextlost', onContextLost);

  function nearStops(t: number) {
    const i = STOPS.findIndex((s) => s.id === stopAt(t).id);
    return new Set<StopId>([STOPS[i]?.id, STOPS[i - 1]?.id, STOPS[i + 1]?.id].filter(Boolean) as StopId[]);
  }

  // The visibility switch for built rooms as well as greybox spaces. Nothing here triggers a build:
  // rooms build only in the background loop below, in path order, never because the camera is near.
  function stream(t: number) {
    const near = nearStops(t);
    grey.setNear(near);
    for (const d of defs) { const s = built.get(d.id); if (s) s.root.visible = d.near.some((n) => near.has(n)); }
  }

  function frame() {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    pacer.frame();
    const dt = Math.min(clock.getDelta(), 0.05);
    sample(dt);
    current = damp(current, target, 8, dt);
    cameraAt(current, cam); camera.position.copy(cam.position); camera.lookAt(cam.target);
    rig.update(current, dt);
    grey.update(current, dt); for (const s of built.values()) s.update(current, dt);
    if (post) post.render(dt); else renderer.render(scene, camera);
  }
  resize(); window.addEventListener('resize', resize);
  // Warm the GPU before the preloader clears: every program compiles now, in parallel where the
  // driver allows it, and one frame renders so the first scroll starts on hot shaders. Without this
  // the first look into the hangar compiled a few dozen programs synchronously mid-gesture.
  grey.setNear(nearStops(current));
  try { if (!disposed) await renderer.compileAsync(scene, camera); } catch { /* drivers without it still compile on first draw */ }
  if (!disposed) { if (post) post.render(0); else renderer.render(scene, camera); }
  opts.onLoadProgress?.(1, 1);
  stream(target);
  frame();

  // Background build: download, build (paced), compile off the gesture, in path order. Nothing here
  // is triggered by the camera. A room that fails stays greybox and logs once.
  const readiness = new Map<string, { promise: Promise<void>; resolve: () => void }>();
  for (const d of defs) { let resolve!: () => void; const promise = new Promise<void>((r) => { resolve = r; }); readiness.set(d.stop, { promise, resolve }); }
  for (const d of gated) readiness.get(d.stop)!.resolve();
  // Nothing waiting on a room's readiness should hang forever: a dispose mid-build (tab navigated
  // away, fallback fired) still has to let a dock click's whenReady() settle.
  const settleReadiness = () => { for (const r of readiness.values()) r.resolve(); };
  void (async () => {
    for (const d of later) {
      if (disposed) { settleReadiness(); return; }
      try {
        await Promise.all(d.groups.map((g) => store.loadGroup(g)));
        await ensure(d);
        const stage = built.get(d.id);
        // compileAsync traverses the whole tree regardless of visibility in three 0.185, and it needs
        // the scene passed through so it can see the rig's lights and cache the right light count.
        if (stage && !disposed) { await renderer.compileAsync(stage.root, camera, scene); stream(target); }
      } catch (err) { console.warn(`background build of ${d.id} failed`, err); opts.onDegraded?.(); }
      readiness.get(d.stop)?.resolve();
    }
  })();

  return {
    setProgress(t) { target = t; stream(t); },
    anchors, camera, store,
    ready: (id) => { const d = defs.find((x) => x.stop === id); return !d || built.has(d.id); },
    whenReady: (id) => readiness.get(id)?.promise ?? Promise.resolve(),
    dispose() {
      disposed = true; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); canvas.removeEventListener('webglcontextlost', onContextLost);
      for (const s of built.values()) s.dispose(); grey.dispose(); rig.dispose(); post?.dispose(); store.dispose();
      envRT.dispose(); renderer.dispose(); setTimeout(() => renderer.forceContextLoss(), 1000);
      settleReadiness();
    },
  };
}
