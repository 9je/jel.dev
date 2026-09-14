import { describe, it, expect, vi, afterEach } from 'vitest';
import { onStreak, resetStreakFeed, startStreakFeed } from '../../src/scenes/walk/streak-feed';
import baked from '../../src/content/streak.json';

/**
 * Nothing in the walk waits on this fetch and nothing in the walk may break because of it. These
 * pin the four ways it ends: good data, a missing file, a body that is not a payload, and a server
 * that never answers.
 */
function answer(body: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok, json: async () => body }) as unknown as Response));
}

afterEach(() => { resetStreakFeed(); vi.unstubAllGlobals(); });

describe('the streak feed', () => {
  it('hands the live figures to everything waiting on them', async () => {
    const live = { ...baked, current: 41 };
    answer(live);
    const seen: number[] = [];
    onStreak((d) => seen.push(d.current));
    startStreakFeed();
    await vi.waitFor(() => expect(seen).toEqual([41]));
  });

  it('answers a late caller straight away', async () => {
    answer({ ...baked, current: 41 });
    startStreakFeed();
    await vi.waitFor(() => { let got = 0; onStreak((d) => { got = d.current; }); expect(got).toBe(41); });
  });

  it('says nothing at all when the file is missing', async () => {
    answer('<html>404</html>', false);
    const seen: number[] = [];
    onStreak((d) => seen.push(d.current));
    startStreakFeed();
    await new Promise((r) => setTimeout(r, 20));
    expect(seen).toEqual([]);
  });

  it('says nothing at all when the body is not a payload', async () => {
    answer({ current: 'lots' });
    const seen: number[] = [];
    onStreak((d) => seen.push(d.current));
    startStreakFeed();
    await new Promise((r) => setTimeout(r, 20));
    expect(seen).toEqual([]);
  });

  it('survives a server that refuses the connection', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    const seen: number[] = [];
    onStreak((d) => seen.push(d.current));
    expect(() => startStreakFeed()).not.toThrow();
    await new Promise((r) => setTimeout(r, 20));
    expect(seen).toEqual([]);
  });

  it('fetches once however many times it is started', async () => {
    answer(baked);
    startStreakFeed(); startStreakFeed(); startStreakFeed();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
