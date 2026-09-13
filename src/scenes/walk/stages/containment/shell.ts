import * as THREE from 'three';
import type { StageContext } from '../types';
import { prepareAO } from '../../materials';
import { instances, merged, place, type Spot } from '../../merge';
import { ceilingGrid, dadoBands, dadoLineMaterial, dadoMaterial, labFloor, labWall } from '../../labs/materials';
import { cableDrop, wallPanel } from '../../labs/plant';
import { cableTray } from '../../labs/props';
import { wallPlaque } from '../../labs/signage';
import { canvas, chainlink, hazardPlate, own } from '../../labs/textures';
import { stencilTexture } from '../../textures';
import {
  X0, X1, Z0, Z1, H, W, D, XC, ZC, HALL_DOOR, SEALED, OFFICE_OPEN, MISSING, DROPS, ISLANDS, ISLAND_HALF,
  AISLE_CLEAR, GENERATOR, TILE, LIT, holeAt,
} from './layout';

// `holeAt` moved to layout.ts with the grid constants it is computed from. Re-exported here
// because the dressing hangs its fallen tiles off the same arithmetic and imports it from the shell.
export { holeAt } from './layout';

export interface Shell { planes: Set<THREE.Object3D> }

/** The void above the tiles: 1.2 m of dark plant space with a blue lit panel in its ceiling. */
const VOID_H = 1.2;
/** The trays run just under the tile line, and the cables strung across the room leave them at
 *  the tray's own cable height. */
const TRAY_Y = 3.12;
/** Ink for the painted stencils, the same near black the cabinet doors carry. */
const INK = '#0e151b';

export function buildShell({ store }: StageContext, root: THREE.Group): Shell {
  const planes = new Set<THREE.Object3D>();
  const plane = (w: number, h: number, mat: THREE.Material) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); prepareAO(m.geometry); m.receiveShadow = true; planes.add(m); root.add(m); return m; };
  // Whiter than the kit's panel tint. Under this room's cold spots the kit default came out a flat
  // mauve grey, which is the wall colour Jordan called weird: the reference is white block with
  // the blue dado on it, and a wall only reads white if it starts near white.
  const wall = (w: number, h: number, x: number, y: number, z: number, ry: number) => { const m = plane(w, h, labWall(store, w, h, 0xe3edf2)); m.rotation.y = ry; m.position.set(x, y, z); return m; };

  // A colder floor than the labs' own grey: this room is the far end of the walk and the tile is the
  // largest surface in it, so half a step of blue in it is what carries the temperature.
  const floor = plane(W, D, labFloor(store, W, D, 0x8ea4b0)); floor.rotation.x = -Math.PI / 2; floor.position.set(XC, 0, ZC);

  // ---- The four walls --------------------------------------------------------------------------
  // South (Z0) is the credentials end: closed either side of the doorway that hall cuts through it,
  // with a soffit over the opening, so nothing the hold sees through the door is a gap in a wall.
  const doorW0 = HALL_DOOR.x - HALL_DOOR.w / 2, doorW1 = HALL_DOOR.x + HALL_DOOR.w / 2;
  wall(doorW0 - X0, H, (X0 + doorW0) / 2, H / 2, Z0, 0);
  wall(X1 - doorW1, H, (doorW1 + X1) / 2, H / 2, Z0, 0);
  wall(HALL_DOOR.w, H - HALL_DOOR.h, HALL_DOOR.x, (H + HALL_DOOR.h) / 2, Z0, 0);

  // Both long walls, full length.
  wall(D, H, X0, H / 2, ZC, Math.PI / 2);
  wall(D, H, X1, H / 2, ZC, -Math.PI / 2);

  // North (Z1). Closed from the west corner to x -77 with the sealed bay's opening cut out of it,
  // and open from -77 east: the control room's glass front fills that run, and until it is built
  // the greybox corridor shows through. The sealed door itself is dressing, not shell.
  const sealW0 = SEALED.x - SEALED.w / 2, sealW1 = SEALED.x + SEALED.w / 2;
  wall(sealW0 - X0, H, (X0 + sealW0) / 2, H / 2, Z1, Math.PI);
  wall(OFFICE_OPEN.x0 - sealW1, H, (sealW1 + OFFICE_OPEN.x0) / 2, H / 2, Z1, Math.PI);
  wall(SEALED.w, H - SEALED.h, SEALED.x, (H + SEALED.h) / 2, Z1, Math.PI);

  // The dado, at the height it is in every Terragroup space: blue to 1.2 m with a white line on it.
  const bands = [
    dadoBands(D, X0 + 0.02, ZC, Math.PI / 2), dadoBands(D, X1 - 0.02, ZC, Math.PI / 2),
    dadoBands(doorW0 - X0, (X0 + doorW0) / 2, Z0 + 0.02, 0), dadoBands(X1 - doorW1, (doorW1 + X1) / 2, Z0 + 0.02, 0),
    dadoBands(sealW0 - X0, (X0 + sealW0) / 2, Z1 - 0.02, 0),
    dadoBands(OFFICE_OPEN.x0 - sealW1, (sealW1 + OFFICE_OPEN.x0) / 2, Z1 - 0.02, 0),
  ];
  root.add(merged(bands.map((b) => b.band), dadoMaterial()), merged(bands.map((b) => b.line), dadoLineMaterial()));

  // ---- What the room says it is -----------------------------------------------------------------
  // The reference room names itself with hardware, not with a sign, and Jordan's read of this one
  // was that he could not tell what it was themed after. So: a plaque by the door, a stencil down
  // the far wall that the hold reads straight up the aisle, a HIGH VOLTAGE stencil and hazard plate
  // on the west wall above the islands, and the wall boxes ref 16 has between them.
  const plaque = wallPlaque('SWITCHGEAR', { w: 0.6, h: 0.18, code: 'B2' });
  plaque.position.set(doorW1 + 0.5, 1.95, Z0 + 0.03); root.add(plaque);
  root.add(stencil('SWITCHGEAR ROOM', 3.6, 0.4, [-83.5, 2.85, Z1 - 0.03], Math.PI));
  root.add(stencil('HIGH VOLTAGE', 2.4, 0.34, [X0 + 0.03, 2.8, 15.7], Math.PI / 2));
  const triangle = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshStandardMaterial({ map: hazardPlate('HIGH VOLTAGE'), roughness: 0.55 }));
  triangle.rotation.y = Math.PI / 2; triangle.position.set(X0 + 0.02, 2.8, 14.05); root.add(triangle);
  for (const z of [10.75, 15.25, 19.75]) {
    const box = wallPanel(0.6, 0.85); box.rotation.y = Math.PI / 2; box.position.set(X0 + 0.06, 1.65, z); root.add(box);
  }
  // The box the generator is plugged into, on the east wall past the bank.
  const feed = wallPanel(0.6, 0.8); feed.rotation.y = -Math.PI / 2; feed.position.set(X1 - 0.06, 1.55, GENERATOR.z); root.add(feed);

  // ---- The ceiling and what is behind it -------------------------------------------------------
  // The grid, five tiles short, with a troffer in every eighth column and every sixth row: eighteen
  // in the whole ceiling. The room was drawn with sixty six, and at the hold that is not a ceiling,
  // it is a lightbox. Sparse is what the reference has. Pale is what it has too: the tiles ran at
  // the kit's own glow under a dark tint and came out near black, where ref 16 is a white grid with
  // black cable on it, so the tint is lifted and the glow with it, and the lenses run bright enough
  // to show their tubes.
  const grid = ceilingGrid(store, W, D, H, {
    tile: TILE, intensity: 1.3, panel: [1.15, 0.3], tint: 0xc6d0d6, tileGlow: 0.55,
    lit: LIT,
    missing: MISSING,
  });
  grid.group.position.set(XC, 0, ZC); root.add(grid.group);

  // Above it, plant space: an interior-facing box a little over a metre deep, near black, with one
  // blue lit panel in its ceiling. The panel is wide and long rather than the one tile square it
  // sits over, because a sightline that enters a 0.6 m hole from seven metres back leaves it four
  // or five metres further up the room: what the hold sees through the gap is the void's ceiling
  // well north of the hole, not the patch directly above it.
  const shellBox = new THREE.Mesh(new THREE.BoxGeometry(W, VOID_H, D), new THREE.MeshStandardMaterial({
    color: 0x06090c, emissive: 0x2a6fd6, emissiveIntensity: 0.22, roughness: 0.9, side: THREE.BackSide,
  }));
  shellBox.position.set(XC, H + VOID_H / 2, ZC); shellBox.name = 'void'; root.add(shellBox);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(5, 8), new THREE.MeshStandardMaterial({ color: 0x071429, emissive: 0x2a6fd6, emissiveIntensity: 0.75 }));
  glow.rotation.x = Math.PI / 2; glow.position.set(-79.5, H + VOID_H - 0.1, 14.5); glow.name = 'void-glow'; root.add(glow);

  // Cable trays down both long walls under the tile line, the thing every run across the ceiling
  // leaves from. Each is a channel with rungs and a bed of cable in it, from the kit.
  root.add(place(cableTray(D - 1.2), X0 + 0.28, TRAY_Y, ZC, Math.PI / 2));
  root.add(place(cableTray(D - 1.2), X1 - 0.28, TRAY_Y, ZC, Math.PI / 2));

  // The cables strung across the ceiling. This is what ref 16 is built on: black runs slung under
  // the grid from the trays, sagging between their fixings, and most of them converging on the
  // one big hole and diving up through it. Six runs of three to five strands and the generator's
  // lead, all one mesh. The runs end a hand above the hole's lip and then curve up into the void,
  // so they read as going somewhere rather than as stopping at a rectangle.
  const [hx0, hz0] = holeAt(10, 8), [hx1, hz1] = holeAt(12, 9);
  const hx = (hx0 + hx1) / 2, hz = (hz0 + hz1) / 2;
  const west = X0 + 0.5, east = X1 - 0.5;
  root.add(cableRuns([
    { from: [west, TRAY_Y + 0.08, 9.4], to: [hx - 0.75, 3.3, hz - 0.45], into: [hx - 0.4, 3.95, hz - 0.2], strands: 4, sag: 0.2 },
    { from: [east, TRAY_Y + 0.08, 10.0], to: [hx + 0.75, 3.3, hz - 0.15], into: [hx + 0.4, 3.95, hz + 0.05], strands: 3, sag: 0.2 },
    { from: [-80.6, TRAY_Y + 0.08, Z1 - 0.4], to: [hx, 3.3, hz + 0.65], into: [hx, 3.95, hz + 0.15], strands: 4, sag: 0.32 },
    { from: [east, TRAY_Y + 0.08, 7.0], to: [hx + 0.7, 3.3, hz - 0.5], into: [hx + 0.45, 3.95, hz - 0.15], strands: 3, sag: 0.18 },
    { from: [west, TRAY_Y + 0.08, 19.4], to: [east, TRAY_Y + 0.08, 18.7], strands: 5, sag: 0.3 },
    { from: [west, TRAY_Y + 0.08, 16.6], to: [holeAt(6, 20)[0] - 0.3, 3.3, holeAt(6, 20)[1] - 0.2], into: [holeAt(6, 20)[0], 3.95, holeAt(6, 20)[1]], strands: 3, sag: 0.12 },
    { from: [X1 - 0.15, 1.17, GENERATOR.z + 0.05], to: [GENERATOR.x + 0.1, 0.58, GENERATOR.z - 0.05], strands: 2, sag: 0.16 },
  ]));

  // Cables pulled through every gap and left hanging. Over the aisle they stop at 2.35 m, a clear
  // half metre above the eye: the first pass hung them to head height straight down the walked
  // line, and the camera went through them. The one off the aisle hangs to 1.5 as before.
  for (const [i, j] of DROPS) {
    const [x, z] = holeAt(i, j);
    const top = H + VOID_H - 0.25;
    const overAisle = Math.abs(x - HALL_DOOR.x) < AISLE_CLEAR;
    root.add(cableDrop([x, top, z], top - (overAisle ? 2.35 : 1.5), 4));
  }

  // ---- The floor ------------------------------------------------------------------------------
  // Hazard bands painted round each island's footprint, the way switchgear stands in a plant room:
  // one merged mesh of flat strips a hair above the tile, unlit so the paint reads the same at both
  // ends of the room.
  root.add(hazardBands(ISLANDS.map(([x, z]) => [x, z])));

  // Grating strips across the aisle every three metres. The first pass alpha tested a white lattice
  // over a near black recess, which gave a hard black and white mat rather than steel over a trench:
  // in the hold's frame it was the loudest thing in the room after the lamp. Now it is a dark steel
  // tray with a half opaque lattice laid on it, so the diamonds sit close in value to what shows
  // between them: measured on the near strip in the hold's frame, the lattice against its recess went
  // from 13:1 to 2:1. The lattice is a duller, rougher steel than the brief's 0x6c757c for the same
  // reason, which is that it sits under the desk lamp and a shinier one puts the highlight back.
  //
  // `instances()` places a box by its centre, so the two heights are picked to stack rather than to
  // nest: the tray spans y 0 to 0.02 and the lattice sheet spans 0.020 to 0.022, one millimetre of
  // depth clear of the tray's top face. Centring the lattice inside the tray, which is what the first
  // attempt at this did, leaves it enclosed and it never draws at all.
  const gratingZ: Spot[] = [];
  for (let z = Z0 + 1; z <= Z1 - 1; z += 3) gratingZ.push([HALL_DOOR.x, 0.01, z]);
  root.add(instances(new THREE.BoxGeometry(1.3, 0.02, 0.46), new THREE.MeshStandardMaterial({
    color: 0x2b3740, metalness: 0.5, roughness: 0.7,
  }), gratingZ));
  const alpha = chainlink(128); alpha.repeat.set(3, 1);
  root.add(instances(new THREE.BoxGeometry(1.2, 0.002, 0.4), new THREE.MeshStandardMaterial({
    color: 0x555d64, alphaMap: alpha, transparent: true, opacity: 0.45, depthWrite: false, metalness: 0.4, roughness: 0.65,
  }), gratingZ.map(([x, , z]) => [x, 0.021, z] as Spot)));

  return { planes };
}

/** A painted stencil on a wall: `w` by `h` metres, origin at its centre, turned `ry` to face out
 *  of the wall it is on. One draw call. */
function stencil(text: string, w: number, h: number, at: [number, number, number], ry: number): THREE.Mesh {
  const px = 112;
  const map = stencilTexture(text, { width: Math.round((px * w) / h), height: px, color: INK, font: `600 ${Math.round(px * 0.72)}px Michroma, system-ui, sans-serif`, alpha: 0.82 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 0.9 }));
  m.rotation.y = ry; m.position.set(at[0], at[1], at[2]); m.name = 'stencil';
  return m;
}

interface Run {
  from: [number, number, number];
  to: [number, number, number];
  /** Where the run goes after `to`: up through a hole in the ceiling, for the ones that do. */
  into?: [number, number, number];
  strands: number;
  /** Metres the run hangs below its chord at the middle. */
  sag: number;
}

/**
 * Black cable slung between fixings, as many runs of as many strands as asked, all one mesh. Each
 * strand sits a little to one side of the run's line and hangs a little lower the further out it
 * is, which is what spreads a bundle under its own weight instead of drawing one fat rope.
 */
function cableRuns(runs: Run[]): THREE.Mesh {
  const strands: THREE.BufferGeometry[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (const run of runs) {
    const a = new THREE.Vector3(...run.from), b = new THREE.Vector3(...run.to);
    const side = new THREE.Vector3().subVectors(b, a).setY(0);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0); else side.normalize().cross(up);
    const len = a.distanceTo(b);
    for (let s = 0; s < run.strands; s++) {
      const off = (s - (run.strands - 1) / 2) * 0.026;
      const p0 = a.clone().addScaledVector(side, off), p1 = b.clone().addScaledVector(side, off);
      const drop = run.sag + Math.abs(off) * 0.6;
      const points = [p0];
      for (const t of [0.25, 0.5, 0.75]) { const p = p0.clone().lerp(p1, t); p.y -= drop * 4 * t * (1 - t); points.push(p); }
      points.push(p1);
      if (run.into) points.push(new THREE.Vector3(...run.into).addScaledVector(side, off));
      const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
      strands.push(new THREE.TubeGeometry(curve, Math.max(10, Math.round(len * 3)), 0.011, 5, false));
    }
  }
  const m = merged(strands, new THREE.MeshStandardMaterial({ color: 0x14191e, roughness: 0.85, metalness: 0.15 }));
  m.name = 'cable-runs';
  return m;
}

/** Yellow and black diagonals, tiling, one period per repeat. Muted a step from the kit's hazard
 *  yellow: it is paint on a floor that has been walked on, not a new roll of tape. */
function hazardStripe(): THREE.CanvasTexture {
  const size = 64;
  const [c, ctx] = canvas(size, size);
  ctx.fillStyle = '#c9a227'; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#15181b';
  for (let k = -2; k <= 2; k++) {
    const x = k * size;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + size / 2, 0); ctx.lineTo(x + size / 2 - size, size); ctx.lineTo(x - size, size); ctx.closePath(); ctx.fill();
  }
  const t = own(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

/** A 0.12 m band round each island's footprint, six centimetres clear of the plinth, as one mesh of
 *  flat strips at y 0.013. The stripe tiles at 0.3 m on both axes of every strip, so it lies at the
 *  same angle round the whole rectangle rather than stretching along the long sides. */
function hazardBands(centres: [number, number][]): THREE.Mesh {
  const BAND = 0.12, GAP = 0.06, PERIOD = 0.3;
  const strips: THREE.BufferGeometry[] = [];
  const strip = (len: number, along: 'x' | 'z', x: number, z: number) => {
    const g = new THREE.PlaneGeometry(len, BAND);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (len / PERIOD), uv.getY(i) * (BAND / PERIOD));
    g.rotateX(-Math.PI / 2);
    if (along === 'z') g.rotateY(Math.PI / 2);
    g.translate(x, 0.013, z);
    strips.push(g);
  };
  const hx = ISLAND_HALF.x + 0.02 + GAP, hz = ISLAND_HALF.z + GAP;
  for (const [cx, cz] of centres) {
    for (const s of [-1, 1]) strip(2 * (hx + BAND), 'x', cx, cz + s * (hz + BAND / 2));
    for (const s of [-1, 1]) strip(2 * hz, 'z', cx + s * (hx + BAND / 2), cz);
  }
  const m = merged(strips, new THREE.MeshBasicMaterial({ map: hazardStripe(), color: 0x8c8c8c }));
  m.name = 'hazard-bands';
  return m;
}
