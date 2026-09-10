import * as THREE from 'three';
import type { StageContext } from '../types';
import type { PointPlacement } from '../../rig';
import { stencilTexture } from '../../textures';
import { surface } from '../../materials';
import { instances, merged, place, type Spot } from '../../merge';
import { labGlass, labSteel, ceilingGrid, LABS } from '../../labs/materials';
import { papers } from '../../labs/props';
import { OFFICE } from './layout';

/**
 * The dispatch office: glass above a white sill on all four sides, a door in the front and back
 * face on the walked line, a lit ceiling grid, the three products on pedestals along the west
 * glass with their plates pinned beside, and a desk with its stool on its side.
 */
export function buildOffice(ctx: StageContext, root: THREE.Group): PointPlacement {
  const { store, anchors } = ctx;
  const { x: OX, z: OZ, w: W, d: D, h: H, sill: S, frontDoorX, backDoorX, doorW } = OFFICE;
  const g = new THREE.Group(); g.position.set(OX, 0, OZ); root.add(g);
  const hx = W / 2, hz = D / 2;

  // Floor and ceiling. The bay floor runs under it, so the office floor is the same concrete
  // lifted a centimetre and painted lighter, with a lit grid overhead and a steel lid.
  const floorMat = surface(store.texture('concrete_floor'), W, D, 4); floorMat.color.setHex(0xc9d4dc);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.2, D - 0.2), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.01; g.add(floor);
  const { group: ceiling } = ceilingGrid(null, W, D, H, { tile: 1.2, litEvery: 2, intensity: 0.9 }); g.add(ceiling);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, 0.12, D + 0.2), labSteel(0x2b3740)); lid.position.y = H + 0.12; g.add(lid); // clear of the ceiling plane, or the two fight for the pixel

  // Sill: a white panel band round the room, split at the doors.
  const sillMat = new THREE.MeshStandardMaterial({ color: LABS.panel, roughness: 0.7 });
  const sills: THREE.BufferGeometry[] = [];
  const band = (len: number, x: number, z: number, ry: number) => { const b = new THREE.BoxGeometry(len, S, 0.12); b.rotateY(ry); b.translate(x, S / 2, z); sills.push(b); };
  band(D, -hx, 0, Math.PI / 2); band(D, hx, 0, Math.PI / 2);
  const doors: [number, number, number][] = [[hz, frontDoorX - OX, 0], [-hz, backDoorX - OX, Math.PI]];
  for (const [z, doorX] of doors) {
    const leftLen = doorX - doorW / 2 + hx, rightLen = hx - (doorX + doorW / 2);
    band(leftLen, -hx + leftLen / 2, z, 0); band(rightLen, hx - rightLen / 2, z, 0);
  }
  g.add(merged(sills, sillMat));

  // Glazing bars: corner posts, door posts, mullions, top and sill rails. Three draw calls.
  const steel = labSteel();
  const posts: Spot[] = [[-hx, H / 2, -hz], [hx, H / 2, -hz], [-hx, H / 2, hz], [hx, H / 2, hz]];
  for (const [z, doorX] of doors) posts.push([doorX - doorW / 2, H / 2, z], [doorX + doorW / 2, H / 2, z]);
  // Mullions skip the door span on each face, so nothing stands in a doorway.
  const inDoor = (x: number, doorX: number) => Math.abs(x - doorX) < doorW / 2 + 0.05;
  for (let x = -hx + 2.5; x < hx - 0.5; x += 2.5) for (const [z, doorX] of doors) if (!inDoor(x, doorX)) posts.push([x, H / 2, z]);
  for (let z = -hz + 2.6; z < hz - 0.5; z += 2.6) posts.push([-hx, H / 2, z], [hx, H / 2, z]);
  g.add(instances(new THREE.BoxGeometry(0.1, H, 0.1), steel, posts));
  g.add(instances(new THREE.BoxGeometry(W, 0.1, 0.1), steel, [[0, H, -hz], [0, H, hz]]));
  // The sill rail on the door faces stops at the openings, like the sill band under it.
  const rails: THREE.BufferGeometry[] = [];
  for (const [z, doorX] of doors) {
    const leftLen = doorX - doorW / 2 + hx, rightLen = hx - (doorX + doorW / 2);
    for (const [len, x] of [[leftLen, -hx + leftLen / 2], [rightLen, hx - rightLen / 2]] as [number, number][]) { const r = new THREE.BoxGeometry(len, 0.1, 0.1); r.translate(x, S, z); rails.push(r); }
  }
  g.add(merged(rails, steel));
  g.add(instances(new THREE.BoxGeometry(0.1, 0.1, D), steel, [[-hx, H, 0], [hx, H, 0], [-hx, S, 0], [hx, S, 0]]));

  // Glass: panes above the sill, the door faces split around the opening, a named panel over each
  // door. Rendered last so it sorts over everything inside.
  const panes: THREE.BufferGeometry[] = [];
  const pane = (w: number, x: number, z: number, ry: number) => { const p = new THREE.PlaneGeometry(w, H - S); p.rotateY(ry); p.translate(x, S + (H - S) / 2, z); panes.push(p); };
  pane(D, -hx, 0, Math.PI / 2); pane(D, hx, 0, -Math.PI / 2);
  for (const [z, doorX, ry] of doors) {
    const leftLen = doorX - doorW / 2 + hx, rightLen = hx - (doorX + doorW / 2);
    pane(leftLen, -hx + leftLen / 2, z, ry); pane(rightLen, hx - rightLen / 2, z, ry);
    const out = z > 0 ? 0.01 : -0.01;
    const head = new THREE.Mesh(new THREE.PlaneGeometry(doorW, 0.5), new THREE.MeshStandardMaterial({ color: LABS.panel, roughness: 0.7 }));
    head.position.set(doorX, H - 0.25, z + out); head.rotation.y = ry; g.add(head);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.32), new THREE.MeshBasicMaterial({ map: stencilTexture('DISPATCH', { width: 512, height: 96, color: '#2455A4', font: '600 60px Michroma, system-ui, sans-serif', alpha: 0.9 }), transparent: true, depthWrite: false }));
    sign.position.set(doorX, H - 0.25, z + out * 3); sign.rotation.y = ry; g.add(sign);
  }
  const glass = labGlass(); glass.side = THREE.DoubleSide;
  const glassMesh = merged(panes, glass); glassMesh.renderOrder = 2; g.add(glassMesh);

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
