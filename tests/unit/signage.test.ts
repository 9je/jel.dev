import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';

// The signage kit draws its faces to a canvas, and vitest runs in node with no DOM. A stub canvas is
// enough: nothing here reads a pixel back, it only needs the 2d calls to be accepted and
// measureText to answer with a width so stencilTexture can fit its line.
beforeAll(() => {
  const context = () => {
    const state: Record<string | symbol, unknown> = {};
    return new Proxy(state, {
      get: (t, k) => (k in t ? t[k] : () => ({ width: 100, addColorStop() {} })),
      set: (t, k, v) => { t[k] = v; return true; },
    });
  };
  const element = () => { const ctx = context(); return { width: 0, height: 0, getContext: () => ctx }; };
  (globalThis as unknown as { document: unknown }).document = { createElement: () => element() };
});

type Signage = typeof import('../../src/scenes/walk/labs/signage');
type Three = typeof import('three');

let THREE: Three;
let kit: Signage;
let font: import('three/addons/loaders/FontLoader.js').Font;

beforeAll(async () => {
  THREE = await import('three');
  kit = await import('../../src/scenes/walk/labs/signage');
  const { FontLoader } = await import('three/addons/loaders/FontLoader.js');
  font = new FontLoader().parse(JSON.parse(readFileSync('public/fonts/michroma.typeface.json', 'utf8')));
});

const meshes = (o: import('three').Object3D) => {
  const out: import('three').Mesh[] = [];
  o.traverse((c) => { if ((c as import('three').Mesh).isMesh) out.push(c as import('three').Mesh); });
  return out;
};

describe('tapeStrip', () => {
  it('is single sided front and back, never DoubleSide', () => {
    const g = kit.tapeStrip([-1, 1, 0], [1, 1, 0], 0.08);
    const all = meshes(g);
    expect(all.length).toBeGreaterThanOrEqual(2);
    for (const m of all) expect((m.material as import('three').Material).side).toBe(THREE.FrontSide);
  });
  it('sags in the middle and spans the two ends', () => {
    const g = kit.tapeStrip([-2, 2, 0], [2, 2, 0], 0.08);
    const box = new THREE.Box3().setFromObject(g);
    expect(box.min.x).toBeCloseTo(-2, 1);
    expect(box.max.x).toBeCloseTo(2, 1);
    // The ends sit at y 2 and the belly hangs below them by most of the sag.
    expect(box.min.y).toBeLessThan(2 - 0.05);
    expect(box.min.y).toBeGreaterThan(2 - 0.08 - 0.06);
  });
  it('reads the same way round from the back: the back plane faces the other way', () => {
    const g = kit.tapeStrip([-1, 1, 0], [1, 1, 0]);
    const all = meshes(g);
    const maps = all.map((m) => (m.material as import('three').MeshStandardMaterial).map!);
    expect(maps.some((t) => t.repeat.x > 0)).toBe(true);
    const back = maps.find((t) => t.repeat.x < 0)!;
    expect(back).toBeDefined();
    expect(back.wrapS).toBe(THREE.RepeatWrapping);
  });
});

describe('tapeLine', () => {
  it('still hangs between two floor points at a height', () => {
    const g = kit.tapeLine([0, 0], [4, 0], 1.2);
    const box = new THREE.Box3().setFromObject(g);
    // The run is strung at 1.2, so the tape's top edge sits half its own width above that.
    expect(box.max.y).toBeGreaterThan(1.2);
    expect(box.max.y).toBeLessThan(1.28);
    expect(box.min.y).toBeLessThan(1.2);
    expect(box.max.x).toBeCloseTo(4, 1);
  });
});

describe('signBox', () => {
  it('lights its face only when it is on', () => {
    const on = kit.signBox('RECREATION', { w: 1.6, h: 0.4, on: true });
    const off = kit.signBox('RECREATION', { w: 1.6, h: 0.4 });
    const face = (g: import('three').Group) => g.getObjectByName('face') as import('three').Mesh;
    expect((face(on).material as import('three').MeshStandardMaterial).emissiveIntensity).toBe(0.6);
    expect((face(off).material as import('three').MeshStandardMaterial).emissiveIntensity).toBe(0);
  });
  it('centres on its face', () => {
    const box = new THREE.Box3().setFromObject(kit.signBox('OPERATIONS', { w: 2, h: 0.5, on: true }));
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 3);
  });
});

describe('doorway', () => {
  const spec = () => ({
    w: 3, h: 3, depth: 2, axis: 'z' as const, sign: 'RECREATION', tape: true,
    floor: new THREE.MeshStandardMaterial(), wall: new THREE.MeshStandardMaterial(),
  });
  it('carries a sign and a tape cross through a vestibule of the given depth', () => {
    const g = kit.doorway(spec());
    expect(g.getObjectByName('sign')).toBeDefined();
    expect(g.getObjectByName('tape')).toBeDefined();
    const box = new THREE.Box3().setFromObject(g);
    // The vestibule is the given depth; the sign box stands proud of the outer face by its carcass.
    expect(box.max.z - box.min.z).toBeGreaterThan(2);
    expect(box.max.z - box.min.z).toBeLessThan(2.3);
  });
  it('turns the vestibule along x when the axis is x', () => {
    const g = kit.doorway({ ...spec(), axis: 'x', sign: undefined, tape: false });
    const box = new THREE.Box3().setFromObject(g);
    expect(box.max.x - box.min.x).toBeCloseTo(2, 1);
    expect(g.getObjectByName('sign')).toBeUndefined();
    expect(g.getObjectByName('tape')).toBeUndefined();
  });
  it('stays under ten draw calls with a sign', () => {
    const g = kit.doorway({ ...spec(), tape: false });
    expect(meshes(g).length).toBeLessThan(10);
  });
});

describe('signLetters', () => {
  it('falls back to a stencil plane when there is no typeface', () => {
    const m = kit.signLetters(null, 'JEL', { size: 0.4, depth: 0.05 });
    expect((m as import('three').Mesh).isMesh).toBe(true);
    m.geometry.computeBoundingBox();
    const box = m.geometry.boundingBox!;
    expect(box.max.x - box.min.x).toBeGreaterThan(box.max.y - box.min.y);
  });
  it('extrudes the text when the typeface is there', () => {
    const m = kit.signLetters(font, 'JEL', { size: 0.4, depth: 0.05 });
    expect(m.geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
    m.geometry.computeBoundingBox();
    const box = m.geometry.boundingBox!;
    expect(box.max.x - box.min.x).toBeGreaterThan(box.max.y - box.min.y);
    // Origin at the left baseline: the caller positions, the geometry is not centred.
    expect(box.min.x).toBeCloseTo(0, 1);
    expect(box.max.z - box.min.z).toBeCloseTo(0.05, 2);
  });
  it('sizes the fallback plane like the extruded letters', () => {
    const real = kit.signLetters(font, 'JEL LABS', { size: 0.4, depth: 0.05 });
    const flat = kit.signLetters(null, 'JEL LABS', { size: 0.4, depth: 0.05 });
    real.geometry.computeBoundingBox(); flat.geometry.computeBoundingBox();
    const a = real.geometry.boundingBox!, b = flat.geometry.boundingBox!;
    expect(b.max.x - b.min.x).toBeGreaterThan((a.max.x - a.min.x) * 0.7);
    expect(b.max.x - b.min.x).toBeLessThan((a.max.x - a.min.x) * 1.4);
  });
});

describe('tapeCross', () => {
  it('crosses the opening and hangs a plate at the crossing', () => {
    const g = kit.tapeCross(3, 3);
    const box = new THREE.Box3().setFromObject(g);
    expect(box.min.x).toBeCloseTo(-1.5, 1);
    expect(box.max.x).toBeCloseTo(1.5, 1);
    expect(box.max.y).toBeCloseTo(3, 1);
    expect(g.getObjectByName('plate')).toBeDefined();
  });
});

describe('signFace and wallPlaque', () => {
  it('prints the face as one map carried as colour and emissive, and plaques stay unlit', () => {
    const box = kit.signBox('CONTAINMENT', { w: 2, h: 0.42, on: true, code: 'ZONE 06' });
    const face = box.getObjectByName('face') as import('three').Mesh;
    const m = face.material as import('three').MeshStandardMaterial;
    expect(m.map).toBe(m.emissiveMap);
    expect(box.getObjectByName('bezel')).toBeDefined();
    expect(meshes(box)).toHaveLength(4);
    const plaque = kit.wallPlaque('SWITCHGEAR', { code: 'B2' });
    expect(meshes(plaque)).toHaveLength(2);
    expect(((plaque.getObjectByName('face') as import('three').Mesh).material as import('three').MeshStandardMaterial).emissive.getHex()).toBe(0);
  });
});
