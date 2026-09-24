import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, NormalPass, BloomEffect, VignetteEffect, NoiseEffect, SMAAEffect, SSAOEffect, ToneMappingEffect, ToneMappingMode, BlendFunction, Pass, Effect } from 'postprocessing';
import type { Tier } from './quality';

/** `overrides` are the materials the stack draws the whole scene with itself, for the scene to warm
 *  their programs before the first frame. */
export interface Post {
  render(dt: number): void; setSize(w: number, h: number): void; overrides(): THREE.Material[]; dispose(): void;
  /** Every material the stack draws a screen with, the effects' own passes included, so the scene
   *  can compile them before the first frame. `toScreen` marks the pass that draws to the canvas,
   *  whose programs key on the canvas's colour space rather than a buffer's. */
  screens(): { geometry: THREE.BufferGeometry; material: THREE.Material; toScreen: boolean }[];
}

/** Every pass reachable from the composer that draws a screen, the effects' own passes included:
 *  bloom's luminance and blur passes, occlusion's depth and occlusion passes. */
type ScreenPass = Pass & { screen: THREE.Mesh | null };
function screenPasses(composer: EffectComposer): ScreenPass[] {
  const out: ScreenPass[] = [], seen = new Set<object>();
  const visit = (o: object, depth: number) => {
    if (seen.has(o) || depth > 4) return;
    seen.add(o);
    if (o instanceof Pass && (o as ScreenPass).screen) out.push(o as ScreenPass);
    for (const v of Object.values(o)) {
      if (Array.isArray(v)) { for (const x of v) if (x instanceof Pass || x instanceof Effect) visit(x, depth + 1); }
      else if (v instanceof Pass || v instanceof Effect) visit(v, depth + 1);
    }
  };
  for (const p of composer.passes) visit(p, 0);
  return out;
}

/**
 * The composer renders into a half float buffer with the renderer's own tone mapping switched off
 * (see `scene.ts`), so the scene stays linear HDR until `ToneMappingEffect` maps it at the end of
 * the chain. Bloom therefore blooms real HDR values rather than clipped ones.
 *
 * Order matters twice over. `SMAAEffect` blends with `BlendFunction.SRC` and re-samples the pass
 * input, so anywhere but first it would overwrite every effect before it. Tone mapping sits after
 * the HDR work (occlusion, bloom) and before the display-space work (vignette, grain).
 */
export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, tier: Tier): Post | null {
  if (tier === 'low' || tier === 'lite') return null;
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));

  const effects: Effect[] = [new SMAAEffect()];
  const overrides: THREE.Material[] = [];
  // Ambient occlusion is the expensive one, so only the high tier pays for it. It runs off a
  // normal buffer rendered at full size and occludes at half resolution.
  if (tier === 'high') {
    const normals = new NormalPass(scene, camera);
    composer.addPass(normals);
    // The pass keeps its render pass to itself in the typings, and the material it overrides with.
    const inner = (normals as unknown as { renderPass?: { overrideMaterial: THREE.Material | null } }).renderPass;
    if (inner?.overrideMaterial) overrides.push(inner.overrideMaterial);
    effects.push(new SSAOEffect(camera, normals.texture, {
      blendFunction: BlendFunction.MULTIPLY,
      samples: 16, rings: 5, distanceScaling: true, depthAwareUpsampling: true,
      luminanceInfluence: 0.55, radius: 0.09, intensity: 2.4, bias: 0.03, fade: 0.02,
      resolutionScale: 0.5, worldDistanceThreshold: 24, worldDistanceFalloff: 6,
      worldProximityThreshold: 0.5, worldProximityFalloff: 0.2,
    }));
  }
  const bloom = new BloomEffect({ luminanceThreshold: 0.85, luminanceSmoothing: 0.2, intensity: 0.7, mipmapBlur: true, radius: 0.6 });
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
  const vignette = new VignetteEffect({ offset: 0.3, darkness: 0.6 });
  const noise = new NoiseEffect({ blendFunction: BlendFunction.SOFT_LIGHT, premultiply: true }); noise.blendMode.opacity.value = 0.06;
  effects.push(bloom, tone, vignette, noise);
  composer.addPass(new EffectPass(camera, ...effects));
  return {
    render(dt) { composer.render(dt); },
    setSize(w, h) { composer.setSize(w, h); },
    overrides() { return overrides; },
    screens() {
      const out: { geometry: THREE.BufferGeometry; material: THREE.Material; toScreen: boolean }[] = [];
      for (const p of screenPasses(composer)) {
        const screen = p.screen!;
        // A blur pass swaps between its own materials as it renders: every material the pass holds.
        const materials = new Set<THREE.Material>([screen.material as THREE.Material]);
        for (const v of Object.values(p)) if ((v as THREE.Material)?.isMaterial) materials.add(v as THREE.Material);
        for (const material of materials) out.push({ geometry: screen.geometry, material, toScreen: p.renderToScreen });
      }
      return out;
    },
    dispose() { composer.dispose(); },
  };
}
