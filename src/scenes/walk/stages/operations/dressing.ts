import * as THREE from 'three';
import type { StageContext } from '../types';
import { grounded, once, place } from '../../merge';
import { serverRack, cage, papers, tapeLine } from '../../labs/props';
import { X0, W, XC, RACK_Z, CAGE_Z, RACK_XS, GATE_X } from './layout';

export async function buildDressing(ctx: StageContext, root: THREE.Group): Promise<void> {
  const { store, anchors, pace } = ctx;
  const prop = (key: string) => grounded(store.model(key));
  const add = async (o: THREE.Object3D) => { root.add(o); await pace(); };

  // Two rows of racks against the long walls, fronts facing the aisle, a cage run in front of each.
  // The north cage is one run; the south cage is two runs with a 1.2 m gate at GATE_X, opposite the
  // flagship, so the aisle can reach the caged racks there. The gate sits inside the same span a
  // single run would have covered (XC +/- (W - 4) / 2), split around it.
  for (const [side, z, ry] of [['south', RACK_Z.south, 0], ['north', RACK_Z.north, Math.PI]] as const) {
    for (const [i, x] of RACK_XS.entries()) await add(place(serverRack(i + (side === 'south' ? 1 : 20)), x, 0, z, ry));
    if (side === 'north') { await add(place(cage(W - 4), XC, 0, CAGE_Z.north)); continue; }
    const spanX0 = XC - (W - 4) / 2, spanX1 = XC + (W - 4) / 2, half = 0.6;
    const run1Len = GATE_X - half - spanX0, run1X = (spanX0 + GATE_X - half) / 2;
    const run2Len = spanX1 - (GATE_X + half), run2X = (GATE_X + half + spanX1) / 2;
    await add(place(cage(run1Len), run1X, 0, CAGE_Z.south));
    await add(place(cage(run2Len), run2X, 0, CAGE_Z.south));
  }
  // The gate: a 1.2 m break in the south cage opposite the flagship, with the plate pinned there.
  anchors.set('operations', new THREE.Vector3(GATE_X, 1.7, CAGE_Z.south + 0.8));

  // The far wall: desk, laptop open on it, the chair on its side, papers.
  await add(once(store.model('desk'), X0 + 1.2, 0, -31, Math.PI / 2));
  await add(once(prop('laptop'), X0 + 1.1, 0.76, -30.6, 1.3));
  const chair = once(prop('office_chair'), X0 + 2.6, 0.45, -29.6, 0.4); chair.rotation.z = -Math.PI / 2; await add(chair);
  await add(papers([[X0 + 3, 0, -30.4, 0.2], [X0 + 3.8, 0, -31.6, 1.1], [-66, 0, -30.2, 2.4], [-61, 0, -31.8, 0.7]]));
  await add(tapeLine([X0 + 0.4, -34.6], [X0 + 0.4, -27.4], 1.0));
}
