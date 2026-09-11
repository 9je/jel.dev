/** The break room. It is the old corridor: x from the bay's outer wall to the server hall, 8 m
 *  wide about z -31, 5 m tall. The walk runs down the middle at z -31 and everything stands
 *  against a wall. The hold at (-28, -31) looks south west at the cabinets. */
export const X0 = -58, X1 = -20, Z0 = -35, Z1 = -27, H = 5;
export const W = X1 - X0, D = Z1 - Z0, XC = (X0 + X1) / 2, ZC = (Z0 + Z1) / 2;
/** Openings: the bay at the east end (full width), the server hall at the west end (full width).
 *  Spacing widened from the brief's 1.2 m to 2.4 m: the hold looks down the row at a shallow angle,
 *  and at 1.2 m the near cabinet's body hid the other three behind it. */
export const CABINETS: [string, string, number][] = [['torn-bet', 'torn.bet', -31.4], ['faction-tools', 'faction.tools', -33.8], ['kayou-bot', 'Kayou', -36.2], ['character-bot', 'character bot', -38.6]];
export const ACCENT = '#3D7BE0';

/**
 * The east landing: the elbow behind the bay's exit. The walk leaves the bay southward through the
 * gap in its far wall at z -30, crosses this landing and turns west through the RECREATION doorway.
 * It used to be unbuilt space, which is the black void between the two rooms in Jordan's screens.
 * Its north side is the bay's own opening (fabrication EXIT_X0..EXIT_X1 at z -30), so nothing is
 * built there.
 */
export const LANDING = { x0: -17.6, x1: -12, z0: -35, z1: -30 };

/**
 * The two doorways this room owns. A doorway's vestibule is a length of wall the walk passes
 * through, so its two mouths are the two shells' wall planes and neither room builds a plane inside
 * it: BAY_DOOR runs from this room's east edge (X1, -20) to the bay's EXIT_X0 (-17.6), HALL_DOOR
 * from the server hall's east wall (X0, -58) to this room's west closure at -56.4. `x` is the frame
 * plane, the middle of the run, and the lit sign hangs over the mouth the walk arrives at.
 */
export const BAY_DOOR = { x: -18.8, z: -32.5, w: 5, h: 4.2, depth: 2.4 };
export const HALL_DOOR = { x: -57.2, z: -31, w: 4, h: 3.2, depth: 1.6 };
