import * as THREE from 'three';
import type { StageContext } from '../types';
import { prepareAO } from '../../materials';
import { merged, instances, type Spot } from '../../merge';
import { labFloor, labWall, dadoBands, dadoMaterial, dadoLineMaterial, labSteel, LABS } from '../../labs/materials';
import { glassRoom } from '../../labs/props';
import { X0, X1, Z0, Z1, H, W, D, XC, ZC, LAB } from './layout';

export interface Shell { planes: Set<THREE.Object3D> }

/** Four fluorescent fixtures down the corridor outside the lab. The lab has its own lit grid. */
const FIXTURE_Z = [-12, -6, 0, 4];

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

export function buildShell({ store }: StageContext, root: THREE.Group): Shell {
  const planes = new Set<THREE.Object3D>();
  const plane = (w: number, h: number, mat: THREE.Material) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); prepareAO(m.geometry); m.receiveShadow = true; planes.add(m); root.add(m); return m; };
  const floor = plane(W, D, labFloor(store, W, D, 0xb7c4cb)); floor.rotation.x = -Math.PI / 2; floor.position.set(XC, 0, ZC);

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

  // A dark steel ceiling the room's full length, four fixtures over the corridor outside the lab.
  const ceiling = plane(W, D, labSteel(0x1a222a)); ceiling.rotation.x = Math.PI / 2; ceiling.position.set(XC, H, ZC);
  const stripMat = new THREE.MeshStandardMaterial({ color: 0x0a0f14, emissive: 0xd9e8ee, emissiveIntensity: 2 });
  const strips: Spot[] = FIXTURE_Z.map((z) => [XC, H - 0.1, z]);
  root.add(instances(new THREE.BoxGeometry(3, 0.06, 0.18), stripMat, strips));

  // The glass lab itself, inset within the hall, a door in its south and north faces at the same
  // x, straddling the walked line.
  const doorLocalX = LAB.doorX - LAB.x;
  const lab = glassRoom(store, {
    w: LAB.w, d: LAB.d, h: LAB.h, sill: LAB.sill,
    doors: [
      { face: 'south', x: doorLocalX, w: LAB.doorW },
      { face: 'north', x: doorLocalX, w: LAB.doorW },
    ],
    // Every tile lit at 0.9 was the ceiling Jordan called crazy: a continuous sheet of light with
    // no ceiling left between the panels, and the plates washed out under it. One tile in three at
    // 0.55 leaves the grid reading as a grid and hands the glow back to the plates.
    litEvery: 3, panelIntensity: 0.55, panel: [1.1, 1.1], frosted: true,
    floor: labFloor(store, LAB.w, LAB.d, LABS.panel),
  });
  lab.position.set(LAB.x, 0, LAB.z); root.add(lab);

  return { planes };
}
