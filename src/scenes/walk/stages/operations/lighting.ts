import type { Placement } from '../../rig';
import { H, XC, RACK_Z } from './layout';

/**
 * Two cold spots down the aisle and one blue point inside each caged row.
 *
 * The spots come down from 80 to 60. The racks light themselves now: sixteen of them carrying
 * fourteen emissive units each is a lot of light coming out of the rows, and at the old level the
 * aisle floor washed out to the point where the cages lost their red and the trunk lost its yellow.
 * The points sit between the cage and the racks rather than out in the aisle, so the blue is a glow
 * coming out of the enclosure instead of a wash across the floor. They hang at 2.2 m, over the rack
 * tops: at eye height a point light 0.4 m off a rack front burns a blue blob into the middle of the
 * row, which the eye reads as a lamp rather than as the row being lit.
 */
export function lights(): Placement[] {
  return [
    { kind: 'spot', position: [-62, H - 0.2, -31], target: [-62, 0, -31], color: 0xdff0f6, intensity: 60, distance: 20, angle: Math.PI / 2.4, penumbra: 0.7, decay: 1.7 },
    { kind: 'spot', position: [-70, H - 0.2, -31], target: [-70, 0, -31], color: 0xdff0f6, intensity: 60, distance: 20, angle: Math.PI / 2.4, penumbra: 0.7, decay: 1.7 },
    { kind: 'point', position: [XC, 2.2, RACK_Z.south + 0.9], color: 0x2a6fd6, intensity: 6, distance: 9, decay: 2 },
    { kind: 'point', position: [XC, 2.2, RACK_Z.north - 0.9], color: 0x2a6fd6, intensity: 6, distance: 9, decay: 2 },
  ];
}
