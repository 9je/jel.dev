import * as THREE from 'three';
import { cameraAt } from './path';
import type { Tier } from './quality';
import type { Stage, StageBuilder, StageContext } from './stages/types';
import { greybox } from './stages/greybox';

export interface WalkOptions { tier: Tier; stages?: StageBuilder[]; onLoadProgress?(loaded: number, total: number): void }
export interface WalkHandle { setProgress(t: number): void; anchors: Map<string, THREE.Vector3>; camera: THREE.PerspectiveCamera; dispose(): void }

const damp = (a: number, b: number, lambda: number, dt: number) => a + (b - a) * (1 - Math.exp(-lambda * dt));

export async function mountWalk(canvas: HTMLCanvasElement, opts: WalkOptions): Promise<WalkHandle> {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: opts.tier === 'high', powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.tier === 'low' ? 1 : 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e161e);
  scene.fog = new THREE.FogExp2(0x0e161e, 0.014);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 150);

  const anchors = new Map<string, THREE.Vector3>();
  const ctx: StageContext = { scene, tier: opts.tier, anchors };
  const builders = opts.stages ?? [greybox];
  const stages: Stage[] = [];
  let done = 0;
  for (const b of builders) { stages.push(await b(ctx)); opts.onLoadProgress?.(++done, builders.length); }

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  }
  resize(); window.addEventListener('resize', resize);

  let target = 0, current = 0, disposed = false, raf = 0;
  const cam = { position: new THREE.Vector3(), target: new THREE.Vector3() };
  const clock = new THREE.Clock();
  cameraAt(0, cam); camera.position.copy(cam.position); camera.lookAt(cam.target);

  function frame() {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    current = damp(current, target, 8, dt);
    cameraAt(current, cam);
    camera.position.copy(cam.position);
    camera.lookAt(cam.target);
    for (const s of stages) s.update(current, dt);
    renderer.render(scene, camera);
  }
  frame();

  return {
    setProgress(t) { target = t; },
    anchors, camera,
    dispose() {
      disposed = true; cancelAnimationFrame(raf); window.removeEventListener('resize', resize);
      for (const s of stages) s.dispose();
      renderer.dispose(); setTimeout(() => renderer.forceContextLoss(), 1000);
    },
  };
}
