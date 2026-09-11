/**
 * Containment, the switchgear room: x -86..-72, z 6..26, 3.4 m to the tile. Low and wide, which is
 * the whole point of it. Every other room on the walk is four to seven metres tall; this one has a
 * suspended ceiling 1.7 m above the eye, tiles missing out of it, and a blue lit void showing
 * through the gaps.
 *
 * The walk comes north out of the credentials hall through the doorway at z 6, holds 2.16 m short of
 * it at (-79, 3.84), and everything the hold sees is framed by that opening: the room reads through
 * a door before it is walked into. Past the hold the line runs up the aisle to (-79, 18) and then
 * curves east through the office door at (-75.6, 26) into the control room.
 *
 * Probed with `cameraAt`: the hold parks at (-79.00, 3.84) looking north with a two degree drop, so
 * the 3.2 m doorway subtends most of the frame and the ceiling comes into shot from z 7.4 on.
 */
export const X0 = -86, X1 = -72, Z0 = 6, Z1 = 26, H = 3.4;
export const W = X1 - X0, D = Z1 - Z0, XC = (X0 + X1) / 2, ZC = (Z0 + Z1) / 2;

/** The doorway from the credentials hall, which that room owns and cuts through this wall. */
export const HALL_DOOR = { x: -79, w: 3.2, h: 3.0 };
/** The sealed bay: a steel door in the north wall, taped over, with the red glow behind it. */
export const SEALED = { x: -80.2, z: Z1, w: 1.6, h: 2.3 };
/** The control room's door. The office's glass front fills the north wall from -77 east, so this
 *  shell closes only as far as -77 and leaves the rest of the run open for it. */
export const OFFICE_DOOR = { x: -75.6, z: Z1, w: 2.4 };
export const OFFICE_OPEN = { x0: -77, x1: X1 };

/** The table under the lamp, which is the one warm thing in the room. */
export const TABLE = { x: -80.6, z: 12 };
/** Cabinet island centres, three cabinets wide along x, fronts to the walk. */
export const ISLANDS: [number, number][] = [[-83.2, 9], [-83.2, 15.5], [-75.2, 10], [-75.2, 16]];
/** The cream control bank along the west wall. */
export const BANK = { x: X0 + 0.35, z0: 8, z1: 24 };
/** Metres either side of the walked line that stay empty, so nothing is ever walked through. */
export const AISLE_CLEAR = 2.2;

/** Ceiling tiles left out, as grid indices: cols along x, rows from the near end of z. The block of
 *  six over the table is the opening the blue void shows through at the hold, and two singles up
 *  the room keep it from reading as the only damage in the ceiling. Six rather than the three it was
 *  drawn with: a 0.6 m tile seen from seven metres back at eye height is a slot, and three of them
 *  showed as slivers of blue where the reference has a hole you could stand a ladder in. */
export const MISSING: [number, number][] = [
  [10, 8], [11, 8], [12, 8], [10, 9], [11, 9], [12, 9], [6, 20], [13, 27],
];
/** The gaps with cable coming down through them. Not all of them: a cable in every hole is a
 *  curtain, and the eye stops reading them as individual runs. */
export const DROPS: [number, number][] = [[10, 8], [12, 9], [6, 20], [13, 27]];
