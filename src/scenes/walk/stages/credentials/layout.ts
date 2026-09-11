/** The credentials hall: x -83..-75, z -30..6, 7 m tall. The glass lab spans the hall's full
 *  width between z -28 and -16, with a door in its south and north faces at x -79.6, both on the
 *  walked line. Outside that span the long walls (x -83, x -75) return to dim white panel; south
 *  of it, toward operations, the hall is left open (the path swings wide entering the room and
 *  never nears a wall there); north of it, toward containment, the hall runs on to the tape line
 *  that marks the dressed room's far end. The hold at (-79.8, -22.4) is inside the lab looking
 *  west at the plates. */
export const X0 = -83, X1 = -75, Z0 = -30, Z1 = 6, H = 7;
export const W = X1 - X0, D = Z1 - Z0, XC = (X0 + X1) / 2, ZC = (Z0 + Z1) / 2;
export const LAB = { x: XC, z: -22, w: W, d: 12, h: 3.2, sill: 0.6, doorX: -79.6, doorW: 2.2 };
export const LAB_Z0 = LAB.z - LAB.d / 2, LAB_Z1 = LAB.z + LAB.d / 2;

/** Plate centres, three per side, mounted on the lab's long glass walls. The hold sits at the
 *  room's own centre looking west with a slight lead to the north, so the west wall's visible
 *  span favours z north of the hold and the east wall's favours z south of it: each side's three
 *  are staggered along its own comfortable stretch rather than mirrored across the aisle. */
export const PLATE_Z = { west: [-22, -20, -18], east: [-27, -25, -23] };
export const PLATE_X = { west: X0 + 0.4, east: X1 - 0.4 };
