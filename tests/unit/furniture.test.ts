import { describe, expect, it, beforeAll } from 'vitest';
import type * as T from 'three';

/**
 * The break room kit draws its faces to a canvas, and vitest runs in node with no DOM. A stub
 * canvas is enough: nothing here reads a pixel back, it only needs the 2d calls to be accepted.
 * What is checked is the handful of numbers a room places furniture by, and the one switch that
 * turns a machine from a working one into a dead one.
 */
describe('the break room kit', () => {
  type Kit = typeof import('../../src/scenes/walk/labs/furniture');
  let THREE: typeof import('three');
  let kit: Kit;

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
    kit = await import('../../src/scenes/walk/labs/furniture');
  });

  it('puts the lights out in an unlit vending machine', () => {
    const header = (m: T.Object3D) => (m.getObjectByName('header') as T.Mesh).material as T.MeshStandardMaterial;
    expect(header(kit.vendingMachine({ accent: '#3D7BE0', lit: false, seed: 1 })).emissiveIntensity).toBe(0);
    expect(header(kit.vendingMachine({ accent: '#3D7BE0', lit: true, seed: 1 })).emissiveIntensity).toBeGreaterThan(1);
  });

  it('stands an arcade cabinet at the height a marquee reads from', () => {
    const box = new THREE.Box3().setFromObject(kit.arcadeCabinet({ title: 'torn.bet', accent: '#3D7BE0', seed: 3 }));
    expect(box.min.y).toBeCloseTo(0, 2);
    expect(box.max.y - box.min.y).toBeGreaterThan(1.85);
    expect(box.max.y - box.min.y).toBeLessThan(1.95);
  });

  it('builds a counter run the length it was asked for', () => {
    for (const len of [3, 4.2]) {
      const box = new THREE.Box3().setFromObject(kit.kitchenette(len));
      expect(box.max.x - box.min.x).toBeCloseTo(len, 1);
    }
  });

  it('gives every locker bay a door', () => {
    const doors = (bays: number) => {
      let n = 0;
      kit.locker(bays).traverse((o) => { if (o.name === 'door') n++; });
      return n;
    };
    expect(doors(4)).toBe(4);
    expect(doors(6)).toBe(6);
  });
});
