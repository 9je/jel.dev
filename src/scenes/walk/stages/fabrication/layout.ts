// The hangar. x right, z toward the booth: the path enters through the booth door at z 22 and leaves
// through the gap in the far wall at x -20..-12. The room is deliberately off centre. The camera
// hugs the left third of it, so the right wall sits at x 14 rather than mirroring x -20, which is
// what puts the right hand dressing and the LED board inside the cone the camera can actually see.
export const X0 = -20, X1 = 14, Z0 = -30, Z1 = 22, H = 12;
export const W = X1 - X0, D = Z1 - Z0, XC = (X0 + X1) / 2, ZC = (Z0 + Z1) / 2;

/** The exit to the break room. The far wall stops short of the left corner and the break room's own
 *  landing picks up behind it (recreation/layout LANDING). EXIT_X0 is the landing-side face of the
 *  RECREATION doorway's vestibule, so the two shells meet on the same plane with no gap: move one
 *  and move the other. The corner between EXIT_X0 and X0 is walled, which is what turns the old 8 m
 *  hole into a doorway. EXIT_H is the landing's ceiling height. */
export const EXIT_X0 = -17.6, EXIT_X1 = X0 + 8, EXIT_H = 5;

/** Columns, in two lines either side of the aisle. */
export const COLUMNS: [number, number][] = [[-14, 8], [10, 8], [-14, -12], [10, -12], [-14, -24], [10, -24]];

/** The dispatch office, a glass room straddling the aisle. The camera enters through the front
 *  door, holds inside looking west at the exhibits, and leaves through the back door. Door centres
 *  sit on the walked line at each face (path x is about -1.7 at z -7 and -3.3 at z -15, so the back door clears the walked line by 0.4 m on the left). */
export const OFFICE = { x: -2.4, z: -11, w: 10, d: 8, h: 3.2, sill: 0.9, frontDoorX: -1.7, backDoorX: -2.6, doorW: 2.2 };

/** The walked line through the hall, from just inside the door to the exit gap. Mirrors the spline's
 *  control points in path.ts so the painted aisle follows the camera. */
export const AISLE: [number, number][] = [[0, 22], [0, 12], [-1, 0], [-3, -14], [-6.6, -22.6]];
/** Where the aisle paint stops and a single line across the exit takes over: the turn into the
 *  corridor is too tight for two offset lines to follow without crossing. */
export const EXIT_LINE_Z = -29.4;
export const AISLE_HALF = 3.2;

/** Height of the blockwork course. Below it the wall is painted block, above it profiled cladding,
 *  and the join is where the first girt runs. */
export const CLAD_Y = 4;
/** Girt heights, on every wall that reaches them. */
export const GIRTS = [4.0, 7.0, 10.0];

/** Palette. Cold concrete, the Terragroup blue dado, worn safety yellow, sodium only at the docks. */
export const PAINT = 0x2455a4, SAFETY = 0xe8b923, AISLE_PAINT = 0xc9a227, SODIUM = 0xe0813a, FLOOR_TINT = 0x8fa8ba;
/** The shell's two courses and the steel that ties them: block, cladding, girt. */
export const BLOCK_TINT = 0xb4c2d0, CLAD_TINT = 0x8a949c, GIRT_TINT = 0x2b3740;
