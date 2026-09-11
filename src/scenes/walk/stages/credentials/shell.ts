import * as THREE from 'three';
import type { StageContext } from '../types';
import { prepareAO } from '../../materials';
import { merged, instances, type Spot } from '../../merge';
import { labFloor, labWall, dadoBands, dadoMaterial, dadoLineMaterial, labSteel, LABS } from '../../labs/materials';
import { glassRoom } from '../../labs/props';
import { X0, X1, Z1, H, W, D, XC, ZC, LAB, LAB_Z1 } from './layout';

export interface Shell { planes: Set<THREE.Object3D> }

/** Four fluorescent fixtures down the corridor outside the lab. The lab has its own lit grid. */
const FIXTURE_Z = [-12, -6, 0, 4];

export function buildShell({ store }: StageContext, root: THREE.Group): Shell {
  const planes = new Set<THREE.Object3D>();
  const plane = (w: number, h: number, mat: THREE.Material) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); prepareAO(m.geometry); m.receiveShadow = true; planes.add(m); root.add(m); return m; };
  const floor = plane(W, D, labFloor(store, W, D, 0xb7c4cb)); floor.rotation.x = -Math.PI / 2; floor.position.set(XC, 0, ZC);

  // The long walls return to dim white panel from the lab's north face to the hall's own far end,
  // where the tape line marks the dressed room's edge. South of the lab the hall is left open: the
  // path swings in wide from the operations side there and never nears a wall.
  const northLen = Z1 - LAB_Z1, northZ = LAB_Z1 + northLen / 2;
  for (const [x, ry] of [[X0, Math.PI / 2], [X1, -Math.PI / 2]] as [number, number][]) {
    const m = plane(northLen, H, labWall(store, northLen, H)); m.rotation.y = ry; m.position.set(x, H / 2, northZ);
  }
  const bandRy = Math.PI / 2;
  const bands = [dadoBands(northLen, X0 + 0.02, northZ, bandRy), dadoBands(northLen, X1 - 0.02, northZ, bandRy)];
  root.add(merged(bands.map((b) => b.band), dadoMaterial()), merged(bands.map((b) => b.line), dadoLineMaterial()));

  // A dark steel ceiling the room's full length, four fixtures over the corridor outside the lab.
  const ceiling = plane(W, D, labSteel(0x1a222a)); ceiling.rotation.x = Math.PI / 2; ceiling.position.set(XC, H, ZC);
  const stripMat = new THREE.MeshStandardMaterial({ color: 0x0a0f14, emissive: 0xd9e8ee, emissiveIntensity: 2 });
  const strips: Spot[] = FIXTURE_Z.map((z) => [XC, H - 0.1, z]);
  root.add(instances(new THREE.BoxGeometry(3, 0.06, 0.18), stripMat, strips));

  // The glass lab itself, straddling the walked line, a door in its south and north faces at the
  // same x. Its long glass walls are the hall's own x0/x1 walls over the lab's z span: the white
  // panel above only picks back up past its north face.
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
