import { beforeAll, describe, expect, it } from 'vitest';
import type { reel as Reel, reelWindow as ReelWindow } from '../../src/scenes/walk/labs/reel';

// The reel starts on a canvas, and vitest runs in node: a stub is enough, nothing reads a pixel.
let reel: typeof Reel, reelWindow: typeof ReelWindow;
beforeAll(async () => {
  const ctx = new Proxy({} as Record<string | symbol, unknown>, { get: (t, k) => (k in t ? t[k] : () => undefined), set: (t, k, v) => { t[k] = v; return true; } });
  (globalThis as unknown as { document: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
  ({ reel, reelWindow } = await import('../../src/scenes/walk/labs/reel'));
});

describe('a reel of frames on a screen in the room', () => {
  it('reads its grid left to right, top row first', () => {
    expect(reelWindow(0, 2, 2)).toEqual({ x: 0, y: 0.5 });
    expect(reelWindow(1, 2, 2)).toEqual({ x: 0.5, y: 0.5 });
    expect(reelWindow(2, 2, 2)).toEqual({ x: 0, y: 0 });
    expect(reelWindow(3, 2, 2)).toEqual({ x: 0.5, y: 0 });
  });
  it('steps a frame at a time and comes round again', () => {
    const r = reel('/x.webp', 2, 2, 1, {}, () => {});
    r.update(1.5); expect(r.texture.offset.toArray()).toEqual([0.5, 0.5]);
    r.update(3); expect(r.texture.offset.toArray()).toEqual([0, 0.5]);
  });
  it('lets go of the placeholder before it takes the real image, whenever that lands', () => {
    // The renderer may already have given the 2 by 2 placeholder its storage, which cannot be
    // resized. Swapping the image in place then fails without a word and the screen stays black.
    let land: (img: unknown) => void = () => {};
    const r = reel('/x.webp', 2, 2, 1, {}, (_url, done) => { land = done; });
    let released = 0;
    r.texture.addEventListener('dispose', () => { released++; });
    const version = r.texture.version;
    const img = { width: 480, height: 480 };
    land(img);
    expect(released).toBe(1);
    expect(r.texture.image).toBe(img);
    expect(r.texture.version).toBeGreaterThan(version);
  });
  it('ignores an image that lands after the room is gone', () => {
    let land: (img: unknown) => void = () => {};
    const r = reel('/x.webp', 2, 2, 1, {}, (_url, done) => { land = done; });
    const before = r.texture.image;
    r.dispose();
    land({ width: 480, height: 480 });
    expect(r.texture.image).toBe(before);
  });
});
