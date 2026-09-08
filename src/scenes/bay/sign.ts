import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { COLORS, HANGAR } from './constants';

export interface Sign { mesh: THREE.Mesh; edge: THREE.MeshStandardMaterial }

export async function loadSign(): Promise<Sign> {
  const font = await new FontLoader().loadAsync('/fonts/michroma.typeface.json');
  const geo = new TextGeometry('JEL LABS', { font, size: 1.4, depth: 0.18, curveSegments: 6, bevelEnabled: false });
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  geo.translate(-(bb.max.x - bb.min.x) / 2, 0, 0);
  const face = new THREE.MeshStandardMaterial({ color: 0x9fb3bf, metalness: 0.7, roughness: 0.35 });
  const edge = new THREE.MeshStandardMaterial({ color: 0x0b1117, emissive: COLORS.glassCyan, emissiveIntensity: 0 });
  const mesh = new THREE.Mesh(geo, [face, edge]);
  // right wall, facing the centre of the hangar; text reads toward +z, which is the viewer's right when facing +x
  mesh.position.set(HANGAR.width / 2 - 0.25, 5.5, -18);
  mesh.rotation.y = -Math.PI / 2;
  return { mesh, edge };
}
