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

// The ceiling grid is the one piece of the kit a room tunes rather than just places: the break room
// hangs 1.2 m troffers on a pattern of its own and drives two of them itself.
describe('the suspended ceiling', () => {
  type Materials = typeof import('../../src/scenes/walk/labs/materials');
  let THREE: typeof import('three');
  let kit: Materials;

  beforeAll(async () => {
    THREE = await import('three');
    kit = await import('../../src/scenes/walk/labs/materials');
  });

  it('lights the pattern the room asks for, not the default diagonal', () => {
    const lit = (i: number, j: number) => i % 6 === 2 && j % 4 === 1;
    const { panels } = kit.ceilingGrid(null, 16, 8, 3.2, { tile: 0.6, lit, panel: [1.2, 0.28] });
    expect(panels.count).toBe(12);
    expect(kit.ceilingGrid(null, 16, 8, 3.2, { tile: 0.6, litEvery: 3 }).panels.count).toBeGreaterThan(80);
  });

  it('hands back every panel the room asked to drive, in the order it asked', () => {
    const lit = (i: number, j: number) => i % 6 === 2 && j % 4 === 1;
    const plain = kit.ceilingGrid(null, 16, 8, 3.2, { tile: 0.6, lit });
    expect(plain.flicker).toEqual([]);
    const driven = kit.ceilingGrid(null, 16, 8, 3.2, { tile: 0.6, lit, flickerIndex: [3, 0] });
    expect(driven.flicker).toHaveLength(2);
    expect(driven.panels.count).toBe(10);
    // Each driven panel carries its own material, or dimming one would dim the other.
    expect(driven.flicker[0].material).not.toBe(driven.flicker[1].material);
    expect(driven.flicker[0].material).not.toBe(driven.panels.material);
    const at = (m: T.InstancedMesh) => new THREE.Matrix4().fromArray(m.instanceMatrix.array as unknown as number[]).elements.slice(12, 15);
    expect(at(driven.flicker[0])).not.toEqual(at(driven.flicker[1]));
  });

  it('finds the lit panel nearest a point under the same pattern', () => {
    const lit = (i: number, j: number) => i % 6 === 2 && j % 4 === 1;
    // 16 by 8 at 0.6 gives 26 by 13 tiles, so the lit columns sit at local x -6.3, -2.7, 0.9, 4.5
    // and the lit rows at local z -3, -0.6, 1.8. Twelve panels, enumerated column by column.
    expect(kit.nearestLitPanel(16, 8, -6.3, -3, { tile: 0.6, lit })).toBe(0);
    expect(kit.nearestLitPanel(16, 8, -2.7, -3, { tile: 0.6, lit })).toBe(3);
    expect(kit.nearestLitPanel(16, 8, 4.5, 1.8, { tile: 0.6, lit })).toBe(11);
  });
});
