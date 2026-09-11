import { describe, expect, it, beforeAll } from 'vitest';
import type * as T from 'three';
import { rackSlots, gridPitch, cagePosts, rackBays } from '../../src/scenes/walk/labs/props';

describe('labs kit helpers', () => {
  it('spaces rack beams evenly with a clear floor level', () => {
    expect(rackSlots(3, 4.5)).toEqual([1.5, 3, 4.5]);
    expect(rackSlots(1, 2)).toEqual([2]);
  });
  it('centres a run of bays on its own middle', () => {
    expect(rackBays(2, 2)).toEqual([-1, 1]);
    expect(rackBays(3, 2.7).map((x) => +x.toFixed(4))).toEqual([-2.7, 0, 2.7]);
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

// The props themselves draw their faces to a canvas, and vitest runs in node with no DOM. A stub
// canvas is enough: nothing here reads a pixel back, it only needs the 2d calls to be accepted.
describe('labs kit props', () => {
  type Props = typeof import('../../src/scenes/walk/labs/props');
  type Three = typeof import('three');
  let THREE: Three;
  let kit: Props;

  beforeAll(async () => {
    const context = () => {
      const state: Record<string | symbol, unknown> = {};
      return new Proxy(state, {
        get: (t, k) => (k in t ? t[k] : () => ({ width: 100, addColorStop() {} })),
        set: (t, k, v) => { t[k] = v; return true; },
      });
    };
    const element = () => { const ctx = context(); return { width: 0, height: 0, getContext: () => ctx }; };
    (globalThis as unknown as { document: unknown }).document = { createElement: () => element() };
    THREE = await import('three');
    kit = await import('../../src/scenes/walk/labs/props');
  });

  it('stands a wrapped pallet at a height a rack level can take', () => {
    for (const seed of [1, 2, 3]) {
      const box = new THREE.Box3().setFromObject(kit.wrappedPallet(seed));
      const height = box.max.y - box.min.y;
      expect(height).toBeGreaterThan(0.8);
      expect(height).toBeLessThan(1.5);
      expect(box.min.y).toBeCloseTo(0);
    }
  });

  it('decks its racking in alpha mapped wire mesh', () => {
    const rack = kit.palletRack(2, 2);
    const decked = rack.children.filter((o) => o instanceof THREE.Mesh && (o.material as T.MeshStandardMaterial).alphaMap);
    expect(decked).toHaveLength(1);
    const material = (decked[0] as T.Mesh).material as T.MeshStandardMaterial;
    expect(material.alphaTest).toBe(0.5);
    expect(material.transparent).toBe(false);
  });
});
