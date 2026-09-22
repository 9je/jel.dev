import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import type { cassette as Cassette, controller as Controller, key as Key } from '../../src/scenes/walk/stages/fabrication/exhibits';

// The cassette prints its own label, and vitest runs in node with no DOM. A stub canvas is enough:
// nothing here reads a pixel back, only the shapes the products are built from are measured.
let controller: typeof Controller, key: typeof Key, cassette: typeof Cassette;
beforeAll(async () => {
  const context = () => new Proxy({} as Record<string | symbol, unknown>, {
    get: (t, k) => (k in t ? t[k] : () => ({ width: 100, addColorStop() {} })),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  (globalThis as unknown as { document: unknown }).document = {
    createElement: () => { const ctx = context(); return { width: 0, height: 0, getContext: () => ctx }; },
  };
  ({ controller, key, cassette } = await import('../../src/scenes/walk/stages/fabrication/exhibits'));
});

// The office stands each product at the plinth top, face toward +z, on a cap 1.0 m across and
// 1.4 m long. These hold the three to that cap at a scale that reads from the hold, three metres
// off: Jordan's screen 33 was three thumbnails he could not name.
const box = (g: THREE.Group) => { g.updateMatrixWorld(true); return new THREE.Box3().setFromObject(g); };
// A stand in for the store's controller model, at the Sketchfab file's own bounds: 51.8 wide,
// 23.5 tall with the face on top, 33 deep with the grips toward +z.
const gamecube = () => { const m = new THREE.Group(); const mesh = new THREE.Mesh(new THREE.BoxGeometry(51.8, 23.5, 33.1)); mesh.position.set(0, 12, 4.5); m.add(mesh); return m; };
const controllerExhibit = () => controller(gamecube());

describe('fabrication exhibits', () => {
  it.each([['controller', () => controllerExhibit()], ['key', () => key()], ['cassette', () => cassette()]] as const)('%s reads at exhibition scale and stays on the cap', (_name, make) => {
    const b = box(make());
    // The controller and the adapter are wide, the key is long and raked up: the biggest dimension
    // is what the eye sizes it by.
    expect(Math.max(b.max.x - b.min.x, b.max.y - b.min.y)).toBeGreaterThan(0.5);
    expect(b.max.y).toBeGreaterThan(0.15);
    // Nothing through the cap, nothing over its edges. The product sits 0.14 m east of the cap's
    // centre and turned 0.35 rad, which the office's own layout owns, so the bound here is the cap
    // less that offset.
    expect(b.min.y).toBeGreaterThanOrEqual(-0.001);
    expect(b.min.z).toBeGreaterThan(-0.5); expect(b.max.z).toBeLessThan(0.4);
    expect(b.min.x).toBeGreaterThan(-0.7); expect(b.max.x).toBeLessThan(0.7);
    expect(b.max.y).toBeLessThan(0.75);
  });
  it('leans every product toward the camera at the hold', () => {
    const face = (g: THREE.Group) => { const t = g.children.find((c) => c.rotation.x !== 0); return t?.rotation.x ?? 0; };
    expect(face(controllerExhibit())).toBeGreaterThan(0.4);
    expect(face(key())).toBeGreaterThan(0.4);
    expect(face(cassette())).toBeGreaterThan(0.4);
  });
  // Every product on this row is read from one place, four metres off the glass, and a product laid
  // back toward the cap is read down its own plane: the cassette's face foreshortened into a wedge
  // at 0.95 and the key's bow into a sliver at 0.6. They all stand near upright now. Nothing here
  // goes past 1.4, because past that a product is a card standing on edge and stops reading as an
  // object somebody could pick up.
  it('stands every product up toward the lens rather than laid back on the cap', () => {
    const rake = (g: THREE.Group) => g.children.find((c) => c.rotation.x !== 0)!.rotation.x;
    for (const make of [() => controllerExhibit(), () => key(), () => cassette()]) {
      expect(rake(make())).toBeGreaterThan(0.75);
      expect(rake(make())).toBeLessThan(1.4);
    }
    // The flat object stands the straightest: it has the most to lose to foreshortening.
    expect(rake(cassette())).toBeGreaterThan(rake(key()));
    expect(rake(key())).toBeGreaterThan(rake(controllerExhibit()));
  });
  it('stands the cassette on the cap rather than sinking it into one', () => {
    const b = box(cassette());
    expect(b.min.y).toBeGreaterThanOrEqual(-0.001);
    // A tape at five times life size: wide enough to carry a label that reads from the hold.
    expect(b.max.x - b.min.x).toBeGreaterThan(0.8);
  });
  it('fits the controller model to the cap whatever scale it arrives at', () => {
    const b = box(controllerExhibit());
    expect(b.max.x - b.min.x).toBeCloseTo(0.66, 2);
    expect(b.min.y).toBeGreaterThanOrEqual(-0.001);
  });
  it('keeps each product to a handful of draw calls', () => {
    for (const make of [() => controllerExhibit(), () => key(), () => cassette()]) {
      let n = 0; make().traverse((o) => { if ((o as THREE.Mesh).isMesh) n++; });
      expect(n).toBeLessThanOrEqual(10);
    }
  });
});
