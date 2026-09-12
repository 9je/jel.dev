import * as THREE from 'three';
import { merged, type Spot } from '../merge';
import { canvas, own } from './textures';

/**
 * Light fittings as objects. The first pass of every room lit itself with emissive rectangles laid
 * flat on the ceiling, and Jordan's read of them was "procedural junk": a glowing box has no frame,
 * no lens, no depth and no hardware, so the eye files it as a texture rather than a fitting. Each
 * piece here spends a few triangles on exactly what a fitting is read by: a frame it sits in, a
 * diffuser with tubes showing through it, end caps, and the rods or chains it hangs from.
 *
 * Nothing here is a light. The rig owns the lights; these are the fittings the rig's spots are
 * placed under, so that where the light comes from and what it appears to come from agree.
 */

/** Cold white, the colour every tube in the building runs at. Kept local so this module does not
 *  import `materials.ts`, which imports it back for the ceiling grid. */
export const TUBE = 0xdff0f6;

/**
 * The face of a diffuser: white acrylic with a fine prismatic grid and the tubes behind it showing
 * through as soft brighter bands. Colour and emissive map. Tiles along x, so a batten and a troffer
 * both read the same tube pitch whatever their length.
 */
export function prismLens(size = 256): THREE.CanvasTexture {
  const [c, ctx] = canvas(size, size);
  // The ground sits well under white so the tubes read as bands through it once the lens is lit:
  // a ground near white clips to the same white as the tubes under any emissive worth having.
  ctx.fillStyle = '#b4c3ca'; ctx.fillRect(0, 0, size, size);
  // Two tubes behind the acrylic: a bright band each with a soft fall off, which is what separates
  // a diffuser from a flat lit sheet.
  for (const y of [0.3, 0.7]) {
    const g = ctx.createLinearGradient(0, size * (y - 0.18), 0, size * (y + 0.18));
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, size * (y - 0.18), size, size * 0.36);
  }
  // The prism cells: a hairline grid, darker than the ground by a little.
  ctx.fillStyle = 'rgba(90,110,120,0.22)';
  const cell = size / 16;
  for (let i = 0; i <= 16; i++) { ctx.fillRect(i * cell, 0, 1, size); ctx.fillRect(0, i * cell, size, 1); }
  const t = own(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

/** The material a diffuser is lit with: the lens map as colour and emissive, tiled to the tube
 *  pitch. `intensity` is the emissive level, which is what a room drives to flicker a fitting. */
export function lensMaterial(w: number, d: number, intensity: number, color: number = TUBE): THREE.MeshStandardMaterial {
  const map = prismLens();
  map.repeat.set(Math.max(1, Math.round(w / 0.6)), Math.max(1, Math.round(d / 0.3)));
  return new THREE.MeshStandardMaterial({ color: 0xffffff, map, emissive: color, emissiveMap: map, emissiveIntensity: intensity, roughness: 0.35 });
}

/** The painted steel a fitting's frame, housing and caps are made of. */
export const fixtureSteel = (color = 0xb9c3c9) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.45 });

/**
 * A recessed troffer, `w` by `d`, as two geometries relative to the ceiling plane at y 0: a frame
 * that hangs two centimetres below the tile, with the lens recessed inside it. Both are meant to
 * be instanced, one batch each, across a whole ceiling: `ceilingGrid` does exactly that.
 */
export function troffer(w: number, d: number): { frame: THREE.BufferGeometry; lens: THREE.BufferGeometry } {
  const lip = 0.035, deep = 0.02;
  const frame = merged([
    new THREE.BoxGeometry(w, deep, lip).translate(0, -deep / 2, d / 2 - lip / 2),
    new THREE.BoxGeometry(w, deep, lip).translate(0, -deep / 2, -(d / 2 - lip / 2)),
    new THREE.BoxGeometry(lip, deep, d - 2 * lip).translate(w / 2 - lip / 2, -deep / 2, 0),
    new THREE.BoxGeometry(lip, deep, d - 2 * lip).translate(-(w / 2 - lip / 2), -deep / 2, 0),
  ], fixtureSteel()).geometry;
  const lens = new THREE.BoxGeometry(w - 2 * lip - 0.004, 0.012, d - 2 * lip - 0.004).translate(0, -0.008, 0);
  return { frame, lens };
}

export interface BattenSpec {
  len: number;
  /** How far the housing hangs below its ceiling plate on two rods. 0 is surface mounted. */
  drop?: number;
  intensity?: number;
  color?: number;
}

/**
 * A fluorescent batten: a steel channel with end caps, a diffuser along its underside, and when it
 * hangs, two rods up to plates on the ceiling. Origin at the centre of the housing, tube along x.
 * Two draw calls on its own; `battens()` lays a row of them for the same two.
 */
export function batten(spec: BattenSpec): THREE.Group {
  const g = new THREE.Group();
  g.add(battenHousing(spec), battenTube(spec));
  return g;
}

/** A row of identical battens at `spots`, two draw calls in all. The tube batch is named `tube`
 *  and its material is the one a room drives to flicker the row. */
export function battens(spec: BattenSpec, spots: Spot[]): THREE.Group {
  const g = new THREE.Group();
  const housing = battenHousing(spec), tube = battenTube(spec);
  const h = new THREE.InstancedMesh(housing.geometry, housing.material, spots.length);
  const t = new THREE.InstancedMesh(tube.geometry, tube.material, spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  spots.forEach(([x, y, z, ry = 0], i) => { m.compose(p.set(x, y, z), q.setFromEuler(e.set(0, ry, 0)), s); h.setMatrixAt(i, m); t.setMatrixAt(i, m); });
  h.instanceMatrix.needsUpdate = true; t.instanceMatrix.needsUpdate = true;
  h.computeBoundingSphere(); t.computeBoundingSphere(); h.computeBoundingBox(); t.computeBoundingBox();
  h.name = 'housing'; t.name = 'tube';
  g.add(h, t);
  return g;
}

function battenHousing({ len, drop = 0 }: BattenSpec): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [
    new THREE.BoxGeometry(len, 0.07, 0.14),
    new THREE.BoxGeometry(0.03, 0.09, 0.16).translate(len / 2 - 0.015, 0, 0),
    new THREE.BoxGeometry(0.03, 0.09, 0.16).translate(-(len / 2 - 0.015), 0, 0),
  ];
  if (drop > 0) {
    for (const x of [-len * 0.35, len * 0.35]) {
      parts.push(new THREE.CylinderGeometry(0.006, 0.006, drop, 6).translate(x, 0.035 + drop / 2, 0));
      parts.push(new THREE.BoxGeometry(0.08, 0.012, 0.08).translate(x, 0.035 + drop, 0));
    }
  }
  const m = merged(parts, fixtureSteel(0x8e979d)); m.name = 'housing'; return m;
}

function battenTube({ len, intensity = 1.6, color }: BattenSpec): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(len - 0.08, 0.05, 0.11), lensMaterial(len, 0.3, intensity, color));
  m.position.y = -0.03; m.name = 'tube'; return m;
}

/** A vertical falloff, white at the top and clear at the bottom, for a shaft of light. */
export function shaftTexture(size = 64): THREE.CanvasTexture {
  const [c, ctx] = canvas(8, size);
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 8, size);
  return own(c);
}

/**
 * A shaft of light under a fitting: an open cone drawn additively with a falloff down its length,
 * which is what the air under a lamp looks like when there is anything in it. Origin at the lamp,
 * pointing down. Faint on purpose: at 0.06 it is a presence in a dark room and invisible against a
 * white wall, and any stronger it reads as a solid. One draw call, sorted after the room.
 */
export function lightShaft(opts: { top: number; bottom: number; height: number; color?: number; opacity?: number }): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(opts.top, opts.bottom, opts.height, 24, 1, true);
  geo.translate(0, -opts.height / 2, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: opts.color ?? TUBE, map: shaftTexture(), transparent: true, opacity: opts.opacity ?? 0.06,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  }));
  m.renderOrder = 1; m.name = 'shaft';
  return m;
}
