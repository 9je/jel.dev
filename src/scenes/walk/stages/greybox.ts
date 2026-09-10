import * as THREE from 'three';
import { STOPS, CONTROL_POINTS, cameraAt, type StopId } from '../path';
import { disposeObject } from '../materials';
import type { GreyboxSpace, Stage, StageContext } from './types';

const WALL = 0x3a4a58, FLOOR = 0x2c3944;
/** Floor patches at the corners the spline turns through, so the greybox reads past the corridor width. */
const CORNERS: [number, number][] = [[-12, -30], [-77.5, -30.5], [-77, 25.5]];
/** A dressed stage hides its greybox space, so the greybox marker standing in for that stop goes with it. */
const MARKER_SPACE: Partial<Record<StopId, GreyboxSpace>> = { booth: 'booth', fabrication: 'hangar' };
/** Which stop each greybox space stands in for. Only the spaces around the camera are left visible:
 *  an invisible group is skipped whole by `projectObject`, which keeps the far corridors out of the
 *  draw list. Spaces carry geometry only. The scene's light count has to be the same at every stop
 *  (see `tests/unit/greybox.test.ts`), or every material recompiles at the first stop transition. */
const SPACE_STOP: Record<GreyboxSpace, StopId> = {
  booth: 'booth', hangar: 'fabrication', corridor: 'recreation', lab: 'operations',
  hall: 'credentials', bay: 'containment', office: 'file',
};

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
  // Emissive strips only, no point lights. A greybox space is switched off when the camera is far
  // from it, and three rebuilds every lit material's program the moment the count of visible lights
  // changes, so a light inside a toggled space is a compile storm on the first walk into it. The
  // rig's ambient fill is what lights these placeholders.
  for (let z = -len / 2 + 3; z < len / 2; z += 6) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 0.4), new THREE.MeshStandardMaterial({ color: 0x0a0f14, emissive: 0xd9e8ee, emissiveIntensity: 1.5 }));
    l.position.set(0, height - 0.1, z); g.add(l);
  }
}

export function greybox({ scene }: StageContext): Stage & { hide(space: GreyboxSpace): void; setNear(near: Set<StopId>): void } {
  const root = new THREE.Group(); root.name = 'greybox'; scene.add(root);
  const p = CONTROL_POINTS.map((c) => new THREE.Vector3(c[0], 0, c[2]));

  const spaces = {} as Record<GreyboxSpace, THREE.Group>;
  const space = (id: GreyboxSpace) => { const g = new THREE.Group(); g.name = `greybox-${id}`; root.add(g); spaces[id] = g; return g; };
  corridor(p[0].clone().setZ(30), p[1].clone().setZ(22), 8, 4, space('booth'));
  corridor(p[1].clone().setZ(22), p[5].clone().setZ(-30), 40, 12, space('hangar'));
  // The corridor starts at the hall's outer wall, not at the spline's turn inside it, so its own
  // walls never poke into the fabrication floor at the exit gap.
  corridor(p[6].clone().setX(-20), p[9], 8, 5, space('corridor'));
  corridor(p[9], p[10].clone().setX(-76), 14, 4.5, space('lab'));
  corridor(p[11].clone().setZ(-30), p[13].clone().setZ(6), 8, 7, space('hall'));
  corridor(p[13].clone().setZ(6), p[14].clone().setZ(24), 24, 9, space('bay'));
  corridor(p[15], p[16].clone().setX(-64), 8, 3.5, space('office'));

  const markers = new THREE.Group(); markers.name = 'greybox-markers'; root.add(markers);
  const markerFor = {} as Partial<Record<GreyboxSpace, THREE.Object3D[]>>;
  for (const s of STOPS) {
    const marker = new THREE.Mesh(new THREE.BoxGeometry(1, 2.5, 0.2), new THREE.MeshStandardMaterial({ color: 0x0b1117, emissive: new THREE.Color(s.light), emissiveIntensity: 1.2 }));
    marker.position.set(s.lookAt[0], 1.25, s.lookAt[2]);
    const cam = cameraAt(s.t);
    const dir = cam.target.clone().sub(cam.position);
    marker.rotation.y = Math.atan2(dir.x, dir.z);
    markers.add(marker);
    const owner = MARKER_SPACE[s.id];
    if (owner) (markerFor[owner] ??= []).push(marker);
  }

  // The scene's rig owns the ambient fill now: a fixed light count is what keeps every material's
  // program compiled once, and a hemisphere here would move the count when the greybox is disposed.
  for (const [x, z] of CORNERS) {
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ color: FLOOR, roughness: 0.9 }));
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(x, 0, z);
    root.add(patch);
  }
  // A space replaced by a dressed stage is gone for good. A space that is simply far away is only
  // switched off, and comes back when the camera does.
  const replaced = new Set<GreyboxSpace>();
  let near = new Set<StopId>(Object.values(SPACE_STOP));
  const apply = () => {
    for (const id of Object.keys(spaces) as GreyboxSpace[]) {
      const on = !replaced.has(id) && near.has(SPACE_STOP[id]);
      spaces[id].visible = on;
      // The marker stands in for the stop inside that space, so it goes dark with it: replaced for
      // good once a stage is dressed, and simply off while the space is out of range.
      for (const m of markerFor[id] ?? []) m.visible = on;
    }
  };
  return {
    id: 'greybox', root,
    hide(id) { replaced.add(id); apply(); },
    setNear(next) { near = next; apply(); },
    update() {},
    dispose() { disposeObject(root); scene.remove(root); },
  };
}
