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

/**
 * The fittings. Two rows of hung battens down the hall, 3.5 m either side of the walked line, and
 * the two cold spots sit exactly under one batten in each row, staggered, so every pool on the
 * floor has a fitting over it. `BATTEN_Y` is the housing's own centre: the housing hangs 0.35 m
 * below the dark ceiling on its rods.
 */
export const BATTEN_ROWS = [-34.5, -27.5] as const;
export const BATTEN_XS = [-74, -71, -68, -65, -62] as const;
export const BATTEN_DROP = 0.35;
export const BATTEN_Y = H - 0.035 - BATTEN_DROP;
export const SPOT_FITTINGS: [number, number][] = [[-65, BATTEN_ROWS[0]], [-71, BATTEN_ROWS[1]]];

/** By ordinal along the row from the east end: the north rack that is burning. It stands next to
 *  the dead one, which is the order those two things happen in. */
export const FIRE_NORTH = 5;

/**
 * The tape. Each cage run's west end post is tied to a stanchion out in the hall, one run each
 * side, and the middle is left open for the walk. The stanchions stand where the spline is already
 * curving north toward the credentials door, so the north one sits further up the hall than its
 * mirror: at z -28.6 it would have been 1.3 m off the walked line.
 */
export const TAPE_Y = 0.95;
export const STANCHIONS: [number, number][] = [[-73.4, -33.3], [-73.4, -27.2]];
export const TAPE_RUNS: [[number, number], [number, number]][] = [
  [[X0 + 2, CAGE_Z.south], STANCHIONS[0]],
  [[X0 + 2, CAGE_Z.north], STANCHIONS[1]],
];

/** The cartons dropped at the south gate: two on the floor and one set square on the first. */
export const CARTONS: [number, number, number, number, number][] = [
  [GATE_X + 0.75, 0, -34.2, 0.25, 1],
  [GATE_X + 1.32, 0, -34.38, 0.08, 0.92],
  [GATE_X + 0.75, 0.38, -34.2, 0.25, 0.82],
];
