import type { Placement } from '../../rig';
import { LAB, H } from './layout';

/** Two cold points inside the lab and two cold spots carrying the corridor. This was the brightest
 *  room in the walk and it read as blown out: the points at 7 and the spots at 70 lit an already
 *  emissive white box until the badge images went to paper white. Both are pulled back so the six
 *  plates are the brightest thing in the room and everything else sits under them.
 *
 *  The points trade intensity for reach. At 4 with the inverse square default the lab's own floor,
 *  2.9 m under them, was the darkest surface in a frame the camera stands in the middle of, and the
 *  clean room read browner than the hall outside it. A shallower decay spreads the same four units
 *  down the walls and across the tile without putting the peak back on the plates. */
export function lights(): Placement[] {
  return [
    { kind: 'point', position: [LAB.x, LAB.h - 0.3, -22], color: 0xdff0f6, intensity: 4, distance: 10, decay: 1.5 },
    { kind: 'point', position: [LAB.x, LAB.h - 0.3, -16], color: 0xdff0f6, intensity: 4, distance: 10, decay: 1.5 },
    { kind: 'spot', position: [-79, H - 0.3, -10], target: [-79, 0, -10], color: 0xdff0f6, intensity: 55, distance: 20, angle: Math.PI / 2.6, penumbra: 0.7, decay: 1.7 },
    { kind: 'spot', position: [-79, H - 0.3, 1], target: [-79, 0, 1], color: 0xdff0f6, intensity: 55, distance: 20, angle: Math.PI / 2.6, penumbra: 0.7, decay: 1.7 },
  ];
}
