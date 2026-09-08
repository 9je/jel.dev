import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildHangar, type Quality } from './geometry';
import { buildLights } from './lights';
import { loadSign, type Sign } from './sign';
import { lightsOnState, LIT, SEQUENCE_DURATION, type LightState } from './sequence';
import { parallaxTarget, damp, scrollCameraZ } from './controls';
import { CAMERA, COLORS, type WingId } from './constants';

export interface BayOptions { skipSequence: boolean; quality: Quality; onSequenceDone?: () => void }
export interface BayHandle {
  setHover(id: WingId | null): void;
  flare(id: WingId): Promise<void>;
  setPointer(nx: number, ny: number): void;
  setScroll(progress: number): void;
  dispose(): void;
}

const GATE_IDLE = 1.4;
const GATE_HOVER = 3.2;
const GATE_FLARE = 6;
const FLARE_MS = 260;

export async function mountBay(canvas: HTMLCanvasElement, opts: BayOptions): Promise<BayHandle> {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: opts.quality === 'high', powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.bayBlack);
  scene.fog = new THREE.FogExp2(COLORS.bayBlack, 0.010);

  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 120);
  camera.position.set(CAMERA.x, CAMERA.y, CAMERA.zStart);

  let done = opts.skipSequence;
  if (done) opts.onSequenceDone?.();

  await document.fonts.load('44px Michroma').catch(() => undefined);
  const hangar = buildHangar(opts.quality);
  scene.add(hangar.root);
  const lights = buildLights(scene);
  let sign: Sign | null = null;
  try { sign = await loadSign(); scene.add(sign.mesh); } catch (err) { console.warn('sign failed to load', err); }

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (opts.quality === 'high') composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.3, 0.5, 0.95));
  composer.addPass(new OutputPass());

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  const gateTarget = new Map<WingId, number>(hangar.gates.map((g): [WingId, number] => [g.id, GATE_IDLE]));
  const gateNow = new Map<WingId, number>(hangar.gates.map((g): [WingId, number] => [g.id, 0]));
  let flareId: WingId | null = null;
  let flareUntil = 0;
  let yaw = 0, pitch = 0, yawT = 0, pitchT = 0;
  let scrollT = 0, scrollNow = 0;
  let elapsed = 0;
  let disposed = false;
  let raf = 0;
  const clock = new THREE.Clock();
  const startMs = performance.now();

  function apply(s: LightState, dt: number, now: number) {
    hangar.strips.forEach((bank, i) => {
      const v = s.banks[i] ?? 0;
      for (const m of bank) m.emissiveIntensity = v * 2.2;
      lights.banks[i]!.intensity = v * 260;
    });
    hangar.cubeInterior.emissiveIntensity = s.cube * 0.12;
    hangar.cubeLight.intensity = s.cube * 1.0;
    if (sign) sign.edge.emissiveIntensity = s.sign * 3;
    lights.sign.intensity = s.sign * 5;
    for (const g of hangar.gates) {
      let target = (gateTarget.get(g.id) ?? GATE_IDLE) * s.gates;
      if (flareId === g.id && now < flareUntil) target = GATE_FLARE;
      const v = damp(gateNow.get(g.id) ?? 0, target, 10, dt);
      gateNow.set(g.id, v);
      g.frame.emissiveIntensity = v;
      g.board.emissiveIntensity = Math.min(v, 1.6);
      g.light.intensity = v * 4;
    }
  }

  function frame() {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const now = performance.now();
    elapsed = (now - startMs) / 1000;
    const s = done ? LIT : lightsOnState(elapsed);
    if (!done && elapsed >= SEQUENCE_DURATION) { done = true; opts.onSequenceDone?.(); }
    apply(s, dt, now);
    yaw = damp(yaw, yawT, 4, dt);
    pitch = damp(pitch, pitchT, 4, dt);
    scrollNow = damp(scrollNow, scrollT, 6, dt);
    camera.position.z = scrollCameraZ(scrollNow);
    camera.rotation.set(pitch, yaw, 0);
    composer.render();
  }
  frame();

  return {
    setHover(id) { for (const g of hangar.gates) gateTarget.set(g.id, g.id === id ? GATE_HOVER : GATE_IDLE); },
    flare(id) {
      flareId = id;
      flareUntil = performance.now() + FLARE_MS;
      return new Promise((resolve) => setTimeout(resolve, FLARE_MS));
    },
    setPointer(nx, ny) { const t = parallaxTarget(nx, ny); yawT = t.yaw; pitchT = t.pitch; },
    setScroll(p) { scrollT = p; },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
        }
      });
      composer.dispose();
      renderer.dispose();
    },
  };
}
