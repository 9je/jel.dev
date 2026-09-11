import type { Placement } from '../../rig';
import { H, SEALED, Z1 } from './layout';

/**
 * One cold spot over the aisle, one red spot behind the sealed door, and a warm point in the lamp.
 *
 * Three lights for a twenty metre room, and that is the room. Every other space on the walk is lit
 * to be looked around; this one is lit so that the eye lands in exactly two places: the page under
 * the lamp, and the red seam around a door that will not open. The ceiling's own fittings carry the
 * rest as emissive geometry, which is what keeps the room cold and flat between those two points.
 *
 * The cold spot sits at z 14 rather than the pair at 10 and 20 the room was drawn with. Two spots
 * plus the red one plus the lamp was over the point budget the rig lends a room, and one wide cone
 * from the tile line reaches both ends: 69 degrees off axis from 3.2 m is an 8 m pool, which covers
 * the aisle from the doorway to the far islands. It runs at 78 rather than the 60 it was drawn at,
 * because the ceiling it replaced sixty six fittings with eighteen no longer lights the room itself.
 *
 * The warm point sits half a metre over the page, at the shade's own height. Inverse square is the
 * whole story here: at the lamp's head it was 5 cm off the model's arm and turned it into a glowing
 * orange squiggle, and a quarter metre over the table it put twice as much light on the top as the
 * whole room gets, which blew the steel to white and took the page on it with it. Half a metre up
 * at 6 candela lands about twice the room's own level on the table, which is a pool rather than a
 * hole burned in the frame, and the page reads dark on light as drawn.
 *
 * The red spot stands outside the room, half a metre past the north wall, aimed back down at the
 * floor inside it. It casts no shadows, so the wall it is behind does not stop it, and the walls
 * themselves face away from it and take none of it: what it actually lights is the floor and the
 * cabinet ends near the sealed door, which is the glow that has to look like it is coming through.
 */
export function lights(): Placement[] {
  return [
    { kind: 'spot', position: [-79, H - 0.2, 14], target: [-79, 0, 14], color: 0xdff0f6, intensity: 78, distance: 22, angle: Math.PI / 2.6, penumbra: 0.7, decay: 1.7 },
    { kind: 'spot', position: [SEALED.x, 1.2, Z1 + 0.6], target: [SEALED.x, 0, Z1 - 3], color: 0xd7383a, intensity: 40, distance: 12, angle: Math.PI / 3, penumbra: 0.9, decay: 1.7 },
    { kind: 'point', position: [-80.6, 1.28, 12.05], color: 0xffc98a, intensity: 6, distance: 3.2, decay: 2 },
  ];
}
