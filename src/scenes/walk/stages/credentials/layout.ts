/** The credentials hall: x -83..-75, z -30..6, 7 m tall, walled full length and full height on
 *  both sides except the server hall gate (the east wall's opening at z -30..-27, where the walk
 *  arrives from operations, the path crossing x -75 at z about -29.3). Inside that, the glass lab
 *  is inset 0.4 m from each wall (w 7.2, centred on the hall), spanning z -23.8 to -13, with a door
 *  in its south and north faces at x -79.2, width 2.4, both on the walked line, straight there.
 *  North of the lab the hall runs on to the tape line that marks the dressed room's far end. The
 *  hold at (-79.83, -22.37) is inside the lab looking north up its own axis; the camera's x inside
 *  the lab spans -79.84 to -79.02, at least 2.6 m from the glass on either side.
 *  Probed with `cameraAt`: the walk crosses the south door plane at x about -79.4 and the
 *  north door plane (z -13) at x -79.024, both inside the 2.4 m door span (-80.4..-78.0). */
export const X0 = -83, X1 = -75, Z0 = -30, Z1 = 6, H = 7;
export const W = X1 - X0, D = Z1 - Z0, XC = (X0 + X1) / 2, ZC = (Z0 + Z1) / 2;
/** The lab ran to z -25, and this hall's east wall only belongs to this hall north of z -24: south
 *  of that the metre of wall is shared with the server hall and is inside it. The lab's south east
 *  corner stood in that metre, so its glass and roof frame showed through into the server hall
 *  behind the north cage. Its south face now stops short of the shared metre. */
export const LAB = { x: XC, z: -18.4, w: 7.2, d: 10.8, h: 3.2, sill: 0.6, doorX: -79.2, doorW: 2.4 };

/** The service run down both long walls above the dado, and the panels hung under it. */
export const SERVICE_Y = 3.9, PANEL_Y = 3.1;
/** Where the panels hang along the corridor north of the lab, as z. */
export const PANEL_Z = [-11.2, -4.6, 2.0];

/** The viewers: four film viewers on mobile stands down each side of the lab, square to the glass
 *  and facing the aisle, 1.6 m apart. The nearest pair is the one the hold frames largest, and it
 *  carries the two CCNAs. Every stand stands 0.55 m inside its own glass, and the far pair stops
 *  0.2 m short of the lab's north face. */
export const VIEWER_Z = [-18.6, -17.0, -15.4, -13.8];
export const VIEWER_X = { west: XC - 3.6 + 0.55, east: XC + 3.6 - 0.55 };
/** Which certification hangs where, by id, west then east, nearest first: the two CCNAs, then the
 *  security certifications, then Microsoft's. `null` would be a viewer with no film on it,
 *  switched off. */
export const VIEWER_ORDER: { west: (string | null)[]; east: (string | null)[] } = {
  west: ['ccna', 'ejpt', 'md-102', 'az-900'],
  east: ['ccna-cybersecurity', 'security-plus', 'isc2-cc', 'sc-900'],
};

/** Four battens down the corridor north of the lab, hung half a metre off the dark steel ceiling
 *  on rods. The room's two spots sit under the first and the third. `BATTEN_Y` is where a housing
 *  hangs: its rods run `BATTEN_DROP` up from the housing top to plates on the ceiling. */
export const BATTEN_Z = [-10.6, -5.9, -1.1, 3.6];
export const BATTEN_DROP = 0.5;
export const BATTEN_Y = H - BATTEN_DROP - 0.05;
/** The lab's lit ceiling: six 2.2 by 1.1 panels in two rows along the room, local to the lab's
 *  own centre. The points inside the lab sit under two of them. */
export const LAB_PANEL = { size: [2.2, 1.1] as [number, number], x: [-1.2, 1.2], z: [-4.5, -1.2, 2.4], intensity: 0.9 };
