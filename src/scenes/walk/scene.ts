import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FontLoader, type Font } from 'three/addons/loaders/FontLoader.js';
import { cameraAt, holdWeight, roomAt, setFrame, stopAt, thresholdDip, STOPS, type StopId } from './path';
import { buildThresholds } from './thresholds';
import { DESK_VFOV, lensFor } from './framing';
import { Focus, leanTarget } from './focus';
import { FrameGovernor, type Tier } from './quality';
import { AssetStore } from './assets';
import { createPost, type Post } from './post';
import type { Hotspot, Stage, StageDef, StageContext } from './stages/types';
import { greybox } from './stages/greybox';
import { STAGES } from './stages/registry';
import { LightRig, rigSizeFor } from './rig';
import { createPacer } from './pace';
import { createCalm, needed } from './calm';
import { disposeStray, disposeObject, anchorTiles } from './materials';
import { createHover, pickHotspot } from './interact';

export type FallbackReason = 'context-lost' | 'too-slow';
export interface WalkOptions { tier: Tier; stages?: StageDef[]; gate: StopId[]; /** A context already made on the canvas, by the tier probe, so the renderer makes no second one. */ context?: WebGL2RenderingContext;  onLoadProgress?(loaded: number, total: number): void; onDegraded?(): void; onFallback?(reason: FallbackReason): void; initialProgress?: number; coarse?: boolean; pixelRatioCap: number }
export interface WalkHandle {
  setProgress(t: number): void;
  anchors: Map<string, THREE.Vector3>;
  /** Registers where an exhibit's card should hang, measured off the prop, unless the stage that
   *  built it already named a point by hand. */
  ensureAnchor(h: Hotspot): void;
  /** The opening: the camera starts on the sign over the shutter at the size the preloader drew it,
   *  `width` as a share of the frame's width, holds for `holdMs`, and pulls back to the booth over
   *  `ms`. A scroll during it cuts it short. */
  intro(width: number, holdMs: number, ms: number): void;
  /** Runs at the head of every frame, before the camera is placed: the scroll steps here, so the
   *  frame draws the scroll of its own frame rather than the one before. */
  beforeFrame(cb: ((now: number) => void) | null): void;
  /** Leans the camera toward an exhibit and drops the room around it, or lets go with null. A
   *  project with no exhibit of its own leans toward its stop's. */
  focus(id: string | null, stop?: StopId, covered?: number): void;
  /** The pointer, in the -1..1 square, for the head's drift on a hold. */
  pointer(nx: number, ny: number): void;
  /** How far the room is dropped for an open project, 0..1, and where its exhibit sits in the
   *  frame as fractions of its width and height. */
  focusState(): { dim: number; x: number; y: number };
  camera: THREE.PerspectiveCamera; store: AssetStore; hotspots(): Hotspot[]; pick(nx: number, ny: number): Hotspot | null; hover(h: Hotspot | null): void; ready(id: StopId): boolean; whenReady(id: StopId): Promise<void>; dispose(): void;
}

const damp = (a: number, b: number, lambda: number, dt: number) => a + (b - a) * (1 - Math.exp(-lambda * dt));

export async function mountWalk(canvas: HTMLCanvasElement, opts: WalkOptions): Promise<WalkHandle> {
  // The low tier has no post stack, so it is the only one that needs the driver's own MSAA.
  const renderer = new THREE.WebGLRenderer({ canvas, context: opts.context, antialias: opts.tier === 'low', powerPreference: 'high-performance', stencil: false, depth: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.pixelRatioCap));
  // The first draw with each program reads its info log and both shaders' logs before it reads the
  // link status. Each read is a round trip to the GPU process that waits for everything queued ahead
  // of it, and across a room's programs they were most of the warm up's main thread time. The logs
  // are for development, where they stay on.
  renderer.debug.checkShaderErrors = import.meta.env.DEV;
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
  const fog = new THREE.FogExp2(0x0e161e, 0.012); scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 150);

  // Signage is drawn to a canvas, and canvas text does not wait for a webfont. Kick the load off
  // now so it overlaps the asset download, and await it just before a stage draws its stencils.
  const fontReady = (async () => { try { await document.fonts.load('600 190px Michroma'); await document.fonts.ready; } catch { /* the fallback stack still draws */ } })();
  // The same face again, as outlines this time, for the signage the kit extrudes rather than paints.
  // It rides alongside the asset download and never blocks a room: a failure hands the stages a null
  // typeface and their lettering falls back to a stencil plane.
  const typefaceReady: Promise<Font | null> = fetch('/fonts/michroma.typeface.json')
    .then((r) => { if (!r.ok) throw new Error(`michroma typeface: ${r.status}`); return r.json(); })
    .then((json) => new FontLoader().parse(json))
    .catch((err) => { console.warn('the michroma typeface did not load, signage falls back to stencils', err); return null; });

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
  const thresholds = buildThresholds(); scene.add(thresholds);

  let disposed = false;
  const store = await AssetStore.open(opts.tier);
  const anchors = new Map<string, THREE.Vector3>();
  const pacer = createPacer(4);
  // A room is built into a hidden scene under the real one, and moves across once it is warm (see
  // `warmStage` below). Built in the open, a room's props were drawn as they landed, and each one's
  // first draw linked its programs and uploaded its geometry in the middle of a frame.
  const staging = new THREE.Scene(); staging.visible = false; staging.name = 'staging'; scene.add(staging);
  const ctx: StageContext = { scene: staging, tier: opts.tier, anchors, store, typeface: await typefaceReady, pace: pacer.pace };
  const grey = greybox({ ...ctx, scene });
  // `defs.find` below takes the first stage claiming the opening stop, so the booth leads: both it
  // and the fabrication floor list `booth` in `near`, and the booth is the one that has to be up in
  // the first frame when the walk opens there.
  const defs = opts.stages ?? STAGES;
  // The preloader gates on the booth, the bay, and the room the page opens in. Their bytes fill the
  // readout to 85%. Their builds and the shader warm-up take it to 100%, each room an equal share,
  // reported step by step: on a fast line with a slow GPU they are most of the load, and read by
  // the bytes alone the readout stood at 85% for all of it. Everything else builds after the
  // preloader clears, in path order, paced against the frame budget.
  const gated = defs.filter((d) => opts.gate.includes(d.stop));
  const later = defs.filter((d) => !gated.includes(d));
  // A room is settled once its build has been attempted, whether it stood up or failed. A failed
  // room runs on the greybox for the rest of the session, so it is as ready as it will ever be and
  // the dock must land on it rather than showing the tube again on every jump.
  const settled = new Set<string>();
  const progress = new Map<string, [number, number]>();
  const report = () => {
    let l = 0, t = 0; for (const [a, b] of progress.values()) { l += a; t += b; }
    if (t > 0) opts.onLoadProgress?.(Math.round(l * 0.85), t);
  };
  const gatedGroups = Array.from(new Set(gated.flatMap((d) => d.groups)));
  // Started now, ahead of the greybox and the post stack, so their warm-up runs under the download.
  const loading = Promise.all(gatedGroups.map((g) => store.loadGroup(g, (l, t) => { progress.set(g, [l, t]); report(); })));
  for (const d of gated) void d.preload?.().catch(() => { /* the build reports it */ });
  const built = new Map<string, Stage>(); const pending = new Map<string, Promise<void>>();
  // The rooms that build behind the walk wait for the camera to park (calm.ts). `building` is the
  // one the background loop is on, and is null under the preloader, where nothing waits. A room
  // somebody asked for by name, a dock jump, is not made to wait either.
  const calm = createCalm();
  let building: StageDef | null = null;
  const wanted = new Set<StopId>();
  const span = (id: StopId): [number, number] => { const i = STOPS.findIndex((x) => x.id === id); return [STOPS[i]?.enter ?? 0, STOPS[i + 1]?.enter ?? 1]; };
  const hurry = () => {
    if (disposed || !building) return true;
    const [enter, leave] = span(building.stop);
    if (needed(current, enter, leave)) return true;
    return awaited();
  };
  /** Somebody jumped to a room that is not built and is looking at the loading sign until it is.
   *  Nothing is on screen to stutter, so the build runs the way it does under the preloader. */
  const awaited = () => {
    for (const id of wanted) { const d = defs.find((x) => x.stop === id); if (d && !built.has(d.id) && !settled.has(d.id)) return true; }
    return false;
  };
  const parked = () => (building ? calm.wait(hurry) : Promise.resolve());
  // Scroll: where the walk is asked to be, and where the camera is on its way there.
  let target = opts.initialProgress ?? 0, current = opts.initialProgress ?? 0, raf = 0;

  // Every await here can outlive the handle: a stage that finishes building after dispose() would
  // add itself to a scene nobody renders and leak its GPU memory, so bail at each resumption point.
  /**
   * `onStep` reports the room's progress, 0 to 1, for the preloader: the build is the first two
   * fifths, and moves on every `pace()` the build makes, the warm up is the rest, and moves on
   * every group compiled. The build's paces are not counted ahead, so they move it along a curve
   * that never quite arrives, and the build's end lands it.
   */
  async function ensure(def: StageDef, onStep?: (f: number) => void) {
    if (built.has(def.id) || pending.has(def.id)) return pending.get(def.id);
    const p = (async () => {
      if (disposed) return;
      await Promise.all(def.groups.map((g) => store.loadGroup(g)));
      if (disposed) return;
      await fontReady;
      if (disposed) return;
      let paces = 0;
      const stage = await def.build(onStep ? { ...ctx, pace: () => { onStep(0.4 * (++paces / (paces + 10))); return pacer.pace(); } } : { ...ctx, pace: async () => { await parked(); await pacer.pace(); } });
      if (disposed) { stage.dispose(); return; }
      onStep?.(0.4);
      anchorTiles(stage.root);
      await warmStage(stage.root, onStep && ((i, n) => onStep(0.4 + 0.6 * (i / n))));
      if (disposed) { stage.dispose(); return; }
      built.set(def.id, stage); if (def.replaces) grey.hide(def.replaces);
      if (stage.lights) rig.register(def.stop, stage.lights);
      stream(current);
    })().catch((err) => {
      console.warn(`stage ${def.id} failed`, err);
      // The stage never handed back a dispose(), so the partial root it added is the caller's to
      // clear: the greybox space it replaces is still standing and the two would draw over each other.
      disposeStray(scene, def.id); disposeStray(staging, def.id);
    }).finally(() => pending.delete(def.id));
    pending.set(def.id, p); return p;
  }

  let post: Post | null = createPost(renderer, scene, camera, opts.tier);
  // The composer tone maps in its own pass, so the renderer must hand it untouched linear HDR.
  // Without a composer the renderer has to do the mapping itself, or the frame renders raw.
  const applyToneMapping = () => { renderer.toneMapping = post ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping; };
  applyToneMapping();
  let sizedW = 0, sizedH = 0, baseFov = DESK_VFOV;
  /** How much of the frame's bottom the phone sheet covers: the dock bar under it and the collapsed
   *  sheet's handle, title and lead. Only a coarse pointer gets the sheet (walk.css). */
  const coarse = matchMedia('(pointer: coarse)');
  const sheetCover = (h: number) => (coarse.matches && window.innerWidth < h ? 12 * parseFloat(getComputedStyle(document.documentElement).fontSize) : 0);
  /**
   * The drawing buffer follows `window.innerHeight`. The canvas's own box is left to the stylesheet,
   * which pins it to the viewport with no script in the loop: a renderer that writes the box in
   * pixels is a renderer that can leave a stale one behind, and a canvas shorter than the frame is
   * the black band Jordan caught under the room. `visualViewport` fires where a plain resize does
   * not: a phone's address bar collapsing, a pinch, a desktop window whose visible area changed.
   */
  function resize(force = false) {
    const w = window.innerWidth, h = window.innerHeight;
    if (!force && w === sizedW && h === sizedH) return;
    sizedW = w; sizedH = h;
    renderer.setSize(w, h, false); post?.setSize(w, h);
    const lens = lensFor(w, h, sheetCover(h));
    camera.aspect = lens.aspect; camera.fov = baseFov = lens.fov;
    if (lens.shift) camera.setViewOffset(w, lens.shift.fullH, 0, lens.shift.y, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    setFrame(lens);
  }
  const onResize = () => resize();
  // Sized before anything links: the ambient occlusion pass keys its programs on its resolution.
  resize(true);

  // ---- Warming a room before it is drawn -----------------------------------------------------
  // Left to its first frame, a room's textures went up, its triangles went up, and its programs
  // had their source built, were submitted and were waited on one at a time, all in that frame.
  // For the two rooms behind the preloader that was a second and a half of frozen sign. For the
  // rooms that build behind the walk it was the same again, spread as a stall on every prop as it
  // landed and another on the whole room when the camera came near. So a room comes up in the
  // hidden staging scene, and this warms it before it is seen, spread over frames in three parts.
  //
  // A program is keyed on the output it draws to, and the composer draws the room into a linear
  // half float buffer, so every compile runs with a scratch target bound or it is the wrong
  // variant, which the old warm up's all were. Each group compiles on its own, in a probe scene
  // carrying the room's fog and environment with the lights gathered from the real scene, so a
  // compile costs what the group costs. Without parallel shader compile in the driver a program's
  // first draw stalls on its link (and the async compile only adds a poll), so a batch is drawn to
  // the scratch target as soon as it holds a few new programs, and the stalls land a frame apart.
  // That draw is also what puts the geometry up, with nothing culled so the whole room goes up now
  // and not on the first step into it. The passes that draw the room with a material of their own,
  // the normal pass and the shadow pass, get their programs the same way.
  const scratch = post ? new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }) : null;
  const parallel = renderer.extensions.has('KHR_parallel_shader_compile');
  // Only a container: fog, environment and lights are read from the room's scene, passed as the target.
  const probe = new THREE.Scene();
  const passes: THREE.Material[] = post?.overrides() ?? [];
  const instancedDepth = new THREE.MeshDepthMaterial();
  // The shadow pass draws each caster with a depth material carrying the caster's own map, alpha
  // map, alpha test and displacement, its side flipped, and no fog: one program per combination.
  // A depth material per combination, kept for the session so its program is never released,
  // stands in for the caster while its shadow program compiles.
  const SHADOW_SIDE: Record<number, THREE.Side> = { [THREE.FrontSide]: THREE.BackSide, [THREE.BackSide]: THREE.FrontSide, [THREE.DoubleSide]: THREE.DoubleSide };
  const depthVariants = new Map<string, THREE.MeshDepthMaterial>();
  const depthFor = (mat: THREE.Material) => {
    const m = mat as THREE.MeshStandardMaterial;
    const side = m.shadowSide ?? SHADOW_SIDE[m.side] ?? THREE.BackSide;
    const alphaTest = m.alphaToCoverage ? 0.5 : m.alphaTest;
    const key = `${side}|${m.map?.channel ?? -1}|${m.alphaMap?.channel ?? -1}|${alphaTest > 0 ? 1 : 0}|${m.displacementMap ? 1 : 0}`;
    let d = depthVariants.get(key);
    if (!d) { d = new THREE.MeshDepthMaterial({ side }); depthVariants.set(key, d); }
    d.map = m.map ?? null; d.alphaMap = m.alphaMap ?? null; d.alphaTest = alphaTest; d.displacementMap = m.displacementMap ?? null;
    return d;
  };
  const shadows = renderer.shadowMap.enabled;
  const programs = () => renderer.info.programs?.length ?? 0;
  const triangles = (o: THREE.Object3D) => { let n = 0; o.traverse((c) => { const g = (c as THREE.Mesh).geometry; if (g) n += (g.index ? g.index.count : g.attributes.position?.count ?? 0) / 3; }); return n; };
  // The GPU process takes the commands in order, and an upload that needs buffer space waits for
  // everything queued ahead of it. A fence, whose status is read without a round trip, waits for
  // the queue to clear without holding the thread. Bounded, so a driver that never signals costs
  // half a second and nothing more.
  const gl = renderer.getContext() as WebGL2RenderingContext;
  async function drained() {
    const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); if (!fence) return;
    gl.flush();
    const until = performance.now() + 500;
    try {
      while (gl.getSyncParameter(fence, gl.SYNC_STATUS) !== gl.SIGNALED && performance.now() < until && !disposed) await new Promise((r) => setTimeout(r, 4));
    } finally { gl.deleteSync(fence); }
  }
  // The program keys are read from the room's scene, so the shadow pass, which draws with no scene
  // and so no fog, compiles with the fog lifted for the synchronous part of the call.
  async function compileIn(o: THREE.Object3D, fog: boolean) {
    probe.add(o);
    renderer.setRenderTarget(scratch);
    const fogWas = scene.fog; if (!fog) scene.fog = null;
    try {
      const done = parallel ? renderer.compileAsync(probe, camera, scene) : Promise.resolve(renderer.compile(probe, camera, scene));
      scene.fog = fogWas;
      await done;
    } catch { scene.fog = fogWas; /* drivers without it still compile on first draw */ }
    renderer.setRenderTarget(null);
  }
  // While a room warms, the frames are the warm up's and not the scene's: on a driver that compiles
  // slowly they run at a few a second for a while, and judged as the scene they had the governor
  // drop the post stack, which recompiles every program for the screen in one two second block.
  const governor = new FrameGovernor();
  let warming = 0;
  async function warmStage(root: THREE.Object3D, onGroup?: (done: number, total: number) => void) {
    warming++;
    try { await warmRoot(root, onGroup); } finally { warming--; governor.reset(); }
  }
  /**
   * For a browser with no parallel shader compile, which is Firefox: there a compile links every
   * new program before it returns, and a room dressed in a dozen new materials held the thread for
   * four hundred milliseconds in one piece while the walk was on screen. This links the group's
   * programs one to a frame instead, through a stand in for each material: a bare mesh on the same
   * geometry and the same material, carrying whatever of its object the program is keyed on
   * (instancing, instance colour, whether it takes shadow). The group's own compile after it then
   * finds every one of them linked and costs nothing.
   */
  async function linkOneAtATime(g: THREE.Object3D) {
    const seen = new Set<string>();
    const stand: THREE.Mesh[] = [];
    g.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh || !m.material || !m.geometry) return;
      const inst = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh) : null;
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        const key = `${mat.uuid}:${inst ? (inst.instanceColor ? 'ic' : 'i') : 'p'}:${m.receiveShadow ? 's' : ''}:${Object.keys(m.geometry.attributes).sort().join(',')}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const rep = inst ? new THREE.InstancedMesh(m.geometry, mat, 1) : new THREE.Mesh(m.geometry, mat);
        if (inst?.instanceColor) (rep as THREE.InstancedMesh).instanceColor = inst.instanceColor;
        rep.receiveShadow = m.receiveShadow; rep.castShadow = m.castShadow; rep.frustumCulled = false;
        stand.push(rep);
      }
    });
    for (const rep of stand) {
      await parked();
      if (disposed) return;
      const before = programs();
      probe.add(rep);
      renderer.setRenderTarget(scratch);
      try { renderer.compile(probe, camera, scene); } catch { /* its first draw links it */ }
      renderer.setRenderTarget(null);
      probe.remove(rep);
      // Only a compile that linked something has cost anything. After one, the thread is handed
      // back so a frame that is due can be drawn. A timer and not a frame callback: on a renderer
      // that draws a frame a second, waiting for a frame after every program would take a room a
      // minute to build.
      if (programs() > before) await new Promise((r) => setTimeout(r, 0));
    }
  }
  /** Every program a group draws with: its own, its glass's back faces, each pass's, the shadow
   *  pass's. The group is left in the probe; the caller puts it back. */
  async function compileGroup(g: THREE.Object3D, spread = false) {
    if (spread) await linkOneAtATime(g);
    await compileIn(g, true);
    // Glass that is double sided draws its back faces first, in a program of their own.
    const glass: THREE.MeshPhysicalMaterial[] = [];
    g.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshPhysicalMaterial | undefined; if (m && m.transmission > 0 && m.side === THREE.DoubleSide && !m.transparent && !glass.includes(m)) glass.push(m); });
    if (glass.length) {
      for (const m of glass) { m.side = THREE.BackSide; m.needsUpdate = true; }
      await compileIn(g, true);
      for (const m of glass) { m.side = THREE.DoubleSide; m.needsUpdate = true; }
    }
    const swapped: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
    for (const pass of passes) {
      g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.material) { swapped.push([m, m.material]); m.material = pass; } });
      await compileIn(g, true);
      for (const [m, mat] of swapped) m.material = mat;
      swapped.length = 0;
    }
    if (shadows) {
      g.traverse((o) => {
        const m = o as THREE.Mesh; if (!m.isMesh || !m.material || !m.castShadow) return;
        swapped.push([m, m.material]);
        m.material = Array.isArray(m.material) ? m.material.map(depthFor) : depthFor(m.material);
      });
      await compileIn(g, false);
      for (const [m, mat] of swapped) m.material = mat;
    }
  }
  async function warmRoot(root: THREE.Object3D, onGroup?: (done: number, total: number) => void) {
    // three keeps one program per material and refetches it whenever a material is drawn instanced
    // after plain, or plain after instanced, on every draw of each: nineteen materials across the
    // kit were doing that every frame, a parameter build and a cache lookup a draw. The instanced
    // meshes get a copy of theirs. A copy shares the textures, so nothing more goes up.
    const users = new Map<THREE.Material, { plain: boolean; instanced: THREE.InstancedMesh[] }>();
    root.traverse((o) => {
      const mesh = o as THREE.Mesh; if (!mesh.isMesh || !mesh.material) return;
      for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const u = users.get(mat) ?? { plain: false, instanced: [] };
        if ((mesh as THREE.InstancedMesh).isInstancedMesh) u.instanced.push(mesh as THREE.InstancedMesh); else u.plain = true;
        users.set(mat, u);
      }
    });
    for (const [mat, u] of users) {
      if (!u.plain || !u.instanced.length) continue;
      const copy = mat.clone();
      for (const m of u.instanced) m.material = Array.isArray(m.material) ? m.material.map((x) => (x === mat ? copy : x)) : copy;
    }
    // Two passes draw every object with one material of their own, the normal pass and the shadow
    // pass, and the same rule holds for them: drawn plain, instanced, plain, that one material
    // refetched its program on every draw, thirty times a frame in the steady state. So the opaque
    // instanced meshes draw after everything plain, one change a pass, and cast their shadows with
    // a depth material that is theirs alone.
    root.traverse((o) => {
      const m = o as THREE.InstancedMesh; if (!m.isInstancedMesh) return;
      if (!(Array.isArray(m.material) ? m.material.some((x) => x.transparent) : m.material.transparent)) m.renderOrder = 1;
      m.customDepthMaterial = instancedDepth;
    });
    const textures = new Set<THREE.Texture>();
    root.traverse((o) => { const m = (o as THREE.Mesh).material; for (const mat of Array.isArray(m) ? m : m ? [m] : []) for (const v of Object.values(mat)) if (v && (v as THREE.Texture).isTexture) textures.add(v as THREE.Texture); });
    // Uploads are queued, and a burst of them fills the buffer faster than the GPU process empties
    // it, at which point one upload in the burst blocks for the whole backlog: a room's model
    // textures cost the thread 110 ms in one call. So the burst is bounded in bytes, and each one
    // waits for the queue to clear before the next.
    // Under the preloader the burst is three times the size: every wait for the queue is at least
    // one timer, a room has eighty of them at 4 MB, and a longer block on the thread costs nothing
    // while there is no walk on screen to hold up.
    const burst = () => (onGroup || awaited() ? 12_000_000 : 4_000_000);
    let queued = 0;
    for (const t of textures) {
      await parked();
      if (disposed) return;
      renderer.initTexture(t);
      const img = t.image as { width?: number; height?: number } | undefined;
      queued += (img?.width ?? 256) * (img?.height ?? 256) * 4;
      if (queued > burst()) { await drained(); queued = 0; }
    }
    // Into the real scene, hidden from the frame loop, its groups held back until each is compiled.
    const groups = [...root.children];
    for (const g of groups) root.remove(g);
    scene.add(root); root.visible = false;
    const culled: THREE.Object3D[] = [];
    // Under the preloader the groups compile several at a time. Each compile waits on a timer for
    // the driver to say its programs are linked, three or four waits a group, and a room is a
    // hundred groups, most of them drawing with programs an earlier group already linked: one at a
    // time that was two seconds of every load spent waiting on timers, the same two seconds on a
    // fast machine as on a slow one. In the background, with the walk running, they still go one
    // at a time, so no single step holds a frame for a batch's worth of work.
    // In big pieces under the preloader, and under the loading sign of a dock jump, where a room
    // warmed a program at a time took a minute on a slow renderer with the reader waiting on it.
    const big = () => !!onGroup || awaited();
    const warmed: THREE.Object3D[] = [];
    let batch = 0, fresh = 0, known = programs();
    for (let i = 0; i < groups.length;) {
      if (disposed) return;
      const lot = new THREE.Group(), members: THREE.Object3D[] = [];
      let tris = 0;
      while (i < groups.length && (members.length === 0 || (members.length < (big() ? 10 : 1) && tris + triangles(groups[i]!) < 60_000))) {
        const g = groups[i++]!; tris += triangles(g); members.push(g); lot.add(g);
      }
      await parked();
      await compileGroup(lot, !parallel && !big());
      for (const g of members) {
        root.add(g);
        g.traverse((o) => { if (o.frustumCulled) { o.frustumCulled = false; culled.push(o); } });
      }
      lot.removeFromParent();
      batch += tris; fresh += programs() - known; known = programs();
      // Behind the walk a draw goes out for every new program and every twenty thousand triangles:
      // the first draw of either is what holds the thread, so there it is taken in small pieces.
      if (batch >= (big() ? 60_000 : 20_000) || fresh >= (big() ? 4 : 1) || i === groups.length) {
        await parked();
        // Only what is new is drawn. This draw used to take the whole scene with it, every room
        // standing and every group of this one already warmed, and behind the walk it now goes out
        // several times as often: on a slow renderer each was a full frame of somebody else's
        // geometry, and a dock jump waiting on the room could not get a frame of its own in. The
        // lights are the rig's and stay, so the programs are the ones the real frame will ask for.
        const hidden: THREE.Object3D[] = [];
        for (const o of scene.children) if (o !== root && o.name !== 'rig' && o.visible) { o.visible = false; hidden.push(o); }
        for (const g of warmed) if (g.visible) { g.visible = false; hidden.push(g); }
        root.visible = true;
        renderer.setRenderTarget(scratch); renderer.render(scene, camera); renderer.setRenderTarget(null);
        root.visible = false;
        for (const o of hidden) o.visible = true;
        for (const g of root.children) if (!warmed.includes(g)) warmed.push(g);
        batch = 0; fresh = 0;
        await new Promise(requestAnimationFrame);
      }
      onGroup?.(i, groups.length);
    }
    for (const g of groups) if (g.parent !== root) root.add(g);
    for (const o of culled) o.frustumCulled = true;
    root.visible = true;
  }
  // The stack's own programs and the greybox's link now, under the download, through the same warm
  // up as the rooms. One draw over the greybox then finds every program ready. Drawn cold, the
  // first frame linked them all at once and held the thread for a third of a second.
  if (post) {
    // Two compiles, not one a material: each waits a poll. The screen pass keys on the canvas.
    const flat = new THREE.Camera();
    for (const toScreen of [false, true]) {
      const group = new THREE.Group();
      for (const s of post.screens()) if (s.toScreen === toScreen) group.add(new THREE.Mesh(s.geometry, s.material));
      if (!group.children.length) continue;
      probe.add(group); renderer.setRenderTarget(toScreen ? null : scratch);
      try { if (parallel) await renderer.compileAsync(probe, flat); else renderer.compile(probe, flat); } catch { /* its first draw links it */ }
      renderer.setRenderTarget(null); probe.remove(group);
    }
  }
  if (!disposed) { await compileGroup(grey.root); scene.add(grey.root); }
  if (!disposed) { await compileGroup(thresholds); scene.add(thresholds); }
  if (!disposed) { if (post) post.render(0); else renderer.render(scene, camera); }

  await loading;
  if (disposed) throw new Error('disposed during load');
  for (const [k, d] of gated.entries()) {
    try {
      await ensure(d, (f) => opts.onLoadProgress?.(Math.round(1000 * (0.85 + 0.15 * ((k + f) / gated.length))), 1000));
      if (!disposed && !built.has(d.id)) throw new Error(`stage ${d.id} did not build`);
    } catch (err) {
      console.warn(`the ${d.id} stage did not build, running on the greybox`, err);
      opts.onDegraded?.();
    }
    settled.add(d.id);
  }


  const cam = { position: new THREE.Vector3(), target: new THREE.Vector3() };
  const clock = new THREE.Clock();
  cameraAt(current, cam); camera.position.copy(cam.position); camera.lookAt(cam.target);

  // ---- The held frame breathes ----------------------------------------------------------------
  // A hold is where the reader stops to read, eight seconds or more of one frame, and a frame that
  // is perfectly still reads as a screenshot. Held, the camera drifts a few centimetres and a
  // fraction of a degree on slow clocks that share no factor, the way a camera on a person does,
  // and settles as the walk moves on. Not with reduced motion.
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let drift = 0;
  function breathe(dt: number) {
    if (still) return;
    drift += dt;
    const w = holdWeight(current);
    if (w <= 0) return;
    camera.position.x += w * 0.045 * Math.sin(drift * 0.23);
    camera.position.y += w * 0.02 * Math.sin(drift * 0.31 + 1.3);
    camera.rotateY(w * 0.0025 * Math.sin(drift * 0.17 + 0.6));
    camera.rotateX(w * 0.002 * Math.sin(drift * 0.29 + 2.1));
  }

  // ---- The opening --------------------------------------------------------------------------
  // The preloader's sign cuts to this one: the camera stands square to the run at the distance that
  // makes it the same width on screen, holds while the HTML fades off it, then eases back to the
  // booth's own pose. Orientation is slerped, not the aim point lerped, so the pull back is one turn.
  let opening: { width: number; start: number; ms: number; cut: boolean } | null = null;
  const openFrom = new THREE.Vector3(), openAim = new THREE.Vector3(), openQ = new THREE.Quaternion(), endQ = new THREE.Quaternion();
  const openBox = new THREE.Box3();
  const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  function openingPose() {
    if (!opening) return;
    const letters = built.get('booth')?.root.getObjectByName('letters');
    if (!letters) { opening = null; return; }
    openBox.setFromObject(letters); openBox.getCenter(openAim);
    const runW = openBox.max.x - openBox.min.x;
    const hHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    // Never further back than the booth leaves room for: the booth's back wall is 7.7 m behind the
    // run, and a sign drawn small on a very wide screen would otherwise start the camera behind it.
    openFrom.set(openAim.x, openAim.y, openAim.z + Math.min(5.5, runW / (opening.width * 2 * hHalf)));
    // A scroll during the opening is the reader wanting to walk: finish in a third of a second.
    const now = performance.now();
    if (!opening.cut && target > 0.004) { opening.cut = true; const done = Math.max(0, (now - opening.start) / opening.ms); opening.start = now - done * 350; opening.ms = 350; }
    const e = Math.min(1, Math.max(0, (now - opening.start) / opening.ms));
    if (e >= 1) { opening = null; return; }
    const k = ease(e);
    endQ.copy(camera.quaternion);
    camera.position.lerpVectors(openFrom, cam.position, k);
    // Square to the run: straight down -z from wherever the pull back has got to.
    camera.lookAt(camera.position.x, camera.position.y, camera.position.z - 1); openQ.copy(camera.quaternion);
    camera.quaternion.slerpQuaternions(openQ, endQ, k);
  }

  // Spec §8: a scene tiered above what the GPU can hold is trimmed after two slow seconds, and
  // handed to the lite path after three more. Time based, so a machine at 6 fps is rescued in
  // seconds rather than after 120 frames.
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
    resize(true);
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

  // Picking and the hover light. One raycaster for the session, and only the rooms the streamer has
  // left visible are candidates, so a cursor never lands on a cabinet three rooms away.
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hoverFx = createHover();
  // The lean toward an open project's exhibit and the head's drift after the pointer, laid over the
  // path's pose each frame. Neither runs for a reader who asked for less motion: the room still
  // drops, the camera stays where the walk put it.
  const focus = new Focus();
  const focusAt = new THREE.Vector3();
  const focusOut = { dim: 0, x: 0.5, y: 0.5 };
  // Only the room the camera is standing in. The streamer keeps a stop's neighbours visible, and a
  // ray has no idea a wall is in the way: without this the cert plates in the credentials hall were
  // pickable from the break room, forty metres off and through two rooms of geometry.
  const hotspots = () => {
    // The nearest stop's exhibits, and those of the room the camera is standing in. They differ in
    // the second half of a room, past the midpoint to the next stop: the break room's end wall set
    // is passed there, and it could not be picked from the one stretch of the walk that faces it.
    const here = stopAt(current).id, room = roomAt(current).id;
    const out: Hotspot[] = [];
    for (const s of built.values()) {
      if (!s.root.visible || !s.hotspots) continue;
      for (const h of s.hotspots) if (h.stop === here || h.stop === room) out.push(h);
    }
    return out;
  };

  let before: ((now: number) => void) | null = null;
  function frame(now = performance.now()) {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    before?.(now);
    // Checked every frame as well as on the events: a viewport can change without firing either of
    // them, and the buffer would then be drawn at the old size and scaled into the new box. The
    // call is two reads and a comparison unless the frame actually changed.
    resize();
    // Read before the reset: this is what the build spent in the frame that just ended, which is
    // the span `getDelta()` is about to measure. The governor is fed the frame time the scene
    // itself cost, so it keeps judging the machine through the build instead of going blind for
    // the ten seconds the rooms take, while a marginal machine is never trimmed, or handed to the
    // lite path, over frames the build was paying for and the walk will never render again.
    const paced = pacer.spent();
    pacer.frame();
    const dt = Math.min(clock.getDelta(), 0.05);
    if (warming === 0) sample(Math.max(0.001, dt - paced / 1000));
    current = damp(current, target, 8, dt);
    if (Math.abs(target - current) > 1e-4) calm.moved();
    cameraAt(current, cam);
    focus.update(dt, opening ? 0 : holdWeight(current));
    if (!still) focus.apply(cam);
    camera.position.copy(cam.position); camera.lookAt(cam.target);
    breathe(dt);
    if (opening) openingPose();
    rig.update(current, dt);
    fog.color.copy(rig.grade.haze); fog.density = rig.grade.density; (scene.background as THREE.Color).copy(rig.grade.haze);
    // A beat of shade on each threshold, and the room beyond opens as the camera comes through: the
    // lens closes a few degrees in the vestibule and widens again with the room.
    const dip = thresholdDip(current);
    renderer.toneMappingExposure = rig.grade.exposure * (1 - 0.2 * dip); scene.environmentIntensity = rig.grade.env;
    // The lens closes a little on an open project as well. One write, only when it has changed.
    const lens = baseFov * (1 - 0.07 * dip) * (still ? 1 : focus.fov);
    if (Math.abs(lens - camera.fov) > 1e-4) { camera.fov = lens; camera.updateProjectionMatrix(); }
    grey.update(current, dt); for (const s of built.values()) s.update(current, dt);
    hoverFx.update(dt);
    if (post) post.render(dt); else renderer.render(scene, camera);
  }
  resize(true); window.addEventListener('resize', onResize); window.visualViewport?.addEventListener('resize', onResize);
  grey.setNear(nearStops(current));
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
    try {
      for (const d of later) {
        if (disposed) { settleReadiness(); return; }
        building = d;
        try {
          // The decode of a room's files stalls frames as well, so it waits its turn like the rest.
          await parked();
          await Promise.all(d.groups.map((g) => store.loadGroup(g)));
          await ensure(d);
          // ensure() swallows a build error in its own catch, so a room that threw shows up here only
          // as a missing entry. Without this check the room never degrades and never settles: the
          // tube would come back on every dock jump to it for the rest of the session.
          if (!disposed && !built.has(d.id)) throw new Error(`stage ${d.id} did not build`);
          if (!disposed) stream(target);
        } catch (err) { console.warn(`background build of ${d.id} failed, running on the greybox`, err); opts.onDegraded?.(); }
        settled.add(d.id);
        // loadGroup's decode sits outside the pacer, so the frames it stalls arrive at sample()
        // reading as 20 fps with nothing paced to discount. Forty of those in a row are enough to
        // trim, and a second run is enough to bail the page to the lite path for the session, on a
        // machine that would run the finished scene fine. Starting the governor's windows again per
        // room means no window can span a room's unpaced cost.
        governor.reset();
        readiness.get(d.stop)?.resolve();
      }
    } finally {
      building = null;
      // The scene the machine actually has to run starts here. The discounted frames through the
      // build were still evidence, but they were evidence about a scene with rooms missing, so the
      // governor starts its warmup and its windows again on the finished one.
      governor.reset();
    }
  })();

  return {
    setProgress(t) { target = t; stream(t); },
    intro(width, holdMs, ms) { opening = { width, start: performance.now() + holdMs, ms, cut: false }; },
    beforeFrame(cb) { before = cb; },
    anchors, camera, store,
    ensureAnchor(h) {
      if (anchors.has(h.id) || disposed) return;
      const box = new THREE.Box3().setFromObject(h.object);
      if (box.isEmpty()) return;
      anchors.set(h.id, box.getCenter(new THREE.Vector3()));
    },
    hotspots,
    pick(nx, ny) {
      if (disposed) return null;
      raycaster.setFromCamera(pointer.set(nx, ny), camera);
      return pickHotspot(raycaster, hotspots());
    },
    hover(h) { hoverFx.set(h); },
    focus(id, _stop, covered = 0) {
      if (disposed) return;
      if (!id) { focus.setTarget(null); hoverFx.hold(null); return; }
      // The exhibit itself where the room has one, measured off the prop.
      const spot = hotspots().find((h) => h.id === id) ?? null;
      const box = spot ? new THREE.Box3().setFromObject(spot.object) : null;
      // Leaned to only when it is near and in front, off the path's own pose and not the one a
      // project already open has leaned it to. Otherwise the room drops and the camera stays put.
      const aim = leanTarget(box && !box.isEmpty() ? box.getCenter(new THREE.Vector3()) : null, cameraAt(current));
      // Hold an exhibit in the middle of what the panel leaves clear: half the covered share, off
      // centre. With nothing to hold there is nothing to move aside for.
      const hHalf = Math.tan(THREE.MathUtils.degToRad(baseFov / 2)) * camera.aspect;
      focus.offset = aim.exhibit ? Math.atan(Math.min(0.45, covered) * hHalf) : 0;
      focus.setTarget(aim.at);
      hoverFx.hold(aim.exhibit ? spot : null);
    },
    pointer(nx, ny) { if (!still) focus.setPointer(nx, ny); },
    focusState() {
      focusOut.dim = focus.dim;
      if (focus.dim > 0) { focusAt.copy(focus.aim).project(camera); focusOut.x = (focusAt.x + 1) / 2; focusOut.y = (1 - focusAt.y) / 2; }
      return focusOut;
    },
    ready: (id) => { const d = defs.find((x) => x.stop === id); return !d || built.has(d.id) || settled.has(d.id); },
    whenReady: (id) => { wanted.add(id); return readiness.get(id)?.promise ?? Promise.resolve(); },
    dispose() {
      disposed = true; cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize); window.visualViewport?.removeEventListener('resize', onResize);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      hoverFx.dispose();
      for (const s of built.values()) { s.dispose(); s.root.removeFromParent(); } grey.dispose(); rig.dispose(); disposeObject(thresholds); post?.dispose(); scratch?.dispose(); store.dispose();
      envRT.dispose(); renderer.dispose(); setTimeout(() => renderer.forceContextLoss(), 1000);
      settleReadiness();
    },
  };
}
