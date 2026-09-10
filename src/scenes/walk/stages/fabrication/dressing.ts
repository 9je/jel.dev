import type * as THREE from 'three';
import type { StageContext } from '../types';
import { grounded, once, repeat, type Spot } from '../../merge';
import { X0, X1, Z0, COLUMNS } from './layout';

/**
 * Props, by bay. Every one of them touches a wall, a column, or another prop: nothing stands in the
 * open. The aisle between the painted lines stays empty. Sizes below are the models' real bounds.
 */
export function buildDressing({ store }: StageContext, root: THREE.Group): void {
  const prop = (key: string) => grounded(store.model(key));
  const R = X1, L = X0, F = Z0;

  // Right wall, stores bay: a run of six shelving units (the model is in centimetres, so 0.1),
  // the overflow stacked between the column and the wall, boxes at the foot of the run, the power
  // box on the wall in the middle of it.
  const shelves: Spot[] = [-23.2, -22, -20.8, -19.6, -18.4, -17.2].map((z) => [R - 0.3, 0, z, -Math.PI / 2, 0.1]);
  root.add(repeat(prop('steel_shelves'), shelves));
  root.add(repeat(prop('cardboard_box'), [[R - 0.5, 0, -15.6, 0.3, 1.3], [R - 0.5, 0.44, -15.6, -0.2, 1.3], [R - 1.0, 0, -14.9, 1.1, 1.3]]));
  const [c4x, c4z] = COLUMNS[3];
  root.add(repeat(prop('crate_wood_1'), [[c4x + 1.4, 0, c4z + 0.8, 0.2, 1.5], [c4x + 1.6, 0.52, c4z + 0.9, 0.5, 1.5], [c4x + 2.7, 0, c4z + 1.3, -0.3, 1.5]]));
  root.add(repeat(prop('crate_wood_2'), [[c4x + 2.4, 0, c4z + 2.6, -0.35, 1.4]]));
  root.add(repeat(prop('crate_plastic'), [[R - 0.5, 0, c4z + 3.4, 0.15, 1.6], [R - 0.5, 0.42, c4z + 3.4, -0.1, 1.6]]));
  root.add(once(prop('military_crate'), R - 1.1, 0, -27.2, 0.1, 1.4));
  root.add(once(store.model('power_box'), R - 0.08, 1.6, -18, -Math.PI / 2));

  // Column 2, right of the door: the barrels live between it and the wall, the extinguisher on its
  // aisle face where a shop would keep one.
  const [c2x, c2z] = COLUMNS[1];
  root.add(repeat(prop('barrel'), [[c2x + 1.4, 0, c2z + 0.4], [c2x + 2.3, 0, c2z + 1.1, 0.9], [c2x + 1.8, 0, c2z + 2.0, 1.7], [c2x + 2.9, 0, c2z + 0.1, 0.4], [c2x + 3.2, 0, c2z + 1.6, 2.2]]));
  root.add(once(prop('fire_extinguisher'), c2x - 0.65, 0, c2z + 0.25, -Math.PI / 2));

  // Far wall, the dock: a roller shutter under the LED board, gas and the compressor on one side of
  // it and the welding cart parked on the other.
  root.add(once(prop('dock_door'), 6, 0, F + 0.2, Math.PI, 1.5));
  root.add(once(prop('compressor'), -1.6, 0, F + 0.5, Math.PI / 2, 1.1));
  root.add(repeat(prop('propane'), [[0.7, 0, F + 0.45], [1.15, 0, F + 0.7, 1.0], [1.6, 0, F + 0.4, 2.1]]));
  root.add(once(prop('welding_cart'), 9.6, 0, F + 0.9, -0.5));

  // Left wall, the tool wall between the clean room and the door: rack, chest, both carts, and a
  // ladder leaning on the wall.
  root.add(once(prop('metal_rack'), L + 0.34, 0, 9.5, Math.PI / 2));
  root.add(once(prop('tool_chest'), L + 0.24, 0, 7.0, Math.PI / 2));
  root.add(once(prop('tool_cart'), L + 0.8, 0, 4.6, 1.25));
  root.add(once(prop('storage_cart'), L + 0.6, 0, 12.9, Math.PI / 2 + 0.25));
  const ladder = once(prop('ladder'), L + 0.6, 0, 16.5, Math.PI / 2); ladder.rotation.z = 0.25; root.add(ladder);
}
