/** The credentials hall: x -83..-75, z -30..6, 7 m tall, walled full length and full height on
 *  both sides except the server hall gate (the east wall's opening at z -30..-27, where the walk
 *  arrives from operations, the path crossing x -75 at z about -29.3). Inside that, the glass lab
 *  is inset 0.4 m from each wall (w 7.2, centred on the hall), spanning z -25 to -13, with a door
 *  in its south and north faces at x -79.2, width 2.4, both on the walked line, straight there.
 *  North of the lab the hall runs on to the tape line that marks the dressed room's far end. The
 *  hold at (-79.8, -22.4) is inside the lab looking west at the plates; the camera's x inside the
 *  lab spans -79.84 to -79.02, at least 2.6 m from the glass on either side.
 *  Probed with `cameraAt`: the walk crosses the south door plane (z -25) at x -79.445 and the
 *  north door plane (z -13) at x -79.024, both inside the 2.4 m door span (-80.4..-78.0). */
export const X0 = -83, X1 = -75, Z0 = -30, Z1 = 6, H = 7;
export const W = X1 - X0, D = Z1 - Z0, XC = (X0 + X1) / 2, ZC = (Z0 + Z1) / 2;
export const LAB = { x: XC, z: -19, w: 7.2, d: 12, h: 3.2, sill: 0.6, doorX: -79.2, doorW: 2.4 };

/** Plate centres, three per side, mounted just inside the lab's own glass. The hold looks west by
 *  spec, so the east three are never in frame there: they are dressing seen through the glass on
 *  the approach, not a hold-frame subject. */
export const PLATE_Z = { west: [-19, -17, -15], east: [-24, -22, -20] };
export const PLATE_X = { west: XC - 3.6 + 0.25, east: XC + 3.6 - 0.25 };
