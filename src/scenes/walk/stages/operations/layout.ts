/** The server hall: the old lab space, x -76..-58, 14 m wide about z -31, 4.5 m tall. The walk
 *  enters at x -58 and holds there looking down the hall, then leaves through the west end toward
 *  the credentials hall. Racks stand against both long walls, cages in front of them. */
export const X0 = -76, X1 = -58, Z0 = -38, Z1 = -24, H = 4.5;
export const W = X1 - X0, D = Z1 - Z0, XC = (X0 + X1) / 2, ZC = (Z0 + Z1) / 2;
export const RACK_Z = { south: Z0 + 0.6, north: Z1 - 0.6 };
export const CAGE_Z = { south: Z0 + 2.2, north: Z1 - 2.2 };
export const RACK_XS = [-73, -71.5, -70, -68.5, -67, -65.5, -64, -62.5];
export const GATE_X = -63;
