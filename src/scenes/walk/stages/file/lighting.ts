import type { Placement } from '../../rig';
import { H, FILE, DESK, X1, XC, ZC } from './layout';

/**
 * Two spots and two points, and the whole room is in the order they are listed.
 *
 * The warm point is the bold element: half a metre over the open file, at the lamp head's own
 * height, running 1.9 candela into a 1.6 m falloff. Everything else in the room is a fraction of
 * that, so the form in the pool is the only properly lit thing in the frame, which is the one thing
 * the last frame of the walk has to say.
 *
 * Two numbers took three passes to land. It sits over the file rather than at the lamp, most of a
 * metre off the shade: any closer and the lamp's own arm is a glowing orange squiggle, which is the
 * mistake the switchgear room already made once. And it runs at 1.9 rather than at the 4.2 it was
 * drawn with, because the form is propped facing the lens a third of a metre under it: at 4.2 the
 * page clipped to flat white and the only thing left on it was the dark of the header band. The
 * 1.6 m falloff is the second half of that: it stops the pool a foot past the folder, so the desk
 * around it goes back to grey and the window return behind it is not lit warm by a desk lamp.
 *
 * The sodium spot stands out in the yard and shines back through the window. It casts no shadows,
 * so the wall the window is cut in does not stop it, and it is aimed along the desk rather than
 * across the room. It ran at 60 in the first pass and that is not a shaft through a window, it is a
 * floodlit room: the tile went terracotta, the desk top blew to white and the file's own pool had
 * nothing left to be brighter than. At 14 into a narrower cone it is a wash down the desk run and
 * the window reveal, and the room behind it stays grey.
 *
 * The cold point at the live monitor is a screen's worth of light and nothing more. The cold ceiling
 * spot is the room's own fittings, run at 26 rather than the 78 the switchgear room uses: a control
 * room with its lights up is an office, and the reference is an office at the end of a shift.
 */
export function lights(): Placement[] {
  return [
    { kind: 'spot', position: [X1 + 6, 3.4, ZC + 1], target: [XC + 3.5, 1.0, ZC + 1.5], color: 0xe0813a, intensity: 14, distance: 20, angle: Math.PI / 8, penumbra: 0.85, decay: 1.6 },
    { kind: 'spot', position: [XC + 0.5, H - 0.1, ZC], target: [XC + 0.5, 0, ZC], color: 0xbcd2dc, intensity: 26, distance: 10, angle: Math.PI / 2.6, penumbra: 0.9, decay: 1.7 },
    { kind: 'point', position: [FILE.x - 0.12, DESK.top + 0.46, FILE.z - 0.06], color: 0xffc98a, intensity: 1.9, distance: 1.6, decay: 2 },
    { kind: 'point', position: [DESK.x + 0.15, DESK.top + 0.36, 33.62], color: 0x6ec1d6, intensity: 1.4, distance: 1.8, decay: 2 },
  ];
}
