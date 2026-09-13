import type { Placement } from '../../rig';
import { XC, RACK_Z, BATTEN_Y, SPOT_FITTINGS } from './layout';

/**
 * Two cold spots, each under a batten, and one blue point inside each caged row.
 *
 * The spots sit exactly under two of the hung battens, one in each row and staggered down the hall,
 * so every pool on the floor has a fitting over it: Jordan's read of the old pair was "a single
 * light point in the middle doesnt even line up". Each aims straight down from the housing, so the
 * pool is centred on the batten, and the cone is narrower than the old hemisphere so the pool has an
 * edge and the hall stays dark between them. Sixteen racks carrying fourteen lit units each put a lot
 * of their own light into the rows, which is what lets the aisle sit this low.
 *
 * The points sit between the cage and the racks rather than out in the aisle, so the blue is a glow
 * coming out of the enclosure instead of a wash across the floor. They hang at 2.2 m, over the rack
 * tops: at eye height a point light 0.4 m off a rack front burns a blue blob into the middle of the
 * row, which the eye reads as a lamp rather than as the row being lit.
 */
export function lights(): Placement[] {
  const spots: Placement[] = SPOT_FITTINGS.map(([x, z]) => ({
    kind: 'spot', position: [x, BATTEN_Y - 0.05, z], target: [x, 0, z],
    color: 0xdff0f6, intensity: 70, distance: 20, angle: Math.PI / 3, penumbra: 0.6, decay: 1.7,
  }));
  return [
    ...spots,
    { kind: 'point', position: [XC, 2.2, RACK_Z.south + 0.9], color: 0x2a6fd6, intensity: 6, distance: 9, decay: 2 },
    { kind: 'point', position: [XC, 2.2, RACK_Z.north - 0.9], color: 0x2a6fd6, intensity: 6, distance: 9, decay: 2 },
  ];
}
