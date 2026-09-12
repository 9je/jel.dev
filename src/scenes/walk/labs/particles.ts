import * as THREE from 'three';
import { radialTexture } from '../textures';
import { canvas, own, rng } from './textures';

/**
 * Particles that cost the CPU nothing per frame: every mote or puff is a point whose motion is a
 * function of time in the vertex shader, so a system is one draw call and one uniform write a
 * frame however many points it holds. Points face the camera on their own, which is what smoke,
 * steam and dust all want. Sizes attenuate with distance against a fixed scale, so a puff is the
 * same size in the world on every screen and a little softer on a tall one.
 *
 * Two things the first pass got wrong are fixed in the shaders themselves. A mote that shrinks to
 * a pixel is drawn as a hard one pixel dot, which is the speckle Jordan saw on the break room's
 * walls, so alpha now fades out under four pixels. And a mote that drifts up to the lens grows to
 * a plate over the whole frame, which was the "single light point" in the bay, so it fades out
 * again past two hundred. A puff of smoke is a textured sprite that turns as it rises, not a soft
 * disc: a disc of any colour reads as a blob, and a row of blobs was the smoke he did not love.
 */
export interface ParticleSystem { points: THREE.Points; update(dt: number): void; dispose(): void }

const SCALE = 520;

const FRAG = `
uniform sampler2D uMap; uniform vec3 uColor; uniform float uOpacity;
varying float vAlpha; varying float vRot;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float s = sin(vRot), k = cos(vRot);
  vec2 rc = vec2(c.x * k - c.y * s, c.x * s + c.y * k) + 0.5;
  float a = texture2D(uMap, rc).a * vAlpha * uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
}`;

/** The size fades: gone under four pixels, gone again past two hundred and forty. */
const SIZE_FADE = `smoothstep(1.5, 4.5, gl_PointSize) * (1.0 - smoothstep(180.0, 240.0, gl_PointSize))`;

/** Dust hanging in a volume: each mote drifts on its own slow orbit and twinkles as it turns. */
const DUST_VERT = `
uniform float uTime; uniform float uSize;
attribute vec3 seed;
varying float vAlpha; varying float vRot;
void main() {
  float ph = seed.x, sp = seed.y, amp = seed.z;
  vec3 p = position;
  p.x += sin(uTime * sp + ph) * amp;
  p.y += sin(uTime * sp * 0.6 + ph * 1.7) * amp * 0.5 - fract(uTime * sp * 0.05 + ph) * amp * 0.4;
  p.z += cos(uTime * sp * 0.8 + ph * 0.9) * amp;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * ${SCALE.toFixed(1)} / -mv.z;
  vAlpha = (0.55 + 0.45 * sin(uTime * sp * 2.3 + ph * 3.1)) * ${SIZE_FADE};
  vRot = 0.0;
  gl_Position = projectionMatrix * mv;
}`;

/** A plume: each puff is born at the source, rises, spreads, swells and thins, then is born again.
 *  Births are staggered by seed, so the column is always populated end to end. `uDrift` is a wind
 *  the whole plume leans into, and `spin` turns each puff on its own axis as it goes. */
const PLUME_VERT = `
uniform float uTime, uLife, uRise, uSpread, uSize, uGrow;
uniform vec3 uDrift;
attribute vec3 seed;
attribute float spin;
varying float vAlpha; varying float vRot;
void main() {
  float age = fract(uTime / uLife + seed.x);
  vec3 p = position;
  p.y += age * uRise;
  p.x += seed.y * age * uSpread + sin(uTime * 0.9 + seed.x * 6.283) * 0.04 * age;
  p.z += seed.z * age * uSpread + cos(uTime * 0.7 + seed.x * 6.283) * 0.04 * age;
  p += uDrift * age * uLife;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * (0.35 + age * uGrow) * ${SCALE.toFixed(1)} / -mv.z;
  vAlpha = smoothstep(0.0, 0.12, age) * (1.0 - smoothstep(0.45, 1.0, age)) * ${SIZE_FADE};
  vRot = spin * 6.283 + uTime * (spin - 0.5) * 1.4;
  gl_Position = projectionMatrix * mv;
}`;

/**
 * A puff of smoke: a cluster of soft blobs under a radial mask, so the sprite has lumps in its
 * outline and thins toward its edge. Alpha only; the system colours it. Seeded, so a room draws
 * the same smoke in every still.
 */
export function smokeTexture(size = 128, seed = 3): THREE.CanvasTexture {
  const [c, ctx] = canvas(size, size);
  const r = rng(seed);
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 18; i++) {
    const a = r() * Math.PI * 2, d = r() * size * 0.22;
    const x = size / 2 + Math.cos(a) * d, y = size / 2 + Math.sin(a) * d;
    const rad = size * (0.14 + r() * 0.2);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const k = 0.1 + r() * 0.14;
    g.addColorStop(0, `rgba(255,255,255,${k.toFixed(3)})`); g.addColorStop(0.6, `rgba(255,255,255,${(k * 0.45).toFixed(3)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  }
  // The mask: whatever the blobs built, the sprite's edge is round and clear.
  ctx.globalCompositeOperation = 'destination-in';
  const m = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size / 2);
  m.addColorStop(0, 'rgba(255,255,255,1)'); m.addColorStop(0.7, 'rgba(255,255,255,0.7)'); m.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = m; ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';
  return own(c);
}

function system(geometry: THREE.BufferGeometry, vertexShader: string, uniforms: Record<string, THREE.IUniform>, additive: boolean, map: THREE.Texture): ParticleSystem {
  map.userData.owned = true;
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
  }, true, radialTexture(64, 0.02));
}

export interface PlumeOptions {
  count?: number;
  /** Seconds a puff lives. */
  life?: number;
  /** Metres a puff rises over its life. */
  rise?: number;
  /** Metres of sideways drift over a life. */
  spread?: number;
  /** A puff's diameter at birth times 0.35, and at death times `grow`. */
  size?: number;
  /** How many times its birth size a puff has swollen to at the end of its life. 1.3 by default. */
  grow?: number;
  color?: number;
  opacity?: number;
  /** Births spread along this line through `origin`, for smoke seeping from under a door. */
  along?: [number, number, number];
  /** A wind, in metres per second, the whole plume leans into. */
  drift?: [number, number, number];
  additive?: boolean;
  /** `smoke` is the lumpy turning sprite. `soft` is the plain disc steam wants. */
  texture?: 'smoke' | 'soft';
  seed?: number;
}

/**
 * A plume off a source: smoke by default, turning as it rises. `along` spreads the births along a
 * line through `origin`, for smoke seeping from under a door rather than off a single point.
 */
export function plume(origin: [number, number, number], opts: PlumeOptions = {}): ParticleSystem {
  const count = opts.count ?? 40, along = opts.along ?? [0, 0, 0];
  const r = rng(opts.seed ?? 7);
  const pos = new Float32Array(count * 3), seed = new Float32Array(count * 3), spin = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = r() - 0.5;
    pos[i * 3] = origin[0] + along[0] * a; pos[i * 3 + 1] = origin[1] + along[1] * a; pos[i * 3 + 2] = origin[2] + along[2] * a;
    seed[i * 3] = r(); seed[i * 3 + 1] = r() * 2 - 1; seed[i * 3 + 2] = r() * 2 - 1;
    spin[i] = r();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 3));
  g.setAttribute('spin', new THREE.BufferAttribute(spin, 1));
  const drift = opts.drift ?? [0, 0, 0];
  return system(g, PLUME_VERT, {
    uLife: { value: opts.life ?? 3 }, uRise: { value: opts.rise ?? 1.2 }, uSpread: { value: opts.spread ?? 0.4 }, uSize: { value: opts.size ?? 0.35 },
    uGrow: { value: opts.grow ?? 1.3 }, uDrift: { value: new THREE.Vector3(drift[0], drift[1], drift[2]) },
    uColor: { value: new THREE.Color(opts.color ?? 0xb8bec4) }, uOpacity: { value: opts.opacity ?? 0.28 },
  }, opts.additive ?? false, opts.texture === 'soft' ? radialTexture(64, 0.02) : smokeTexture(128, opts.seed ?? 3));
}

/**
 * Haze lying on the floor: big slow puffs born along a line, barely rising, spreading wide and
 * turning, so many faint sprites overlap into one bank of fog rather than reading one at a time.
 * The same shader as a plume with the numbers a fog bank wants. Use it where smoke has settled: at
 * the foot of a door, along a floor drain, in the corner of a cold room.
 */
export function haze(origin: [number, number, number], opts: PlumeOptions = {}): ParticleSystem {
  return plume(origin, {
    count: 36, life: 11, rise: 0.3, spread: 2.2, size: 1.7, grow: 1.1, color: 0xb2bec6, opacity: 0.085, texture: 'smoke',
    ...opts,
  });
}
