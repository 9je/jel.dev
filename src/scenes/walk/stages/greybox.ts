import * as THREE from 'three';
import { STOPS, CONTROL_POINTS } from '../path';
import type { Stage, StageContext } from './types';

const WALL = 0x17222c, FLOOR = 0x1a2630;

function box(w: number, h: number, d: number, color: number, x: number, y: number, z: number, parent: THREE.Object3D) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
  m.position.set(x, y, z); parent.add(m); return m;
}

/** A corridor segment: floor, two walls, ceiling, between two points, given a width and height. */
function corridor(a: THREE.Vector3, b: THREE.Vector3, width: number, height: number, parent: THREE.Object3D) {
  const dir = b.clone().sub(a); const len = dir.length(); const mid = a.clone().add(b).multiplyScalar(0.5);
  const g = new THREE.Group(); g.position.set(mid.x, 0, mid.z); g.rotation.y = Math.atan2(dir.x, dir.z); parent.add(g);
  box(width, 0.1, len, FLOOR, 0, -0.05, 0, g);
  box(width, 0.1, len, WALL, 0, height, 0, g);
  box(0.2, height, len, WALL, -width / 2, height / 2, 0, g);
  box(0.2, height, len, WALL, width / 2, height / 2, 0, g);
  for (let z = -len / 2 + 3; z < len / 2; z += 6) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 0.4), new THREE.MeshStandardMaterial({ color: 0x0a0f14, emissive: 0xd9e8ee, emissiveIntensity: 1.5 }));
    l.position.set(0, height - 0.1, z); g.add(l);
  }
}

export function greybox({ scene }: StageContext): Stage {
  const root = new THREE.Group(); root.name = 'greybox'; scene.add(root);
  const p = CONTROL_POINTS.map((c) => new THREE.Vector3(c[0], 0, c[2]));
  corridor(p[0].clone().setZ(30), p[1].clone().setZ(22), 8, 4, root);      // booth
  corridor(p[1].clone().setZ(22), p[5].clone().setZ(-30), 40, 12, root);   // hangar
  corridor(p[6], p[9], 8, 5, root);                                          // recreation corridor
  corridor(p[9], p[10].clone().setX(-76), 14, 4.5, root);                    // lab
  corridor(p[11].clone().setZ(-30), p[13].clone().setZ(6), 8, 7, root);     // credentials hall
  corridor(p[13].clone().setZ(6), p[14].clone().setZ(24), 24, 9, root);     // containment bay
  corridor(p[15], p[16].clone().setX(-64), 8, 3.5, root);                    // office
  for (const s of STOPS) {
    const marker = new THREE.Mesh(new THREE.BoxGeometry(1, 2.5, 0.2), new THREE.MeshStandardMaterial({ color: 0x0b1117, emissive: new THREE.Color(s.light), emissiveIntensity: 1.2 }));
    marker.position.set(s.lookAt[0], 1.25, s.lookAt[2]); root.add(marker);
  }
  const hemi = new THREE.HemisphereLight(0x2a3b4a, 0x0e161e, 0.6); root.add(hemi);
  return {
    id: 'greybox', root,
    update() {},
    dispose() { root.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); } }); scene.remove(root); },
  };
}
