import type * as THREE from 'three';
import type { StageContext } from '../types';
import { grounded, once, repeat, place, type Spot } from '../../merge';
import { palletRack, wrappedPallet, rackBays, rackSlots, container, papers, RACK_BAY, RACK_HEIGHT } from '../../labs/props';
import { rng } from '../../labs/textures';
import { X0, X1, Z0, COLUMNS } from './layout';

/** The three racking runs, all turned a quarter so their bays face the aisle. */
const RACKS: { bays: number; x: number; z: number }[] = [
  { bays: 4, x: X1 - 0.7, z: -20 },
  { bays: 3, x: X1 - 0.7, z: -6 },
  { bays: 3, x: X0 + 0.7, z: -4 },
];
const LEVELS = 3;

/**
 * What is on the racks. Every deck below the top beam carries something: six in ten a shrink
 * wrapped pallet, the rest a crate, drawn from a seed so the bay looks the same in every
 * screenshot. The top level stays empty, which leaves its wire decking on show and keeps the
 * stock clear of the cable tray running the wall at 5.2.
 *
 * The stock is batched across all three runs rather than per rack, which is why it is built here
 * from the runs' own geometry instead of inside `palletRack`: two pallet variants and three crates
 * over the whole bay is nine draw calls, where a pallet built per deck would be fifty.
 */
function rackStock(prop: (key: string) => THREE.Object3D): THREE.Object3D[] {
  const r = rng(11);
  const pallets: Spot[][] = [[], []];
  const crates: Spot[][] = [[], [], []];
  let n = 0;
  for (const rack of RACKS) {
    for (const y of rackSlots(LEVELS, RACK_HEIGHT).slice(0, -1)) for (const bay of rackBays(rack.bays, RACK_BAY)) {
      // The run is turned a quarter, so a bay offset along the run lands on world z.
      const spot: Spot = [rack.x, y, rack.z - bay, Math.PI / 2];
      if (r() < 0.6) pallets[n % pallets.length].push(spot);
      else crates[n % crates.length].push([spot[0], spot[1], spot[2], r() * 0.4 - 0.2, 1.4]);
      n++;
    }
  }
  const out: THREE.Object3D[] = [];
  pallets.forEach((spots, i) => { if (spots.length) out.push(repeat(wrappedPallet(i + 1), spots)); });
  ['crate_wood_1', 'cardboard_box', 'crate_plastic'].forEach((key, i) => { if (crates[i].length) out.push(repeat(prop(key), crates[i])); });
  return out;
}

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

  // Racking down both long walls, loaded. A container parked in front of the near run, boxes at
  // the foot of the far one.
  for (const rack of RACKS) await add(place(palletRack(rack.bays, LEVELS), rack.x, 0, rack.z, Math.PI / 2));
  for (const batch of rackStock(prop)) await add(batch);
  await add(place(container(0x2b6a6f), R - 2.6, 0, 8, Math.PI / 2));
  await add(repeat(prop('crate_wood_1'), [[R - 0.7, 0, -8.6, 0.2, 1.5]]));
  await add(repeat(prop('cardboard_box'), [[R - 0.7, 0, -12.2, 0.3, 1.4], [R - 0.7, 0.44, -12.2, -0.2, 1.4]]));
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

  // Left wall: a container by the exit and the tool wall by the door. The racking there is built
  // with the other runs above.
  await add(place(container(0x8a3a2e), L + 2.6, 0, -22, Math.PI / 2));
  await add(once(prop('metal_rack'), L + 0.34, 0, 9.5, Math.PI / 2));
  await add(once(prop('tool_chest'), L + 0.24, 0, 7.0, Math.PI / 2));
  await add(once(prop('tool_cart'), L + 0.8, 0, 4.6, 1.25));
  await add(once(prop('storage_cart'), L + 0.6, 0, 12.9, Math.PI / 2 + 0.25));
  const ladder = once(prop('ladder'), L + 0.6, 0, 16.5, Math.PI / 2); ladder.rotation.z = 0.25; await add(ladder);

  // The abandonment layer: papers by the office door. The tape that used to hang across the exit is
  // gone. It ran at an angle into the far wall, read as clipping through it, and the tape that marks
  // this exit now hangs off the RECREATION doorway itself (recreation/shell.ts), where the walk
  // turns through it rather than past it.
  await add(papers([[-0.4, 0, -5.6, 0.3], [0.5, 0, -6.4, 1.4], [-4.1, 0, -16.2, 2.0]]));
}
