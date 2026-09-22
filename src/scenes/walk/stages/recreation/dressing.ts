import * as THREE from 'three';
import type { Hotspot, StageContext } from '../types';
import { grounded, once, repeat, place } from '../../merge';
import { cableTray, papers } from '../../labs/props';
import { arcadeCabinet, canteenChair, canteenTable, crtBracket, crtSet, drinksMachine, fridge, kitchenette, locker, mug, poster, splashback } from '../../labs/furniture';
import { battens } from '../../labs/fixtures';
import { signBox } from '../../labs/signage';
import { labsIdent } from '../../labs/textures';
import { Z0, Z1, CABINETS, CABINET_Z, ACCENT, HALL_FACE, FITTINGS, MESS_TABLES, ROW_PANEL } from './layout';

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

  // The four fittings the room's four spots hang under. The ceiling grid's own troffers are sparse
  // and land where the tile pattern puts them, which is not where a light wants to be, and a spot
  // burning in open ceiling was the note "lights are super bad and have a single light point in
  // middle doesnt even line up". These are surface battens over the served wall and the lounge, on
  // the same four positions `lighting.ts` puts its spots. One instanced pair for all four.
  await add(battens({ len: 1.6, drop: 0.08, intensity: 1.45 }, FITTINGS.map(([x, z]) => [x, 3.1, z])));

  // ---- South wall, the east end: the kitchen ----------------------------------------------------
  // The whole kitchen moved four metres east, to the first stretch of wall past the door, because
  // the arcade row now takes the piece of wall the camera parks in front of. Walking in, the
  // servery goes by on the right and the row is straight ahead.
  await add(place(fridge(), -21.7, 0, Z0 + 0.37));
  await add(place(kitchenette(3.2), -24.2, 0, Z0 + 0.33));
  await add(place(splashback(3.2, 0.62), -24.2, 1.19, Z0 + 0.05));
  await add(once(prop('microwave'), -23.4, 0.905, Z0 + 0.33, 0.15));
  await add(once(prop('kettle'), -25.6, 0.905, Z0 + 0.28, -0.4));
  // Mugs, not a tea set. A bone china pot and cups is not what a facility canteen drinks out of,
  // and there is a kettle beside them already.
  await add(place(mug(), -25.15, 0.9, Z0 + 0.22, 0.9));
  await add(place(mug(0xcfd8dd), -24.95, 0.9, Z0 + 0.34, -1.2));
  await add(place(poster('WASH YOUR HANDS', 0.44, 0.62, 5), -25.5, 1.6, Z0 + 0.06));
  // The clock hangs over the counter, not on the far wall: it is the one thing that fills the bare
  // metre of wall between the cupboards and the ceiling on the side of the frame the copy leaves.
  await add(once(prop('wall_clock'), -22.9, 2.3, Z0 + 0.07));

  // ---- South wall, the middle: the row the room is about ----------------------------------------
  // The cabinets stand square on the piece of wall the camera parks in front of, under their
  // own batten and their own sign. The dark panel behind them is what gives a blue machine an edge
  // against a blue dado, which was the note "blue blends into wall", and it reads as the painted
  // back of a machine bay.
  const panel = new THREE.Mesh(new THREE.BoxGeometry(ROW_PANEL.w, ROW_PANEL.h, 0.06), new THREE.MeshStandardMaterial({ color: 0x272e35, roughness: 0.85 }));
  panel.position.set(ROW_PANEL.x, ROW_PANEL.h / 2, Z0 + 0.05); await add(panel);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(ROW_PANEL.w + 0.08, 0.05, 0.1), new THREE.MeshStandardMaterial({ color: 0x8e99a1, roughness: 0.45, metalness: 0.4 }));
  rail.position.set(ROW_PANEL.x, ROW_PANEL.h + 0.02, Z0 + 0.07); await add(rail);

  const hotspots: Hotspot[] = [];
  for (const [key, title, x, accent, ry, kind] of CABINETS) {
    const cabinet = place(arcadeCabinet({ title, accent, seed: x * -7, kind }), x, 0, CABINET_Z, ry);
    await add(cabinet);
    hotspots.push({ id: key, kind: 'project', label: title, object: cabinet, stop: 'recreation' });
    // Off the cabinet's own x, so a card still lands on its machine when the row is re-spaced.
    if (key === 'torn-bet') anchors.set('torn-bet', new THREE.Vector3(x, 2.15, Z0 + 1.0));
  }
  // The sign over the row, on the wall above the marquees. A lit box at the head of an aisle is how
  // a building this size tells you what a corner of a room is for, and it is what makes the row the
  // thing you look at on the way in rather than the machines.
  // The eyebrow reads JEL LABS, the way every other lit sign in the building does. It said BREAK
  // ROOM, which is the room the sign is hanging in: a facility signs the thing you are walking up
  // to, not the room you are already standing in, and "BREAK ROOM / ARCADE" read as a label for the
  // whole room rather than for the three machines under it.
  await add(place(signBox('ARCADE', { w: 1.7, h: 0.42, accent: 0x3d7be0, on: true, code: 'JEL LABS' }), -28.1, 2.28, Z0 + 0.13));

  // ---- South wall, west of the row: the machines --------------------------------------------------
  // Past the cabinets, where they are the backdrop the row stands against and the light that leaks
  // down the wall behind it. Two machines, and until now they were the same machine twice: the same
  // carcass, the same stock, one lit and one not, which Jordan read as "2 almost identical" and the
  // dead one as the less detailed of the pair. The pair a break room actually has is a drinks
  // machine and a snack machine, so that is what stands here: the same cabinet, but one is cold
  // blue with cans and bottles stacked on shelves and the other is warm with bags and bars hung off
  // coils. Different silhouette behind the glass, different header over the door.
  //
  // Both are `drinksMachine`, which was built as the second cut of this object and then never
  // placed: a full height glass door in a steel frame, a coin mech column, a delivery flap and a
  // vent in the plinth. The room went on drawing the first cut, which is the flat recess and the
  // painted-on stock Jordan called weak.
  const machine = drinksMachine({ accent: ACCENT, lit: true, seed: 11 });
  const header = machine.getObjectByName('header') as THREE.Mesh;
  const litHeader = header.material as THREE.MeshStandardMaterial;
  await add(place(machine, -31.9, 0, Z0 + 0.42));
  await add(place(drinksMachine({ accent: '#E8B923', lit: true, seed: 5, kind: 'snacks' }), -32.95, 0, Z0 + 0.42));

  // The copy panel hangs east of the row, over the counter end, so it never covers the cabinets it
  // is describing.
  anchors.set('recreation', new THREE.Vector3(-25.4, 2.0, -33.9));

  // ---- North wall: the quiet side ---------------------------------------------------------------
  await add(place(statusBoard(), -29.6, 2.05, Z1 - 0.02, Math.PI));

  // Two canteen tables against the wall with a chair at each end, and every chair turned to face
  // the table it belongs to. Both chairs at both tables used to face away from theirs, which is
  // what reads as random: a chair is the one piece of furniture in a room that says which way a
  // person was pointed, so a wrong heading on one is louder than a wrong heading on anything else.
  //
  // The ends only. A chair on the south side of either table would stand its back 2.4 m off the
  // walked line, inside the 2.6 m this room keeps clear either side of it.
  // Three chairs to a table: one at each end and one on the long side, every one of them square to
  // the table and facing it. Two chairs at the ends and nothing else still read as spun, because a
  // chair seen from the side tells you nothing about which way it is pointed: it is the one on the
  // long side, facing the table front on, that makes the other two legible as a set.
  //
  // The table stands 0.95 m off the wall rather than 0.62 to make room for it, which puts the long
  // side chair's back 1.9 m from the walked line. That is inside the 2.6 m this room otherwise
  // keeps clear, and it is the right trade: the camera is a point, 1.9 m is nowhere near it, and a
  // canteen with nobody sitting at the long side of any table is not a canteen.
  for (const tx of MESS_TABLES) {
    await add(place(canteenTable(1.6, 0.8), tx, 0, Z1 - 0.95, 0));
    await add(place(canteenChair(), tx - 1.02, 0, Z1 - 0.95, Math.PI / 2));
    await add(place(canteenChair(), tx + 1.02, 0, Z1 - 0.95, -Math.PI / 2));
    await add(place(canteenChair(), tx - 0.28, 0, Z1 - 1.78, 0));
  }
  // One on its side where it went over, for the room's abandonment layer. It is the only chair in
  // here that is not square, so it reads as one that fell rather than as the set being careless.
  const fallen = place(canteenChair(), -30.4, 0.24, Z1 - 1.5, 1.2);
  fallen.rotation.z = Math.PI / 2; await add(fallen);
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
  const LOW_H = 0.42;
  await add(place(canteenTable(1.2, 0.6, LOW_H), -52.9, 0, Z0 + 0.62, 0.08));
  await add(place(mug(), -53.15, LOW_H, Z0 + 0.58, 1.4));
  await add(papers([[-52.6, LOW_H, Z0 + 0.66, 0.5]]));

  // North wall, east to west: the notices, the bin, a bench, the board, the television the sofas
  // face across the room, and the table people ate at.
  await add(place(poster('NO SMOKING', 0.5, 0.7, 11), -38.5, 1.85, Z1 - 0.04, Math.PI));
  await add(once(prop('bin'), -40.5, 0, Z1 - 0.5));
  await add(once(prop('trashbag'), -41.6, 0, Z1 - 0.6, 2.1));
  await add(once(prop('bench'), -43.5, 0, Z1 - 0.45, Math.PI));
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.95, 0.05), new THREE.MeshStandardMaterial({ color: 0x2f3a42, roughness: 0.8 }));
  board.position.set(-46.5, 1.7, Z1 - 0.03); board.rotation.y = Math.PI; await add(board);
  await add(place(poster('NOTICE', 1.0, 0.72, 7), -46.5, 1.72, Z1 - 0.07, Math.PI));
  await add(place(statusBoard(), -49.45, 2.05, Z1 - 0.02, Math.PI));
  await add(deadPlant(once(prop('plant'), -50.4, 0, Z1 - 0.5, 1.1)));
  await add(place(canteenTable(1.6, 0.8), -53.5, 0, Z1 - 0.62, 0));
  // Two chairs at the ends, both facing the table, and a spare stood back against the wall square
  // to it. It was left dragged out at an angle, which from the walk only read as a chair facing
  // nowhere. None of the three stands on the south side, for the clearance the walk keeps.
  await add(place(canteenChair(), -54.52, 0, Z1 - 0.62, Math.PI / 2));
  await add(place(canteenChair(), -52.48, 0, Z1 - 0.62, -Math.PI / 2));
  await add(place(canteenChair(), -51.4, 0, Z1 - 0.3, Math.PI));

  // The clock on the west end wall, south of the doorway, so the far end of the room has something
  // to read rather than being the place the light runs out.
  await add(once(prop('wall_clock'), HALL_FACE + 0.07, 2.2, -34.0, Math.PI / 2));

  await add(papers([[-33.9, 0, -33.4, 0.3], [-30.6, 0, -28.4, 1.6], [-46.8, 0, -33.9, 2.1], [-51.2, 0, -33.6, 0.9], [-44.2, 0, -28.3, 1.2]]));

  return { hotspots, header: litHeader };
}

/** The television on its wall bracket, square to the wall it hangs on, showing the Labs mark. It
 *  is dressing, not a project, so it carries no hotspot. It is the same set the containment floor
 *  has, whose screen sits in its own bezel, half again as big. It stands the way a set on a canteen
 *  wall does, facing the room, not turned to meet the walk: the room is meant to look lived in, not
 *  posed for the camera passing through it. */
function statusBoard(): THREE.Group {
  const S = 1.5;
  const set = crtSet(labsIdent());
  set.scale.setScalar(S);
  // The set is 0.6 m deep behind its face at this size, so the shelf runs the whole of that and the
  // set stands with the back of its funnel just off the wall.
  const back = 0.415 * S, front = 0.16 * S;
  const g = crtBracket(set, 0.52 * S * 0.92, back + front + 0.04);
  set.position.z = back + 0.03;
  return g;
}

/** The plants died with the building. Tinting the model's own materials is enough: green is the one
 *  colour in the room that reads as something still alive. */
function deadPlant(plant: THREE.Group): THREE.Group {
  plant.traverse((o) => { if (o instanceof THREE.Mesh) { const m = (o.material as THREE.MeshStandardMaterial).clone(); m.color.setHex(0x6b6a55); o.material = m; } });
  return plant;
}
