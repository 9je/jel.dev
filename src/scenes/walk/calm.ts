/**
 * Holding the background build until the camera is standing still.
 *
 * A room that builds behind the walk has steps that cannot be made small: the first draw of new
 * geometry holds the thread for fifty to two hundred milliseconds on any driver, and that is a
 * dropped frame nobody sees on a parked camera and a stutter everybody sees on a moving one. So the
 * build waits for the walk to stop. The one exception is the room the camera is about to enter:
 * a stutter on the way in is better than walking into the greybox.
 */

/** How long after the last movement the camera counts as parked. Longer than a pause between two
 *  turns of a wheel, shorter than the time it takes to start reading. */
export const SETTLE_MS = 200;
/** How far short of a room's doorway, in walk progress, its build stops waiting. */
export const APPROACH = 0.06;

/** Whether the camera at `t` is in, or closing on, the room that spans `enter` to `leave`. */
export function needed(t: number, enter: number, leave: number): boolean {
  return t >= enter - APPROACH && t <= leave + APPROACH;
}

export interface Calm {
  /** The frame loop calls this on every frame the camera is travelling. */
  moved(): void;
  still(): boolean;
  /** Resolves once the camera is parked, or as soon as `hurry()` says the work cannot wait. */
  wait(hurry: () => boolean): Promise<void>;
}

export function createCalm(now: () => number = () => performance.now(), later: (cb: () => void) => unknown = (cb) => setTimeout(cb, 50)): Calm {
  let last = -Infinity;
  const still = () => now() - last >= SETTLE_MS;
  return {
    moved() { last = now(); },
    still,
    async wait(hurry) {
      while (!still() && !hurry()) await new Promise<void>((r) => later(r));
    },
  };
}
