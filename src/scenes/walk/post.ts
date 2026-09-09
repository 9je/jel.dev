import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, NormalPass, BloomEffect, VignetteEffect, NoiseEffect, SMAAEffect, SSAOEffect, BlendFunction, type Effect } from 'postprocessing';
import type { Tier } from './quality';

export interface Post { render(dt: number): void; setSize(w: number, h: number): void; dispose(): void }

export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, tier: Tier): Post | null {
  if (tier === 'low' || tier === 'lite') return null;
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));

  // Ambient occlusion is the expensive one, so only the high tier pays for it. It runs off a
  // normal buffer rendered at full size and occludes at half resolution.
  const effects: Effect[] = [];
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
  const vignette = new VignetteEffect({ offset: 0.3, darkness: 0.6 });
  const noise = new NoiseEffect({ blendFunction: BlendFunction.SOFT_LIGHT, premultiply: true }); noise.blendMode.opacity.value = 0.06;
  effects.push(bloom, vignette, noise, new SMAAEffect());
  composer.addPass(new EffectPass(camera, ...effects));
  return {
    render(dt) { composer.render(dt); },
    setSize(w, h) { composer.setSize(w, h); },
    dispose() { composer.dispose(); },
  };
}
