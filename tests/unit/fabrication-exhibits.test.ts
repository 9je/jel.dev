import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { controller, key, adapter } from '../../src/scenes/walk/stages/fabrication/exhibits';

// The office stands each product at the plinth top, face toward +z, on a cap 1.0 m across and
// 1.4 m long. These hold the three to that cap at a scale that reads from the hold, three metres
// off: Jordan's screen 33 was three thumbnails he could not name.
const box = (g: THREE.Group) => { g.updateMatrixWorld(true); return new THREE.Box3().setFromObject(g); };
// A stand in for the store's controller model, at the Sketchfab file's own bounds: 51.8 wide,
// 23.5 tall with the face on top, 33 deep with the grips toward +z.
const gamecube = () => { const m = new THREE.Group(); const mesh = new THREE.Mesh(new THREE.BoxGeometry(51.8, 23.5, 33.1)); mesh.position.set(0, 12, 4.5); m.add(mesh); return m; };
const controllerExhibit = () => controller(gamecube());

describe('fabrication exhibits', () => {
  it.each([['controller', controllerExhibit], ['key', key], ['adapter', adapter]] as const)('%s reads at exhibition scale and stays on the cap', (_name, make) => {
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
  it('leans every product toward the camera, the key most, the adapter least', () => {
    const face = (g: THREE.Group) => { const t = g.children.find((c) => c.rotation.x !== 0); return t?.rotation.x ?? 0; };
    expect(face(controllerExhibit())).toBeGreaterThan(0.4);
    expect(face(key())).toBeGreaterThan(0.4);
    expect(face(adapter())).toBeGreaterThan(0.2); expect(face(adapter())).toBeLessThan(0.5);
  });
  it('fits the controller model to the cap whatever scale it arrives at', () => {
    const b = box(controllerExhibit());
    expect(b.max.x - b.min.x).toBeCloseTo(0.66, 2);
    expect(b.min.y).toBeGreaterThanOrEqual(-0.001);
  });
  it('keeps each product to a handful of draw calls', () => {
    for (const make of [controllerExhibit, key, adapter]) {
      let n = 0; make().traverse((o) => { if ((o as THREE.Mesh).isMesh) n++; });
      expect(n).toBeLessThanOrEqual(10);
    }
  });
});
