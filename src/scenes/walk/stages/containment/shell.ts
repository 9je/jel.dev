import * as THREE from 'three';
import type { StageContext } from '../types';
import { prepareAO } from '../../materials';
import { instances, merged, type Spot } from '../../merge';
import { ceilingGrid, dadoBands, dadoLineMaterial, dadoMaterial, labFloor, labWall } from '../../labs/materials';
import { cableDrop } from '../../labs/plant';
import { chainlink } from '../../labs/textures';
import { X0, X1, Z0, Z1, H, W, D, XC, ZC, HALL_DOOR, SEALED, OFFICE_OPEN, MISSING, DROPS } from './layout';

export interface Shell { planes: Set<THREE.Object3D> }

/** The tile pitch the grid is laid on. 0.6 m, so the ceiling is 23 by 33 and a missing tile is a
 *  hole you could put a shoulder through rather than a whole bay of the room. */
export const TILE = 0.6;
const COLS = Math.floor(W / TILE), ROWS = Math.floor(D / TILE);

/** Where a missing tile actually is in the world. The ceiling is one segmented plane spanning the
 *  full room, so its cells are W/COLS wide rather than exactly TILE, and the cables that hang
 *  through the holes have to be hung off the same arithmetic or they miss. */
export function holeAt(i: number, j: number): [number, number] {
  return [XC - W / 2 + (i + 0.5) * (W / COLS), ZC - D / 2 + (j + 0.5) * (D / ROWS)];
}

/** The void above the tiles: 1.2 m of dark plant space with a blue lit panel in its ceiling. */
const VOID_H = 1.2;

export function buildShell({ store }: StageContext, root: THREE.Group): Shell {
  const planes = new Set<THREE.Object3D>();
  const plane = (w: number, h: number, mat: THREE.Material) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); prepareAO(m.geometry); m.receiveShadow = true; planes.add(m); root.add(m); return m; };
  const wall = (w: number, h: number, x: number, y: number, z: number, ry: number) => { const m = plane(w, h, labWall(store, w, h)); m.rotation.y = ry; m.position.set(x, y, z); return m; };

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

  // ---- The ceiling and what is behind it -------------------------------------------------------
  // The grid, five tiles short. One fitting in every eighth column and every sixth row: a troffer
  // every 4.8 m across the room and every 3.6 m up it, eighteen in the whole ceiling.
  //
  // The room was drawn with one in four columns and one in three rows, which is sixty six fittings,
  // and at the hold that is not a ceiling, it is a lightbox. Half the frame went to a sheet of
  // glowing rectangles and nothing on the floor could compete with it. Sparse and dim is what the
  // reference actually has: mostly dark tile, a fitting here and there, and the room lit by the two
  // things it is about.
  const grid = ceilingGrid(store, W, D, H, {
    tile: TILE, intensity: 0.85, panel: [1.15, 0.3], tint: 0xa8b9c2,
    lit: (i, j) => i % 8 === 2 && j % 6 === 2,
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

  // Cables pulled through every gap and left hanging to head height. This is the detail the
  // reference is built on: the ceiling is not just missing tiles, it is missing tiles with the
  // building's own wiring coming down through them.
  for (const [i, j] of DROPS) {
    const [x, z] = holeAt(i, j);
    root.add(cableDrop([x, H + VOID_H - 0.25, z], H + VOID_H - 0.25 - 1.5, 4));
  }

  // ---- The floor ------------------------------------------------------------------------------
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
