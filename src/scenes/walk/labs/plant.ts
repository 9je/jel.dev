import * as THREE from 'three';
import { instances, merged, type Spot } from '../merge';
import { labSteel } from './materials';
import { cagePosts } from './props';
import { chainlink, hazardPlate, unitFace, rng } from './textures';

/**
 * The server hall kit. The first pass of the room was two rows of dark boxes behind a red stick
 * fence, and Jordan's read of it was "ok, lacking": a rack was one lit plane, a cage was posts and
 * a rail, and nothing crossed the space overhead. Everything here spends its triangles on the three
 * things that say machine room at a glance instead: rack units you can count, a cage you could put
 * a padlock on, and services running the length of the ceiling.
 *
 * Origins are on the floor at each piece's own centre, facing +z, so a room places one with
 * `place(piece, x, 0, z, ry)`.
 */

/** Terragroup red, the colour the cages and their gates are painted. */
const RED = 0xb0362c;
const red = () => new THREE.MeshStandardMaterial({ color: RED, roughness: 0.45, metalness: 0.45 });
/** Alpha-tested, never transparent: the mesh writes depth and stays out of the transparent sort, so
 *  what stands behind it reads through the diamonds without sorting artefacts. */
function mesh(w: number, h: number, color = 0x8d969c, size = 128): THREE.MeshStandardMaterial {
  const map = chainlink(size); map.repeat.set(w / 0.5, h / 0.5);
  return new THREE.MeshStandardMaterial({ color, alphaMap: map, alphaTest: 0.45, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.55 });
}

export interface RackSpec {
  seed: number;
  /** Swing the mesh door open on its hinge, as a rack somebody was working in. */
  open?: boolean;
  /** A rack with the power off: the units are there, none of them lit. */
  dead?: boolean;
}

const RACK_W = 0.6, RACK_H = 2.1, RACK_D = 1.0, UNITS = 14, UNIT_PITCH = 0.135;

/**
 * A 42U rack, 0.6 by 2.1 by 1.0, origin at floor centre, front facing +z. Four draw calls: the
 * carcass, the two front rails, the fitted units as one batch, and the mesh door.
 *
 * The units are the point of it. Fourteen bezels on a ladder up the front, three of them missing by
 * seed so no two racks read as the same object, each carrying `unitFace` as an emissive map: drive
 * handles, a vent grille and two status LEDs. One batch means one material, which is what lets the
 * room pulse a whole rack with a single write per frame.
 */
export function serverRack(spec: RackSpec): THREE.Group {
  const { seed, open = false, dead = false } = spec;
  const g = new THREE.Group();
  const r = rng(seed);

  const body = new THREE.Mesh(new THREE.BoxGeometry(RACK_W, RACK_H, RACK_D), new THREE.MeshStandardMaterial({ color: 0x0b1117, roughness: 0.6, metalness: 0.4 }));
  body.position.y = RACK_H / 2; g.add(body);

  // The two front rails, proud of the carcass, in bare steel rather than the carcass black: they are
  // the vertical line that makes the row of units read as mounted in something.
  const rails: THREE.BufferGeometry[] = [];
  for (const x of [-RACK_W / 2 + 0.03, RACK_W / 2 - 0.03]) { const b = new THREE.BoxGeometry(0.03, 2.0, 0.03); b.translate(x, RACK_H / 2, RACK_D / 2 + 0.016); rails.push(b); }
  g.add(merged(rails, labSteel(0x9aa5ad)));

  const missing = new Set<number>();
  while (missing.size < 3) missing.add(Math.floor(r() * UNITS));
  const y0 = RACK_H / 2 - ((UNITS - 1) * UNIT_PITCH) / 2;
  const fitted: Spot[] = [];
  for (let i = 0; i < UNITS; i++) if (!missing.has(i)) fitted.push([0, y0 + i * UNIT_PITCH, RACK_D / 2 + 0.011]);
  // Colour, not black: a dead rack's units still have to read as hardware sitting in the dark rather
  // than as holes cut in the front of the cabinet.
  const unit = new THREE.MeshStandardMaterial({
    color: 0x10161c, roughness: 0.5, metalness: 0.35,
    emissive: 0xffffff, emissiveIntensity: dead ? 0 : 1.1, emissiveMap: unitFace(seed),
  });
  g.add(instances(new THREE.BoxGeometry(0.52, 0.09, 0.02), unit, fitted));

  // The door hangs on its own hinge edge, so `open` is a turn about the left rail rather than a
  // panel that has slid sideways out of the cabinet.
  const hinge = new THREE.Group();
  hinge.position.set(-RACK_W / 2 + 0.01, RACK_H / 2, RACK_D / 2 + 0.025);
  hinge.rotation.y = open ? 1.3 : 0;
  // The door mesh is painted near black, not the cage's bare steel. In bare steel it catches the
  // aisle lights and a shut rack reads as a second wall of sparkling wire in front of the first,
  // which is what the lit units are trying to show through.
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 2.0), mesh(0.58, 2.0, 0x2b343a));
  door.position.x = 0.29; door.name = 'door'; hinge.add(door); g.add(hinge);

  g.userData.blink = [unit];
  g.userData.seed = seed;
  return g;
}

/**
 * A cage run along x: red posts every 2 m, a top rail, a mid rail at 1.3 m and a mesh panel. Origin
 * at the centre of the run at floor level. Four draw calls.
 *
 * The mid rail is what the first pass was missing. A run of posts under one top rail is a fence;
 * a second horizontal at hand height is the band that reads as an enclosure you are kept out of,
 * and it is the line that carries the red across the frame.
 */
export function cage(len: number, h = 2.6): THREE.Group {
  const g = new THREE.Group();
  const frame = red();
  g.add(instances(new THREE.BoxGeometry(0.08, h, 0.08), frame, cagePosts(len).map((x) => [x, h / 2, 0] as Spot)));
  const rails: THREE.BufferGeometry[] = [];
  for (const y of [h, 1.3]) { const b = new THREE.BoxGeometry(len, 0.06, 0.06); b.translate(0, y, 0); rails.push(b); }
  g.add(merged(rails, frame));
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(len, h), mesh(len, h, 0x8d969c, 256));
  panel.position.y = h / 2; panel.name = 'panel'; g.add(panel);
  return g;
}

/**
 * A gate for a break in a cage run: a braced leaf hung on the left edge of the opening, swung
 * `swing` radians into the aisle, with a hasp plate on the free edge. Origin at the floor centre of
 * the opening, so it drops into the gap a split run leaves. Three draw calls.
 */
export function cageGate(w = 1.2, h = 2.6, swing = 0.4): THREE.Group {
  const g = new THREE.Group();
  const hinge = new THREE.Group();
  hinge.position.set(-w / 2, 0, 0); hinge.rotation.y = swing; g.add(hinge);
  const leaf = new THREE.Group(); leaf.position.x = w / 2; hinge.add(leaf);

  const bars: THREE.BufferGeometry[] = [];
  for (const y of [0.06, h - 0.06]) { const b = new THREE.BoxGeometry(w, 0.06, 0.05); b.translate(0, y, 0); bars.push(b); }
  for (const x of [-w / 2 + 0.03, w / 2 - 0.03]) { const b = new THREE.BoxGeometry(0.06, h, 0.05); b.translate(x, h / 2, 0); bars.push(b); }
  // One diagonal, corner to corner: the brace is how a gate leaf is told from a piece of the fence.
  const brace = new THREE.BoxGeometry(Math.hypot(w, h) - 0.12, 0.04, 0.04);
  brace.rotateZ(Math.atan2(h, w)); brace.translate(0, h / 2, 0); bars.push(brace);
  leaf.add(merged(bars, red()));

  const panel = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, h - 0.14), mesh(w, h));
  panel.position.y = h / 2; leaf.add(panel);

  const hasp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.02), labSteel(0x39434b));
  hasp.position.set(w / 2 + 0.02, 1.3, 0.035); hasp.name = 'hasp'; leaf.add(hasp);
  return g;
}

/**
 * The service trunk: one fat hazard yellow pipe along x with a bracket every 3 m. Origin at its own
 * centre, so a room hangs it by its centreline. Two draw calls.
 */
export function trunkPipe(len: number): THREE.Group {
  const g = new THREE.Group();
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, len, 12), new THREE.MeshStandardMaterial({ color: 0xd9b12a, roughness: 0.6, metalness: 0.25 }));
  pipe.rotation.z = Math.PI / 2; pipe.name = 'pipe'; g.add(pipe);
  const brackets: Spot[] = [];
  for (let x = -len / 2 + 0.5; x <= len / 2; x += 3) brackets.push([x, 0.19, 0]);
  g.add(instances(new THREE.BoxGeometry(0.2, 0.06, 0.4), labSteel(0x39434b), brackets));
  return g;
}

/** Cable colours, blue twice over: a bundle is mostly patch lead with a power run and a fibre in it. */
const CABLE = [0x2a6fd6, 0x2a6fd6, 0xe8b923, 0x9aa5ad, 0x3fd47a];

/**
 * A bundle of `count` cables slung between two world points, sagging 0.35 m below the chord at the
 * middle. One mesh whatever the count: the strands carry their colour as a vertex attribute, which
 * is what lets five different-coloured tubes merge into a single draw call.
 *
 * Each strand is offset sideways from the run and sags a little further the further out it is, so
 * the bundle spreads under its own weight instead of reading as one thick rope.
 */
export function cableBundle(from: [number, number, number], to: [number, number, number], count = 5): THREE.Mesh {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const middle = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const side = new THREE.Vector3().subVectors(b, a).normalize().cross(new THREE.Vector3(0, 1, 0));
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0); else side.normalize();

  const strands: THREE.BufferGeometry[] = [];
  const colour = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const off = (i - (count - 1) / 2) * 0.028;
    const belly = middle.clone().addScaledVector(side, off);
    belly.y = middle.y - 0.35 - Math.abs(off) * 0.5;
    const curve = new THREE.CatmullRomCurve3([a.clone().addScaledVector(side, off), belly, b.clone().addScaledVector(side, off)]);
    const tube = new THREE.TubeGeometry(curve, 16, 0.016, 6, false);
    colour.setHex(CABLE[i % CABLE.length]);
    const rgb = new Float32Array(tube.attributes.position.count * 3);
    for (let v = 0; v < tube.attributes.position.count; v++) colour.toArray(rgb, v * 3);
    tube.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    strands.push(tube);
  }
  const m = merged(strands, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.1 }));
  m.name = 'cables';
  return m;
}

/** A grey electrical panel on a wall: a shallow box with a hazard plate and a latch. Origin at the
 *  centre of its face, so hanging one is a single position. Three draw calls. */
export function wallPanel(w: number, h: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), new THREE.MeshStandardMaterial({ color: 0x9fb0b8, roughness: 0.5, metalness: 0.4 }));
  body.name = 'body'; g.add(body);
  const size = Math.min(0.26, w * 0.34);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: hazardPlate('!'), roughness: 0.55 }));
  plate.position.set(0, h * 0.26, 0.061); g.add(plate);
  const latch = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.02), labSteel(0x39434b));
  latch.position.set(w / 2 - 0.07, -h * 0.08, 0.068); latch.name = 'latch'; g.add(latch);
  return g;
}
