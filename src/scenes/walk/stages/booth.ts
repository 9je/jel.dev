import * as THREE from 'three';
import type { Stage, StageContext, StageDef } from './types';
import { surface, prepareAO, disposeObject } from '../materials';
import { merged } from '../merge';
import { LABS } from '../labs/materials';
import { buildDoor } from '../door';
import { doorOpenAmount } from '../path';
import type { Placement, PointPlacement } from '../rig';

// The booth is the room the walk opens in. The camera stands at z 26 on the path and looks at the
// shutter at z 22, so only the front half of the room is ever in frame and everything that has to
// read sits inside a 3 m cone in front of the door.
const W = 8, D = 8, H = 4.4, Z0 = 22, Z1 = 30;
const DOOR_W = 6, DOOR_H = 3.6;

/** The room's placements. Pure, and exported, so the lighting can be checked against the rig's room
 *  budget without standing a scene up. The door's standby lamp is the door's own placement, passed
 *  in rather than declared here, because its colour follows the shutter. */
export function boothLights(lamp: PointPlacement): Placement[] {
  return [
    // Cool ceiling strip washing down the shutter, warm pool at the desk.
    { kind: 'spot', position: [0, H - 0.3, 25.4], target: [0, 0.1, 23.3], color: 0x8fd0e0, intensity: 16, distance: 12, angle: Math.PI / 4.2, penumbra: 0.9, decay: 1.7, shadow: true },
    { kind: 'point', position: [1.18, 1, 23.68], color: 0xffc98a, intensity: 2.6, distance: 3.2, decay: 2 },
    lamp,
  ];
}

function build({ scene, store, anchors, tier, typeface }: StageContext): Stage {
  const root = new THREE.Group(); root.name = 'booth'; scene.add(root);
  const plate = store.texture('metal_plate'), rubber = store.texture('rubber_floor');
  const zc = (Z0 + Z1) / 2;
  const shell = (m: THREE.Mesh) => { prepareAO(m.geometry); m.receiveShadow = true; root.add(m); return m; };

  const floor = shell(new THREE.Mesh(new THREE.PlaneGeometry(W, D), surface(rubber, W, D, 1)));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, zc);
  const ceil = shell(new THREE.Mesh(new THREE.PlaneGeometry(W, D), surface(plate, W, D, 2)));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, zc);
  const wallMat = surface(plate, D, H, 2);
  for (const x of [-W / 2, W / 2]) { const w = shell(new THREE.Mesh(new THREE.PlaneGeometry(D, H), wallMat)); w.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; w.position.set(x, H / 2, zc); }
  const back = shell(new THREE.Mesh(new THREE.PlaneGeometry(W, H), surface(plate, W, H, 2))); back.rotation.y = Math.PI; back.position.set(0, H / 2, Z1);
  // Front wall around the door opening: a jamb each side and a header above it.
  const frontMat = surface(plate, W, H, 2);
  const jamb = (W - DOOR_W) / 2;
  for (const x of [-(DOOR_W + jamb) / 2, (DOOR_W + jamb) / 2]) { const m = shell(new THREE.Mesh(new THREE.PlaneGeometry(jamb, H), frontMat)); m.position.set(x, H / 2, Z0 + 0.01); }
  const header = shell(new THREE.Mesh(new THREE.PlaneGeometry(DOOR_W, H - DOOR_H), frontMat)); header.position.set(0, DOOR_H + (H - DOOR_H) / 2, Z0 + 0.01);

  const door = buildDoor(store, { width: DOOR_W, height: DOOR_H, position: [0, 0, Z0], typeface }); root.add(door.root);

  // Props sit in the right third of frame, clear of the copy that overlays the left half.
  const desk = store.model('desk'); desk.position.set(1.55, 0, 23.9); desk.rotation.y = -Math.PI / 2; root.add(desk);
  const stool = store.model('stool'); stool.position.set(0.62, 0, 23.7); root.add(stool);
  const lamp = store.model('desk_lamp'); lamp.position.set(1.5, 0.76, 23.35); lamp.rotation.y = 2.1; root.add(lamp);
  // The lamp is a warm prop beside the light, not a second light. Left on the shared PBR setup its
  // chrome arm mirrored the warm point back at the camera and the whole armature read as lit from
  // inside. Dulling the reflection and holding the roughness up puts the glow back in the shade.
  lamp.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (m instanceof THREE.MeshStandardMaterial) { m.envMapIntensity = 0.25; m.roughness = Math.max(m.roughness, 0.5); m.metalness = Math.min(m.metalness, 0.4); }
    }
  });
  // Bolted to the side wall behind the camera's shoulder. On the front wall it stood in the door's
  // own frame, clipping the jamb post and the hazard rail with it.
  const box = store.model('utility_box'); box.position.set(W / 2 - 0.06, 1.75, 24.6); box.rotation.y = -Math.PI / 2; root.add(box);
  // Painted hexes on the floor between the door and the desk, the one piece of colour down there.
  // Spaced so no two overlap: coplanar at the same height, an overlap is a z fight, not a patch.
  const hexes = ([[-1.8, 23], [-0.3, 24.05], [-1.9, 25.1]] as [number, number][])
    .map(([x, z]) => new THREE.CylinderGeometry(0.9, 0.9, 0.01, 6).translate(x, 0.008, z));
  root.add(merged(hexes, new THREE.MeshStandardMaterial({ color: LABS.dado, roughness: 0.9, transparent: true, opacity: 0.5 })));
  root.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = tier === 'high'; o.receiveShadow = true; } });

  // Cool ceiling strip washing down the shutter, warm pool at the desk.
  const strip = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.07, 0.3), new THREE.MeshStandardMaterial({ color: 0x0a0f14, emissive: 0xcfe6ee, emissiveIntensity: 2.2 })); strip.position.set(0, H - 0.05, 25.2); root.add(strip);

  anchors.set('booth', new THREE.Vector3(-2.5, 1.6, 23));

  return { id: 'booth', root, lights: boothLights(door.lamp), update(t) { door.update(doorOpenAmount(t)); }, dispose() { door.dispose(); disposeObject(root); scene.remove(root); } };
}

export const BOOTH_DEF: StageDef = { id: 'booth', stop: 'booth', groups: ['booth'], near: ['booth', 'fabrication'], replaces: 'booth', build };
