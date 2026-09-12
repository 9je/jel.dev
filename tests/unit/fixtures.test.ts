import { describe, it, expect, beforeAll } from 'vitest';

// The fittings paint their lenses to a canvas, and vitest runs in node with no DOM. A stub is enough.
beforeAll(() => {
  const context = () => new Proxy({} as Record<string | symbol, unknown>, {
    get: (t, k) => (k in t ? t[k] : () => ({ width: 100, addColorStop() {} })),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  (globalThis as unknown as { document: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => context() }) };
});

type Three = typeof import('three');
type Kit = typeof import('../../src/scenes/walk/labs/fixtures');
let THREE: Three; let kit: Kit;
beforeAll(async () => { THREE = await import('three'); kit = await import('../../src/scenes/walk/labs/fixtures'); });

const meshes = (o: import('three').Object3D) => { const out: import('three').Mesh[] = []; o.traverse((c) => { if ((c as import('three').Mesh).isMesh) out.push(c as import('three').Mesh); }); return out; };

describe('troffer', () => {
  it('hangs its frame below the ceiling plane with the lens recessed inside it', () => {
    const { frame, lens } = kit.troffer(1.2, 0.3);
    frame.computeBoundingBox(); lens.computeBoundingBox();
    const f = frame.boundingBox!, l = lens.boundingBox!;
    expect(f.max.y).toBeCloseTo(0, 6);
    expect(f.min.y).toBeLessThan(l.min.y);
    expect(l.max.x).toBeLessThan(f.max.x); expect(l.max.z).toBeLessThan(f.max.z);
    expect(f.max.x - f.min.x).toBeCloseTo(1.2, 6);
  });
});

describe('batten', () => {
  it('is two draw calls surface mounted and carries rods only when it hangs', () => {
    const flat = kit.batten({ len: 2 });
    expect(meshes(flat)).toHaveLength(2);
    const box = new THREE.Box3().setFromObject(flat);
    expect(box.max.y).toBeCloseTo(0.045, 3);
    const hung = kit.batten({ len: 2, drop: 0.4 });
    const hb = new THREE.Box3().setFromObject(hung);
    expect(hb.max.y).toBeGreaterThan(0.4);
    expect(meshes(hung)).toHaveLength(2);
  });
  it('lays a row for the same two draw calls, and hands the tube material back by name', () => {
    const row = kit.battens({ len: 2.2, intensity: 1.2 }, [[0, 3, 0], [3, 3, 0], [6, 3, 0, Math.PI / 2]]);
    const ms = meshes(row);
    expect(ms).toHaveLength(2);
    const tube = row.getObjectByName('tube') as import('three').InstancedMesh;
    expect(tube.count).toBe(3);
    expect((tube.material as import('three').MeshStandardMaterial).emissiveIntensity).toBe(1.2);
  });
});

describe('lightShaft', () => {
  it('points down from its origin, additive and never writing depth', () => {
    const s = kit.lightShaft({ top: 0.3, bottom: 1.2, height: 3 });
    s.geometry.computeBoundingBox();
    expect(s.geometry.boundingBox!.max.y).toBeCloseTo(0, 6);
    expect(s.geometry.boundingBox!.min.y).toBeCloseTo(-3, 6);
    const m = s.material as import('three').MeshBasicMaterial;
    expect(m.blending).toBe(THREE.AdditiveBlending); expect(m.depthWrite).toBe(false); expect(m.transparent).toBe(true);
  });
});
