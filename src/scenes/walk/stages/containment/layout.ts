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

/** Metres either side of the walked line that stay empty, so nothing is ever walked through. */
export const AISLE_CLEAR = 2.2;

/**
 * Cabinet island centres, three cabinets wide along x, fronts to the walk. All four stand down the
 * west side now. They were split two west and two east, which put the near east island between the
 * hold and the cream bank: the walk looks north down a twenty metre room, so anything standing on
 * one side of the aisle hides that side's wall for the whole length of it, and ref 17 never once
 * appeared in a frame.
 */
export const ISLANDS: [number, number][] = [[-82.9, 8.5], [-82.9, 13], [-82.9, 17.5], [-82.9, 22]];
/** Half an island along x (three bays of 0.92) and along z (a 0.7 m carcass plus its plinth). */
export const ISLAND_HALF = { x: 0.92 * 1.5, z: 0.37 };

/**
 * The table under the lamp, which is the one warm thing in the room. It stands against the front
 * of the second island's east cabinet, long side along the doors, rather than loose in the aisle
 * where it was drawn: a table on its own in the middle of a floor is furniture somebody dropped,
 * and against a cabinet it is where somebody sat to work on the panel behind it. Its east edge at
 * -81.45 is a quarter metre outside the aisle's clearance line.
 */
export const TABLE = { x: -82.05, z: 12.25 };
/** The chair, pulled round to the table's west end and turned as if somebody stood up from it. */
export const CHAIR = { x: -83.05, z: 12.15, ry: Math.PI / 2 - 0.35 };
/** The wet floor sign, stood in the aisle beside the tiles that came down, on the clearance line. */
export const WET_SIGN = { x: -81.5, z: 10.3, ry: 0.55 };
/** The generator, against the east wall past the bank's north end, with a lead up to a wall box.
 *  It was parked by the office door, two metres off the curve into the control room and out of
 *  every frame the room is held in. Here the walk out of the room turns straight toward it. */
export const GENERATOR = { x: -73.05, z: 19.9, ry: 0.35 };

/**
 * The cream control bank (ref 17), standing proud of the east wall rather than flat against the
 * west one. Three things decided this. Against the west wall at -85.65 it sits behind the flagship
 * panel for most of its run. Against either wall it is only inside the doorway's own cone from
 * fifteen metres in, because the hold reads the room through a 3.2 m opening from 2.16 m back. And
 * seven metres off the aisle a 0.9 m bay is twenty pixels wide, which is a cream stripe rather than
 * a bank of labelled gear. On the aisle's own clearance line its near bays are five metres from the
 * lens at sixty pixels each, with the window, the dial and the block letter all reading.
 *
 * `x` is the run's centre: the carcass is 0.55 deep and the doors and band stand 0.32 proud, so the
 * face lands exactly on the clearance line at -76.8 and nothing crosses it.
 *
 * It ends at z 17, four metres short of the 21 it was drawn to. The walk leaves the aisle at z 18.8
 * on its way to the office door, and a 2.3 m cream carcass two metres off the lens at that point is
 * half the frame: the transition out of this room was a wall of overexposed cream with BLOCK E
 * stencilled across it. Nine bays from z 8.6 puts the last of them at 16.4, which the camera has
 * already passed, and the hold at (-79, 3.84) still reads the whole run down the far side of the
 * aisle because the run it reads from there is the near half, not the far end.
 */
export const BANK = { x: -76.48, z0: 8.6, z1: 17 };

// ---- The ceiling grid ----------------------------------------------------------------------------
/** The tile pitch the grid is laid on. 0.6 m, so the ceiling is 23 by 33 and a missing tile is a
 *  hole you could put a shoulder through rather than a whole bay of the room. */
export const TILE = 0.6;
export const COLS = Math.floor(W / TILE), ROWS = Math.floor(D / TILE);

/** Which tiles carry a troffer: one in every eighth column and every sixth row, a fitting every
 *  4.8 m across the room and every 3.6 m up it. The shell hands this to `ceilingGrid` and the
 *  lights read their positions back out of it, so a spot never sits anywhere but under a lens. */
export const LIT = (i: number, j: number): boolean => i % 8 === 2 && j % 6 === 2;

/** The world x, z of the troffer in tile `i, j`, by the grid's own arithmetic: whole tiles at the
 *  pitch, centred in the room, so the leftover splits between the two edges. */
export function trofferAt(i: number, j: number): [number, number] {
  return [XC - (COLS * TILE) / 2 + (i + 0.5) * TILE, ZC - (ROWS * TILE) / 2 + (j + 0.5) * TILE];
}

/** The three troffers the room's cold spots hang under, all in the aisle column: the one nearest
 *  the doorway, one mid aisle, and one over the far end by the sealed door. */
export const SPOT_TILES: [number, number][] = [[10, 2], [10, 14], [10, 26]];

/** Where a missing tile actually is in the world. The ceiling is one segmented plane spanning the
 *  full room, so its cells are W/COLS wide rather than exactly TILE, and the cables that hang
 *  through the holes have to be hung off the same arithmetic or they miss. */
export function holeAt(i: number, j: number): [number, number] {
  return [XC - W / 2 + (i + 0.5) * (W / COLS), ZC - D / 2 + (j + 0.5) * (D / ROWS)];
}

/** Ceiling tiles left out, as grid indices: cols along x, rows from the near end of z. The block of
 *  six over the aisle is the opening the blue void shows through at the hold, and two singles up
 *  the room keep it from reading as the only damage in the ceiling. Six rather than the three it was
 *  drawn with: a 0.6 m tile seen from seven metres back at eye height is a slot, and three of them
 *  showed as slivers of blue where the reference has a hole you could stand a ladder in. */
export const MISSING: [number, number][] = [
  [10, 8], [11, 8], [12, 8], [10, 9], [11, 9], [12, 9], [6, 20], [13, 27],
];
/** The gaps with cable coming down through them. Not all of them: a cable in every hole is a
 *  curtain, and the eye stops reading them as individual runs. */
export const DROPS: [number, number][] = [[10, 8], [12, 9], [6, 20], [13, 27]];
