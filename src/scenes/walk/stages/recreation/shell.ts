import * as THREE from 'three';
import type { StageContext } from '../types';
import { prepareAO } from '../../materials';
import { merged } from '../../merge';
import { labFloor, labWall, dadoBands, dadoMaterial, dadoLineMaterial, ceilingGrid } from '../../labs/materials';
import { X0, X1, Z0, Z1, H, W, D, XC, ZC } from './layout';

export interface Shell { planes: Set<THREE.Object3D>; flicker: THREE.InstancedMesh }

export function buildShell({ store }: StageContext, root: THREE.Group): Shell {
  const planes = new Set<THREE.Object3D>();
  const plane = (w: number, h: number, mat: THREE.Material) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); prepareAO(m.geometry); m.receiveShadow = true; planes.add(m); root.add(m); return m; };
  const floor = plane(W, D, labFloor(store, W, D)); floor.rotation.x = -Math.PI / 2; floor.position.set(XC, 0, ZC);
  for (const [z, ry] of [[Z0, 0], [Z1, Math.PI]] as [number, number][]) { const m = plane(W, H, labWall(store, W, H)); m.rotation.y = ry; m.position.set(XC, H / 2, z); }
  const bands = [dadoBands(W, XC, Z0 + 0.02, 0), dadoBands(W, XC, Z1 - 0.02, 0)];
  root.add(merged(bands.map((b) => b.band), dadoMaterial()), merged(bands.map((b) => b.line), dadoLineMaterial()));
  const { group, panels } = ceilingGrid(store, W, D, H, { tile: 1.2, litEvery: 3, intensity: 1.3 });
  group.position.set(XC, 0, ZC); root.add(group);
  return { planes, flicker: panels };
}
