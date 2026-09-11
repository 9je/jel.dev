import * as THREE from 'three';
import type { AssetStore } from '../assets';
import { instances, merged, type Spot } from '../merge';
import { LABS, labSteel, labGlass, ceilingGrid } from './materials';
import { stencilTexture } from '../textures';
import { rackFace, screenFace, paperSheet, hazardPlate, chainlink, rng } from './textures';

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

/** A 42U rack: dark box with a lit front. 0.6 wide, 2.1 tall, 1.0 deep, origin at floor centre. */
export function serverRack(seed = 1): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.1, 1.0), dark()); body.position.y = 1.05; g.add(body);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 2.0), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1.2, emissiveMap: rackFace(256, 768, 18, seed) }));
  face.position.set(0, 1.05, 0.501); g.add(face);
  return g;
}

/** A switchgear cabinet: grey green box, hazard plate on the door, origin at floor centre. */
export function switchCabinet(w = 0.9, h = 2.2, color = 0x3a5a4a): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.6), new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.5 })); body.position.y = h / 2; g.add(body);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), new THREE.MeshStandardMaterial({ map: hazardPlate(), roughness: 0.5 })); plate.position.set(0, h * 0.62, 0.301); g.add(plate);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.03), labSteel(0x9aa5ad)); handle.position.set(w * 0.35, h * 0.48, 0.31); g.add(handle);
  return g;
}

/** A wall screen: dark frame, lit face. Origin at the centre of the face, hang it on a wall. */
export function wallScreen(w: number, h: number, lines: string[], accent = '#6EC1D6'): THREE.Group {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.06), dark()); g.add(frame);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1.1, emissiveMap: screenFace(lines, accent) }));
  face.position.z = 0.031; g.add(face);
  return g;
}

/** An arcade cabinet: 0.8 wide, 1.9 tall, 0.9 deep, screen tilted back, marquee lit. Origin at floor centre, faces +z. */
export function arcadeCabinet(title: string, accent = '#3D7BE0'): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.9, 0.9), new THREE.MeshStandardMaterial({ color: 0x141c24, roughness: 0.5 })); body.position.y = 0.95; g.add(body);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.48), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1.3, emissiveMap: screenFace([title, 'insert coin'], accent, 512, 400) }));
  screen.position.set(0, 1.25, 0.46); screen.rotation.x = -0.25; g.add(screen);
  const marquee = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.2), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(accent), emissiveIntensity: 1.6 }));
  marquee.position.set(0, 1.78, 0.451); g.add(marquee);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.06, 0.32), dark()); deck.position.set(0, 0.98, 0.35); g.add(deck);
  return g;
}

/** A vending machine: 1.0 wide, 1.9 tall, 0.8 deep, lit front. Origin at floor centre, faces +z. */
export function vendingMachine(accent = '#3D7BE0'): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.9, 0.8), new THREE.MeshStandardMaterial({ color: 0x1a2530, roughness: 0.45, metalness: 0.3 })); body.position.y = 0.95; g.add(body);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.3), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 0.9, emissiveMap: screenFace(['', 'cold drinks', '', 'out of order'], accent, 512, 900) }));
  front.position.set(-0.08, 1.05, 0.401); g.add(front);
  return g;
}

/** Warehouse racking: blue uprights, beams at each level, grey decking. Origin at floor centre of
 *  the run, bays along x, faces +z. Three draw calls. */
export function palletRack(bays = 3, levels = 3, bayWidth = 2.7, height = 4.5): THREE.Group {
  const g = new THREE.Group(); const depth = 1.1; const len = bays * bayWidth;
  const blue = new THREE.MeshStandardMaterial({ color: LABS.dado, roughness: 0.5, metalness: 0.4 });
  const uprights: Spot[] = [];
  for (let i = 0; i <= bays; i++) for (const z of [-depth / 2, depth / 2]) uprights.push([-len / 2 + i * bayWidth, height / 2, z]);
  g.add(instances(new THREE.BoxGeometry(0.09, height, 0.09), blue, uprights));
  const beams: Spot[] = [];
  for (const y of rackSlots(levels, height)) for (let i = 0; i < bays; i++) for (const z of [-depth / 2, depth / 2]) beams.push([-len / 2 + (i + 0.5) * bayWidth, y - 0.08, z]);
  g.add(instances(new THREE.BoxGeometry(bayWidth - 0.1, 0.12, 0.08), new THREE.MeshStandardMaterial({ color: 0xd8722c, roughness: 0.5, metalness: 0.4 }), beams));
  const decks: Spot[] = [];
  for (const y of rackSlots(levels, height)) for (let i = 0; i < bays; i++) decks.push([-len / 2 + (i + 0.5) * bayWidth, y - 0.02, 0]);
  g.add(instances(new THREE.BoxGeometry(bayWidth - 0.12, 0.04, depth - 0.1), new THREE.MeshStandardMaterial({ color: 0x6c757c, roughness: 0.8, metalness: 0.6 }), decks));
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

/** Sheets of paper lying on the floor, each spot a sheet with its own turn. One draw call. */
export function papers(spots: Spot[]): THREE.Mesh {
  const r = rng(spots.length + 7);
  const sheets = spots.map(([x, y, z, ry = 0]) => { const s = new THREE.PlaneGeometry(0.21, 0.297); s.rotateX(-Math.PI / 2); s.rotateY(ry + (r() - 0.5) * 0.6); s.translate(x, y + 0.006, z); return s; });
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

/** A chain-link cage wall along x: posts every 2 m, a top rail, and the mesh as an alpha-tested
 *  plane. Origin at the centre of the run at floor level. */
export function cage(len: number, h = 2.6): THREE.Group {
  const g = new THREE.Group(); const steel = labSteel(0x7a2a24);
  const posts: Spot[] = cagePosts(len).map((x) => [x, h / 2, 0]);
  g.add(instances(new THREE.BoxGeometry(0.06, h, 0.06), steel, posts));
  const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.05), steel); rail.position.y = h; g.add(rail);
  const mesh = chainlink(); mesh.repeat.set(len / 0.5, h / 0.5);
  // alphaTest without transparency keeps the mesh out of the transparent sort and lets it write
  // depth, so the racks behind it read through the diamonds without sorting artefacts.
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(len, h), new THREE.MeshStandardMaterial({ color: 0xb0b8bd, alphaMap: mesh, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.5 }));
  panel.position.y = h / 2; g.add(panel);
  return g;
}

export interface GlassRoomDoor { face: 'north' | 'south'; x: number; w: number }
export interface GlassRoomSpec {
  w: number; d: number; h: number; sill: number;
  doors: GlassRoomDoor[];
  sign?: string;
  litEvery?: number;
  panelIntensity?: number;
  floor?: THREE.Material;
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
  const { group: ceiling } = ceilingGrid(store, W, D, H, { tile: 1.2, litEvery: spec.litEvery ?? 2, intensity: spec.panelIntensity ?? 0.9 });
  g.add(ceiling);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, 0.12, D + 0.2), labSteel(0x2b3740)); lid.position.y = H + 0.12; g.add(lid); // clear of the ceiling plane, or the two fight for the pixel

  const faces: { z: number; ry: number; door?: GlassRoomDoor }[] = [
    { z: hz, ry: 0, door: doors.find((d) => d.face === 'north') },
    { z: -hz, ry: Math.PI, door: doors.find((d) => d.face === 'south') },
  ];

  // Sill: a white panel band round the room, split at each door.
  const sillMat = new THREE.MeshStandardMaterial({ color: LABS.panel, roughness: 0.7 });
  const sills: THREE.BufferGeometry[] = [];
  const band = (len: number, x: number, z: number, ry: number) => { const b = new THREE.BoxGeometry(len, S, 0.12); b.rotateY(ry); b.translate(x, S / 2, z); sills.push(b); };
  band(D, -hx, 0, Math.PI / 2); band(D, hx, 0, Math.PI / 2);
  for (const f of faces) {
    if (!f.door) { band(W, 0, f.z, 0); continue; }
    const leftLen = f.door.x - f.door.w / 2 + hx, rightLen = hx - (f.door.x + f.door.w / 2);
    band(leftLen, -hx + leftLen / 2, f.z, 0); band(rightLen, hx - rightLen / 2, f.z, 0);
  }
  g.add(merged(sills, sillMat));

  // Glazing bars: corner posts, door posts, mullions, top and sill rails. Three draw calls.
  const steel = labSteel();
  const posts: Spot[] = [[-hx, H / 2, -hz], [hx, H / 2, -hz], [-hx, H / 2, hz], [hx, H / 2, hz]];
  for (const f of faces) if (f.door) posts.push([f.door.x - f.door.w / 2, H / 2, f.z], [f.door.x + f.door.w / 2, H / 2, f.z]);
  // Mullions skip the door span on each face, with enough margin that one just past the door post
  // does not double up with it as a doubled bar.
  const inDoor = (x: number, f: (typeof faces)[number]) => !!f.door && Math.abs(x - f.door.x) < f.door.w / 2 + 0.3;
  for (let x = -hx + 2.5; x < hx - 0.5; x += 2.5) for (const f of faces) if (!inDoor(x, f)) posts.push([x, H / 2, f.z]);
  for (let z = -hz + 2.6; z < hz - 0.5; z += 2.6) posts.push([-hx, H / 2, z], [hx, H / 2, z]);
  g.add(instances(new THREE.BoxGeometry(0.1, H, 0.1), steel, posts));
  g.add(instances(new THREE.BoxGeometry(W, 0.1, 0.1), steel, [[0, H, -hz], [0, H, hz]]));
  // The sill rail on a door face stops at the opening, like the sill band under it.
  const rails: THREE.BufferGeometry[] = [];
  for (const f of faces) {
    if (!f.door) { const r = new THREE.BoxGeometry(W, 0.1, 0.1); r.translate(0, S, f.z); rails.push(r); continue; }
    const leftLen = f.door.x - f.door.w / 2 + hx, rightLen = hx - (f.door.x + f.door.w / 2);
    for (const [len, x] of [[leftLen, -hx + leftLen / 2], [rightLen, hx - rightLen / 2]] as [number, number][]) { const r = new THREE.BoxGeometry(len, 0.1, 0.1); r.translate(x, S, f.z); rails.push(r); }
  }
  g.add(merged(rails, steel));
  g.add(instances(new THREE.BoxGeometry(0.1, 0.1, D), steel, [[-hx, H, 0], [hx, H, 0], [-hx, S, 0], [hx, S, 0]]));

  // Glass: panes above the sill, a door face split around its opening, a named panel over each
  // door. Rendered last so it sorts over everything inside.
  const panes: THREE.BufferGeometry[] = [];
  const pane = (w: number, x: number, z: number, ry: number) => { const p = new THREE.PlaneGeometry(w, H - S); p.rotateY(ry); p.translate(x, S + (H - S) / 2, z); panes.push(p); };
  pane(D, -hx, 0, Math.PI / 2); pane(D, hx, 0, -Math.PI / 2);
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
  const glass = labGlass(); glass.side = THREE.DoubleSide;
  const glassMesh = merged(panes, glass); glassMesh.renderOrder = 2; g.add(glassMesh);

  return g;
}
