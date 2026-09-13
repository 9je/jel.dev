import type { Placement } from '../../rig';
import { Z0, FITTINGS } from './layout';
/**
 * Four spots and two points over 36 m of room. All four are warm white against the cold white every
 * other room in the building is lit with: a staff room is the one place with a different bulb in it,
 * and the warmth is half of why it reads as somewhere people sat down. The west pair used to be one
 * cold spot over a service passage, which is what made the far half read as the detail running out.
 *
 * Each spot hangs at a batten the dressing draws at the same position, and aims at the wall the
 * things under it stand against, rather than straight down the middle of the room at nothing.
 *
 * The two points are the room's glow: one inside the lit drinks machine and one over the arcade row,
 * both in the room's accent, both short range so they pool on the wall behind rather than washing
 * the whole room blue.
 */
export function lights(): Placement[] {
  const room = { color: 0xf1ece0, angle: Math.PI / 2.4, penumbra: 0.8, decay: 1.7 } as const;
  const [kitchen, row, lounge, west] = FITTINGS;
  return [
    { kind: 'spot', position: [kitchen[0], 3.02, kitchen[1]], target: [kitchen[0], 0.95, kitchen[1] - 0.9], intensity: 32, distance: 16, ...room },
    // The row's own fitting stands nearly two metres off the wall and throws into the cabinet faces
    // rather than down the wall behind them. Hung tight to the wall with a wide cone it washed the
    // panel to the ceiling and blew the sign on it to a white rectangle, and it was doing very
    // little for the cabinets themselves, which are vertical and take almost nothing off a ceiling.
    { kind: 'spot', position: [row[0], 3.02, row[1]], target: [row[0], 1.25, row[1] - 1.2], intensity: 44, distance: 16, ...room, angle: Math.PI / 4 },
    { kind: 'spot', position: [lounge[0], 3.02, lounge[1]], target: [lounge[0] - 0.4, 0, lounge[1] - 1.4], intensity: 52, distance: 18, ...room },
    { kind: 'spot', position: [west[0], 3.02, west[1]], target: [west[0] - 0.5, 0, west[1] - 1.2], intensity: 62, distance: 22, ...room },
    { kind: 'point', position: [-30.95, 1.2, Z0 + 0.7], color: 0x3d7be0, intensity: 3.4, distance: 4.5, decay: 2 },
    { kind: 'point', position: [-28.1, 1.85, Z0 + 1.2], color: 0x3d7be0, intensity: 5, distance: 4.5, decay: 2 },
  ];
}
