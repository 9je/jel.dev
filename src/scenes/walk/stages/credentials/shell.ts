import * as THREE from 'three';
import type { StageContext } from '../types';
import { prepareAO } from '../../materials';
import { merged, instances, type Spot } from '../../merge';
import { labFloor, labWall, dadoBands, dadoMaterial, dadoLineMaterial, labSteel, LABS } from '../../labs/materials';
import { glassRoom } from '../../labs/props';
import { doorway } from '../../labs/signage';
import { battens, lightShaft, troffer, lensMaterial, fixtureSteel } from '../../labs/fixtures';
import { X0, X1, Z0, Z1, H, W, D, XC, ZC, LAB, LAB_PANEL, BATTEN_Z, BATTEN_Y, BATTEN_DROP } from './layout';

export interface Shell { planes: Set<THREE.Object3D> }


/** The only break in the long walls: the east wall opens from the hall's south end to here, where
 *  the walk arrives from the server hall (the path crosses x -75 at z about -29.2). The server hall
 *  owns the doorway that fills this gate and the vestibule behind it; this room closes the gate's
 *  head and its own south end so no frame in the transition shows an unbuilt edge. */
const GATE_Z1 = -27, GATE_H = 3.2;
/** The server hall cuts the doorway through the metre of wall where the two shells overlap (its X0
 *  back to this room's X1), so that metre of the south end at floor level is the vestibule's own
 *  south reveal. This room's south wall is built around it: a second plane in the same place facing
 *  the same way would be two front faces on one plane, which is what fights for depth. */
const VESTIBULE_W = 1;
/** The north end: the doorway into containment, on the walked line, and the wall it is cut through.
 *  The hold at t 0.84 stands 2.16 m short of this plane and reads the switchgear room through it, so
 *  the opening is the frame that room is first seen in and the wall around it has to be solid. */
const NORTH_DOOR = { x: -79, w: 3.2, h: 3.0, depth: 1.2 };

export function buildShell({ store }: StageContext, root: THREE.Group): Shell {
  const planes = new Set<THREE.Object3D>();
  const plane = (w: number, h: number, mat: THREE.Material) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); prepareAO(m.geometry); m.receiveShadow = true; planes.add(m); root.add(m); return m; };
  // This hall and the server hall overlap by the metre their shared doorway is cut through, and both
  // lay a floor across it: x -76 to -75, z -30 to -24, the strip beside the flagship desk at the
  // server hall's west end. Coplanar at y 0 they tore into thin stripes of this room's paler tile
  // across the server hall's greyer one, in the frame the walk leaves operations on. Trimming either
  // plane leaves a hole (this hall runs on to z 6 where the server hall stops at -24, and the server
  // hall runs back to z -38 where this one stops at -30), so the tie is settled in height instead:
  // 6 mm, which is a pixel at the distance the strip is ever seen from and beats the depth buffer's
  // resolution there by a factor of fifty. A polygon offset was tried first and is the wrong tool for
  // a ground plane read at a grazing angle: it scales with the depth slope, and at the angle the
  // operations hold looks through the doorway it pushed this whole floor behind the greybox's corner
  // patch. Props stand at y 0 and sink 6 mm into the tile, which is nothing at floor level.
  const floor = plane(W, D, labFloor(store, W, D, 0xb7c4cb)); floor.rotation.x = -Math.PI / 2; floor.position.set(XC, 0.006, ZC);

  // The long walls run full length and full height on both sides: the lab's glass is inset 0.4 m
  // from them, so there is always a solid wall (and a sliver of hall floor) behind every pane. The
  // west wall is one unbroken run; the east wall opens only at the server hall gate (z -30..-27).
  const bandGeoms: THREE.BufferGeometry[] = [], lineGeoms: THREE.BufferGeometry[] = [];
  const wallSegment = (x: number, ry: number, z0: number, z1: number) => {
    const len = z1 - z0, midZ = (z0 + z1) / 2;
    const m = plane(len, H, labWall(store, len, H)); m.rotation.y = ry; m.position.set(x, H / 2, midZ);
    const b = dadoBands(len, x + (x === X0 ? 0.02 : -0.02), midZ, Math.PI / 2);
    bandGeoms.push(b.band); lineGeoms.push(b.line);
  };
  wallSegment(X0, Math.PI / 2, Z0, Z1);
  wallSegment(X1, -Math.PI / 2, GATE_Z1, Z1);
  root.add(merged(bandGeoms, dadoMaterial()), merged(lineGeoms, dadoLineMaterial()));

  // The south end, closed. It was open, which is the black wall beside the desk in Jordan's shot of
  // the server hall's far end: the gate is a doorway, and the rest of this end is wall. Two pieces:
  // the run up to the vestibule, and the strip above it, so nothing is drawn twice.
  const southW = W - VESTIBULE_W;
  const south = plane(southW, H, labWall(store, southW, H)); south.position.set(X0 + southW / 2, H / 2, Z0);
  const overDoor = plane(VESTIBULE_W, H - GATE_H, labWall(store, VESTIBULE_W, H - GATE_H));
  overDoor.position.set(X1 - VESTIBULE_W / 2, (H + GATE_H) / 2, Z0);
  const head = plane(GATE_Z1 - Z0, H - GATE_H, labWall(store, GATE_Z1 - Z0, H - GATE_H));
  head.rotation.y = -Math.PI / 2; head.position.set(X1, (H + GATE_H) / 2, (Z0 + GATE_Z1) / 2);

  // The north end, closed around the containment doorway. Containment closes the same plane from
  // its own side with its own 3.4 m wall, both faces turned away from each other, so the two are
  // one-sided planes back to back rather than a pair fighting for the pixel.
  const nd0 = NORTH_DOOR.x - NORTH_DOOR.w / 2, nd1 = NORTH_DOOR.x + NORTH_DOOR.w / 2;
  for (const [w, x] of [[nd0 - X0, (X0 + nd0) / 2], [X1 - nd1, (nd1 + X1) / 2]] as [number, number][]) {
    const m = plane(w, H, labWall(store, w, H)); m.rotation.y = Math.PI; m.position.set(x, H / 2, Z1);
  }
  const lintel = plane(NORTH_DOOR.w, H - NORTH_DOOR.h, labWall(store, NORTH_DOOR.w, H - NORTH_DOOR.h));
  lintel.rotation.y = Math.PI; lintel.position.set(NORTH_DOOR.x, (H + NORTH_DOOR.h) / 2, Z1);

  const north = doorway({
    w: NORTH_DOOR.w, h: NORTH_DOOR.h, depth: NORTH_DOOR.depth, axis: 'z', sign: 'CONTAINMENT', tape: false,
    floor: labFloor(store, NORTH_DOOR.w, NORTH_DOOR.depth), wall: labWall(store, NORTH_DOOR.depth, NORTH_DOOR.h),
  });
  // Turned about, so the lit CONTAINMENT sign hangs over the mouth the walk arrives at rather
  // than over the one it leaves by. The vestibule itself is symmetric either way.
  north.rotation.y = Math.PI;
  north.position.set(NORTH_DOOR.x, 0, Z1); north.name = 'containment-door'; root.add(north);

  // A dark steel ceiling the room's full length. Over the corridor north of the lab, four battens
  // hung on rods off it, and under the two the spots sit at, a faint shaft: the hall is dark, and
  // the air under a fitting is the one place a shaft reads as air rather than as a solid.
  const ceiling = plane(W, D, labSteel(0x1a222a)); ceiling.rotation.x = Math.PI / 2; ceiling.position.set(XC, H, ZC);
  root.add(battens({ len: 3, drop: BATTEN_DROP, intensity: 1.4 }, BATTEN_Z.map((z) => [XC, BATTEN_Y, z] as Spot)));
  for (const z of [BATTEN_Z[0], BATTEN_Z[2]]) {
    const shaft = lightShaft({ top: 0.4, bottom: 2.4, height: BATTEN_Y - 0.1, opacity: 0.05 });
    shaft.position.set(XC, BATTEN_Y - 0.06, z); root.add(shaft);
  }

  // The glass lab itself, inset within the hall, a door in its south and north faces at the same
  // x, straddling the walked line.
  const doorLocalX = LAB.doorX - LAB.x;
  const lab = glassRoom(store, {
    w: LAB.w, d: LAB.d, h: LAB.h, sill: LAB.sill,
    doors: [
      { face: 'south', x: doorLocalX, w: LAB.doorW },
      { face: 'north', x: doorLocalX, w: LAB.doorW },
    ],
    // The grid's own pattern lights every nth tile on a diagonal, and no n gives this room the
    // reference's luminous lid: a few large panels in two even rows. So the grid is asked for none
    // (nothing on its diagonal fits a 2.2 m fitting) and the six panels are laid below by hand,
    // with the grid's own troffer and lens so they are the same fitting every other ceiling has.
    // Tinted whiter than the shared tile so the lid reads as a white box, not a grey one.
    litEvery: 1000, panel: LAB_PANEL.size, tint: 0xe4ecf0, frosted: true,
    floor: labFloor(store, LAB.w, LAB.d, LABS.panel),
  });
  const [pw, pd] = LAB_PANEL.size;
  const { frame, lens } = troffer(pw, pd);
  const panelSpots: Spot[] = LAB_PANEL.x.flatMap((x) => LAB_PANEL.z.map((z) => [x, LAB.h - 0.004, z] as Spot));
  lab.add(instances(frame, fixtureSteel(), panelSpots));
  const lenses = instances(lens, lensMaterial(pw, pd, LAB_PANEL.intensity), panelSpots); lenses.name = 'panels'; lab.add(lenses);
  lab.position.set(LAB.x, 0, LAB.z); root.add(lab);

  return { planes };
}
