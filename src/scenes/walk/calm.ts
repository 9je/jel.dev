import { STOPS, type StopId } from './path';

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

/** Whether a room's build goes ahead with the camera moving. A room still ahead of the camera does:
 *  a reader who scrolls on without stopping would otherwise reach it unbuilt, and on a slow GPU a
 *  room takes seconds. The hitches that costs land on rooms already built and are a few frames; an
 *  unbuilt room on screen is the whole room. Only a room behind the camera, which a dock jump past
 *  it leaves, waits for the camera to park. */
export function buildNow(t: number, enter: number, leave: number): boolean {
  return needed(t, enter, leave) || enter >= t;
}

/** How far past the end of a room's hold the walk goes before an unbuilt next room stops it. */
export const HOLD_LEAD = 0.004;

/** The room a reader at `t` is about to see and that is not built yet, or null. The walk stops there
 *  under the loading sign until it is: the corridor looks through the next doorway, so the stop
 *  comes as the reader leaves a room's hold, before the unbuilt one can be seen. `dir` is the way
 *  they are walking: back (-1) matters after a deep link, which builds the room it opens in and
 *  leaves the ones behind it for later. */
export function doorHold(t: number, ready: (id: StopId) => boolean, dir: 1 | -1 = 1): StopId | null {
  if (dir < 0) {
    // The last stop whose hold has begun at or before t: inside its hold the reader is reading it,
    // past the hold they are in the transit, walking back into it.
    let k = -1;
    for (let i = 0; i < STOPS.length; i++) if (STOPS[i]!.hold[0] <= t) k = i;
    if (k < 0 || t <= STOPS[k]!.hold[1] + HOLD_LEAD) return null;
    return ready(STOPS[k]!.id) ? null : STOPS[k]!.id;
  }
  const i = STOPS.findIndex((s) => s.enter > t);
  if (i <= 0) return null;
  if (t <= STOPS[i - 1]!.hold[1] + HOLD_LEAD) return null;
  return ready(STOPS[i]!.id) ? null : STOPS[i]!.id;
}

/** Every room an automatic move from `from` to `to` would show: each room it passes into on the way,
 *  and the next one if it ends where `doorHold` would stop a reader. A dock jump or a project link
 *  waits for these under the loading sign, then flies: a flight is never held halfway. */
export function roomsOnTheWay(from: number, to: number): StopId[] {
  const lo = Math.min(from, to), hi = Math.max(from, to);
  const out = STOPS.filter((s) => s.enter > lo && s.enter <= hi).map((s) => s.id);
  const end = doorHold(to, () => false);
  if (end && !out.includes(end)) out.push(end);
  return out;
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
