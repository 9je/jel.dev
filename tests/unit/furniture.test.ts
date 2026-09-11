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

  it('slings a tarp the size it was asked for with a rail over it', () => {
    const box = new THREE.Box3().setFromObject(kit.tarpWall(8, 3.2));
    expect(box.max.x - box.min.x).toBeCloseTo(8, 2);
    expect(box.max.y).toBeGreaterThan(1.6);
    expect(box.min.y).toBeCloseTo(-1.6, 1);
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
    const keys = kit.controlConsole(new THREE.Texture()).getObjectByName('keys') as T.Mesh;
    keys.updateMatrixWorld(true);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(keys.quaternion);
    // Up, and leaning toward +z, which is the side the console is operated from. Leaning the other
    // way turns a bank of keys into a blank pale slab facing the ceiling and the far wall.
    expect(normal.y).toBeGreaterThan(0.9);
    expect(normal.z).toBeGreaterThan(0.2);
    expect(keys.position.y).toBeGreaterThan(0.16);
  });
});
