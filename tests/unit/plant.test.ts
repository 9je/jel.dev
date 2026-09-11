import { describe, expect, it, beforeAll } from 'vitest';
import type * as T from 'three';

// The plant kit draws its faces to a canvas, and vitest runs in node with no DOM. A stub canvas is
// enough: nothing here reads a pixel back, it only needs the 2d calls to be accepted.
describe('the server hall kit', () => {
  type Plant = typeof import('../../src/scenes/walk/labs/plant');
  let THREE: typeof import('three');
  let kit: Plant;

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
    kit = await import('../../src/scenes/walk/labs/plant');
  });

  it('stands a rack 2.1 m tall whichever way its door is hung', () => {
    for (const open of [false, true]) {
      const box = new THREE.Box3().setFromObject(kit.serverRack({ seed: 1, open }));
      const height = box.max.y - box.min.y;
      expect(height).toBeGreaterThan(2.05);
      expect(height).toBeLessThan(2.15);
      expect(box.min.y).toBeCloseTo(0);
    }
  });

  it('fits every rack with units on one material the room can pulse', () => {
    const rack = kit.serverRack({ seed: 4 });
    const blink = rack.userData.blink as T.MeshStandardMaterial[];
    expect(blink).toHaveLength(1);
    expect(blink[0].emissiveIntensity).toBeGreaterThan(0);
    // Fourteen slots with three missing by seed, as one batch.
    const batch = rack.children.find((o) => o instanceof THREE.InstancedMesh) as T.InstancedMesh;
    expect(batch.count).toBe(11);
    expect(batch.material).toBe(blink[0]);
  });

  it('leaves a dead rack with its lights out', () => {
    const blink = kit.serverRack({ seed: 1, dead: true }).userData.blink as T.MeshStandardMaterial[];
    expect(blink.length).toBeGreaterThan(0);
    for (const m of blink) expect(m.emissiveIntensity).toBe(0);
  });

  it('hangs a hasp on the gate', () => {
    expect(kit.cageGate().getObjectByName('hasp')).toBeTruthy();
    // Swung open by default, shut when the room asks for it.
    const swing = (g: T.Group) => (g.children[0] as T.Group).rotation.y;
    expect(swing(kit.cageGate())).toBeCloseTo(0.4);
    expect(swing(kit.cageGate(1.2, 2.6, 0))).toBe(0);
  });

  it('rails a cage at the top and at hand height', () => {
    const box = new THREE.Box3().setFromObject(kit.cage(8));
    // The run is 8 m between post centres, plus half an end post at each end.
    expect(box.max.x - box.min.x).toBeCloseTo(8.08);
    expect(box.max.y).toBeCloseTo(2.63);
  });

  it('merges a bundle of differently coloured cables into one mesh', () => {
    const bundle = kit.cableBundle([0, 4, 0], [0, 4, -6], 5);
    expect(bundle).toBeInstanceOf(THREE.Mesh);
    expect((bundle.material as T.MeshStandardMaterial).vertexColors).toBe(true);
    expect(bundle.geometry.getAttribute('color')).toBeTruthy();
    // Sagging below the chord rather than running straight between the two ends.
    const box = new THREE.Box3().setFromObject(bundle);
    expect(box.min.y).toBeLessThan(3.7);
    expect(box.max.y).toBeGreaterThan(3.9);
  });

  it('runs the trunk the length it was asked for', () => {
    const box = new THREE.Box3().setFromObject(kit.trunkPipe(10));
    expect(box.max.x - box.min.x).toBeCloseTo(10, 1);
    expect(box.max.y - box.min.y).toBeLessThan(0.6);
  });
});
