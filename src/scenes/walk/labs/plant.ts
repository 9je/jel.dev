import * as THREE from 'three';
import { instances, merged, type Spot } from '../merge';
import { labSteel } from './materials';
import { cagePosts } from './props';
import { breakerFace, chainlink, hazardPlate, unitFace, rng } from './textures';
import { stencilTexture } from '../textures';

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

/**
 * A bundle of `n` cables dropped from a point, curling as they fall. Merged, dark, origin wherever
 * `from` is in the space it is added to, so a room hangs one through a hole in its ceiling with a
 * single call. One draw call.
 *
 * The curl matters more than the count. Four straight tubes read as a bundle of rod; each strand
 * here leaves the drop on its own bearing, bows out by a few centimetres on the way down and hangs
 * plumb at the bottom, which is what a cable does when it has been pulled through a ceiling and
 * left.
 */
export function cableDrop(from: [number, number, number], len: number, n = 4): THREE.Mesh {
  const [x, y, z] = from;
  const strands: THREE.BufferGeometry[] = [];
  // The whole drop leans as it falls, and each strand leaves the hole on its own bearing. Four
  // plumb tubes read as scaffold pole from eight metres back; a run that swings out and comes back
  // reads as wire that was pulled through a ceiling and let go.
  const lean = Math.cos(x * 1.7 + z) * 0.22, leanZ = Math.sin(x + z * 1.3) * 0.22;
  for (let i = 0; i < n; i++) {
    const bearing = (i / n) * Math.PI * 2;
    const out = 0.05 + (i % 2) * 0.05;
    const dx = Math.cos(bearing) * out, dz = Math.sin(bearing) * out;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, y, z),
      new THREE.Vector3(x + dx + lean * 0.5, y - len * 0.35, z + dz + leanZ * 0.5),
      new THREE.Vector3(x + dx * 1.5 + lean, y - len * 0.74, z + dz * 1.5 + leanZ),
      new THREE.Vector3(x + dx * 1.2 + lean * 0.85, y - len, z + dz * 1.2 + leanZ * 0.85),
    ]);
    strands.push(new THREE.TubeGeometry(curve, 16, 0.011, 5, false));
  }
  const m = merged(strands, new THREE.MeshStandardMaterial({ color: 0x1b232a, roughness: 0.8, metalness: 0.15 }));
  m.name = 'drop';
  return m;
}

export interface CabinetSpec {
  w?: number; h?: number;
  color?: number;
  /** Swing the door open on its hinge, showing the breakers and the cable run out of the top. */
  open?: boolean;
  /** What the hazard plate on the door says, and the name stencilled under it. */
  label?: string;
}

const CAB_D = 0.7;

/**
 * A switchgear cabinet: a painted carcass with a hazard plate, a handle and a stencilled name on
 * its door, origin at floor centre, front facing +z. Five draw calls shut, eight open.
 *
 * The v1 of this was a coloured box with a plate stuck on it, and a room of them read as a row of
 * wardrobes. The door is a separate leaf on its own hinge now, which is what buys the one cabinet
 * somebody left standing open: the breakers behind it are the only place in this room where the
 * machinery is actually visible, and a room of sealed boxes needs exactly one of them.
 */
export function switchCabinet(spec: CabinetSpec = {}): THREE.Group {
  const { w = 0.9, h = 2.2, color = 0x3a5a4a, open = false, label } = spec;
  const g = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, CAB_D), new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.45 }));
  body.position.y = h / 2; body.name = 'body'; g.add(body);
  // A plinth in bare steel, as the reference has: it is the line that lifts a cabinet off the floor
  // rather than letting it sink into a grey tile at the same value.
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.1, CAB_D + 0.04), labSteel(0x39434b));
  plinth.position.y = 0.05; g.add(plinth);

  // The leaf hangs on the left jamb, so `open` is a turn about that edge rather than a panel that
  // has slid out of the carcass.
  const hinge = new THREE.Group();
  hinge.position.set(-w / 2 + 0.02, h / 2, CAB_D / 2);
  hinge.rotation.y = open ? 1.4 : 0;
  g.add(hinge);
  const door = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, h - 0.2, 0.03), new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.45 }));
  door.position.x = (w - 0.06) / 2; door.name = 'door'; hinge.add(door);

  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), new THREE.MeshStandardMaterial({ map: hazardPlate(label ?? 'HIGH VOLTAGE'), roughness: 0.55 }));
  plate.position.set(0, h * 0.22, 0.017); door.add(plate);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.02), labSteel(0x9aa5ad));
  handle.position.set((w - 0.06) / 2 - 0.07, -0.05, 0.025); handle.name = 'handle'; door.add(handle);
  const name = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.2, 0.09), new THREE.MeshBasicMaterial({
    map: stencilTexture(label ?? 'SWITCHGEAR', { width: 512, height: 72, color: '#0e151b', font: '600 44px Michroma, system-ui, sans-serif', alpha: 0.9 }),
    transparent: true, depthWrite: false,
  }));
  name.position.set(0, -h * 0.3, 0.017); door.add(name);

  if (open) {
    // The inside: a back plate of breakers, and the cable run somebody pulled out of the top.
    const breakers = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.12, h - 0.4), new THREE.MeshStandardMaterial({ map: breakerFace(Math.round(w * 100)), roughness: 0.7, metalness: 0.2 }));
    breakers.position.set(0, h / 2, CAB_D / 2 - 0.06); breakers.name = 'breakers'; g.add(breakers);
    g.add(cableDrop([0, h - 0.05, CAB_D / 2 - 0.2], h - 0.9, 3));
  }
  return g;
}

/** Which bays of a run carry a stencilled block letter. Every door labelled is a label per draw
 *  call and a wall of shouting text; the reference letters one bay in three. */
const LABEL_EVERY = 3;
const BAY = 0.9;

/**
 * The cream control bank along a wall (ref 17): a run of bays at 0.9 m, each with a dark window, a
 * dial and a louvre on its door, a blue band across the whole run at 1.6 m and a block letter on
 * every third bay. Origin at the floor centre of the run, bays along x, facing +z.
 *
 * The band is what makes it one bank rather than a queue of lockers, and it is the only place the
 * dado blue appears above waist height in the room.
 */
export function cabinetBank(len: number, h = 2.3): THREE.Group {
  const g = new THREE.Group();
  const bays = Math.max(1, Math.round(len / BAY));
  const cream = new THREE.MeshStandardMaterial({ color: 0xd8d2bf, roughness: 0.6, metalness: 0.2 });

  const carcass = new THREE.Mesh(new THREE.BoxGeometry(len, h, 0.55), cream);
  carcass.position.y = h / 2; carcass.name = 'carcass'; g.add(carcass);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.6), labSteel(0x39434b));
  plinth.position.y = 0.06; g.add(plinth);

  const x0 = -len / 2 + (len - bays * BAY) / 2;
  const windows: THREE.BufferGeometry[] = [], dials: Spot[] = [], louvres: THREE.BufferGeometry[] = [];
  for (let i = 0; i < bays; i++) {
    const x = x0 + (i + 0.5) * BAY;
    // One door per bay, as its own mesh over the shared cream: the run has to read as doors you
    // could open, and a single merged front is a painted wall.
    const door = new THREE.Mesh(new THREE.BoxGeometry(BAY - 0.04, h - 0.34, 0.03), cream);
    door.position.set(x, h / 2 + 0.05, 0.29); door.name = 'door'; g.add(door);

    const win = new THREE.BoxGeometry(0.25, 0.18, 0.01); win.translate(x, h - 0.42, 0.31); windows.push(win);
    dials.push([x + 0.22, h - 0.44, 0.31]);
    const louvre = new THREE.BoxGeometry(BAY - 0.3, 0.12, 0.01); louvre.translate(x, 0.55, 0.31); louvres.push(louvre);

    if (i % LABEL_EVERY !== 1) continue;
    const letter = String.fromCharCode(65 + Math.floor(i / LABEL_EVERY));
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(BAY - 0.14, 0.13), new THREE.MeshBasicMaterial({
      map: stencilTexture(`BLOCK ${letter}`, { width: 512, height: 96, color: '#17334f', font: '600 52px Michroma, system-ui, sans-serif', alpha: 0.95, flecks: false }),
      transparent: true, depthWrite: false,
    }));
    strip.position.set(x, h - 0.2, 0.312); g.add(strip);
  }
  g.add(merged(windows, new THREE.MeshStandardMaterial({ color: 0x10161b, roughness: 0.35, metalness: 0.5 })));
  // Turned to face out of the door. A cylinder stands on its own y by default, which puts a dial
  // flat on the door like a coin on a table: from the aisle it reads as a short bar rather than as
  // a gauge, and a bank of them reads as a row of screws.
  const dialFace = new THREE.CylinderGeometry(0.05, 0.05, 0.02, 12); dialFace.rotateX(Math.PI / 2);
  g.add(instances(dialFace, labSteel(0x6f7a82), dials.map(([x, y, z]) => [x, y, z] as Spot)));
  g.add(merged(louvres, labSteel(0x9aa5ad)));
  const band = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.005), new THREE.MeshStandardMaterial({ color: 0x2455a4, roughness: 0.7 }));
  band.position.set(0, 1.6, 0.313); band.name = 'band'; g.add(band);
  return g;
}

/**
 * Ceiling tiles on the floor, each on its own lie. One draw call whatever the count. The tilt is a
 * few degrees about x on top of the turn each spot names: a tile that has fallen never lands flat,
 * and a scatter of perfectly level squares reads as tiling somebody laid there.
 */
export function fallenTiles(spots: Spot[]): THREE.Mesh {
  const tiles: THREE.BufferGeometry[] = spots.map(([x, y, z, ry = 0], i) => {
    const t = new THREE.BoxGeometry(0.6, 0.02, 0.6);
    t.rotateX(i % 2 === 0 ? 0.15 : -0.15);
    t.rotateY(ry);
    t.translate(x, y, z);
    return t;
  });
  const m = merged(tiles, new THREE.MeshStandardMaterial({ color: 0xa6b2b8, roughness: 0.94 }));
  m.name = 'fallen';
  return m;
}
