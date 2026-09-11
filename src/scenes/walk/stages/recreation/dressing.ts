import * as THREE from 'three';
import type { Hotspot, StageContext } from '../types';
import { grounded, once, repeat, place } from '../../merge';
import { arcadeCabinet, vendingMachine, wallScreen, papers } from '../../labs/props';
import { Z0, Z1, CABINETS, ACCENT } from './layout';

export async function buildDressing(ctx: StageContext, root: THREE.Group): Promise<Hotspot[]> {
  const { store, anchors, pace } = ctx;
  const prop = (key: string) => grounded(store.model(key));
  const add = async (o: THREE.Object3D) => { root.add(o); await pace(); };
  const hotspots: Hotspot[] = [];

  // South wall: the four cabinets the hold looks at, one per recreation project, two screens above.
  // Each cabinet is its own group with its own materials, so it is the hotspot as it stands: the
  // pointer lights that cabinet's screen and marquee and nothing else in the row.
  for (const [key, title, x] of CABINETS) {
    const cabinet = place(arcadeCabinet(title, ACCENT), x, 0, Z0 + 0.5);
    await add(cabinet);
    hotspots.push({ id: key, kind: 'project', label: title, object: cabinet, stop: 'recreation' });
    if (key === 'torn-bet') anchors.set('torn-bet', new THREE.Vector3(x, 1.9, Z0 + 1.6));
  }
  await add(place(wallScreen(2.2, 1.2, ['torn.bet', 'operational'], ACCENT), -32.6, 3.4, Z0 + 0.05));
  await add(place(wallScreen(1.6, 1.0, ['Kayou', '1,500 members'], ACCENT), -37.4, 3.3, Z0 + 0.05));
  anchors.set('recreation', new THREE.Vector3(-35, 2, Z0 + 2));

  // North wall by the entrance: two vending machines and the bin. Both machines carry the room's
  // one accent: the break room reads as one warm colour, not two. The walked line at z -31 needs
  // 2.6 m clearance either side, ruled down from the spec's 3.2 m: the room is only 8 m wide, and
  // 3.2 m either side leaves under a metre of depth against each wall, not enough for furniture
  // 0.5-0.9 m deep to stand there at all. Every solid prop below is kept to 0.5-0.7 m off its wall,
  // which puts its near edge (offset plus half its own depth) at 2.95-3.25 m of clearance: the
  // vending machines (0.8 m deep) at 0.5 m clear 3.1 m, the cabinets and sofas (0.9 m) at 0.5-0.6 m
  // off the wall clear 2.95-3.05 m, the tables (0.9 m) at 0.6 m clear 2.95 m, and the chairs (0.5 m)
  // at 0.5-0.7 m clear 3.05-3.25 m.
  await add(place(vendingMachine(ACCENT), -23.5, 0, Z1 - 0.5, Math.PI));
  await add(place(vendingMachine(ACCENT), -24.7, 0, Z1 - 0.5, Math.PI));
  await add(once(prop('bin'), -26.2, 0, Z1 - 0.6));

  // Tables against the north wall, the sofa on the south wall past the cabinets.
  await add(once(prop('table'), -40, 0, Z1 - 0.6));
  await add(repeat(prop('chair'), [[-41.2, 0, Z1 - 0.5, Math.PI], [-38.9, 0, Z1 - 0.6, Math.PI + 0.3], [-40.6, 0, Z1 - 0.7, 0.2], [-39.3, 0, Z1 - 0.5, -0.1]]));
  await add(once(prop('table'), -50, 0, Z1 - 0.6));
  await add(repeat(prop('chair'), [[-51.2, 0, Z1 - 0.5, Math.PI], [-48.8, 0, Z1 - 0.6, 0.4]]));
  await add(once(prop('sofa'), -44, 0, Z0 + 0.6));
  await add(once(prop('sofa'), -52, 0, Z0 + 0.6, 0.1));

  // Abandonment: a chair on its side by the far table, a trash bag, papers. The tape that used to
  // run down the west end is gone: it hung on the walked line, so the camera drove through its
  // lettering. The tape at each end now hangs beside its doorway (shell.ts).
  const fallen = once(prop('chair'), -52.4, 0.42, Z1 - 0.5, 1.1); fallen.rotation.z = Math.PI / 2; await add(fallen);
  await add(once(prop('trashbag'), -27.4, 0, Z1 - 0.7, 0.6));
  await add(papers([[-30, 0, -29.5, 0.3], [-31.2, 0, -29.9, 1.6], [-47, 0, -30.2, 2.1], [-55, 0, -32.4, 0.9]]));

  return hotspots;
}
