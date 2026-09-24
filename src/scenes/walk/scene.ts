import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FontLoader, type Font } from 'three/addons/loaders/FontLoader.js';
import { cameraAt, holdWeight, setFrame, stopAt, thresholdDip, STOPS, type StopId } from './path';
import { buildThresholds } from './thresholds';
import { DESK_VFOV, lensFor } from './framing';
import { FrameGovernor, type Tier } from './quality';
import { AssetStore } from './assets';
import { createPost, type Post } from './post';
import type { Hotspot, Stage, StageDef, StageContext } from './stages/types';
import { greybox } from './stages/greybox';
import { STAGE_LOADERS } from './stages/registry';
import { LightRig, rigSizeFor } from './rig';
import { createPacer } from './pace';
import { disposeStray, disposeObject, anchorTiles } from './materials';
import { createHover, pickHotspot } from './interact';

export type FallbackReason = 'context-lost' | 'too-slow';
export interface WalkOptions { tier: Tier; stages?: StageDef[]; gate: StopId[]; onLoadProgress?(loaded: number, total: number): void; onDegraded?(): void; onFallback?(reason: FallbackReason): void; initialProgress?: number; coarse?: boolean; pixelRatioCap: number }
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
  camera: THREE.PerspectiveCamera; store: AssetStore; hotspots(): Hotspot[]; pick(nx: number, ny: number): Hotspot | null; hover(h: Hotspot | null): void; ready(id: StopId): boolean; whenReady(id: StopId): Promise<void>; dispose(): void;
}

const damp = (a: number, b: number, lambda: number, dt: number) => a + (b - a) * (1 - Math.exp(-lambda * dt));

export async function mountWalk(canvas: HTMLCanvasElement, opts: WalkOptions): Promise<WalkHandle> {
  // The low tier has no post stack, so it is the only one that needs the driver's own MSAA.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: opts.tier === 'low', powerPreference: 'high-performance', stencil: false, depth: true });
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
  const defs = opts.stages ?? await Promise.all(STAGE_LOADERS.map((load) => load()));
  const built = new Map<string, Stage>(); const pending = new Map<string, Promise<void>>();
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
      const stage = await def.build(onStep ? { ...ctx, pace: () => { onStep(0.4 * (++paces / (paces + 10))); return pacer.pace(); } } : ctx);
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
  let sizedW = 0, sizedH = 0, baseFov = DESK_VFOV, dipped = false;
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
  // The post stack's own programs link on their first use. Drawn once now, over the greybox, at the
  // frame's real size, they link while the download has the main thread idle anyway. Drawn at the
  // canvas's default size they linked twice: the ambient occlusion pass keys on its resolution.
  resize(true);
  if (post) post.render(0); else renderer.render(scene, camera);

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
    let queued = 0;
    for (const t of textures) {
      if (disposed) return;
      renderer.initTexture(t);
      const img = t.image as { width?: number; height?: number } | undefined;
      queued += (img?.width ?? 256) * (img?.height ?? 256) * 4;
      if (queued > 4_000_000) { await drained(); queued = 0; }
    }
    // Into the real scene, hidden from the frame loop, its groups held back until each is compiled.
    const groups = [...root.children];
    for (const g of groups) root.remove(g);
    scene.add(root); root.visible = false;
    const culled: THREE.Object3D[] = [];
    let batch = 0, fresh = 0, known = programs();
    for (const [i, g] of groups.entries()) {
      if (disposed) return;
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
      root.add(g);
      g.traverse((o) => { if (o.frustumCulled) { o.frustumCulled = false; culled.push(o); } });
      batch += triangles(g); fresh += programs() - known; known = programs();
      if (batch >= 60_000 || fresh >= 4 || i === groups.length - 1) {
        root.visible = true;
        renderer.setRenderTarget(scratch); renderer.render(scene, camera); renderer.setRenderTarget(null);
        root.visible = false;
        batch = 0; fresh = 0;
        await new Promise(requestAnimationFrame);
      }
      onGroup?.(i + 1, groups.length);
    }
    for (const g of groups) if (g.parent !== root) root.add(g);
    for (const o of culled) o.frustumCulled = true;
    root.visible = true;
  }

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
  await Promise.all(gatedGroups.map((g) => store.loadGroup(g, (l, t) => { progress.set(g, [l, t]); report(); })));
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
  // Only the room the camera is standing in. The streamer keeps a stop's neighbours visible, and a
  // ray has no idea a wall is in the way: without this the cert plates in the credentials hall were
  // pickable from the break room, forty metres off and through two rooms of geometry.
  const hotspots = () => {
    const here = stopAt(current).id;
    const out: Hotspot[] = [];
    for (const s of built.values()) {
      if (!s.root.visible || !s.hotspots) continue;
      for (const h of s.hotspots) if (h.stop === here) out.push(h);
    }
    return out;
  };

  function frame() {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
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
    cameraAt(current, cam); camera.position.copy(cam.position); camera.lookAt(cam.target);
    breathe(dt);
    if (opening) openingPose();
    rig.update(current, dt);
    fog.color.copy(rig.grade.haze); fog.density = rig.grade.density; (scene.background as THREE.Color).copy(rig.grade.haze);
    // A beat of shade on each threshold, and the room beyond opens as the camera comes through: the
    // lens closes a few degrees in the vestibule and widens again with the room.
    const dip = thresholdDip(current);
    renderer.toneMappingExposure = rig.grade.exposure * (1 - 0.2 * dip); scene.environmentIntensity = rig.grade.env;
    if (dip > 0.002 || dipped) { camera.fov = baseFov * (1 - 0.07 * dip); camera.updateProjectionMatrix(); dipped = dip > 0.002; }
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
        try {
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
      // The scene the machine actually has to run starts here. The discounted frames through the
      // build were still evidence, but they were evidence about a scene with rooms missing, so the
      // governor starts its warmup and its windows again on the finished one.
      governor.reset();
    }
  })();

  return {
    setProgress(t) { target = t; stream(t); },
    intro(width, holdMs, ms) { opening = { width, start: performance.now() + holdMs, ms, cut: false }; },
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
    ready: (id) => { const d = defs.find((x) => x.stop === id); return !d || built.has(d.id) || settled.has(d.id); },
    whenReady: (id) => readiness.get(id)?.promise ?? Promise.resolve(),
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
