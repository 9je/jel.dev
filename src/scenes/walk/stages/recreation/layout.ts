/**
 * The break room. It is the whole corridor: 38 m from the bay's landing to the server hall, 8 m
 * wide about z -31, under one dropped tile ceiling at 3.2 m.
 *
 * It was two spaces for a day. The east 16 m was the room and the west 22 m was a dark service
 * passage under the shell's own 5 m, which was meant to read as contrast and read instead as the
 * detail running out: "why did you keep the low detail area after it?" So the ceiling, the paint
 * and the dressing now run the full length, and the far half is the lounge: lockers, sofas, a
 * television, a table and chairs.
 *
 * The walk runs down the middle at z -31 and everything stands against a wall, clear of the line by
 * at least 2.6 m either side. The room is 8 m deep, so that leaves 1.4 m of usable depth against
 * each wall, which is what every arrangement below is built inside.
 */
export const X0 = -58, X1 = -20, Z0 = -35, Z1 = -27, H = 5;
export const W = X1 - X0, D = Z1 - Z0, XC = (X0 + X1) / 2, ZC = (Z0 + Z1) / 2;

/**
 * The two doorways this room owns. A doorway's vestibule is a length of wall the walk passes
 * through, so its two mouths are the two shells' wall planes and neither room builds a plane inside
 * it: BAY_DOOR runs from this room's east edge (X1, -20) to the bay's EXIT_X0 (-17.6), HALL_DOOR
 * from the server hall's east wall (X0, -58) to this room's west closure at -56.4. `x` is the frame
 * plane, the middle of the run, and the lit sign hangs over the mouth the walk arrives at.
 *
 * BAY_DOOR's header came down from 4.2 m to 2.8 m with the dropped ceiling: an opening taller than
 * the room it opens into is a hole in the ceiling. Its sign hangs on the landing side, where the
 * shell is still its full height. HALL_DOOR's own header is the room's ceiling, so its sign hangs
 * on a head panel the shell builds at 2.6 m instead (see `shell.ts`).
 */
export const BAY_DOOR = { x: -18.8, z: -32.5, w: 5, h: 2.8, depth: 2.4 };
export const HALL_DOOR = { x: -57.2, z: -31, w: 4, h: 3.2, depth: 1.6 };
/** The room's west wall plane: the near mouth of the server hall's doorway. */
export const HALL_FACE = HALL_DOOR.x + HALL_DOOR.depth / 2;
/** The height of the opening into the server hall as the room sees it, under its head panel. */
export const HALL_HEAD = 2.6;

/** The dropped ceiling: from the west wall plane to the east wall, and its height. */
export const ROOM = { x0: HALL_FACE, x1: X1, ceiling: 3.2 };
export const ROOM_W = ROOM.x1 - ROOM.x0, ROOM_XC = (ROOM.x0 + ROOM.x1) / 2;
/** A 0.6 m tile grid hung with 1.2 m troffers on a 4.8 by 3 m pattern, sixteen of them over the
 *  whole room. Two earlier grids were denser and both got the same note, the last being "the sheer
 *  quantity of them makes the room feel unatural": a fitting every few tiles is a showroom ceiling,
 *  and a corridor nobody has maintained runs two sparse rows with dark tile between them. */
export const TILE = 0.6;
export const LIT = (i: number, j: number) => i % 8 === 3 && j % 5 === 2;
export const PANEL: [number, number] = [1.2, 0.28];

/** The row: four cabinets standing where the drinks machines used to, which is the nearest stretch
 *  of the served wall to the hold and the only place they are the thing the eye lands on. With the
 *  machines in front of them they were the smaller, further pair of objects in their own frame, and
 *  Jordan read the room as being about the drinks twice.
 *
 *  Each carries its own turn out of the wall, rising down the row, so all four marquees face the
 *  hold rather than only the nearest one. The last cabinet is the one he could not read, and it is
 *  the one turned furthest. The turn swings a back corner toward the wall, so the row stands a
 *  little further off it than a square row would need. */
export const CABINET_Z = Z0 + 0.52;
export const CABINETS: [string, string, number, string, number][] = [
  ['torn-bet', 'torn.bet', -30.70, '#3D7BE0', 0.26],
  ['faction-tools', 'faction.tools', -31.66, '#E8B923', 0.36],
  ['kayou-bot', 'Kayou', -32.62, '#D7383A', 0.47],
  ['character-bot', 'character bot', -33.58, '#3FD47A', 0.58],
];
export const ACCENT = '#3D7BE0';

/** Where the room's four spots hang, and where the dressing hangs a batten so each of them has a
 *  fitting over it. The first two wash the served wall at the kitchen and at the arcade row, the
 *  last two stand further out over the lounge. `[x, z]`, and the fitting sits at y 3.1 under the
 *  3.2 m ceiling. Kept here because `lighting.ts` and `dressing.ts` have to agree on them exactly,
 *  which is the whole of the note that a light did not line up with anything. */
export const FITTINGS: [number, number][] = [[-28.2, -33.4], [-32.1, -33.4], [-41.0, -32.0], [-48.5, -32.0]];

/**
 * The east landing: the elbow behind the bay's exit. The walk leaves the bay southward through the
 * gap in its far wall at z -30, crosses this landing and turns west through the RECREATION doorway.
 * Its north side is the bay's own opening (fabrication EXIT_X0..EXIT_X1 at z -30), which is as tall
 * as the shell, so the landing keeps the full 5 m and only the break room drops.
 */
export const LANDING = { x0: -17.6, x1: -12, z0: -35, z1: -30 };
