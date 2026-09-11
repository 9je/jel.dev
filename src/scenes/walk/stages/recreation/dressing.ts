import * as THREE from 'three';
import type { Hotspot, StageContext } from '../types';
import { grounded, once, repeat, place } from '../../merge';
import { cableTray, papers } from '../../labs/props';
import { arcadeCabinet, crtBracket, fridge, kitchenette, locker, poster, splashback, vendingMachine } from '../../labs/furniture';
import { screenFace } from '../../labs/textures';
import { Z0, Z1, CABINETS, CABINET_RY, CABINET_Z, ACCENT } from './layout';

export interface Dressing { hotspots: Hotspot[]; header: THREE.MeshStandardMaterial }

/**
 * The break room, dressed as one continuous run down the south wall: fridge, counter, the lit
 * drinks machine, then the arcade row in the corner. The hold reads that run left to right as
 * kitchen and then amusements, which is what makes the room a break room in the first second
 * rather than a corridor with furniture in it. The north wall is deliberately quiet: tables against
 * the wall, a sofa, a television on a bracket, two notices.
 *
 * Nothing stands within 2.6 m of the walked line at z -31. The room is 8 m deep, so that leaves
 * 1.4 m of usable depth against each wall, which is why the tables are pushed back against the
 * north wall with their chairs at the ends rather than standing out in the middle of the floor.
 */
export async function buildDressing(ctx: StageContext, root: THREE.Group): Promise<Dressing> {
  const { store, anchors, pace } = ctx;
  const prop = (key: string) => grounded(store.model(key));
  const add = async (o: THREE.Object3D) => { root.add(o); await pace(); };

  // A conduit run the length of the served wall, a half metre under the ceiling. The wall above the
  // cupboards is the one large blank in the frame, and a service tray is what a building of this
  // kind puts there: a horizontal line that ties the kitchen and the arcade row into one wall.
  await add(place(cableTray(12), -30, 2.72, Z0 + 0.28));

  // ---- South wall, east to west: the kitchen ----------------------------------------------------
  await add(place(fridge(), -26.05, 0, Z0 + 0.37));
  await add(place(kitchenette(3.2), -28.0, 0, Z0 + 0.33));
  await add(place(splashback(3.2, 0.62), -28.0, 1.19, Z0 + 0.05));
  await add(once(prop('microwave'), -27.2, 0.905, Z0 + 0.33, 0.15));
  await add(once(prop('kettle'), -29.4, 0.905, Z0 + 0.28, -0.4));
  await add(once(prop('tea_set'), -29.0, 0.905, Z0 + 0.24, 0.9));
  await add(place(poster('WASH YOUR HANDS', 0.44, 0.62, 5), -29.3, 1.6, Z0 + 0.06));
  // The clock hangs over the counter, not on the far wall: it is the one thing that fills the bare
  // metre of wall between the cupboards and the ceiling on the side of the frame the copy leaves.
  await add(once(prop('wall_clock'), -26.75, 2.3, Z0 + 0.07));

  // ---- South wall, west end: the one bold thing in the room -------------------------------------
  // The lit machine stands at the head of the row, and the row runs into the corner. Each cabinet is
  // turned a fifth of a radian out of the wall: square to it, the hold saw four dark flanks and
  // Jordan's note was "idk what any of these things are".
  const machine = vendingMachine({ accent: ACCENT, lit: true, seed: 11 });
  const header = machine.getObjectByName('header') as THREE.Mesh;
  const litHeader = header.material as THREE.MeshStandardMaterial;
  await add(place(machine, -31.4, 0, Z0 + 0.42));
  // Its dark twin stands beside it, between the lit machine and the counter. Two machines side by
  // side, one out, is the whole abandonment beat in one object, and the dead one is the piece of
  // wall the flagship plate hangs over at the hold.
  await add(place(vendingMachine({ accent: ACCENT, lit: false, seed: 5 }), -30.35, 0, Z0 + 0.42));

  const hotspots: Hotspot[] = [];
  for (const [key, title, x, accent] of CABINETS) {
    const cabinet = place(arcadeCabinet({ title, accent, seed: x * -7 }), x, 0, CABINET_Z, CABINET_RY);
    await add(cabinet);
    hotspots.push({ id: key, kind: 'project', label: title, object: cabinet, stop: 'recreation' });
    if (key === 'torn-bet') anchors.set('torn-bet', new THREE.Vector3(-30.35, 2.2, Z0 + 0.6));
  }
  // The copy panel hangs on the dead machine beside the row, on the right of the frame, so it never
  // covers the four cabinets it is describing.
  anchors.set('recreation', new THREE.Vector3(-27.4, 2.0, -33.6));

  // ---- North wall: the quiet side ---------------------------------------------------------------
  // The television is a status board, not a project: no hotspot. Its face is measured off the model
  // rather than guessed, and hung 5 mm proud of the front of its own bounding box.
  const tv = prop('tv');
  const box = new THREE.Box3().setFromObject(tv);
  const size = box.getSize(new THREE.Vector3());
  const face = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 0.76, size.y * 0.66), new THREE.MeshStandardMaterial({
    color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1.05,
    emissiveMap: screenFace(['torn.bet  operational', 'Kayou  1,500 members', 'faction.tools  in flight'], ACCENT, 512, 360),
  }));
  face.position.set(0, size.y * 0.54, size.z / 2 + 0.005); tv.add(face);
  await add(place(crtBracket(tv, size.x * 0.92), -29.6, 2.05, Z1 - 0.02, Math.PI));

  await add(once(prop('table'), -27.2, 0, Z1 - 0.55, Math.PI));
  await add(once(prop('table'), -32.4, 0, Z1 - 0.55, Math.PI + 0.06));
  await add(repeat(prop('chair'), [[-28.5, 0, Z1 - 0.6, -Math.PI / 2], [-25.9, 0, Z1 - 0.5, Math.PI / 2 + 0.2], [-33.7, 0, Z1 - 0.6, -Math.PI / 2 - 0.15]]));
  const fallen = once(prop('chair'), -31.1, 0.29, Z1 - 0.85, 1.2); fallen.rotation.z = Math.PI / 2; await add(fallen);
  await add(place(poster('SAFETY FIRST !', 0.6, 0.85, 3), -33.4, 1.85, Z1 - 0.04, Math.PI));
  await add(once(prop('sofa'), -34.6, 0, Z1 - 0.62, Math.PI + 0.05));
  await add(once(prop('bin'), -30.4, 0, Z1 - 0.5));
  await add(once(prop('trashbag'), -30.95, 0, Z1 - 0.62, 0.6));
  // The plant died with the building. Tinting the model's own materials is enough: it is the only
  // green in the room, and green reads as alive.
  const plant = once(prop('plant'), -35.5, 0, Z1 - 0.5, 0.4);
  plant.traverse((o) => { if (o instanceof THREE.Mesh) { const m = (o.material as THREE.MeshStandardMaterial).clone(); m.color.setHex(0x6b6a55); o.material = m; } });
  await add(plant);

  // ---- The service passage: lockers, a noticeboard and a sofa somebody dragged out there ---------
  await add(place(locker(6), -39.5, 0, Z0 + 0.3));
  await add(place(locker(4), -44.5, 0, Z0 + 0.3));
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.95, 0.05), new THREE.MeshStandardMaterial({ color: 0x2f3a42, roughness: 0.8 }));
  board.position.set(-47.5, 1.7, Z0 + 0.03); await add(board);
  await add(place(poster('NOTICE', 1.0, 0.72, 7), -47.5, 1.72, Z0 + 0.07));
  await add(once(prop('sofa'), -52, 0, Z0 + 0.62, 0.1));
  await add(once(prop('trashbag'), -41.6, 0, Z1 - 0.6, 2.1));
  await add(papers([[-33.9, 0, -33.4, 0.3], [-30.6, 0, -28.4, 1.6], [-46.8, 0, -33.9, 2.1], [-51.2, 0, -33.6, 0.9]]));

  return { hotspots, header: litHeader };
}
