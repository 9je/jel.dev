import * as THREE from 'three';
import type { AssetStore } from '../assets';
import { instances, merged, type Spot } from '../merge';
import { LABS, labSteel, labGlass, ceilingGrid } from './materials';
import { stencilTexture } from '../textures';
import { screenFace, paperSheet, chainlink, rng } from './textures';

export function rackSlots(levels: number, height: number): number[] { return Array.from({ length: levels }, (_, i) => +(((i + 1) * height) / levels).toFixed(4)); }
export { gridPitch } from './materials';
// Barrier tape lives in the signage kit now, where it is a strip that reads the right way round from
// both sides. Re-exported here so the rooms that string it keep their one import.
export { tapeLine } from './signage';

/** Evenly spaced post offsets from -len/2 to +len/2 inclusive, near `pitch` apart. Stepping from one
 *  edge by a fixed pitch drops the far edge's post whenever `len` isn't a multiple of the pitch (a
 *  10.4 m run at 2 m pitch stops 0.4 m short), which reads as a cage run missing a post on one side.
 *  Rounding to a whole number of segments keeps both edges posted and the spacing close to pitch. */
export function cagePosts(len: number, pitch = 2): number[] {
  const segments = Math.max(1, Math.round(len / pitch));
  return Array.from({ length: segments + 1 }, (_, i) => -len / 2 + (i * len) / segments);
}

const dark = () => new THREE.MeshStandardMaterial({ color: 0x0b1117, roughness: 0.6, metalness: 0.4 });

/** A box the pointer can hit and the renderer never draws: `visible` is off so it costs no draw
 *  call, and its material is flagged transparent so a room's shadow pass skips it too. Used to make
 *  a prop that is part of an instanced batch pickable on its own. */
export function pickBox(w: number, h: number, d: number, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  m.position.set(x, y, z); m.visible = false;
  return m;
}

/** A wall screen: dark frame, lit face. Origin at the centre of the face, hang it on a wall. */
export function wallScreen(w: number, h: number, lines: string[], accent = '#6EC1D6'): THREE.Group {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.06), dark()); g.add(frame);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1.1, emissiveMap: screenFace(lines, accent) }));
  face.position.z = 0.031; g.add(face);
  return g;
}

export const RACK_BAY = 2.7, RACK_HEIGHT = 4.5, RACK_DEPTH = 1.1;

/** Centres of a run's bays, measured from the centre of the run. */
export function rackBays(bays: number, bayWidth = RACK_BAY): number[] {
  return Array.from({ length: bays }, (_, i) => -(bays * bayWidth) / 2 + (i + 0.5) * bayWidth);
}

/** Warehouse racking: blue uprights on foot plates, braced end frames, orange beams at each level
 *  and wire mesh decking. Origin at floor centre of the run, bays along x, faces +z. Six draw calls.
 *
 *  The braces are what stop a run reading as four blue sticks: a real end frame is a ladder of
 *  diagonals between its two uprights, and the pair of them at each level is the first thing that
 *  says steel rather than toy. They are two batches, not one, because a batch carries a position
 *  and a turn about y, and a diagonal is a lean about x: baking each lean into its own geometry
 *  buys the second half of the X for one more draw call. */
export function palletRack(bays = 3, levels = 3, bayWidth = RACK_BAY, height = RACK_HEIGHT): THREE.Group {
  const g = new THREE.Group(); const depth = RACK_DEPTH; const len = bays * bayWidth;
  const blue = new THREE.MeshStandardMaterial({ color: LABS.dado, roughness: 0.5, metalness: 0.4 });
  const uprights: Spot[] = [], feet: Spot[] = [];
  for (let i = 0; i <= bays; i++) for (const z of [-depth / 2, depth / 2]) { uprights.push([-len / 2 + i * bayWidth, height / 2, z]); feet.push([-len / 2 + i * bayWidth, 0.01, z]); }
  g.add(instances(new THREE.BoxGeometry(0.1, height, 0.1), blue, uprights));
  g.add(instances(new THREE.BoxGeometry(0.2, 0.02, 0.2), labSteel(0x39434b), feet));
  const level = height / levels;
  const braces: Spot[] = [];
  for (const x of [-len / 2, len / 2]) for (let i = 0; i < levels; i++) braces.push([x, (i + 0.5) * level, 0]);
  for (const lean of [0.7, -0.7]) g.add(instances(new THREE.BoxGeometry(0.04, 1.5, 0.04).rotateX(lean), blue, braces));
  const beams: Spot[] = [];
  for (const y of rackSlots(levels, height)) for (const x of rackBays(bays, bayWidth)) for (const z of [-depth / 2, depth / 2]) beams.push([x, y - 0.08, z]);
  g.add(instances(new THREE.BoxGeometry(bayWidth - 0.1, 0.12, 0.08), new THREE.MeshStandardMaterial({ color: 0xd8722c, roughness: 0.5, metalness: 0.4 }), beams));
  // Wire decking, not a steel pan: the mesh is an alpha map on the deck, alpha tested so it writes
  // depth and keeps out of the transparent sort, and the beams show through the diamonds.
  const wire = chainlink(); wire.repeat.set(bayWidth / 0.2, depth / 0.2);
  const decks: Spot[] = rackSlots(levels, height).flatMap((y) => rackBays(bays, bayWidth).map((x) => [x, y - 0.02, 0] as Spot));
  g.add(instances(new THREE.BoxGeometry(bayWidth - 0.12, 0.04, depth - 0.1), new THREE.MeshStandardMaterial({ color: 0x9aa5ac, alphaMap: wire, alphaTest: 0.5, roughness: 0.6, metalness: 0.7 }), decks));
  return g;
}

/** A shrink wrapped pallet of stock: three bearers and a deck under a load in milky film with a
 *  strap round its middle. `seed` picks the load's height, so a row of them is not a row of one
 *  box. 1.2 by 1.0 on plan, origin at the foot of the pallet. Three draw calls, so stand them up
 *  through `repeat()` rather than one at a time. */
export function wrappedPallet(seed = 1): THREE.Group {
  const g = new THREE.Group();
  const r = rng(seed);
  const boards: THREE.BufferGeometry[] = [new THREE.BoxGeometry(1.2, 0.02, 1.0).translate(0, 0.11, 0)];
  for (const z of [-0.45, 0, 0.45]) boards.push(new THREE.BoxGeometry(1.2, 0.1, 0.1).translate(0, 0.05, z));
  g.add(merged(boards, new THREE.MeshStandardMaterial({ color: 0x9c7f5a, roughness: 0.9 })));
  const h = 0.7 + r() * 0.6;
  const load = new THREE.Mesh(new THREE.BoxGeometry(1.1, h, 0.9), new THREE.MeshPhysicalMaterial({ color: 0xdfe6ea, transmission: 0, roughness: 0.35, transparent: true, opacity: 0.85 }));
  load.position.y = 0.12 + h / 2; g.add(load);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.05, 0.92), new THREE.MeshStandardMaterial({ color: LABS.dado, roughness: 0.7 }));
  strap.position.y = 0.12 + h / 2; g.add(strap);
  return g;
}

/** A 20 ft shipping container, 6.1 by 2.6 by 2.4, ribbed sides. Origin at floor centre, long axis
 *  along x. Two draw calls. */
export function container(color = 0x2b6a6f): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(6.1, 2.6, 2.4), new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.5 })); body.position.y = 1.3; g.add(body);
  const ribs: Spot[] = [];
  for (let x = -2.85; x <= 2.85; x += 0.3) for (const z of [-1.21, 1.21]) ribs.push([x, 1.3, z]);
  g.add(instances(new THREE.BoxGeometry(0.12, 2.4, 0.04), new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.8), roughness: 0.7, metalness: 0.5 }), ribs));
  return g;
}

/** Sheets of paper lying on the floor, each spot a sheet with its own turn. One draw call. A sheet
 *  lies twelve millimetres over the y it is given: the credentials floor sits six up from its
 *  neighbours, and a sheet six over that was coplanar with it and tore. */
export function papers(spots: Spot[]): THREE.Mesh {
  const r = rng(spots.length + 7);
  const sheets = spots.map(([x, y, z, ry = 0]) => { const s = new THREE.PlaneGeometry(0.21, 0.297); s.rotateX(-Math.PI / 2); s.rotateY(ry + (r() - 0.5) * 0.6); s.translate(x, y + 0.012, z); return s; });
  const m = merged(sheets, new THREE.MeshStandardMaterial({ map: paperSheet(3), roughness: 0.9, side: THREE.DoubleSide })); m.receiveShadow = false; return m;
}

/** A red roof beacon: a dome on a base. Emissive, blooms on high. Origin at the base. */
export function beacon(): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.08, 12), dark()); base.position.y = 0.04; g.add(base);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a0806, emissive: LABS.warn, emissiveIntensity: 3 })); dome.position.y = 0.08; g.add(dome);
  return g;
}

/** A cable tray: a shallow open channel with rungs, along x. Origin at its centre. */
export function cableTray(len: number): THREE.Group {
  const g = new THREE.Group(); const steel = labSteel(0x6c757c);
  for (const z of [-0.2, 0.2]) { const side = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.02), steel); side.position.z = z; g.add(side); }
  const rungs: Spot[] = []; for (let x = -len / 2 + 0.15; x < len / 2; x += 0.3) rungs.push([x, -0.03, 0]);
  g.add(instances(new THREE.BoxGeometry(0.03, 0.02, 0.4), steel, rungs));
  const cables = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.3), new THREE.MeshStandardMaterial({ color: 0x1c2a44, roughness: 0.9 })); cables.position.y = 0.01; g.add(cables);
  return g;
}

export interface GlassRoomDoor { face: 'north' | 'south'; x: number; w: number }
export type GlassFace = 'north' | 'south' | 'east' | 'west';
export interface GlassRoomSpec {
  w: number; d: number; h: number; sill: number;
  doors: GlassRoomDoor[];
  /** Which of the four walls are glazed. Defaults to all of them. A room that is glass on one side
   *  and painted block on the others (the control room looks south through its front and is solid
   *  everywhere else) asks for that one face, and builds the rest as `labWall` planes of its own:
   *  a glazed wall the room then covers with a wall plane is two surfaces fighting for the pixel. */
  faces?: GlassFace[];
  sign?: string;
  litEvery?: number;
  panelIntensity?: number;
  /** Fitting size of one lit ceiling panel, `[along x, along z]`. See `ceilingGrid`. */
  panel?: [number, number];
  /** The ceiling tile's own colour. The shared map is a warm grey, which is right over a white lab
   *  and wrong over a room lit cold. See `ceilingGrid`. */
  tint?: number;
  floor?: THREE.Material;
  /** A second, frosted pane set over the lower 1.2 m above the sill, the way a real clean room is
   *  glazed (ref 02). It reads from outside as privacy glass and from inside as a soft band that
   *  hides the floor clutter of the hall beyond. */
  frosted?: boolean;
}

/**
 * A glass-walled room, the shape shared by the dispatch office and the credentials lab: a white
 * sill band round all four sides split at any door, corner and door posts, mullions that skip a
 * door's span, top rails, sill rails split at the doors, panes merged and rendered last so they
 * sort over everything inside, a head panel (and an optional sign) over each door, a lit ceiling
 * grid and a steel lid clear of the ceiling plane. Doors sit only on the north (+z) and south
 * (-z) faces; a door's `x` is local to the room's own centre. Origin at floor centre; the caller
 * positions the returned group in the world.
 */
export function glassRoom(store: AssetStore | null, spec: GlassRoomSpec): THREE.Group {
  const { w: W, d: D, h: H, sill: S, doors } = spec;
  const g = new THREE.Group();
  const hx = W / 2, hz = D / 2;

  if (spec.floor) {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.2, D - 0.2), spec.floor);
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.01; g.add(floor);
  }
  const { group: ceiling } = ceilingGrid(store, W, D, H, { tile: 1.2, litEvery: spec.litEvery ?? 2, intensity: spec.panelIntensity ?? 0.9, panel: spec.panel, tint: spec.tint });
  g.add(ceiling);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, 0.12, D + 0.2), labSteel(0x2b3740)); lid.position.y = H + 0.12; g.add(lid); // clear of the ceiling plane, or the two fight for the pixel

  const wanted = new Set<GlassFace>(spec.faces ?? ['north', 'south', 'east', 'west']);
  const faces: { z: number; ry: number; door?: GlassRoomDoor }[] = [
    { z: hz, ry: 0, door: doors.find((d) => d.face === 'north') },
    { z: -hz, ry: Math.PI, door: doors.find((d) => d.face === 'south') },
  ].filter((f) => wanted.has(f.z > 0 ? 'north' : 'south'));
  const sides = ([{ x: -hx, side: 'west' }, { x: hx, side: 'east' }] as { x: number; side: GlassFace }[]).filter((s) => wanted.has(s.side));

  // Sill: a white panel band round the room, split at each door.
  const sillMat = new THREE.MeshStandardMaterial({ color: LABS.panel, roughness: 0.7 });
  const sills: THREE.BufferGeometry[] = [];
  const band = (len: number, x: number, z: number, ry: number) => { const b = new THREE.BoxGeometry(len, S, 0.12); b.rotateY(ry); b.translate(x, S / 2, z); sills.push(b); };
  for (const s of sides) band(D, s.x, 0, Math.PI / 2);
  for (const f of faces) {
    if (!f.door) { band(W, 0, f.z, 0); continue; }
    const leftLen = f.door.x - f.door.w / 2 + hx, rightLen = hx - (f.door.x + f.door.w / 2);
    band(leftLen, -hx + leftLen / 2, f.z, 0); band(rightLen, hx - rightLen / 2, f.z, 0);
  }
  if (sills.length > 0) g.add(merged(sills, sillMat));

  // Glazing bars: corner posts, door posts, mullions, top and sill rails. Three draw calls.
  const steel = labSteel();
  const posts: Spot[] = [];
  for (const f of faces) posts.push([-hx, H / 2, f.z], [hx, H / 2, f.z]);
  for (const s of sides) if (faces.length === 0) posts.push([s.x, H / 2, -hz], [s.x, H / 2, hz]);
  for (const f of faces) if (f.door) posts.push([f.door.x - f.door.w / 2, H / 2, f.z], [f.door.x + f.door.w / 2, H / 2, f.z]);
  // Mullions skip the door span on each face, with enough margin that one just past the door post
  // does not double up with it as a doubled bar.
  const inDoor = (x: number, f: (typeof faces)[number]) => !!f.door && Math.abs(x - f.door.x) < f.door.w / 2 + 0.3;
  for (let x = -hx + 2.5; x < hx - 0.5; x += 2.5) for (const f of faces) if (!inDoor(x, f)) posts.push([x, H / 2, f.z]);
  for (let z = -hz + 2.6; z < hz - 0.5; z += 2.6) for (const s of sides) posts.push([s.x, H / 2, z]);
  if (posts.length > 0) g.add(instances(new THREE.BoxGeometry(0.1, H, 0.1), steel, posts));
  if (faces.length > 0) g.add(instances(new THREE.BoxGeometry(W, 0.1, 0.1), steel, faces.map((f) => [0, H, f.z] as Spot)));
  // The sill rail on a door face stops at the opening, like the sill band under it.
  const rails: THREE.BufferGeometry[] = [];
  for (const f of faces) {
    if (!f.door) { const r = new THREE.BoxGeometry(W, 0.1, 0.1); r.translate(0, S, f.z); rails.push(r); continue; }
    const leftLen = f.door.x - f.door.w / 2 + hx, rightLen = hx - (f.door.x + f.door.w / 2);
    for (const [len, x] of [[leftLen, -hx + leftLen / 2], [rightLen, hx - rightLen / 2]] as [number, number][]) { const r = new THREE.BoxGeometry(len, 0.1, 0.1); r.translate(x, S, f.z); rails.push(r); }
  }
  if (rails.length > 0) g.add(merged(rails, steel));
  const sideRails: Spot[] = sides.flatMap((s) => [[s.x, H, 0], [s.x, S, 0]] as Spot[]);
  if (sideRails.length > 0) g.add(instances(new THREE.BoxGeometry(0.1, 0.1, D), steel, sideRails));

  // Glass: panes above the sill, a door face split around its opening, a named panel over each
  // door. Rendered last so it sorts over everything inside.
  const panes: THREE.BufferGeometry[] = [];
  const pane = (w: number, x: number, z: number, ry: number) => { const p = new THREE.PlaneGeometry(w, H - S); p.rotateY(ry); p.translate(x, S + (H - S) / 2, z); panes.push(p); };
  for (const s of sides) pane(D, s.x, 0, s.side === 'west' ? Math.PI / 2 : -Math.PI / 2);
  for (const f of faces) {
    if (!f.door) { pane(W, 0, f.z, f.ry); continue; }
    const leftLen = f.door.x - f.door.w / 2 + hx, rightLen = hx - (f.door.x + f.door.w / 2);
    pane(leftLen, -hx + leftLen / 2, f.z, f.ry); pane(rightLen, hx - rightLen / 2, f.z, f.ry);
    const out = f.z > 0 ? 0.01 : -0.01;
    const head = new THREE.Mesh(new THREE.PlaneGeometry(f.door.w, 0.5), new THREE.MeshStandardMaterial({ color: LABS.panel, roughness: 0.7 }));
    head.position.set(f.door.x, H - 0.25, f.z + out); head.rotation.y = f.ry; g.add(head);
    if (spec.sign) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.32), new THREE.MeshBasicMaterial({ map: stencilTexture(spec.sign, { width: 512, height: 96, color: '#2455A4', font: '600 60px Michroma, system-ui, sans-serif', alpha: 0.9 }), transparent: true, depthWrite: false }));
      sign.position.set(f.door.x, H - 0.25, f.z + out * 3); sign.rotation.y = f.ry; g.add(sign);
    }
  }
  if (panes.length > 0) {
    const glass = labGlass(); glass.side = THREE.DoubleSide;
    const glassMesh = merged(panes, glass); glassMesh.renderOrder = 2; g.add(glassMesh);
  }

  // The frosted band. It is a second set of panes standing a centimetre inside the clear ones
  // rather than a shorter clear pane with a frosted one beside it: two transparent surfaces on one
  // plane have no depth between them to sort by, and the pair flickers as the camera moves.
  if (spec.frosted) {
    const band = Math.min(1.2, H - S);
    const frost: THREE.BufferGeometry[] = [];
    const lower = (w: number, x: number, z: number, ry: number, inward: [number, number]) => {
      const p = new THREE.PlaneGeometry(w, band); p.rotateY(ry);
      p.translate(x + inward[0] * 0.01, S + band / 2, z + inward[1] * 0.01); frost.push(p);
    };
    for (const s of sides) lower(D, s.x, 0, s.side === 'west' ? Math.PI / 2 : -Math.PI / 2, [s.side === 'west' ? 1 : -1, 0]);
    for (const f of faces) {
      const inward: [number, number] = [0, f.z > 0 ? -1 : 1];
      if (!f.door) { lower(W, 0, f.z, f.ry, inward); continue; }
      const leftLen = f.door.x - f.door.w / 2 + hx, rightLen = hx - (f.door.x + f.door.w / 2);
      lower(leftLen, -hx + leftLen / 2, f.z, f.ry, inward); lower(rightLen, hx - rightLen / 2, f.z, f.ry, inward);
    }
    const frostMat = new THREE.MeshPhysicalMaterial({ color: 0xdfe8ec, transparent: true, opacity: 0.55, roughness: 0.7, transmission: 0, side: THREE.DoubleSide, depthWrite: false });
    if (frost.length > 0) { const frostMesh = merged(frost, frostMat); frostMesh.renderOrder = 1; g.add(frostMesh); }
  }

  return g;
}
