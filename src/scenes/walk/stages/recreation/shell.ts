import * as THREE from 'three';
import type { StageContext } from '../types';
import { prepareAO } from '../../materials';
import { merged, instances, type Spot } from '../../merge';
import { labFloor, labWall, dadoBands, dadoMaterial, dadoLineMaterial, ceilingGrid, nearestLitPanel, LABS } from '../../labs/materials';
import { doorway, tapeStrip } from '../../labs/signage';
import { X0, X1, Z0, Z1, H, W, D, XC, ZC, ROOM, ROOM_W, ROOM_XC, ROOM_OPEN, TILE, LIT, PANEL, LANDING, BAY_DOOR, HALL_DOOR } from './layout';

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
  // The two long walls are built in two runs each, breaking at the room's west closure: the break
  // room's are the kit's panel white, the passage's a dirtier grey. One 38 m plane painted one
  // colour is what made the old room read as a single corridor from end to end.
  const passW = ROOM.x0 - X0, passXC = (X0 + ROOM.x0) / 2;
  for (const [z, ry] of [[Z0, 0], [Z1, Math.PI]] as [number, number][]) {
    wall(ROOM_W, H, ROOM_XC, H / 2, z, ry);
    wall(passW, H, passXC, H / 2, z, ry, 0x93a1a8);
    const out = z === Z0 ? 0.02 : -0.02;
    band(ROOM_W, ROOM_XC, z + out, 0); band(passW, passXC, z + out, 0);
  }

  // ---- The dropped ceiling over the break room --------------------------------------------------
  const grid = { tile: TILE, lit: LIT, panel: PANEL, intensity: 1.25 };
  // Two panels come out of the batch so the room can drive them: one over the arcade row, one over
  // the lit vending machine, which shares its fault with the machine's own header.
  const flickerIndex = [[-34.3, -34.0], [-30.7, -34.0]].map(([x, z]) => nearestLitPanel(ROOM_W, D, x - ROOM_XC, z - ZC, grid));
  const room = ceilingGrid(store, ROOM_W, D, ROOM.ceiling, { ...grid, flickerIndex });
  if (room.flicker.length !== 2) throw new Error('recreation: the ceiling did not give up two panels to flicker');
  room.group.position.set(ROOM_XC, 0, ZC); root.add(room.group);
  // The shell's own lid, above the dropped ceiling and over the passage, so neither space opens on
  // a void. Plain dark paint: the only thing hung from it is the passage's two strip lights.
  const lid = plane(W, D, new THREE.MeshStandardMaterial({ color: 0x2b343b, emissive: 0x2b343b, emissiveIntensity: 0.35, roughness: 0.95 }));
  lid.rotation.x = Math.PI / 2; lid.position.set(XC, H, ZC);
  root.add(instances(new THREE.BoxGeometry(2.4, 0.07, 0.16), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: LABS.cold, emissiveIntensity: 1.5 }), [[-42, H - 0.12, -31], [-48, H - 0.12, -31], [-54, H - 0.12, -31]] as Spot[]));

  // ---- The west closure: where the low ceiling and the break room end ---------------------------
  // A bulkhead alone would leave the room open to the passage for its whole width, and the dropped
  // ceiling would read as a lid floating in a longer room. The closure is a wall with a 4 m way
  // through it on the walked line, so the passage is something the room looks into.
  const flanks: [number, number][] = [[Z0, ROOM_OPEN.z0], [ROOM_OPEN.z1, Z1]];
  for (const [a, b] of flanks) {
    const len = b - a, mid = (a + b) / 2;
    wall(len, ROOM.ceiling, ROOM.x0, ROOM.ceiling / 2, mid, Math.PI / 2);
    wall(len, H, ROOM.x0, H / 2, mid, -Math.PI / 2, 0x93a1a8);
    band(len, ROOM.x0 + 0.02, mid, Math.PI / 2);
  }
  wall(ROOM_OPEN.z1 - ROOM_OPEN.z0, H - ROOM.ceiling, ROOM.x0, (H + ROOM.ceiling) / 2, (ROOM_OPEN.z0 + ROOM_OPEN.z1) / 2, -Math.PI / 2, 0x93a1a8);
  const bulkhead = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, D), new THREE.MeshStandardMaterial({ color: LABS.panel, roughness: 0.7 }));
  bulkhead.position.set(ROOM.x0 + 0.17, ROOM.ceiling + 0.15, ZC); root.add(bulkhead);

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
  wall(flankZ0 - Z0, H, hallFace, H / 2, (Z0 + flankZ0) / 2, Math.PI / 2, 0x93a1a8);
  wall(Z1 - flankZ1, H, hallFace, H / 2, (flankZ1 + Z1) / 2, Math.PI / 2, 0x93a1a8);
  wall(HALL_DOOR.w, H - HALL_DOOR.h, hallFace, (H + HALL_DOOR.h) / 2, HALL_DOOR.z, Math.PI / 2, 0x93a1a8);
  band(flankZ0 - Z0, hallFace + 0.02, (Z0 + flankZ0) / 2, Math.PI / 2);
  band(Z1 - flankZ1, hallFace + 0.02, (flankZ1 + Z1) / 2, Math.PI / 2);
  // The tape that used to hang across this end ran down the walked line and the camera drove through
  // its lettering. This one hangs off the south flank beside the doorway, clear of the line.
  root.add(tapeStrip([hallFace, 1.3, flankZ0 - 0.1], [hallFace + 1.9, 0.06, flankZ0 - 1.1], 0.06));

  root.add(merged(dado, dadoMaterial()), merged(lines, dadoLineMaterial()));
  return { planes, flicker: room.flicker };
}
