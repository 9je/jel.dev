import * as THREE from 'three';
import type { Hotspot, StageContext } from '../types';
import { grounded, once, repeat, place } from '../../merge';
import { cableTray, papers } from '../../labs/props';
import { arcadeCabinet, crtBracket, fridge, kitchenette, locker, poster, splashback, vendingMachine } from '../../labs/furniture';
import { screenFace } from '../../labs/textures';
import { Z0, Z1, CABINETS, CABINET_RY, CABINET_Z, ACCENT, HALL_FACE } from './layout';

export interface Dressing { hotspots: Hotspot[]; header: THREE.MeshStandardMaterial }

/**
 * The break room, in two halves of one room. The east half is the served end: fridge, counter, the
 * two drinks machines, then the arcade row in the corner, all in one run down the south wall, which
 * the hold reads left to right as amusements and then kitchen. The west half is the lounge: lockers,
 * two sofas facing a television across the room, a table with the tea things, a table and chairs and
 * the noticeboard. Neither half is a fall-off from the other, which was the note on the first cut of
 * this room.
 *
 * Nothing stands within 2.6 m of the walked line at z -31. The room is 8 m deep, so that leaves
 * 1.4 m of usable depth against each wall, which is why the tables are pushed back against the
 * walls with their chairs at the ends rather than standing out in the middle of the floor.
 */
export async function buildDressing(ctx: StageContext, root: THREE.Group): Promise<Dressing> {
  const { store, anchors, pace } = ctx;
  const prop = (key: string) => grounded(store.model(key));
  const add = async (o: THREE.Object3D) => { root.add(o); await pace(); };

  // A conduit run the length of the served wall, a half metre under the ceiling. The wall above the
  // cupboards is the one large blank in the frame, and a service tray is what a building of this
  // kind puts there: a horizontal line that ties the kitchen and the arcade row into one wall.
  await add(place(cableTray(30), -39, 2.72, Z0 + 0.28));

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
  await add(place(statusBoard(prop('tv')), -29.6, 2.05, Z1 - 0.02, Math.PI));

  await add(once(prop('table'), -27.2, 0, Z1 - 0.55, Math.PI));
  await add(once(prop('table'), -32.4, 0, Z1 - 0.55, Math.PI + 0.06));
  await add(repeat(prop('chair'), [[-28.5, 0, Z1 - 0.6, -Math.PI / 2], [-25.9, 0, Z1 - 0.5, Math.PI / 2 + 0.2], [-33.7, 0, Z1 - 0.6, -Math.PI / 2 - 0.15]]));
  const fallen = once(prop('chair'), -31.1, 0.29, Z1 - 0.85, 1.2); fallen.rotation.z = Math.PI / 2; await add(fallen);
  await add(place(poster('SAFETY FIRST !', 0.6, 0.85, 3), -33.4, 1.85, Z1 - 0.04, Math.PI));
  await add(once(prop('sofa'), -34.6, 0, Z1 - 0.62, Math.PI + 0.05));
  await add(once(prop('bin'), -30.4, 0, Z1 - 0.5));
  await add(once(prop('trashbag'), -30.95, 0, Z1 - 0.62, 0.6));
  await add(deadPlant(once(prop('plant'), -35.5, 0, Z1 - 0.5, 0.4)));

  // ---- The west half: the lounge -----------------------------------------------------------------
  // South wall: the two locker banks with a notice between them, then the seating.
  await add(place(locker(6), -39.5, 0, Z0 + 0.3));
  await add(place(poster('STAFF ONLY', 0.5, 0.7, 9), -43.0, 1.7, Z0 + 0.05));
  await add(place(locker(4), -46.3, 0, Z0 + 0.3));
  await add(once(prop('sofa'), -48.4, 0, Z0 + 0.55, 0.05));
  await add(once(prop('sofa'), -50.5, 0, Z0 + 0.55, -0.05));
  // The low table stands beside the sofas rather than in front of them: 2.6 m of clearance either
  // side of the walk leaves 1.4 m of depth against the wall, and a sofa and a coffee table in front
  // of it is 2 m. Along the wall it is the same three pieces and it keeps the gangway.
  const low = prop('table');
  const topY = new THREE.Box3().setFromObject(low).max.y;
  await add(once(low, -52.9, 0, Z0 + 0.55, 0.08));
  await add(once(prop('tea_set'), -52.9, topY, Z0 + 0.5, 1.4));

  // North wall, east to west: the notices, the bin, a bench, the board, the television the sofas
  // face across the room, and the table people ate at.
  await add(place(poster('NO SMOKING', 0.5, 0.7, 11), -38.5, 1.85, Z1 - 0.04, Math.PI));
  await add(once(prop('bin'), -40.5, 0, Z1 - 0.5));
  await add(once(prop('trashbag'), -41.6, 0, Z1 - 0.6, 2.1));
  await add(once(prop('bench'), -43.5, 0, Z1 - 0.45, Math.PI));
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.95, 0.05), new THREE.MeshStandardMaterial({ color: 0x2f3a42, roughness: 0.8 }));
  board.position.set(-46.5, 1.7, Z1 - 0.03); board.rotation.y = Math.PI; await add(board);
  await add(place(poster('NOTICE', 1.0, 0.72, 7), -46.5, 1.72, Z1 - 0.07, Math.PI));
  await add(place(statusBoard(prop('tv')), -49.45, 2.05, Z1 - 0.02, Math.PI));
  await add(deadPlant(once(prop('plant'), -50.4, 0, Z1 - 0.5, 1.1)));
  await add(once(prop('table'), -53.5, 0, Z1 - 0.48, Math.PI + 0.04));
  // Two chairs at the ends of the table and one dragged clear of it. None of the three stands on the
  // south side: a chair tucked under that edge would either poke through the table top or eat into
  // the 2.6 m the walk keeps either side of the line.
  await add(repeat(prop('chair'), [[-54.9, 0, Z1 - 0.55, -Math.PI / 2], [-52.1, 0, Z1 - 0.55, Math.PI / 2 + 0.15], [-51.4, 0, Z1 - 0.95, 0.8]]));

  // The clock on the west end wall, south of the doorway, so the far end of the room has something
  // to read rather than being the place the light runs out.
  await add(once(prop('wall_clock'), HALL_FACE + 0.07, 2.2, -34.0, Math.PI / 2));

  await add(papers([[-33.9, 0, -33.4, 0.3], [-30.6, 0, -28.4, 1.6], [-46.8, 0, -33.9, 2.1], [-51.2, 0, -33.6, 0.9], [-44.2, 0, -28.3, 1.2]]));

  return { hotspots, header: litHeader };
}

/** The television on its wall bracket, showing the wing's own status board. It is dressing, not a
 *  project, so it carries no hotspot. The face is measured off the model rather than guessed, and
 *  hung 5 mm proud of the front of its own bounding box. */
function statusBoard(tv: THREE.Object3D): THREE.Group {
  const size = new THREE.Box3().setFromObject(tv).getSize(new THREE.Vector3());
  const face = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 0.76, size.y * 0.66), new THREE.MeshStandardMaterial({
    color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1.05,
    emissiveMap: screenFace(['torn.bet  operational', 'Kayou  1,500 members', 'faction.tools  in flight'], ACCENT, 512, 360),
  }));
  face.position.set(0, size.y * 0.54, size.z / 2 + 0.005); tv.add(face);
  return crtBracket(tv, size.x * 0.92);
}

/** The plants died with the building. Tinting the model's own materials is enough: green is the one
 *  colour in the room that reads as something still alive. */
function deadPlant(plant: THREE.Group): THREE.Group {
  plant.traverse((o) => { if (o instanceof THREE.Mesh) { const m = (o.material as THREE.MeshStandardMaterial).clone(); m.color.setHex(0x6b6a55); o.material = m; } });
  return plant;
}
