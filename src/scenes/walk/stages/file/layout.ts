/**
 * The personnel file, which is the control room over the loading yard: x -77..-62, z 26..34, 3.2 m
 * to the tile. The last room on the walk and the last thing anybody sees of it.
 *
 * The walk comes east out of containment through the office door at x -75.6 on z 26, runs along the
 * inside of the glass front and parks at (-70, 30) looking east north east with a fifteen degree
 * drop. Everything is composed for that one frame. Probed with `cameraAt`: at t 1.0 the heading is
 * 63.4 degrees off +z, which puts screen right on +z and screen left on -z, so the room reads from
 * the south end of the window on the left to the north east corner on the right.
 *
 * The copy for this stop stands in the left half of the frame, 96 to 660 pixels across a 1600 wide
 * shot. That is the one fact the layout is built around: everything the room is about has to land
 * right of it. The desk run is under the window down the east wall, and the end of it the camera
 * reads clear of the copy is the north end, so the lamp, the open file and the live screen are all
 * at the north end and the console, the radio and the paperwork fill the run south of them.
 */
export const X0 = -77, X1 = -62, Z0 = 26, Z1 = 34, H = 3.2;
export const W = X1 - X0, D = Z1 - Z0, XC = (X0 + X1) / 2, ZC = (Z0 + Z1) / 2;

/** The door in the glass front, which containment's shell leaves the run of wall open for. Its `x`
 *  is containment's own `OFFICE_DOOR.x`: the spline crosses z 26 at about -75.8. */
export const DOOR = { x: -75.6, w: 2.4 };
/** The height of the white panel band under the glass front. */
export const SILL = 0.9;

/**
 * The window onto the yard, in the east wall. Six metres of it, from y 1.0 to y 2.6, with a metre
 * of return at each end so it reads as an opening cut in a wall rather than as a missing wall. The
 * brief drew it nine metres wide, which is a metre longer than the wall it is cut into.
 */
export const WINDOW = { z0: 27, z1: 33, y0: 1.0, y1: 2.6 };

/**
 * The desk run under the window. Three of the metal office desks end to end, 2 m each, their long
 * axis along z, the north end of the run against the north wall. `x` is the centre of the run, so
 * the tops span x -63.475 to -62.525 and every prop standing on one is placed between those.
 */
export const DESK = { x: -63, z0: 28, z1: 34, top: 0.79 };
/** Where the open file lies, which is where the lamp is aimed and where the camera is meant to
 *  land. North end of the run, clear of the copy column at about 780 pixels across the shot. */
export const FILE = { x: -63.2, z: 32.55 };

/** The yard beyond the glass. No walk goes into it: it is dressing, seen through a six metre hole
 *  in a wall from eight metres back, and it is built to be read at that size and no closer. */
export const YARD = { x0: X1, x1: -38, z0: 20, z1: 40, h: 8 };
