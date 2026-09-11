import { describe, expect, it } from 'vitest';
import { createPacer } from '../../src/scenes/walk/pace';

function fakeClock() {
  let t = 0; const frames: (() => void)[] = [];
  return {
    now: () => t, advance: (ms: number) => { t += ms; },
    nextFrame: (cb: () => void) => { frames.push(cb); },
    tick() { const list = frames.splice(0); for (const f of list) f(); },
    pending: () => frames.length,
  };
}

describe('pacer', () => {
  it('resolves at once while the frame has budget left', async () => {
    const c = fakeClock(); const p = createPacer(4, c.now, c.nextFrame);
    p.frame(); c.advance(2);
    let done = false; p.pace().then(() => { done = true; });
    await Promise.resolve();
    expect(done).toBe(true); expect(c.pending()).toBe(0);
  });
  it('waits for the next frame once the budget is spent', async () => {
    const c = fakeClock(); const p = createPacer(4, c.now, c.nextFrame);
    p.frame(); c.advance(5);
    let done = false; p.pace().then(() => { done = true; });
    await Promise.resolve();
    expect(done).toBe(false); expect(c.pending()).toBe(1);
    c.advance(10); c.tick(); await Promise.resolve(); await Promise.resolve();
    expect(done).toBe(true);
  });
  it('counts the budget from the top of the frame, render time included', async () => {
    const c = fakeClock(); const p = createPacer(4, c.now, c.nextFrame);
    p.frame(); c.advance(3);
    await p.pace();              // 3 ms in: fine
    c.advance(3);                // 6 ms in: over
    let done = false; p.pace().then(() => { done = true; });
    await Promise.resolve();
    expect(done).toBe(false);
  });
  it('reports the milliseconds paced work spent in the frame', async () => {
    const c = fakeClock(); const p = createPacer(4, c.now, c.nextFrame);
    p.frame();
    expect(p.spent()).toBe(0);
    c.advance(2);
    await p.pace();
    // 2 ms of work behind it, whatever the frame does with the rest of its time.
    expect(p.spent()).toBe(2);
    c.advance(9);
    expect(p.spent()).toBe(2);
  });
  it('counts the run it waited out, and starts the next frame count from the resume', async () => {
    const c = fakeClock(); const p = createPacer(4, c.now, c.nextFrame);
    p.frame(); c.advance(5);
    void p.pace();
    // Over budget: the work still ran for those 5 ms and this frame is charged for them.
    expect(p.spent()).toBe(5);
    c.advance(10);
    // The render loop opens the next frame before the wait resumes, so the frame reads the run it
    // is about to be charged for, then resets.
    expect(p.spent()).toBe(5);
    p.frame();
    expect(p.spent()).toBe(0);
    c.tick(); await Promise.resolve(); await Promise.resolve();
    // The resumed run is measured from the resume, not from the top of the frame the draw owns.
    c.advance(3); await p.pace();
    expect(p.spent()).toBe(3);
  });
  it('shares one wait across a burst of over-budget calls, then queues a fresh wait next frame', async () => {
    const c = fakeClock(); const p = createPacer(4, c.now, c.nextFrame);
    p.frame(); c.advance(5);
    const first = p.pace();
    const second = p.pace();
    // A burst of pace() calls in the same over-budget frame all key off the same wait.
    expect(second).toBe(first);
    expect(c.pending()).toBe(1);
    c.advance(10); c.tick(); await Promise.resolve(); await Promise.resolve();
    c.advance(5);
    const third = p.pace();
    // Once that frame's wait has resolved, a later over-budget call gets its own new wait.
    expect(third).not.toBe(first);
    expect(c.pending()).toBe(1);
  });
});
