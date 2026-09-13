import type { Placement } from '../../rig';
import { LAB, XC, LAB_PANEL, BATTEN_Z, BATTEN_Y } from './layout';

/** Two cold points inside the lab and two cold spots carrying the corridor north of it.
 *
 *  The points sit under two of the lab's six lit panels, one each side of the aisle on a diagonal,
 *  so the hot disc a point paints on the ceiling above it lands on a lens that is already lit and
 *  the room reads as lit by its ceiling. They trade intensity for reach: a shallower decay spreads
 *  the same units down the walls and across the tile without a peak on the plates, which have to
 *  stay the brightest thing in the room.
 *
 *  The spots hang at the first and third battens, just under the tube, and point straight down. */
export function lights(): Placement[] {
  const spot = (z: number): Placement => ({ kind: 'spot', position: [XC, BATTEN_Y - 0.06, z], target: [XC, 0, z], color: 0xdff0f6, intensity: 55, distance: 20, angle: Math.PI / 2.6, penumbra: 0.7, decay: 1.7 });
  return [
    { kind: 'point', position: [LAB.x + LAB_PANEL.x[0], LAB.h - 0.15, LAB.z + LAB_PANEL.z[1]], color: 0xdff0f6, intensity: 5, distance: 10, decay: 1.5 },
    { kind: 'point', position: [LAB.x + LAB_PANEL.x[1], LAB.h - 0.15, LAB.z + LAB_PANEL.z[2]], color: 0xdff0f6, intensity: 5, distance: 10, decay: 1.5 },
    spot(BATTEN_Z[0]),
    spot(BATTEN_Z[2]),
  ];
}
