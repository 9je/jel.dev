/** The break room. It is the old corridor: x from the bay's outer wall to the server hall, 8 m
 *  wide about z -31, 5 m tall. The walk runs down the middle at z -31 and everything stands
 *  against a wall. The hold at (-28, -31) looks south west at the cabinets. */
export const X0 = -58, X1 = -20, Z0 = -35, Z1 = -27, H = 5;
export const W = X1 - X0, D = Z1 - Z0, XC = (X0 + X1) / 2, ZC = (Z0 + Z1) / 2;
/** Openings: the bay at the east end (full width), the server hall at the west end (full width).
 *  Spacing widened from the brief's 1.2 m to 2.4 m: the hold looks down the row at a shallow angle,
 *  and at 1.2 m the near cabinet's body hid the other three behind it. */
export const CABINETS: [string, string, number][] = [['torn-bet', 'torn.bet', -31.4], ['faction-tools', 'faction.tools', -33.8], ['kayou-bot', 'Kayou', -36.2], ['character-bot', 'character bot', -38.6]];
export const ACCENT = '#3D7BE0';
