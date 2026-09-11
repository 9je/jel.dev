import type { Placement } from '../../rig';
import { H, Z0 } from './layout';
/**
 * Three spots and two points. The break room's two are warm white against the cold white every
 * other room in the building is lit with: a staff room is the one place with a different bulb in
 * it, and the warmth is half of why it reads as somewhere people sat down. The passage keeps the
 * building's own cold light, far away and dim, so the lit room reads against the dark one.
 *
 * The two points are the room's glow: one inside the drinks machine and one over the arcade row,
 * both in the room's accent, both short range so they pool on the wall behind rather than washing
 * the whole room blue.
 */
export function lights(): Placement[] {
  return [
    { kind: 'spot', position: [-27, 3.05, -31], target: [-27.4, 0, -32.6], color: 0xf1ece0, intensity: 50, distance: 18, angle: Math.PI / 2.4, penumbra: 0.75, decay: 1.7 },
    { kind: 'spot', position: [-32.6, 3.05, -31], target: [-33, 0, -32.8], color: 0xf1ece0, intensity: 56, distance: 18, angle: Math.PI / 2.4, penumbra: 0.75, decay: 1.7 },
    { kind: 'spot', position: [-46, H - 0.3, -31], target: [-46, 0, -31], color: 0xdff0f6, intensity: 60, distance: 22, angle: Math.PI / 2.6, penumbra: 0.7, decay: 1.7 },
    { kind: 'point', position: [-31.1, 1.2, Z0 + 0.7], color: 0x3d7be0, intensity: 5, distance: 5, decay: 2 },
    { kind: 'point', position: [-33.8, 1.9, Z0 + 1.3], color: 0x3d7be0, intensity: 5, distance: 7, decay: 2 },
  ];
}
