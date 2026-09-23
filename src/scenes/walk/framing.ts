/**
 * The lens for a window shape. The walk is composed at 16 by 9 with 55 degrees vertically, which
 * is about 85 across. Two shapes break that:
 *
 * A portrait phone. 55 vertically is 25 across, so it gets a taller lens, and never less than 40
 * across. That is still half a desktop's view, which is why the wide stops pan on a narrow frame
 * (`pan` in path.ts). The phone sheet covers the bottom of the frame too, so the lens is shifted up
 * until the aim sits in the middle of what the sheet leaves showing, not behind the sheet.
 *
 * An ultrawide. 55 vertically on 32 by 9 is 123 across, and the edges of the frame stretch every
 * prop out of shape. Past 100 across the vertical angle closes instead.
 */
export const DESK_VFOV = 55, PHONE_VFOV = 72, MIN_HFOV = 40, MAX_HFOV = 100;
/** Below this aspect a stop's row does not fit and the hold pans across it. */
export const NARROW = 1.1;

const rad = (d: number) => (d * Math.PI) / 180, deg = (r: number) => (r * 180) / Math.PI;

export interface Lens {
  /** Vertical field of the full frame, which is taller than the window when `shift` is set. */
  fov: number; aspect: number; narrow: boolean;
  /** The lens has closed below 46 degrees vertically, which a 21 by 9 screen never reaches and
   *  32 by 9 does. */
  wide: boolean;
  /** When set, the camera draws the bottom `h` rows of a frame `fullH` tall. */
  shift: { fullH: number; y: number } | null;
}

export function lensFor(w: number, h: number, coveredBottom = 0): Lens {
  const aspect = w / h;
  const narrow = aspect < NARROW;
  if (aspect >= 1) {
    const hHalf = Math.tan(rad(DESK_VFOV / 2)) * aspect;
    const capped = Math.min(hHalf, Math.tan(rad(MAX_HFOV / 2)));
    const fov = deg(2 * Math.atan(capped / aspect));
    return { fov, aspect, narrow, wide: fov < 46, shift: null };
  }
  const vHalf = Math.max(Math.tan(rad(PHONE_VFOV / 2)), Math.tan(rad(MIN_HFOV / 2)) / aspect);
  // The aim goes halfway down the part of the window the sheet leaves. A frame taller than the
  // window by twice that lift, cropped to its bottom, puts its centre there.
  const lift = Math.min(coveredBottom, h * 0.35) / 2;
  if (lift < 1) return { fov: deg(2 * Math.atan(vHalf)), aspect, narrow, wide: false, shift: null };
  const fullH = h + 2 * lift;
  // The same angle per pixel as the unshifted lens, over the taller frame.
  return { fov: deg(2 * Math.atan(vHalf * fullH / h)), aspect: w / fullH, narrow, wide: false, shift: { fullH, y: 2 * lift } };
}
