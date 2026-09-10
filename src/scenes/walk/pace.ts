export interface Pacer { frame(): void; pace(): Promise<void> }

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
  let waiting: Promise<void> | null = null;
  return {
    frame() { start = now(); },
    pace() {
      if (now() - start < budgetMs) return Promise.resolve();
      // Every caller in the same frame shares one wait, so a burst of pace() calls costs one frame.
      waiting ??= new Promise<void>((resolve) => nextFrame(() => { start = now(); waiting = null; resolve(); }));
      return waiting;
    },
  };
}
