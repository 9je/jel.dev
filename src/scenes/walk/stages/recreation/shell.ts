import * as THREE from 'three';
import type { StageContext } from '../types';
import { prepareAO } from '../../materials';
import { merged } from '../../merge';
import { labFloor, labWall, dadoBands, dadoMaterial, dadoLineMaterial, ceilingGrid, nearestLitPanel } from '../../labs/materials';
import { doorway, tapeStrip } from '../../labs/signage';
import { X1, Z0, Z1, H, W, D, XC, ZC, LANDING, BAY_DOOR, HALL_DOOR } from './layout';

export interface Shell { planes: Set<THREE.Object3D>; flicker: THREE.InstancedMesh }

export function buildShell({ store }: StageContext, root: THREE.Group): Shell {
  const planes = new Set<THREE.Object3D>();
  const plane = (w: number, h: number, mat: THREE.Material) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); prepareAO(m.geometry); m.receiveShadow = true; planes.add(m); root.add(m); return m; };
  /** A wall piece: `ry` turns its normal into the space it faces, so a piece is only ever drawn from
   *  the side it belongs to and two pieces back to back on one plane never fight for depth. */
  const wall = (w: number, h: number, x: number, y: number, z: number, ry: number) => { const m = plane(w, h, labWall(store, w, h)); m.rotation.y = ry; m.position.set(x, y, z); return m; };
  const floor = plane(W, D, labFloor(store, W, D)); floor.rotation.x = -Math.PI / 2; floor.position.set(XC, 0, ZC);
  for (const [z, ry] of [[Z0, 0], [Z1, Math.PI]] as [number, number][]) { const m = plane(W, H, labWall(store, W, H)); m.rotation.y = ry; m.position.set(XC, H / 2, z); }
  const bands = [dadoBands(W, XC, Z0 + 0.02, 0), dadoBands(W, XC, Z1 - 0.02, 0)];
  const dado: THREE.BufferGeometry[] = bands.map((b) => b.band), lines: THREE.BufferGeometry[] = bands.map((b) => b.line);
  // The panel that flickers is the one nearest the entrance, at x -23 on the room's walked line
  // (z 0 local to the grid's own centre, which sits on ZC, the walked line). Pulled into its own
  // instanced mesh so only it dims, not the whole grid.
  const flickerIndex = nearestLitPanel(W, D, -23 - XC, 0, { tile: 1.2, litEvery: 3 });
  const { group, flicker } = ceilingGrid(store, W, D, H, { tile: 1.2, litEvery: 3, intensity: 1.3, flickerIndex });
  if (!flicker) throw new Error('recreation: no ceiling panel found near the entrance to flicker');
  group.position.set(XC, 0, ZC); root.add(group);

  // ---- The east end: the landing behind the bay's wall, and the doorway into this room ----------
  // The bay's exit gap at z -30 opens onto this landing, the walk turns west across it, and the
  // RECREATION doorway takes it into the break room. Both are built here, in the room they lead
  // into, because the vestibule is finished in this room's floor and panel wall and the bay does not
  // carry those textures. The bay closes its own wall around the same opening (fabrication EXIT_X0).
  const lw = LANDING.x1 - LANDING.x0, ld = LANDING.z1 - LANDING.z0;
  const lx = (LANDING.x0 + LANDING.x1) / 2, lz = (LANDING.z0 + LANDING.z1) / 2;
  const landingFloor = plane(lw, ld, labFloor(store, lw, ld)); landingFloor.rotation.x = -Math.PI / 2; landingFloor.position.set(lx, 0, lz);
  wall(lw, H, lx, H / 2, LANDING.z0, 0);
  wall(ld, H, LANDING.x1, H / 2, lz, -Math.PI / 2);
  const landingCeiling = ceilingGrid(store, lw, ld, H, { tile: 1.2, litEvery: 3, intensity: 1.3 });
  landingCeiling.group.position.set(lx, 0, lz); root.add(landingCeiling.group);
  for (const b of [dadoBands(lw, lx, LANDING.z0 + 0.02, 0), dadoBands(ld, LANDING.x1 - 0.02, lz, Math.PI / 2)]) { dado.push(b.band); lines.push(b.line); }

  const bayDoor = doorway({
    w: BAY_DOOR.w, h: BAY_DOOR.h, depth: BAY_DOOR.depth, axis: 'x', sign: 'RECREATION', tape: false,
    floor: labFloor(store, BAY_DOOR.w, BAY_DOOR.depth), wall: labWall(store, BAY_DOOR.depth, BAY_DOOR.h),
  });
  bayDoor.position.set(BAY_DOOR.x, 0, BAY_DOOR.z); bayDoor.name = 'bay-door'; root.add(bayDoor);
  // The two soffits over the vestibule, one per mouth, so neither room shows a slot above the door.
  wall(BAY_DOOR.w, H - BAY_DOOR.h, X1, (H + BAY_DOOR.h) / 2, BAY_DOOR.z, -Math.PI / 2);
  wall(BAY_DOOR.w, H - BAY_DOOR.h, LANDING.x0, (H + BAY_DOOR.h) / 2, BAY_DOOR.z, Math.PI / 2);
  // The rest of this room's east wall, beside the doorway: the bay's own west wall backs onto it.
  wall(Z1 - LANDING.z1, H, X1, H / 2, (LANDING.z1 + Z1) / 2, -Math.PI / 2);
  // One tape, hanging off the doorway's south post and trailing to the floor: somebody ducked under
  // it. It stops well short of the walked line, so it never runs through the camera or a wall.
  root.add(tapeStrip([BAY_DOOR.x, 1.25, BAY_DOOR.z - BAY_DOOR.w / 2 + 0.05], [BAY_DOOR.x + 2.0, 0.06, BAY_DOOR.z - BAY_DOOR.w / 2 + 0.8], 0.06));

  // ---- The west end: the doorway into the server hall -------------------------------------------
  // Its far mouth is the hall's own east wall plane (X0), which the hall closes around, and its near
  // mouth is this room's west closure at HALL_DOOR.x + depth / 2.
  const hallFace = HALL_DOOR.x + HALL_DOOR.depth / 2;
  const hallDoor = doorway({
    w: HALL_DOOR.w, h: HALL_DOOR.h, depth: HALL_DOOR.depth, axis: 'x', sign: 'OPERATIONS', tape: false,
    floor: labFloor(store, HALL_DOOR.w, HALL_DOOR.depth), wall: labWall(store, HALL_DOOR.depth, HALL_DOOR.h),
  });
  hallDoor.position.set(HALL_DOOR.x, 0, HALL_DOOR.z); hallDoor.name = 'hall-door'; root.add(hallDoor);
  const flankZ0 = HALL_DOOR.z - HALL_DOOR.w / 2, flankZ1 = HALL_DOOR.z + HALL_DOOR.w / 2;
  wall(flankZ0 - Z0, H, hallFace, H / 2, (Z0 + flankZ0) / 2, Math.PI / 2);
  wall(Z1 - flankZ1, H, hallFace, H / 2, (flankZ1 + Z1) / 2, Math.PI / 2);
  wall(HALL_DOOR.w, H - HALL_DOOR.h, hallFace, (H + HALL_DOOR.h) / 2, HALL_DOOR.z, Math.PI / 2);
  for (const b of [dadoBands(flankZ0 - Z0, hallFace + 0.02, (Z0 + flankZ0) / 2, Math.PI / 2), dadoBands(Z1 - flankZ1, hallFace + 0.02, (flankZ1 + Z1) / 2, Math.PI / 2)]) { dado.push(b.band); lines.push(b.line); }
  // The tape that used to hang across this end ran down the walked line and the camera drove through
  // its lettering. This one hangs off the south flank beside the doorway, clear of the line.
  root.add(tapeStrip([hallFace, 1.3, flankZ0 - 0.1], [hallFace + 1.9, 0.06, flankZ0 - 1.1], 0.06));

  root.add(merged(dado, dadoMaterial()), merged(lines, dadoLineMaterial()));
  return { planes, flicker };
}
