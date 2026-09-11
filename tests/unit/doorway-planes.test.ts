import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';

/**
 * The transitions are built by five shells that each close their own side of a shared wall plane.
 * The technique they use is two one-sided planes back to back: opposite normals, so whichever side
 * the camera is on, one is front facing and the other is culled and neither fights for depth. Get a
 * normal the wrong way round and the two planes are both front facing in the same place, which is a
 * flicker on every camera move and nothing a still screenshot shows.
 *
 * So this builds the five rooms' shells for real and reads the triangles back out. Every surface a
 * doorway's vestibule contributes is checked against every surface the rooms contribute: same plane,
 * same facing and overlapping in that plane is the failure.
 */

// The shells draw signage and hazard stripes to a canvas, and vitest runs in node with no DOM. The
// stub only has to accept the 2d calls and answer measureText with a width.
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

type Store = import('../../src/scenes/walk/assets').AssetStore;

/** Enough of an AssetStore for a shell: every texture set is three blank textures, every model an
 *  empty group. Nothing here samples a pixel, it only needs the geometry the shell builds around. */
const fakeStore = () => ({
  texture: () => ({ map: new THREE.Texture(), normalMap: new THREE.Texture(), arm: new THREE.Texture(), repeat: [1, 1] as [number, number] }),
  model: () => new THREE.Group(),
}) as unknown as Store;

interface Face { key: string; u0: number; u1: number; v0: number; v1: number; owner: string; mesh: string }

/** Every triangle in the hierarchy, as its world plane (normal and offset, both rounded so two
 *  planes built from different arithmetic still land on one key) plus its extent in that plane. */
function faces(root: THREE.Object3D, owner: string): Face[] {
  const out: Face[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), n = new THREE.Vector3();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || (o as THREE.InstancedMesh).isInstancedMesh) return;
    const position = mesh.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!position) return;
    const index = mesh.geometry.getIndex();
    const count = index ? index.count : position.count;
    for (let i = 0; i < count; i += 3) {
      const [ia, ib, ic] = index ? [index.getX(i), index.getX(i + 1), index.getX(i + 2)] : [i, i + 1, i + 2];
      a.fromBufferAttribute(position, ia).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(position, ib).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(position, ic).applyMatrix4(mesh.matrixWorld);
      n.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
      if (n.lengthSq() < 1e-12) continue;
      n.normalize();
      // Only the three axis aligned facings matter here: every wall, floor and reveal in these
      // rooms is one of them, and a stray angled face cannot be coplanar with any of them.
      const axis = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)].indexOf(Math.max(Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)));
      if (Math.abs([n.x, n.y, n.z][axis]) < 0.999) continue;
      const sign = Math.sign([n.x, n.y, n.z][axis]);
      const along = [a.x, a.y, a.z][axis];
      const [ui, vi] = axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1];
      const u = [a, b, c].map((p) => p.toArray()[ui]), v = [a, b, c].map((p) => p.toArray()[vi]);
      out.push({
        key: `${axis}:${sign}:${along.toFixed(3)}`, owner, mesh: mesh.uuid,
        u0: Math.min(...u), u1: Math.max(...u), v0: Math.min(...v), v1: Math.max(...v),
      });
    }
  });
  return out;
}

/** Two faces on one plane that both face the camera over a patch of real area. */
const clashes = (a: Face, b: Face) => {
  const EPS = 1e-3;
  return a.key === b.key
    && Math.min(a.u1, b.u1) - Math.max(a.u0, b.u0) > EPS
    && Math.min(a.v1, b.v1) - Math.max(a.v0, b.v0) > EPS;
};

/** Every vestibule in the walk, by the name its own shell gives it. `containment-door` is cut
 *  through the credentials hall's north wall and its far mouth opens into the containment shell's
 *  south wall, which is the fourth pair of one-sided planes built back to back on a shared plane. */
const DOORS = ['bay-door', 'hall-door', 'credentials-door', 'containment-door'];

describe('the doorway vestibules against the room walls', () => {
  const built: { room: Face[]; door: Face[] } = { room: [], door: [] };

  beforeAll(async () => {
    const store = fakeStore();
    const ctx = { store } as unknown as import('../../src/scenes/walk/stages/types').StageContext;
    const shells = [
      ['fabrication', (await import('../../src/scenes/walk/stages/fabrication/shell')).buildShell],
      ['recreation', (await import('../../src/scenes/walk/stages/recreation/shell')).buildShell],
      ['operations', (await import('../../src/scenes/walk/stages/operations/shell')).buildShell],
      ['credentials', (await import('../../src/scenes/walk/stages/credentials/shell')).buildShell],
      ['containment', (await import('../../src/scenes/walk/stages/containment/shell')).buildShell],
      ['file', (await import('../../src/scenes/walk/stages/file/shell')).buildShell],
    ] as [string, (c: never, r: THREE.Group) => unknown][];
    for (const [name, build] of shells) {
      const root = new THREE.Group();
      build(ctx as never, root);
      // The doorways name themselves, so a vestibule's own surfaces can be told from its room's.
      const doors = DOORS.map((id) => root.getObjectByName(id)).filter(Boolean) as THREE.Object3D[];
      for (const door of doors) {
        for (const part of door.children) built.door.push(...faces(part, `${name}/${door.name}/${part.name || 'part'}`));
        door.removeFromParent();
      }
      built.room.push(...faces(root, name));
    }
  });

  it('builds all four vestibules and all six shells', () => {
    expect(built.door.length).toBeGreaterThan(0);
    expect(built.room.length).toBeGreaterThan(0);
    for (const id of DOORS) {
      expect(built.door.some((f) => f.owner.includes(id))).toBe(true);
    }
  });

  /** Every pair of faces on one plane, facing the same way, overlapping, and drawn by two different
   *  meshes. Two rooms' own walls are left out of it: those are deliberately built back to back with
   *  opposite normals, which this already tolerates, and a room against itself is that room's own
   *  business. Anything a doorway draws is checked against everything else. */
  const clashesWith = (against: Face[]) => {
    const byKey = new Map<string, Face[]>();
    for (const f of against) { const hit = byKey.get(f.key); if (hit) hit.push(f); else byKey.set(f.key, [f]); }
    const found: string[] = [];
    for (const d of built.door) {
      for (const other of byKey.get(d.key) ?? []) {
        if (other.mesh === d.mesh || !clashes(d, other)) continue;
        const patch = `${d.owner} over ${other.owner} on plane ${d.key}`;
        if (!found.includes(patch)) found.push(patch);
      }
    }
    return found;
  };

  it('leaves no room surface coplanar and facing the same way as a vestibule surface', () => {
    expect(clashesWith(built.room)).toEqual([]);
  });

  it('leaves no part of a doorway coplanar and facing the same way as its own reveals', () => {
    // The frame is the one that used to: a post flush with the opening puts its inner face on the
    // reveal, and the header's underside on the vestibule ceiling.
    expect(clashesWith(built.door)).toEqual([]);
  });
});
