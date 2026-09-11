import * as THREE from 'three';
import type { StageContext } from '../types';
import { prepareAO, surface } from '../../materials';
import { instances, merged, type Spot } from '../../merge';
import { labFloor, labGlass, labSteel, labWall } from '../../labs/materials';
import { container, glassRoom, palletRack } from '../../labs/props';
import { radialTexture } from '../../textures';
import { DOOR, H, SILL, W, D, X1, XC, ZC, Z0, Z1, WINDOW, YARD } from './layout';

export interface Shell { planes: Set<THREE.Object3D> }

/** A strip of floor paint, as one geometry already placed. The fabrication floor paints its aisle
 *  the same way. Copied rather than imported: one room reaching into another room's shell is how a
 *  chunk stops being a chunk. */
function stripe(len: number, x: number, z: number, width: number, ry: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(len, width);
  g.rotateX(-Math.PI / 2); g.rotateY(ry); g.translate(x, 0.03, z);
  return g;
}

/**
 * The control room and the yard it looks over.
 *
 * Two spaces, one wall apart. The room is a glass fronted office: white sill band and clear glazing
 * facing south into containment, painted block on the other three sides, a low lit tile ceiling, and
 * a six metre window cut in the east wall from 1.0 to 2.6 m. The yard behind that window is a dark
 * box twenty four metres across with containers, racking and beacons in it, and one sodium pool on
 * its floor. It is never walked into and never seen any closer than eight metres through a hole in a
 * wall, so it is built to be read at that size: thirteen draw calls in total and nothing in it that
 * needs a second look.
 */
export function buildShell({ store }: StageContext, root: THREE.Group): Shell {
  const planes = new Set<THREE.Object3D>();
  const plane = (w: number, h: number, mat: THREE.Material) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); prepareAO(m.geometry); m.receiveShadow = true; planes.add(m); root.add(m); return m; };
  const wall = (w: number, h: number, x: number, y: number, z: number, ry: number, tint?: number) => {
    const m = plane(w, h, labWall(store, w, h, tint)); m.rotation.y = ry; m.position.set(x, y, z); return m;
  };

  // ---- The glass front -------------------------------------------------------------------------
  // Only the south face of it. Containment leaves its north wall open from x -77 east for exactly
  // this run, and the other three sides of this room are painted block, so a glazed north, east or
  // west face would be a second surface standing in the same place as the wall that covers it.
  const front = glassRoom(store, {
    w: W, d: D, h: H, sill: SILL,
    faces: ['south'],
    doors: [{ face: 'south', x: DOOR.x - XC, w: DOOR.w }],
    litEvery: 6, panelIntensity: 0.32, panel: [1.1, 0.3], tint: 0x9aacb6,
    floor: labFloor(store, W, D, 0x586873),
  });
  front.position.set(XC, 0, ZC); root.add(front);

  // ---- The three solid walls -------------------------------------------------------------------
  // A colder, darker panel than the labs' own white: this is a room lit by one desk lamp and one
  // sodium pool coming in through a window, and a white wall in it would be the brightest thing in
  // the frame by a distance.
  const TINT = 0x6b7a84;
  wall(D, H, -77, H / 2, ZC, Math.PI / 2, TINT);
  wall(W, H, XC, H / 2, Z1, Math.PI, TINT);

  // The east wall, with the window cut out of it: a course under the opening, a course over it, and
  // a metre of return at each end.
  const returnS = WINDOW.z0 - Z0, returnN = Z1 - WINDOW.z1, span = WINDOW.z1 - WINDOW.z0;
  wall(D, WINDOW.y0, X1, WINDOW.y0 / 2, ZC, -Math.PI / 2, TINT);
  wall(D, H - WINDOW.y1, X1, (H + WINDOW.y1) / 2, ZC, -Math.PI / 2, TINT);
  wall(returnS, WINDOW.y1 - WINDOW.y0, X1, (WINDOW.y0 + WINDOW.y1) / 2, Z0 + returnS / 2, -Math.PI / 2, TINT);
  wall(returnN, WINDOW.y1 - WINDOW.y0, X1, (WINDOW.y0 + WINDOW.y1) / 2, Z1 - returnN / 2, -Math.PI / 2, TINT);

  // The window itself: one pane with a steel surround and two mullions in it. The glass sits two
  // centimetres inside the opening so it never lands on the plane of the wall it is set in.
  const glassMat = labGlass(); glassMat.side = THREE.DoubleSide;
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(span, WINDOW.y1 - WINDOW.y0), glassMat);
  pane.rotation.y = -Math.PI / 2; pane.position.set(X1 - 0.02, (WINDOW.y0 + WINDOW.y1) / 2, ZC);
  pane.renderOrder = 2; pane.name = 'window'; root.add(pane);
  const frame: Spot[] = [[X1 - 0.05, (WINDOW.y0 + WINDOW.y1) / 2, WINDOW.z0 + span / 3], [X1 - 0.05, (WINDOW.y0 + WINDOW.y1) / 2, WINDOW.z1 - span / 3]];
  root.add(instances(new THREE.BoxGeometry(0.07, WINDOW.y1 - WINDOW.y0, 0.07), labSteel(0x39434b), frame));
  root.add(merged([
    new THREE.BoxGeometry(0.12, 0.1, span).translate(X1 - 0.06, WINDOW.y0 - 0.05, ZC),
    new THREE.BoxGeometry(0.12, 0.1, span).translate(X1 - 0.06, WINDOW.y1 + 0.05, ZC),
  ], labSteel(0x39434b)));

  buildYard(store, root);
  return { planes };
}

/**
 * The yard. An interior facing box, so the room sees straight into it through the window and the
 * east wall is what stops it being seen anywhere else, with the near half of its floor below the
 * window's bottom edge and therefore never drawn on.
 *
 * Everything in it is placed against what the window actually shows. From the hold the opening is a
 * cone: at twelve metres out it is fifteen metres wide and four metres tall, and the floor only
 * comes into view eleven metres past the glass. So the containers stand at the far end of that cone
 * rather than under the window, the paint is in the far half of the floor, and the beacons are at
 * 3.3 m on the far wall rather than in the roof: a beacon on an eight metre roof is four metres over
 * the top edge of the window and would never once be in shot.
 */
function buildYard(store: StageContext['store'], root: THREE.Group): void {
  const yard = new THREE.Group(); yard.name = 'yard'; root.add(yard);
  const w = YARD.x1 - YARD.x0, d = YARD.z1 - YARD.z0;
  const cx = (YARD.x0 + YARD.x1) / 2, cz = (YARD.z0 + YARD.z1) / 2;

  const box = new THREE.Mesh(new THREE.BoxGeometry(w, YARD.h, d), new THREE.MeshStandardMaterial({
    color: 0x1a222a, emissive: 0x16273a, emissiveIntensity: 0.85, roughness: 0.95, side: THREE.BackSide,
  }));
  box.position.set(cx, YARD.h / 2, cz); yard.add(box);

  const floorMat = surface(store.texture('concrete_floor'), w, d, 6);
  floorMat.color.setHex(0x5a6670);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
  prepareAO(floor.geometry); floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0.02, cz); yard.add(floor);

  // Bay lines, in the half of the floor the window shows. Hazard yellow, worn, drawn flat.
  const paint = new THREE.MeshBasicMaterial({ color: 0xe8b923, transparent: true, opacity: 0.3, depthWrite: false });
  yard.add(merged([
    stripe(11, -45.5, 25, 0.3, 0), stripe(11, -45.5, 31, 0.3, 0), stripe(11, -45.5, 37, 0.3, 0),
    stripe(13, -45.5, 31, 0.3, Math.PI / 2),
  ], paint));

  // Two containers at the far end of the cone, in one batch. A 20 ft box is 6.1 by 2.4, which at
  // fifteen metres through a six metre window is the largest single thing the yard has to say.
  const rust = container(0x7d4034);
  rust.position.set(-45.5, 0, 38.4); rust.rotation.y = -0.5; yard.add(rust);
  const teal = container(0x2b5a62);
  teal.position.set(-51, 0, 23.5); teal.rotation.y = 0.22; yard.add(teal);

  // Blue racking down the far wall, which is the one detail every reference of this bay carries.
  const rack = palletRack(3, 3);
  rack.position.set(-40.4, 0, 34); rack.rotation.y = Math.PI / 2; yard.add(rack);

  // The red beacons. One batch of domes, no bases: at twenty metres a base is two pixels of dark
  // grey under a glowing red one, and it is the glow that reads.
  const beacons: Spot[] = [
    [-39.2, 3.3, 22], [-39.2, 3.3, 27], [-39.2, 3.3, 32], [-39.2, 3.3, 37],
    [-47, 3.5, 39.4], [-47, 3.5, 20.6],
  ];
  yard.add(instances(
    new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x3a0806, emissive: 0xc8322b, emissiveIntensity: 2.6 }),
    beacons,
  ));

  // One sodium pool on the floor, where the floor first comes into view under the window's bottom
  // edge. It is what says the yard is lit and the room is not.
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({
    map: radialTexture(128, 0.05), color: 0xe0813a, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(-47, 0.04, 32); yard.add(pool);
}
