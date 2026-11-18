import { describe, it, expect } from 'vitest';
import { createCalm, needed, APPROACH, SETTLE_MS } from '../../src/scenes/walk/calm';

describe('needed', () => {
  it('is true inside the room and on the approach to it, from either side', () => {
    expect(needed(0.4, 0.332, 0.52)).toBe(true);
    expect(needed(0.332 - APPROACH + 0.001, 0.332, 0.52)).toBe(true);
    expect(needed(0.52 + APPROACH - 0.001, 0.332, 0.52)).toBe(true);
  });
  it('is false a room away', () => {
    expect(needed(0.2, 0.332, 0.52)).toBe(false);
    expect(needed(0.7, 0.332, 0.52)).toBe(false);
  });
});

describe('createCalm', () => {
  it('is still before anything has moved', () => expect(createCalm(() => 0).still()).toBe(true));
  it('is not still while the camera moves, nor for the settle after', () => {
    let t = 1000; const c = createCalm(() => t);
    c.moved(); expect(c.still()).toBe(false);
    t += SETTLE_MS - 1; expect(c.still()).toBe(false);
    t += 2; expect(c.still()).toBe(true);
  });
  it('lets work through while moving once the room is needed', async () => {
    let t = 0; const c = createCalm(() => t, (cb) => { t += 50; c.moved(); cb(); });
    let hurry = false, polls = 0;
    c.moved();
    await c.wait(() => { if (++polls === 3) hurry = true; return hurry; });
    expect(polls).toBe(3);
  });
  it('returns at once when still', async () => {
    const c = createCalm(() => 0, () => { throw new Error('waited'); });
    await c.wait(() => false);
  });
});
