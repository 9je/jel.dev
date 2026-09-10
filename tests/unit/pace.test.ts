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
