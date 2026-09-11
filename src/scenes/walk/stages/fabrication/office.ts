import * as THREE from 'three';
import type { StageContext } from '../types';
import type { PointPlacement } from '../../rig';
import { stencilTexture } from '../../textures';
import { surface } from '../../materials';
import { instances, place, type Spot } from '../../merge';
import { LABS, labSteel } from '../../labs/materials';
import { papers, glassRoom } from '../../labs/props';
import { OFFICE } from './layout';

/**
 * The dispatch office: glass above a white sill on all four sides, a door in the front and back
 * face on the walked line, a lit ceiling grid, the three products on pedestals along the west
 * glass with their plates pinned beside, and a desk with its stool on its side.
 */
export function buildOffice(ctx: StageContext, root: THREE.Group): PointPlacement {
  const { store, anchors } = ctx;
  const { x: OX, z: OZ, w: W, d: D, h: H, sill: S, frontDoorX, backDoorX, doorW } = OFFICE;
  const hx = W / 2;

  // The bay floor runs under it, so the office floor is the same concrete lifted a centimetre and
  // painted lighter. Without a store the ceiling grid is flat paint: the office sits behind the
  // preloader, before the shared labs textures load.
  const floorMat = surface(store.texture('concrete_floor'), W, D, 4); floorMat.color.setHex(0xc9d4dc);
  const g = glassRoom(null, {
    w: W, d: D, h: H, sill: S,
    doors: [
      { face: 'north', x: frontDoorX - OX, w: doorW },
      { face: 'south', x: backDoorX - OX, w: doorW },
    ],
    sign: 'DISPATCH', litEvery: 2, panelIntensity: 0.9, floor: floorMat,
  });
  g.position.set(OX, 0, OZ); root.add(g);

  // Exhibits along the west glass, 3 m apart, facing the camera at the hold. The flagship sits in
  // the centre so its plate, which pins to the right of its anchor, lands in the gap beside it
  // rather than over a neighbour. Positive z is to the camera's left.
  const exhibits: [string, string, number][] = [['conch', 'conch.gg', 3.0], ['ezkey', 'ezkey.io', 0], ['gc-bridge', 'gc-bridge', -3.0]];
  const pedestals: Spot[] = [], tops: Spot[] = [];
  const ex = -hx + 0.9;
  for (const [key, label, dz] of exhibits) {
    pedestals.push([ex, 0.5, dz]); tops.push([ex, 1.02, dz]);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.5), new THREE.MeshStandardMaterial({ color: 0x05080b, emissive: 0xffffff, emissiveIntensity: 1.2, emissiveMap: stencilTexture(label, { width: 512, height: 180, color: '#CFE6EE', font: '600 96px Michroma, system-ui, sans-serif' }) }));
    g.add(place(screen, ex + 0.05, 1.45, dz, Math.PI / 2));
    // The plate hangs to the right of its anchor, so the anchor sits past the screen's right edge.
    anchors.set(key, new THREE.Vector3(OX + ex + 0.6, 1.7, OZ + dz - 0.9));
  }
  g.add(instances(new THREE.BoxGeometry(1.0, 1.0, 1.4), new THREE.MeshStandardMaterial({ color: 0x9aacb4, roughness: 0.5 }), pedestals));
  g.add(instances(new THREE.BoxGeometry(1.1, 0.05, 1.5), labSteel(0x46525a), tops));

  // The desk on the east side, its stool on its side, papers where they fell.
  const desk = store.model('desk'); desk.position.set(hx - 1.3, 0, -1.2); desk.rotation.y = Math.PI / 2; g.add(desk);
  const stool = store.model('stool'); stool.position.set(hx - 2.2, 0.28, -0.4); stool.rotation.set(Math.PI / 2, 0, 0.5); g.add(stool);
  g.add(papers([[hx - 2.6, 0, 0.3, 0.4], [hx - 2.0, 0, 0.9, 1.2], [hx - 3.1, 0, -0.2, 2.3], [-1.2, 0, 2.4, 0.8]]));

  return { kind: 'point', position: [OX, H - 0.4, OZ], color: LABS.cold, intensity: 6, distance: 12, decay: 1.8 };
}
