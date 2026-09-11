import * as THREE from 'three';
import type { StageContext } from '../types';
import { prepareAO } from '../../materials';
import { merged } from '../../merge';
import { labFloor, labWall, dadoBands, dadoMaterial, dadoLineMaterial, ceilingGrid, nearestLitPanel } from '../../labs/materials';
import { doorway, tapeStrip, stanchion } from '../../labs/signage';
import { X1, Z0, Z1, H, W, D, XC, ZC, ROOM, ROOM_W, ROOM_XC, TILE, LIT, PANEL, LANDING, BAY_DOOR, HALL_DOOR, HALL_FACE, HALL_HEAD } from './layout';

export interface Shell { planes: Set<THREE.Object3D>; flicker: THREE.InstancedMesh[] }

export function buildShell({ store }: StageContext, root: THREE.Group): Shell {
  const planes = new Set<THREE.Object3D>();
  const plane = (w: number, h: number, mat: THREE.Material) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); prepareAO(m.geometry); m.receiveShadow = true; planes.add(m); root.add(m); return m; };
  /** A wall piece: `ry` turns its normal into the space it faces, so a piece is only ever drawn from
   *  the side it belongs to and two pieces back to back on one plane never fight for depth. */
  const wall = (w: number, h: number, x: number, y: number, z: number, ry: number, tint?: number) => { const m = plane(w, h, labWall(store, w, h, tint)); m.rotation.y = ry; m.position.set(x, y, z); return m; };
  const dado: THREE.BufferGeometry[] = [], lines: THREE.BufferGeometry[] = [];
  const band = (len: number, x: number, z: number, ry: number) => { const b = dadoBands(len, x, z, ry); dado.push(b.band); lines.push(b.line); };

  const floor = plane(W, D, labFloor(store, W, D)); floor.rotation.x = -Math.PI / 2; floor.position.set(XC, 0, ZC);
  // One run of paint end to end. The west half used to be a dirtier grey under the shell's own 5 m,
  // which read as the detail running out rather than as contrast, so both long walls are one plane
  // in the kit's panel white with one dado under them.
  for (const [z, ry] of [[Z0, 0], [Z1, Math.PI]] as [number, number][]) {
    wall(W, H, XC, H / 2, z, ry);
    band(W, XC, z + (z === Z0 ? 0.02 : -0.02), 0);
  }

  // ---- The dropped ceiling, the full length of the room ----------------------------------------
  // One grid, so the troffer pattern is continuous from the landing door to the hall door and there
  // is no seam where a low ceiling meets a high one. It stops on the west wall plane rather than the
  // shell's own X0: past that is the hall doorway's vestibule, which carries its own ceiling at the
  // same height, and two ceilings on one plane is a flicker down the whole west end.
  const grid = { tile: TILE, lit: LIT, panel: PANEL, intensity: 1.25, tint: 0xd6e0e6, tileGlow: 0.6 };
  // Two panels come out of the batch so the room can drive them: one over the arcade row, one over
  // the drinks machines, whose lit header shares the second one's fault.
  const flickerIndex = [[-33.1, -34.0], [-29.5, -34.0]].map(([x, z]) => nearestLitPanel(ROOM_W, D, x - ROOM_XC, z - ZC, grid));
  const room = ceilingGrid(store, ROOM_W, D, ROOM.ceiling, { ...grid, flickerIndex });
  if (room.flicker.length !== 2) throw new Error('recreation: the ceiling did not give up two panels to flicker');
  room.group.position.set(ROOM_XC, 0, ZC); root.add(room.group);
  // The shell's own lid above the dropped ceiling, so the plenum is not a void at either end.
  const lid = plane(W, D, new THREE.MeshStandardMaterial({ color: 0x2b343b, roughness: 0.95 }));
  lid.rotation.x = Math.PI / 2; lid.position.set(XC, H, ZC);

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
  // The landing keeps the shell's height, because the bay's opening on its north side is that tall,
  // but it takes the room's ceiling: the same tile and the same sparse troffers, hung at 5 m.
  const landing = ceilingGrid(store, lw, ld, H, grid);
  landing.group.position.set(lx, 0, lz); root.add(landing.group);
  band(lw, lx, LANDING.z0 + 0.02, 0); band(ld, LANDING.x1 - 0.02, lz, Math.PI / 2);

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
  // Tied from the jamb to a stanchion two metres along. It used to run from the jamb to the floor
  // with nothing at the floor end, a tape that had fallen and been left, and Jordan's note on the
  // entry was that it felt weird.
  const postA = stanchion(); postA.position.set(BAY_DOOR.x + 2.0, 0, BAY_DOOR.z - BAY_DOOR.w / 2 + 0.8); root.add(postA);
  root.add(tapeStrip([BAY_DOOR.x, 1.05, BAY_DOOR.z - BAY_DOOR.w / 2 + 0.05], [BAY_DOOR.x + 2.0, 0.95, BAY_DOOR.z - BAY_DOOR.w / 2 + 0.8], 0.06));

  // ---- The west end: the doorway into the server hall -------------------------------------------
  // Its far mouth is the hall's own east wall plane (X0), which the hall closes around, and its near
  // mouth is this room's west closure at HALL_DOOR.x + depth / 2.
  const hallFace = HALL_FACE;
  const hallDoor = doorway({
    w: HALL_DOOR.w, h: HALL_DOOR.h, depth: HALL_DOOR.depth, axis: 'x', sign: 'OPERATIONS', tape: false,
    floor: labFloor(store, HALL_DOOR.w, HALL_DOOR.depth), wall: labWall(store, HALL_DOOR.depth, HALL_DOOR.h),
  });
  hallDoor.position.set(HALL_DOOR.x, 0, HALL_DOOR.z); hallDoor.name = 'hall-door'; root.add(hallDoor);
  const flankZ0 = HALL_DOOR.z - HALL_DOOR.w / 2, flankZ1 = HALL_DOOR.z + HALL_DOOR.w / 2;
  wall(flankZ0 - Z0, H, hallFace, H / 2, (Z0 + flankZ0) / 2, Math.PI / 2);
  wall(Z1 - flankZ1, H, hallFace, H / 2, (flankZ1 + Z1) / 2, Math.PI / 2);
  wall(HALL_DOOR.w, H - HALL_DOOR.h, hallFace, (H + HALL_DOOR.h) / 2, HALL_DOOR.z, Math.PI / 2);
  band(flankZ0 - Z0, hallFace + 0.02, (Z0 + flankZ0) / 2, Math.PI / 2);
  band(Z1 - flankZ1, hallFace + 0.02, (flankZ1 + Z1) / 2, Math.PI / 2);
  // The opening is as tall as the room's ceiling, so on this side there is no header to hang the
  // sign on and the sign's own place is inside the plenum. A head panel brings the mouth down to
  // 2.6 m, which is where the sign goes. The vestibule behind it stays 3.2, which reads as the
  // recess over a doorway and not as a step.
  wall(HALL_DOOR.w, ROOM.ceiling - HALL_HEAD, hallFace, (ROOM.ceiling + HALL_HEAD) / 2, HALL_DOOR.z, Math.PI / 2);
  const sign = hallDoor.getObjectByName('sign');
  if (sign) sign.position.y = HALL_HEAD + 0.35;
  // The tape that used to hang across this end ran down the walked line and the camera drove through
  // its lettering. This one hangs off the south flank beside the doorway, clear of the line.
  const postB = stanchion(); postB.position.set(hallFace + 1.9, 0, flankZ0 - 1.1); root.add(postB);
  root.add(tapeStrip([hallFace, 1.1, flankZ0 - 0.1], [hallFace + 1.9, 0.95, flankZ0 - 1.1], 0.06));

  root.add(merged(dado, dadoMaterial()), merged(lines, dadoLineMaterial()));
  return { planes, flicker: room.flicker };
}
