import * as THREE from 'three';
import { radialTexture } from '../textures';

/**
 * Particles that cost the CPU nothing per frame: every mote or puff is a point whose motion is a
 * function of time in the vertex shader, so a system is one draw call and one uniform write a
 * frame however many points it holds. Points face the camera on their own, which is what smoke,
 * steam and dust all want. Sizes attenuate with distance against a fixed scale, so a puff is the
 * same size in the world on every screen and a little softer on a tall one.
 */
export interface ParticleSystem { points: THREE.Points; update(dt: number): void; dispose(): void }

const SCALE = 520;

const FRAG = `
uniform sampler2D uMap; uniform vec3 uColor; uniform float uOpacity;
varying float vAlpha;
void main() {
  float a = texture2D(uMap, gl_PointCoord).a * vAlpha * uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
}`;

/** Dust hanging in a volume: each mote drifts on its own slow orbit and twinkles as it turns. */
const DUST_VERT = `
uniform float uTime; uniform float uSize;
attribute vec3 seed;
varying float vAlpha;
void main() {
  float ph = seed.x, sp = seed.y, amp = seed.z;
  vec3 p = position;
  p.x += sin(uTime * sp + ph) * amp;
  p.y += sin(uTime * sp * 0.6 + ph * 1.7) * amp * 0.5 - fract(uTime * sp * 0.05 + ph) * amp * 0.4;
  p.z += cos(uTime * sp * 0.8 + ph * 0.9) * amp;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * ${SCALE.toFixed(1)} / -mv.z;
  vAlpha = 0.55 + 0.45 * sin(uTime * sp * 2.3 + ph * 3.1);
  gl_Position = projectionMatrix * mv;
}`;

/** A plume: each puff is born at the source, rises, spreads, swells and thins, then is born again.
 *  Births are staggered by seed, so the column is always populated end to end. */
const PLUME_VERT = `
uniform float uTime, uLife, uRise, uSpread, uSize;
attribute vec3 seed;
varying float vAlpha;
void main() {
  float age = fract(uTime / uLife + seed.x);
  vec3 p = position;
  p.y += age * uRise;
  p.x += seed.y * age * uSpread + sin(uTime * 0.9 + seed.x * 6.283) * 0.04 * age;
  p.z += seed.z * age * uSpread + cos(uTime * 0.7 + seed.x * 6.283) * 0.04 * age;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * (0.35 + age * 1.3) * ${SCALE.toFixed(1)} / -mv.z;
  vAlpha = smoothstep(0.0, 0.12, age) * (1.0 - smoothstep(0.45, 1.0, age));
  gl_Position = projectionMatrix * mv;
}`;

function system(geometry: THREE.BufferGeometry, vertexShader: string, uniforms: Record<string, THREE.IUniform>, additive: boolean): ParticleSystem {
  const map = radialTexture(64, 0.02); map.userData.owned = true;
  const material = new THREE.ShaderMaterial({
    vertexShader, fragmentShader: FRAG,
    uniforms: { uTime: { value: 0 }, uMap: { value: map }, ...uniforms },
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;  // the shader moves points past the geometry's own bounds
  return {
    points,
    update(dt) { material.uniforms.uTime.value += dt; },
    dispose() { geometry.dispose(); material.dispose(); map.dispose(); },
  };
}

/** Motes filling the box from `min` to `max`. `size` is a mote's diameter in metres. */
export function dust(min: [number, number, number], max: [number, number, number], count: number, opts: { color?: number; size?: number; opacity?: number; amp?: number } = {}): ParticleSystem {
  const pos = new Float32Array(count * 3), seed = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 3; k++) pos[i * 3 + k] = min[k] + Math.random() * (max[k] - min[k]);
    seed[i * 3] = Math.random() * 6.283; seed[i * 3 + 1] = 0.15 + Math.random() * 0.35; seed[i * 3 + 2] = (opts.amp ?? 0.25) * (0.5 + Math.random());
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 3));
  return system(g, DUST_VERT, {
    uSize: { value: opts.size ?? 0.05 }, uColor: { value: new THREE.Color(opts.color ?? 0xffe9c4) }, uOpacity: { value: opts.opacity ?? 0.35 },
  }, true);
}

/**
 * A plume off a source. `along` spreads the births along a line through `origin`, for smoke seeping
 * from under a door rather than off a single point. `life` seconds per puff, `rise` metres over a
 * life, `spread` metres of sideways drift over a life, `size` a puff's diameter at the end of it.
 */
export function plume(origin: [number, number, number], opts: { count?: number; life?: number; rise?: number; spread?: number; size?: number; color?: number; opacity?: number; along?: [number, number, number]; additive?: boolean } = {}): ParticleSystem {
  const count = opts.count ?? 40, along = opts.along ?? [0, 0, 0];
  const pos = new Float32Array(count * 3), seed = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = Math.random() - 0.5;
    pos[i * 3] = origin[0] + along[0] * a; pos[i * 3 + 1] = origin[1] + along[1] * a; pos[i * 3 + 2] = origin[2] + along[2] * a;
    seed[i * 3] = Math.random(); seed[i * 3 + 1] = Math.random() * 2 - 1; seed[i * 3 + 2] = Math.random() * 2 - 1;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 3));
  return system(g, PLUME_VERT, {
    uLife: { value: opts.life ?? 3 }, uRise: { value: opts.rise ?? 1.2 }, uSpread: { value: opts.spread ?? 0.4 }, uSize: { value: opts.size ?? 0.35 },
    uColor: { value: new THREE.Color(opts.color ?? 0xb8bec4) }, uOpacity: { value: opts.opacity ?? 0.28 },
  }, opts.additive ?? false);
}
