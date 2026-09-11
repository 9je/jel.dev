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
