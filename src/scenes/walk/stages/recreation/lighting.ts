import type { Placement } from '../../rig';
import { Z0 } from './layout';
/**
 * Four spots and two points over 36 m of room. All four are warm white against the cold white every
 * other room in the building is lit with: a staff room is the one place with a different bulb in it,
 * and the warmth is half of why it reads as somewhere people sat down. The west pair used to be one
 * cold spot over a service passage, which is what made the far half read as the detail running out.
 *
 * The two points are the room's glow: one inside the lit drinks machine and one over the arcade row,
 * both in the room's accent, both short range so they pool on the wall behind rather than washing
 * the whole room blue.
 */
export function lights(): Placement[] {
  const room = { color: 0xf1ece0, angle: Math.PI / 2.4, penumbra: 0.75, decay: 1.7 } as const;
  return [
    { kind: 'spot', position: [-27.5, 3.05, -31], target: [-27.9, 0, -32.6], intensity: 50, distance: 18, ...room },
    { kind: 'spot', position: [-33, 3.05, -31], target: [-33.4, 0, -32.8], intensity: 56, distance: 18, ...room },
    { kind: 'spot', position: [-41, 3.0, -31], target: [-41.4, 0, -32.4], intensity: 52, distance: 18, ...room },
    { kind: 'spot', position: [-48.5, 3.0, -31], target: [-49, 0, -32.6], intensity: 62, distance: 22, ...room },
    { kind: 'point', position: [-31.4, 1.2, Z0 + 0.7], color: 0x3d7be0, intensity: 5, distance: 5, decay: 2 },
    { kind: 'point', position: [-33.8, 1.9, Z0 + 1.3], color: 0x3d7be0, intensity: 5, distance: 7, decay: 2 },
  ];
}
