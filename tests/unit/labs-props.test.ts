import { describe, expect, it } from 'vitest';
import { rackSlots, gridPitch, cagePosts } from '../../src/scenes/walk/labs/props';

describe('labs kit helpers', () => {
  it('spaces rack beams evenly with a clear floor level', () => {
    expect(rackSlots(3, 4.5)).toEqual([1.5, 3, 4.5]);
    expect(rackSlots(1, 2)).toEqual([2]);
  });
  it('fits a ceiling grid to whole tiles', () => {
    expect(gridPitch(10, 8, 1.2)).toEqual({ cols: 8, rows: 6 });
    expect(gridPitch(1, 1, 1.2)).toEqual({ cols: 1, rows: 1 });
  });
  it('always posts a cage run at both edges, even off-pitch', () => {
    const posts = cagePosts(10.4);
    expect(posts[0]).toBeCloseTo(-5.2);
    expect(posts[posts.length - 1]).toBeCloseTo(5.2);
    expect(posts).toHaveLength(6);
    const gaps = posts.slice(1).map((x, i) => x - posts[i]);
    for (const g of gaps) expect(g).toBeCloseTo(gaps[0]);
    expect(cagePosts(2.4).map((x) => +x.toFixed(4))).toEqual([-1.2, 1.2]);
    expect(cagePosts(8)).toEqual([-4, -2, 0, 2, 4]);
  });
});
