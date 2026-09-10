import * as THREE from 'three';
import type { StageContext } from '../types';
import { grounded, once, repeat, place } from '../../merge';
import { arcadeCabinet, vendingMachine, wallScreen, papers, tapeLine } from '../../labs/props';
import { X0, X1, Z0, Z1, CABINETS, ACCENT } from './layout';

export async function buildDressing(ctx: StageContext, root: THREE.Group): Promise<void> {
  const { store, anchors, pace } = ctx;
  const prop = (key: string) => grounded(store.model(key));
  const add = async (o: THREE.Object3D) => { root.add(o); await pace(); };

  // South wall: the four cabinets the hold looks at, one per recreation project, two screens above.
  for (const [key, title, x] of CABINETS) {
    await add(place(arcadeCabinet(title, ACCENT), x, 0, Z0 + 0.5));
    if (key === 'torn-bet') anchors.set('torn-bet', new THREE.Vector3(x, 1.9, Z0 + 1.6));
  }
  await add(place(wallScreen(2.2, 1.2, ['torn.bet', 'operational'], ACCENT), -32.6, 3.4, Z0 + 0.05));
  await add(place(wallScreen(1.6, 1.0, ['Kayou', '1,500 members'], ACCENT), -37.4, 3.3, Z0 + 0.05));
  anchors.set('recreation', new THREE.Vector3(-35, 2, Z0 + 2));

  // North wall by the entrance: two vending machines and the bin.
  await add(place(vendingMachine(ACCENT), -23.5, 0, Z1 - 0.5, Math.PI));
  await add(place(vendingMachine('#6EC1D6'), -24.7, 0, Z1 - 0.5, Math.PI));
  await add(once(prop('bin'), -26.2, 0, Z1 - 0.6));

  // Tables against the north wall, the sofa on the south wall past the cabinets. Kept within
  // 0.6-0.7 m of their wall so the walked line at z -31 keeps its 3.2 m clearance either side: the
  // room is only 8 m wide, which leaves less than a metre against each wall for anything to stand.
  await add(once(prop('table'), -40, 0, Z1 - 0.6));
  await add(repeat(prop('chair'), [[-41.2, 0, Z1 - 0.5, Math.PI], [-38.9, 0, Z1 - 0.6, Math.PI + 0.3], [-40.6, 0, Z1 - 0.7, 0.2], [-39.3, 0, Z1 - 0.5, -0.1]]));
  await add(once(prop('table'), -50, 0, Z1 - 0.6));
  await add(repeat(prop('chair'), [[-51.2, 0, Z1 - 0.5, Math.PI], [-48.8, 0, Z1 - 0.6, 0.4]]));
  await add(once(prop('sofa'), -44, 0, Z0 + 0.6));
  await add(once(prop('sofa'), -52, 0, Z0 + 0.6, 0.1));

  // Abandonment: a chair on its side by the far table, a trash bag, papers, tape across the exit.
  const fallen = once(prop('chair'), -52.4, 0.42, Z1 - 0.5, 1.1); fallen.rotation.z = Math.PI / 2; await add(fallen);
  await add(once(prop('trashbag'), -27.4, 0, Z1 - 0.7, 0.6));
  await add(papers([[-30, 0, -29.5, 0.3], [-31.2, 0, -29.9, 1.6], [-47, 0, -30.2, 2.1], [-55, 0, -32.4, 0.9]]));
  await add(tapeLine([X0 + 0.5, Z0 + 0.6], [X0 + 0.5, Z1 - 3.2], 1.0));
}
