import type * as THREE from 'three';
import type { StageContext } from '../types';
import { grounded, once, repeat, place } from '../../merge';
import { palletRack, container, tapeLine, papers } from '../../labs/props';
import { X0, X1, Z0, COLUMNS } from './layout';

/**
 * Props, by bay. Every one of them touches a wall, a column, or another prop: nothing stands in the
 * open. The aisle between the painted lines stays empty. Poly Haven sizes are the models' real
 * bounds; racking and containers are procedural, from the Labs kit.
 */
export async function buildDressing(ctx: StageContext, root: THREE.Group): Promise<void> {
  const { store, pace } = ctx;
  const prop = (key: string) => grounded(store.model(key));
  const R = X1, L = X0, F = Z0;
  const add = async (o: THREE.Object3D) => { root.add(o); await pace(); };

  // Right wall: two runs of blue racking with stock on the decks, a container parked in front of
  // the near run, boxes at the foot of the far run. Deck heights are 1.5 and 3.0.
  // The racking runs along z, turned a quarter so its bays face the aisle.
  await add(place(palletRack(4, 3), R - 0.7, 0, -20, Math.PI / 2));
  await add(place(palletRack(3, 3), R - 0.7, 0, -6, Math.PI / 2));
  await add(place(container(0x2b6a6f), R - 2.6, 0, 8, Math.PI / 2));
  await add(repeat(prop('crate_wood_1'), [[R - 0.7, 1.5, -22.4, 0.1, 1.5], [R - 0.7, 3.0, -19.4, 0.2, 1.5], [R - 0.7, 1.5, -16.6, -0.2, 1.5], [R - 0.7, 3.0, -6.4, 0.3, 1.5], [R - 0.7, 0, -8.6, 0.2, 1.5]]));
  await add(repeat(prop('cardboard_box'), [[R - 0.7, 1.5, -18.2, 0.3, 1.4], [R - 0.7, 1.5, -25.2, 1.1, 1.4], [R - 0.7, 0, -12.2, 0.3, 1.4], [R - 0.7, 0.44, -12.2, -0.2, 1.4], [R - 0.7, 3.0, -3.4, 0.9, 1.4]]));
  await add(repeat(prop('crate_plastic'), [[R - 0.6, 1.5, -13.6, 0.15, 1.6], [R - 0.6, 3.0, -21.2, -0.1, 1.6]]));
  await add(repeat(prop('steel_shelves'), [[R - 0.3, 0, 16.4, -Math.PI / 2, 0.1], [R - 0.3, 0, 17.6, -Math.PI / 2, 0.1]]));
  await add(once(store.model('power_box'), R - 0.08, 1.6, -13, -Math.PI / 2));

  // Column 2, right of the door: barrels between it and the container, the extinguisher on its face.
  const [c2x, c2z] = COLUMNS[1];
  await add(repeat(prop('barrel'), [[c2x + 1.4, 0, c2z + 0.4], [c2x + 2.3, 0, c2z + 1.1, 0.9], [c2x + 1.8, 0, c2z + 2.0, 1.7]]));
  await add(once(prop('fire_extinguisher'), c2x - 0.65, 0, c2z + 0.25, -Math.PI / 2));

  // Far wall, the docks: two roller shutters under the LED board, the compressor and gas between
  // them, the welding cart parked by the right one.
  await add(repeat(prop('dock_door'), [[2, 0, F + 0.2, Math.PI, 1.5], [9, 0, F + 0.2, Math.PI, 1.5]]));
  await add(once(prop('compressor'), 5.5, 0, F + 0.5, Math.PI / 2, 1.1));
  await add(repeat(prop('propane'), [[4.2, 0, F + 0.45], [4.7, 0, F + 0.7, 1.0], [6.8, 0, F + 0.4, 2.1]]));
  await add(once(prop('welding_cart'), 11.8, 0, F + 0.9, -0.5));
  await add(once(prop('military_crate'), R - 1.1, 0, -27.2, 0.1, 1.4));

  // Left wall: racking where the old clean room stood, a container by the exit, the tool wall by
  // the door.
  await add(place(palletRack(3, 3), L + 0.7, 0, -4, Math.PI / 2));
  await add(place(container(0x8a3a2e), L + 2.6, 0, -22, Math.PI / 2));
  await add(repeat(prop('cardboard_box'), [[L + 0.7, 1.5, -6.2, 0.3, 1.4], [L + 0.7, 3.0, -2.6, -0.4, 1.4], [L + 0.7, 1.5, -1.0, 0.8, 1.4]]));
  await add(once(prop('metal_rack'), L + 0.34, 0, 9.5, Math.PI / 2));
  await add(once(prop('tool_chest'), L + 0.24, 0, 7.0, Math.PI / 2));
  await add(once(prop('tool_cart'), L + 0.8, 0, 4.6, 1.25));
  await add(once(prop('storage_cart'), L + 0.6, 0, 12.9, Math.PI / 2 + 0.25));
  const ladder = once(prop('ladder'), L + 0.6, 0, 16.5, Math.PI / 2); ladder.rotation.z = 0.25; await add(ladder);

  // The abandonment layer: tape across the left side of the exit, papers by the office door.
  await add(tapeLine([-6, -27.5], [-11.5, -29.0], 1.0));
  await add(papers([[-0.4, 0, -5.6, 0.3], [0.5, 0, -6.4, 1.4], [-4.1, 0, -16.2, 2.0]]));
}
