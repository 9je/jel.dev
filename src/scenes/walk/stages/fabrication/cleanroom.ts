import * as THREE from 'three';
import type { StageContext } from '../types';
import { stencilTexture } from '../../textures';
import { instances, place, type Spot } from '../../merge';
import { CUBE } from './layout';

/**
 * The clean room: a glazed box against the left wall, lit white inside, with one exhibit per
 * product. It is the one bright thing in a sodium hall and the thing the fabrication hold turns
 * back to look at. Clear tinted glass on every tier: transmission frosted it into a slab.
 */
export function buildCleanRoom({ anchors }: StageContext, root: THREE.Group): THREE.PointLight {
  const { x: CX, z: CZ, w: CW, h: CH, d: CD } = CUBE;
  const cube = new THREE.Group(); cube.position.set(CX, 0, CZ); root.add(cube);

  const inner = new THREE.Mesh(new THREE.BoxGeometry(CW - 0.3, CH - 0.2, CD - 0.3), new THREE.MeshStandardMaterial({ color: 0xc4d2d8, roughness: 0.9, emissive: 0xcfe6ee, emissiveIntensity: 0.04, side: THREE.BackSide }));
  cube.add(place(inner, 0, CH / 2, 0));
  // A lit ceiling panel does most of the glow. It is what blooms on the high tier and what keeps the
  // room reading as lit from across the hall on the low tier, where there is no bloom to help.
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(CW - 1.2, CD - 1.2), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe4f2f7, emissiveIntensity: 1.15 }));
  panel.rotation.x = Math.PI / 2; cube.add(place(panel, 0, CH - 0.12, 0));

  // The glazing bars first, so the glass has something to be glass between: four corner posts and a
  // rail along every top and bottom edge, in three draw calls.
  const frame = new THREE.MeshStandardMaterial({ color: 0x2b3740, metalness: 0.7, roughness: 0.35 });
  const hx = CW / 2, hz = CD / 2;
  cube.add(instances(new THREE.BoxGeometry(0.14, CH, 0.14), frame, [[-hx, CH / 2, -hz], [hx, CH / 2, -hz], [-hx, CH / 2, hz], [hx, CH / 2, hz]]));
  cube.add(instances(new THREE.BoxGeometry(CW, 0.12, 0.12), frame, [[0, CH, -hz], [0, CH, hz], [0, 0.06, -hz], [0, 0.06, hz]]));
  cube.add(instances(new THREE.BoxGeometry(0.12, 0.12, CD), frame, [[-hx, CH, 0], [hx, CH, 0], [-hx, 0.06, 0], [hx, 0.06, 0]]));
  // Mullions at thirds on the long faces, so the glazing reads as panes rather than one sheet.
  cube.add(instances(new THREE.BoxGeometry(0.08, CH, 0.08), frame, [[-hx / 3, CH / 2, -hz], [hx / 3, CH / 2, -hz], [-hx / 3, CH / 2, hz], [hx / 3, CH / 2, hz]]));

  // 2.2 m apart rather than 3: at the stop the three pedestals have to fit in the strip of frame to
  // the right of the pinned panel, and 3 m put the far one past the edge of a 960 px viewport.
  const exhibits: [string, string, number][] = [['gc-bridge', 'gc-bridge', -2.2], ['conch', 'conch.gg', 0], ['ezkey', 'ezkey.io', 2.2]];
  const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x9aacb4, roughness: 0.5 });
  const topMat = new THREE.MeshStandardMaterial({ color: 0x46525a, metalness: 0.7, roughness: 0.4 });
  const labelMat = new THREE.MeshStandardMaterial({ color: 0x101c22, emissive: 0x6ec1d6, emissiveIntensity: 0.5 });
  const pedestals: Spot[] = [], tops: Spot[] = [], labels: Spot[] = [];
  for (const [key, label, x] of exhibits) {
    pedestals.push([x, 0.5, 0]); tops.push([x, 1.02, 0]); labels.push([x, 1.4, -0.48, Math.PI]);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.6), new THREE.MeshStandardMaterial({
      color: 0x05080b, emissive: 0xffffff, emissiveIntensity: 1.2,
      emissiveMap: stencilTexture(label, { width: 512, height: 180, color: '#CFE6EE', font: '600 96px Michroma, system-ui, sans-serif' }),
    }));
    cube.add(place(screen, x, 1.4, -0.55, Math.PI));
    anchors.set(key, new THREE.Vector3(CX + x, 1.7, CZ - 1.5));
  }
  cube.add(instances(new THREE.BoxGeometry(1.6, 1.0, 1.0), pedestalMat, pedestals));
  cube.add(instances(new THREE.BoxGeometry(1.7, 0.05, 1.1), topMat, tops));
  cube.add(instances(new THREE.BoxGeometry(1.9, 0.9, 0.04), labelMat, labels));

  // Glass last, so it sorts over everything inside it. Reflective, barely tinted, no depth write.
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xcfe6ee, transparent: true, opacity: 0.16, roughness: 0.06, metalness: 0, envMapIntensity: 1.6, depthWrite: false });
  const pane = new THREE.Mesh(new THREE.BoxGeometry(CW, CH, CD), glass); pane.renderOrder = 2;
  cube.add(place(pane, 0, CH / 2, 0));

  const light = new THREE.PointLight(0xdff0f6, 5, 12, 1.8); light.position.set(CX, 3.4, CZ); root.add(light);
  return light;
}
