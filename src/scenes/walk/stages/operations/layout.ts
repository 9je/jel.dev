/** The server hall: the old lab space, x -76..-58, 14 m wide about z -31, 4.5 m tall. The walk
 *  enters at x -58 and holds there looking down the hall, then leaves through the west end toward
 *  the credentials hall. Racks stand against both long walls, cages in front of them. */
export const X0 = -76, X1 = -58, Z0 = -38, Z1 = -24, H = 4.5;
export const W = X1 - X0, D = Z1 - Z0, XC = (X0 + X1) / 2, ZC = (Z0 + Z1) / 2;
export const RACK_Z = { south: Z0 + 0.6, north: Z1 - 0.6 };
export const CAGE_Z = { south: Z0 + 2.2, north: Z1 - 2.2 };
export const RACK_XS = [-73, -71.5, -70, -68.5, -67, -65.5, -64, -62.5];
export const GATE_X = -63;

/** The credentials hall's east wall plane. The two shells overlap by a metre here, and that metre is
 *  the thickness the doorway between them is cut through. */
export const CREDENTIALS_X = -75;

/**
 * The two end openings. East (X1) is the break room's doorway: the break room owns that vestibule
 * and this wall closes around its far mouth, which sits on X1 itself. West (X0) is this room's own
 * doorway into the credentials hall, matching the gate that hall already leaves at z -30..-27.
 */
export const EAST_OPEN = { z0: -33, z1: -29, h: 3.2 };
export const WEST_OPEN = { z0: -30, z1: -27, h: 3.2 };
/** The credentials doorway: frame plane midway through the metre of wall, one mouth on each shell. */
export const HALL_DOOR = {
  x: (X0 + CREDENTIALS_X) / 2, z: (WEST_OPEN.z0 + WEST_OPEN.z1) / 2,
  w: WEST_OPEN.z1 - WEST_OPEN.z0, h: WEST_OPEN.h, depth: CREDENTIALS_X - X0,
};
