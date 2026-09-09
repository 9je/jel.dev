import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, NormalPass, BloomEffect, VignetteEffect, NoiseEffect, SMAAEffect, SSAOEffect, ToneMappingEffect, ToneMappingMode, BlendFunction, type Effect } from 'postprocessing';
import type { Tier } from './quality';

export interface Post { render(dt: number): void; setSize(w: number, h: number): void; dispose(): void }

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
  // Ambient occlusion is the expensive one, so only the high tier pays for it. It runs off a
  // normal buffer rendered at full size and occludes at half resolution.
  if (tier === 'high') {
    const normals = new NormalPass(scene, camera);
    composer.addPass(normals);
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
    dispose() { composer.dispose(); },
  };
}
