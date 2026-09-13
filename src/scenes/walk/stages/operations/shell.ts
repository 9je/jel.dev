import * as THREE from 'three';
import type { StageContext } from '../types';
import { prepareAO } from '../../materials';
import { merged, type Spot } from '../../merge';
import { labFloor, labWall, labSteel, dadoBands, dadoMaterial, dadoLineMaterial } from '../../labs/materials';
import { cableTray } from '../../labs/props';
import { doorway } from '../../labs/signage';
import { battens, lightShaft } from '../../labs/fixtures';
import { X0, X1, Z0, Z1, H, W, D, XC, ZC, RACK_Z, EAST_OPEN, WEST_OPEN, HALL_DOOR, BATTEN_ROWS, BATTEN_XS, BATTEN_DROP, BATTEN_Y, SPOT_FITTINGS } from './layout';

export interface Shell { planes: Set<THREE.Object3D> }

export function buildShell({ store }: StageContext, root: THREE.Group): Shell {
  const planes = new Set<THREE.Object3D>();
  const plane = (w: number, h: number, mat: THREE.Material) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); prepareAO(m.geometry); m.receiveShadow = true; planes.add(m); root.add(m); return m; };
  /** A wall piece facing the space it belongs to. Two pieces back to back on one plane are two
   *  one-sided planes with opposite normals, so only one is ever drawn and neither fights for
   *  depth: that is how this hall and the break room share the wall at X1. */
  const wall = (w: number, h: number, x: number, y: number, z: number, ry: number) => { const m = plane(w, h, labWall(store, w, h)); m.rotation.y = ry; m.position.set(x, y, z); return m; };
  const floor = plane(W, D, labFloor(store, W, D)); floor.rotation.x = -Math.PI / 2; floor.position.set(XC, 0, ZC);

  // The long walls, south at Z0 and north at Z1, full width, as Recreation's.
  for (const [z, ry] of [[Z0, 0], [Z1, Math.PI]] as [number, number][]) { const m = plane(W, H, labWall(store, W, H)); m.rotation.y = ry; m.position.set(XC, H / 2, z); }

  // The end walls at X0 (west, toward Credentials) and X1 (east, toward the break room). Each is
  // built as pieces flanking its doorway plus a soffit over it, so the hall closes on every side of
  // the opening and the transition never shows a slot into the dark.
  for (const [x, ry, open] of [[X0, Math.PI / 2, WEST_OPEN], [X1, -Math.PI / 2, EAST_OPEN]] as [number, number, typeof WEST_OPEN][]) {
    wall(open.z0 - Z0, H, x, H / 2, (Z0 + open.z0) / 2, ry);
    wall(Z1 - open.z1, H, x, H / 2, (open.z1 + Z1) / 2, ry);
    wall(open.z1 - open.z0, H - open.h, x, (H + open.h) / 2, (open.z0 + open.z1) / 2, ry);
  }

  // The doorway into the credentials hall, cut through the metre of wall where the two shells
  // overlap: its east mouth is this hall's X0, its west mouth the credentials east wall, and the lit
  // sign hangs over the east mouth, which is the face the walk arrives at.
  const door = doorway({
    w: HALL_DOOR.w, h: HALL_DOOR.h, depth: HALL_DOOR.depth, axis: 'x', sign: 'CREDENTIALS', tape: false,
    floor: labFloor(store, HALL_DOOR.w, HALL_DOOR.depth), wall: labWall(store, HALL_DOOR.depth, HALL_DOOR.h),
  });
  door.position.set(HALL_DOOR.x, 0, HALL_DOOR.z); door.name = 'credentials-door'; root.add(door);

  const bands = [dadoBands(W, XC, Z0 + 0.02, 0), dadoBands(W, XC, Z1 - 0.02, 0)];
  root.add(merged(bands.map((b) => b.band), dadoMaterial()), merged(bands.map((b) => b.line), dadoLineMaterial()));

  // No suspended ceiling grid in this room: a dark steel plane with two rows of fluorescent battens
  // hung from it on rods, and a cable tray over each rack row. The battens are fittings rather than
  // lit rectangles on the ceiling, which is what Jordan's "procedural junk" was: a housing with end
  // caps, a diffuser with the tubes showing through it, and the rods and plates it hangs by.
  const ceiling = plane(W, D, labSteel(0x1a222a)); ceiling.rotation.x = Math.PI / 2; ceiling.position.set(XC, H, ZC);

  const spots: Spot[] = [];
  for (const z of BATTEN_ROWS) for (const x of BATTEN_XS) spots.push([x, BATTEN_Y, z]);
  const row = battens({ len: 2.2, drop: BATTEN_DROP, intensity: 1.4 }, spots); row.name = 'battens'; root.add(row);

  // A shaft of light under the two battens the spots sit in, and only those two. The hall is dark
  // and the air in it is dusty, so the cone under a lamp is the one place the light itself shows.
  for (const [x, z] of SPOT_FITTINGS) {
    const shaft = lightShaft({ top: 0.25, bottom: 1.6, height: 4.1, opacity: 0.05 });
    shaft.position.set(x, BATTEN_Y - 0.06, z); root.add(shaft);
  }

  for (const z of [RACK_Z.south, RACK_Z.north]) { const tray = cableTray(W - 2); tray.position.set(XC, H - 0.4, z); root.add(tray); }

  return { planes };
}
