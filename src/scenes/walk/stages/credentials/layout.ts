/** The credentials hall: x -83..-75, z -30..6, 7 m tall. The glass lab spans the hall's full
 *  width between z -25 and -13, with a door in its south and north faces at x -79.2, width 2.4,
 *  both on the walked line, straight there. Outside that span the long walls (x -83, x -75)
 *  return to dim white panel; the west wall runs the full z -30..6 with no gap; the east wall has
 *  one opening, z -30..-27, where the walk arrives from the server hall (the path crosses x -75 at
 *  z about -29.3); north of the lab the hall runs on to the tape line that marks the dressed
 *  room's far end. The hold at (-79.8, -22.4) is inside the lab looking west at the plates.
 *  Probed with `cameraAt`: the walk crosses the south door plane (z -25) at x -79.445 and the
 *  north door plane (z -13) at x -79.024, both inside the 2.4 m door span (-80.4..-78.0). */
export const X0 = -83, X1 = -75, Z0 = -30, Z1 = 6, H = 7;
export const W = X1 - X0, D = Z1 - Z0, XC = (X0 + X1) / 2, ZC = (Z0 + Z1) / 2;
export const LAB = { x: XC, z: -19, w: W, d: 12, h: 3.2, sill: 0.6, doorX: -79.2, doorW: 2.4 };
export const LAB_Z0 = LAB.z - LAB.d / 2, LAB_Z1 = LAB.z + LAB.d / 2;

/** Plate centres, three per side, mounted on the lab's long glass walls. The hold looks west by
 *  spec, so the east three are never in frame there: they are dressing seen through the glass on
 *  the approach, not a hold-frame subject. */
export const PLATE_Z = { west: [-19, -17, -15], east: [-24, -22, -20] };
export const PLATE_X = { west: X0 + 0.4, east: X1 - 0.4 };
