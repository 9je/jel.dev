export interface Pacer {
  frame(): void;
  pace(): Promise<void>;
  /** Milliseconds of paced work charged to the current frame: from the top of the frame, or from
   *  wherever the last wait resumed, up to the most recent `pace()`. Read it before `frame()` and
   *  it is the previous frame's total, which is what the frame time needs discounting by. */
  spent(): number;
}

/**
 * A frame budget for work that runs while the walk is live. A room build calls `pace()` between
 * props. While the current frame has time left the call returns at once. Once it has spent the
 * budget, the call waits for the next frame.
 *
 * The render loop calls `frame()` at the top of every frame, before that frame draws. A `pace()`
 * call resumed from a wait fires later in that same frame, after the draw, and resets the clock
 * from there rather than from the top. So a frame that resumes paced work can cost the draw plus a
 * full budget window, not the draw eating into the budget.
 */
export function createPacer(budgetMs = 4, now: () => number = () => performance.now(), nextFrame: (cb: () => void) => unknown = (cb) => requestAnimationFrame(cb)): Pacer {
  let start = now();
  // `open` is the run in progress, measured to its last pace(); `closed` is the runs before it that
  // this frame has already finished. A frame resuming a wait has both: nothing, then the resumed run.
  let open = 0, closed = 0;
  let waiting: Promise<void> | null = null;
  return {
    frame() { start = now(); open = 0; closed = 0; },
    pace() {
      open = now() - start;
      if (open < budgetMs) return Promise.resolve();
      // Every caller in the same frame shares one wait, so a burst of pace() calls costs one frame.
      waiting ??= new Promise<void>((resolve) => nextFrame(() => { closed += open; open = 0; start = now(); waiting = null; resolve(); }));
      return waiting;
    },
    spent() { return closed + open; },
  };
}
