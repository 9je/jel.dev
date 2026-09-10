import * as THREE from 'three';
import type { StageContext } from '../types';
import { prepareAO } from '../../materials';
import { merged, instances, type Spot } from '../../merge';
import { labFloor, labWall, labSteel, dadoBands, dadoMaterial, dadoLineMaterial } from '../../labs/materials';
import { cableTray } from '../../labs/props';
import { X0, X1, Z0, Z1, H, W, D, XC, ZC, RACK_Z } from './layout';

export interface Shell { planes: Set<THREE.Object3D> }

// The end openings, shared by both x -58 and x -76: 8 m wide on the walked line, matching the
// corridor width either side so the hold's sightline runs clean through both ends of the hall.
const OPEN_Z0 = -35, OPEN_Z1 = -27;

export function buildShell({ store }: StageContext, root: THREE.Group): Shell {
  const planes = new Set<THREE.Object3D>();
  const plane = (w: number, h: number, mat: THREE.Material) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); prepareAO(m.geometry); m.receiveShadow = true; planes.add(m); root.add(m); return m; };
  const floor = plane(W, D, labFloor(store, W, D)); floor.rotation.x = -Math.PI / 2; floor.position.set(XC, 0, ZC);

  // The long walls, south at Z0 and north at Z1, full width, as Recreation's.
  for (const [z, ry] of [[Z0, 0], [Z1, Math.PI]] as [number, number][]) { const m = plane(W, H, labWall(store, W, H)); m.rotation.y = ry; m.position.set(XC, H / 2, z); }

  // The end walls at X0 (west, toward Credentials) and X1 (east, toward the break room), each built
  // as two pieces flanking the opening rather than one wall with a hole cut in it.
  const endPiece = OPEN_Z0 - Z0;
  for (const [x, ry] of [[X0, Math.PI / 2], [X1, -Math.PI / 2]] as [number, number][]) {
    for (const zc of [(Z0 + OPEN_Z0) / 2, (OPEN_Z1 + Z1) / 2]) {
      const m = plane(endPiece, H, labWall(store, endPiece, H)); m.rotation.y = ry; m.position.set(x, H / 2, zc);
    }
  }

  const bands = [dadoBands(W, XC, Z0 + 0.02, 0), dadoBands(W, XC, Z1 - 0.02, 0)];
  root.add(merged(bands.map((b) => b.band), dadoMaterial()), merged(bands.map((b) => b.line), dadoLineMaterial()));

  // No suspended ceiling grid in this room: a dark steel plane, two rows of emissive fluorescent
  // strips down the aisle, and a cable tray over each rack row.
  const ceiling = plane(W, D, labSteel(0x1a222a)); ceiling.rotation.x = Math.PI / 2; ceiling.position.set(XC, H, ZC);

  const stripMat = new THREE.MeshStandardMaterial({ color: 0x0a0f14, emissive: 0xd9e8ee, emissiveIntensity: 2 });
  const strips: Spot[] = [];
  for (const z of [-34.5, -27.5]) for (let x = X0 + 2; x <= X1 - 2; x += 3) strips.push([x, H - 0.1, z]);
  root.add(instances(new THREE.BoxGeometry(2.2, 0.06, 0.18), stripMat, strips));

  for (const z of [RACK_Z.south, RACK_Z.north]) { const tray = cableTray(W - 2); tray.position.set(XC, H - 0.4, z); root.add(tray); }

  return { planes };
}
