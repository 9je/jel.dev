import type { Placement } from '../../rig';
import { LAB, H } from './layout';

/** Two cold points inside the lab light the plates from above; two cold spots outside carry the
 *  corridor. The brightest room in the walk leans on the plates' own emissive faces for its glow. */
export function lights(): Placement[] {
  return [
    { kind: 'point', position: [LAB.x, LAB.h - 0.3, -22], color: 0xdff0f6, intensity: 7, distance: 10 },
    { kind: 'point', position: [LAB.x, LAB.h - 0.3, -16], color: 0xdff0f6, intensity: 7, distance: 10 },
    { kind: 'spot', position: [-79, H - 0.3, -10], target: [-79, 0, -10], color: 0xdff0f6, intensity: 70, distance: 20, angle: Math.PI / 2.6, penumbra: 0.7, decay: 1.7 },
    { kind: 'spot', position: [-79, H - 0.3, 1], target: [-79, 0, 1], color: 0xdff0f6, intensity: 70, distance: 20, angle: Math.PI / 2.6, penumbra: 0.7, decay: 1.7 },
  ];
}
