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
    expect(header(kit.drinksMachine({ accent: '#3D7BE0', lit: false, seed: 1 })).emissiveIntensity).toBe(0);
    expect(header(kit.drinksMachine({ accent: '#3D7BE0', lit: true, seed: 1 })).emissiveIntensity).toBeGreaterThan(1);
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

  it('stands a gurney at trolley height with the sheet hanging off one end', () => {
    const box = new THREE.Box3().setFromObject(kit.gurney());
    expect(box.min.y).toBeCloseTo(0, 2);
    expect(box.max.y).toBeCloseTo(0.93, 2);
    // 0.8 by 2.0 on plan, which is what the lab's clearance from the walked line is measured against.
    expect(box.max.x - box.min.x).toBeCloseTo(0.8, 2);
    expect(box.max.z - box.min.z).toBeCloseTo(2.0, 2);
    // The hanging edge reaches below the deck, or the sheet is just a white box on a trolley.
    expect(box.min.y).toBeLessThan(0.6);
  });

  it('stands a task chair at desk height on five casters, in three draw calls', () => {
    const chair = kit.taskChair();
    let meshes = 0; chair.traverse((o) => { if ((o as T.Mesh).isMesh) meshes++; });
    expect(meshes).toBe(3);
    const box = new THREE.Box3().setFromObject(chair);
    expect(box.min.y).toBeGreaterThanOrEqual(-0.001);
    expect(box.max.y).toBeGreaterThan(0.95); expect(box.max.y).toBeLessThan(1.15);
    expect(box.max.x - box.min.x).toBeLessThan(0.75);
  });
  it('builds a flight case the size a room stacks two of', () => {
    const box = new THREE.Box3().setFromObject(kit.hardCase());
    expect(box.min.y).toBeCloseTo(0, 2);
    // The shell is 0.45 tall, so a case placed at y 0.45 lands on the lid of the one below it.
    expect(box.max.y).toBeCloseTo(0.45, 2);
    expect(box.max.x - box.min.x).toBeCloseTo(0.61, 2);
  });

  it('hangs a cable coil the full drop below its fixing', () => {
    const box = new THREE.Box3().setFromObject(kit.cableCoil());
    // The origin is the top of the coil and the cord runs up from it to the ceiling.
    expect(box.max.y).toBeCloseTo(1.8, 2);
    expect(box.min.y).toBeLessThan(0);
    expect(box.min.y).toBeGreaterThan(-0.4);
  });

  it('stands a camera on a tripod at eye height', () => {
    const box = new THREE.Box3().setFromObject(kit.tripodCamera());
    expect(box.min.y).toBeCloseTo(0, 2);
    expect(box.max.y).toBeGreaterThan(1.45);
    expect(box.max.y).toBeLessThan(1.7);
    // Splayed legs, or it is a stick: the feet spread wider than the head is deep.
    expect(box.max.x - box.min.x).toBeGreaterThan(0.6);
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

  it('props a file open on the form it carries', () => {
    const folder = kit.openFile();
    expect(folder.getObjectByName('page')).toBeTruthy();
    const box = new THREE.Box3().setFromObject(folder);
    // One leaf flat on the desk, one propped on the fold: the folder stands up off the top rather
    // than lying in it, and the fold itself never drops below the surface it is standing on.
    expect(box.min.y).toBeGreaterThan(-0.001);
    expect(box.max.y).toBeGreaterThan(0.15);
    expect(box.max.z - box.min.z).toBeGreaterThan(0.4);
  });

  it('puts a dead monitor face out', () => {
    const face = (alive: boolean) => (kit.monitor({ alive }).getObjectByName('face') as T.Mesh).material as T.MeshStandardMaterial;
    expect(face(false).emissiveIntensity).toBe(0);
    expect(face(true).emissiveIntensity).toBeGreaterThan(1);
  });

  it('pins six sheets to a board the size it was asked for', () => {
    const box = new THREE.Box3().setFromObject(kit.pinboard(1.6, 1.0));
    expect(box.max.x - box.min.x).toBeCloseTo(1.66, 2);
    expect(box.max.y - box.min.y).toBeCloseTo(1.06, 2);
  });

  it('rakes the console face up toward whoever is working it', () => {
    const console_ = kit.controlConsole(new THREE.Texture());
    console_.updateMatrixWorld(true);
    const keys = console_.getObjectByName('keys') as T.Mesh;
    // In world space, not the mesh's own: the rake sits on the group the face and the key caps
    // share, so that a cap placed at a canvas pixel lands on the well printed at it.
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(keys.getWorldQuaternion(new THREE.Quaternion()));
    // Up, and leaning toward +z, which is the side the console is operated from. Leaning the other
    // way turns a bank of keys into a blank pale slab facing the ceiling and the far wall.
    expect(normal.y).toBeGreaterThan(0.9);
    expect(normal.z).toBeGreaterThan(0.2);
    expect(keys.getWorldPosition(new THREE.Vector3()).y).toBeGreaterThan(0.16);
  });

  // The caps are geometry and the wells they sit in are printed, so the two enumerations have to
  // agree. They are built from one grid for exactly that reason, and this is what holds them to it:
  // eighteen caps, two of them lit, every one inside the deck and none of them on top of another.
  it('stands a key cap on every well the console prints', () => {
    const console_ = kit.controlConsole(new THREE.Texture());
    const batches = [] as T.InstancedMesh[];
    console_.traverse((o) => { if ((o as T.InstancedMesh).isInstancedMesh) batches.push(o as T.InstancedMesh); });
    expect(batches.reduce((n, b) => n + b.count, 0)).toBe(18);
    const lit = batches.filter((b) => (b.material as T.MeshStandardMaterial).emissiveIntensity > 1);
    expect(lit.reduce((n, b) => n + b.count, 0)).toBe(2);

    const seen = new Set<string>();
    const m = new THREE.Matrix4(), v = new THREE.Vector3();
    console_.updateMatrixWorld(true);
    for (const b of batches) for (let i = 0; i < b.count; i++) {
      b.getMatrixAt(i, m);
      v.setFromMatrixPosition(m).applyMatrix4(b.matrixWorld);
      // Inside the 1.0 by 0.5 case on plan, and standing above the worktop.
      expect(Math.abs(v.x)).toBeLessThan(0.5);
      expect(Math.abs(v.z)).toBeLessThan(0.25);
      expect(v.y).toBeGreaterThan(0.16);
      const key = `${v.x.toFixed(3)},${v.z.toFixed(3)}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});
