import * as THREE from 'three';
import type { StageContext } from '../types';
import { prepareAO } from '../../materials';
import { merged, instances, type Spot } from '../../merge';
import { labFloor, labWall, dadoBands, dadoMaterial, dadoLineMaterial, labSteel, LABS } from '../../labs/materials';
import { glassRoom } from '../../labs/props';
import { X0, X1, Z0, Z1, H, W, D, XC, ZC, LAB, LAB_Z0, LAB_Z1 } from './layout';

export interface Shell { planes: Set<THREE.Object3D> }

/** Four fluorescent fixtures down the corridor outside the lab. The lab has its own lit grid. */
const FIXTURE_Z = [-12, -6, 0, 4];

/** The only break in the long walls: the east wall opens from the hall's south end to here, where
 *  the walk arrives from the server hall (the path crosses x -75 at z about -29.3). */
const GATE_Z1 = -27;

export function buildShell({ store }: StageContext, root: THREE.Group): Shell {
  const planes = new Set<THREE.Object3D>();
  const plane = (w: number, h: number, mat: THREE.Material) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); prepareAO(m.geometry); m.receiveShadow = true; planes.add(m); root.add(m); return m; };
  const floor = plane(W, D, labFloor(store, W, D, 0xb7c4cb)); floor.rotation.x = -Math.PI / 2; floor.position.set(XC, 0, ZC);

  // The long walls: dim white panel wherever the lab's own glass does not stand in for them, dado
  // along each panel run. The west wall runs the full length with no gap; the east wall opens only
  // at the server hall gate (z -30..-27).
  const bandGeoms: THREE.BufferGeometry[] = [], lineGeoms: THREE.BufferGeometry[] = [];
  const wallSegment = (x: number, ry: number, z0: number, z1: number) => {
    const len = z1 - z0, midZ = (z0 + z1) / 2;
    const m = plane(len, H, labWall(store, len, H)); m.rotation.y = ry; m.position.set(x, H / 2, midZ);
    const b = dadoBands(len, x + (x === X0 ? 0.02 : -0.02), midZ, Math.PI / 2);
    bandGeoms.push(b.band); lineGeoms.push(b.line);
  };
  wallSegment(X0, Math.PI / 2, Z0, LAB_Z0);
  wallSegment(X0, Math.PI / 2, LAB_Z1, Z1);
  wallSegment(X1, -Math.PI / 2, GATE_Z1, LAB_Z0);
  wallSegment(X1, -Math.PI / 2, LAB_Z1, Z1);
  root.add(merged(bandGeoms, dadoMaterial()), merged(lineGeoms, dadoLineMaterial()));

  // A clerestory band above the lab's lid, both long walls, so the hall's own ceiling never shows
  // a gap over the lab's span.
  const clerestoryY0 = LAB.h + 0.3, clerestoryH = H - clerestoryY0;
  for (const [x, ry] of [[X0, Math.PI / 2], [X1, -Math.PI / 2]] as [number, number][]) {
    const m = plane(LAB.d, clerestoryH, labWall(store, LAB.d, clerestoryH)); m.rotation.y = ry; m.position.set(x, clerestoryY0 + clerestoryH / 2, LAB.z);
  }

  // A dark steel ceiling the room's full length, four fixtures over the corridor outside the lab.
  const ceiling = plane(W, D, labSteel(0x1a222a)); ceiling.rotation.x = Math.PI / 2; ceiling.position.set(XC, H, ZC);
  const stripMat = new THREE.MeshStandardMaterial({ color: 0x0a0f14, emissive: 0xd9e8ee, emissiveIntensity: 2 });
  const strips: Spot[] = FIXTURE_Z.map((z) => [XC, H - 0.1, z]);
  root.add(instances(new THREE.BoxGeometry(3, 0.06, 0.18), stripMat, strips));

  // The glass lab itself, straddling the walked line, a door in its south and north faces at the
  // same x. Its long glass walls are the hall's own x0/x1 walls over the lab's z span.
  const doorLocalX = LAB.doorX - LAB.x;
  const lab = glassRoom(store, {
    w: LAB.w, d: LAB.d, h: LAB.h, sill: LAB.sill,
    doors: [
      { face: 'south', x: doorLocalX, w: LAB.doorW },
      { face: 'north', x: doorLocalX, w: LAB.doorW },
    ],
    litEvery: 1, panelIntensity: 0.9, floor: labFloor(store, LAB.w, LAB.d, LABS.panel),
  });
  lab.position.set(LAB.x, 0, LAB.z); root.add(lab);

  return { planes };
}
