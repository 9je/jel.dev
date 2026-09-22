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

/**
 * By ordinal along the row from the east end: the north rack that is burning. It stands next to the
 * dead one, which is the order those two things happen in.
 *
 * Which ordinal is a framing decision, not a dressing one. The hold looks west down the aisle from
 * x -58, so a rack's angle off the centre of the frame is its distance off the row divided by its
 * distance down the hall: the north row is 6.4 m off the line, so the fifth rack along sat 36
 * degrees out, which on a 55 degree lens is hard against the left edge behind the room's own copy.
 * The fire was built, lit, smoking and strobing there for a week and could not be seen. Far enough
 * down the hall and the same rack is 25 degrees out, which is inside the clear band between the
 * copy column and the doorway.
 */
export const FIRE_NORTH = 2;

/**
 * The tape. Each cage run's west end post is tied to a stanchion out in the hall, one run each
 * side, and the middle is left open for the walk. The stanchions stand where the spline is already
 * curving north toward the credentials door, so the north one sits further up the hall than its
 * mirror: at z -28.6 it would have been 1.3 m off the walked line.
 */
/**
 * The service trunk overhead: one run the length of the hall, over the south cage line.
 *
 * Its z is the whole of it and it is here rather than buried in the dressing so a test can hold it
 * to its reason. The walk stops at the east end of this hall and looks west, and the trunk runs
 * west, so the trunk lies along the camera's own axis and its near end is at the camera's own x.
 * Anything on that axis foreshortens without limit: over the aisle it was an ochre wedge laid
 * across the top of the frame rather than a pipe, and nudging it 1.8 m off the walked line moved
 * the wedge without shrinking it. Turning it into an L took the wedge away and put a bar across the
 * whole top of the frame instead, which is the same object being loud in a new direction.
 *
 * The answer is lateral distance, not routing. At 4.8 m off the line the near end sits square
 * beside the lens and falls outside the frame entirely, and what is left is a line entering at the
 * right edge and running away to the west wall. That is also where the pipe belongs: over the cage
 * in front of the south rack row, above the tray it feeds, rather than over the walkway.
 */
export const TRUNK = { y: 4.2, z: CAGE_Z.south };

export const TAPE_Y = 0.95;
export const STANCHIONS: [number, number][] = [[-73.4, -33.3], [-73.4, -27.2], [-74.7, -35.5], [-74.7, -25.5]];
/** Post to post, both ends. Each run used to start on a point out by the west wall with nothing at
 *  it, so the tape read as tied to the paint: "this tape seems unnaturally placed". A tape is tied
 *  to something at both ends or it is not a tape. */
export const TAPE_RUNS: [[number, number], [number, number]][] = [
  [STANCHIONS[2]!, STANCHIONS[0]!],
  [STANCHIONS[3]!, STANCHIONS[1]!],
];

/** The cartons dropped at the south gate: two on the floor and one set square on the first. */
export const CARTONS: [number, number, number, number, number][] = [
  [GATE_X + 0.75, 0, -34.2, 0.25, 1],
  [GATE_X + 1.32, 0, -34.38, 0.08, 0.92],
  [GATE_X + 0.75, 0.38, -34.2, 0.25, 0.82],
];
