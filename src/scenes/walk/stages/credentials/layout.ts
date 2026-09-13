/** The credentials hall: x -83..-75, z -30..6, 7 m tall, walled full length and full height on
 *  both sides except the server hall gate (the east wall's opening at z -30..-27, where the walk
 *  arrives from operations, the path crossing x -75 at z about -29.3). Inside that, the glass lab
 *  is inset 0.4 m from each wall (w 7.2, centred on the hall), spanning z -25 to -13, with a door
 *  in its south and north faces at x -79.2, width 2.4, both on the walked line, straight there.
 *  North of the lab the hall runs on to the tape line that marks the dressed room's far end. The
 *  hold at (-79.83, -22.37) is inside the lab looking north up its own axis; the camera's x inside
 *  the lab spans -79.84 to -79.02, at least 2.6 m from the glass on either side.
 *  Probed with `cameraAt`: the walk crosses the south door plane (z -25) at x -79.445 and the
 *  north door plane (z -13) at x -79.024, both inside the 2.4 m door span (-80.4..-78.0). */
export const X0 = -83, X1 = -75, Z0 = -30, Z1 = 6, H = 7;
export const W = X1 - X0, D = Z1 - Z0, XC = (X0 + X1) / 2, ZC = (Z0 + Z1) / 2;
export const LAB = { x: XC, z: -19, w: 7.2, d: 12, h: 3.2, sill: 0.6, doorX: -79.2, doorW: 2.4 };

/** Plate centres, three per side, on the same three z so the hold sees a matched pair at each step
 *  up the aisle. Jordan's read of the first pass was that the room never showed both walls: the
 *  west three were in shot and the east three sat behind the camera. Every plate stands 0.45 m
 *  inside its own glass, which is the clearance its 0.25 rad turn toward the aisle needs.
 *  The near pair starts at -17.4 rather than -18. The rows are 6.3 m apart and the hold stands
 *  4.97 m short of the near pair: at -18 that pair subtends more than the 85.6 degree horizontal
 *  frame a 55 degree lens gives a 16 by 9 shot, and both near plates are cut by its edges. At
 *  -17.4 the whole run fits, and the far pair still clears the lab's north face. */
export const PLATE_Z = { west: [-17.4, -15.6, -13.8], east: [-17.4, -15.6, -13.8] };
export const PLATE_X = { west: XC - 3.6 + 0.45, east: XC + 3.6 - 0.45 };
/** How far each plate turns off its wall toward the aisle, so both rows face the hold. */
export const PLATE_TURN = 0.25;

/** Four battens down the corridor north of the lab, hung half a metre off the dark steel ceiling
 *  on rods. The room's two spots sit under the first and the third. `BATTEN_Y` is where a housing
 *  hangs: its rods run `BATTEN_DROP` up from the housing top to plates on the ceiling. */
export const BATTEN_Z = [-10.6, -5.9, -1.1, 3.6];
export const BATTEN_DROP = 0.5;
export const BATTEN_Y = H - BATTEN_DROP - 0.05;
/** The lab's lit ceiling: six 2.2 by 1.1 panels in two rows along the room, local to the lab's
 *  own centre. The points inside the lab sit under two of them. */
export const LAB_PANEL = { size: [2.2, 1.1] as [number, number], x: [-1.2, 1.2], z: [-4.2, -0.6, 3.0], intensity: 0.9 };
