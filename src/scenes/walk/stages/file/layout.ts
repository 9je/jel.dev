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
 * The desk. One purpose built control desk, six metres long under the window with its long axis
 * along z and its north end against the north wall: a laminate worktop with a rounded front edge, a
 * raised instrument tier along the back of it that the screens stand on, a steel modesty panel with
 * the cable ducts on it, and pedestal legs. `x` is the centre line the run is built about, `top` is
 * the worktop, and `tier` is how far the instrument tier stands above it. `front` and `back` are
 * the worktop's own x extents and `tierBack` is the tier's: a prop on the worktop is placed between
 * `front` and `back`, and a screen on the tier between `back` and `tierBack`.
 *
 * It stands out in the room rather than against the window wall, two metres in front of where the
 * camera parks. Against the glazing at x -63 the desk was seven metres from the lens and the file
 * on it was a fifty pixel sliver in a thumbnail sized pool: the room read as a control office but
 * the thing the room is about did not read at all. At x -67.5 the same file is a hundred and forty
 * pixels across and its pool is the largest warm area in the frame, and the window with the yard
 * behind it sits above the run instead of behind it, which is the way the reference is composed
 * anyway. The walk ends at (-70, 30) and comes in from (-74.13, 27.8), so the whole run is clear of
 * the line by a metre and a half at its nearest.
 */
export const DESK = { x: -67.5, z0: 28, z1: 34, top: 0.79, tier: 0.25, front: -68.05, back: -67.25, tierBack: -66.9 };
/** Where the open file stands, which is where the lamp is aimed and where the eye is meant to land.
 *  On the front edge of the worktop, 780 pixels across the settled shot: clear of the copy column,
 *  under the window's north end, and 2.9 m off the lens. */
export const FILE = { x: -67.85, z: 31.0 };

/** The ceiling grid the glass room hangs, which is where the one cold ceiling spot has to sit:
 *  `lighting.ts` enumerates the lit troffers from these numbers exactly the way `ceilingGrid` does,
 *  so the spot lands under a lens the room actually draws. */
export const CEILING = { tile: 1.2, litEvery: 6, panel: [1.1, 0.3] as [number, number], intensity: 0.32, tint: 0x9aacb6 };

/** The yard beyond the glass. No walk goes into it: it is dressing, seen through a six metre hole
 *  in a wall from eight metres back, and it is built to be read at that size and no closer. */
export const YARD = { x0: X1, x1: -38, z0: 20, z1: 40, h: 8 };
/** The high bay lamps hanging in the yard. The first is the fitting the sodium spot sits at, ten
 *  metres past the glass on the window's centre line, low enough that its lens shows through the
 *  blinds from the hold and the shaft under it stands clear in the window. The second is dressing:
 *  a lit fitting and a pool with no light of its own, far left in the window. */
export const YARD_LAMPS: [number, number, number][] = [[-52, 3.6, 31], [-44, 4.2, 25]];
