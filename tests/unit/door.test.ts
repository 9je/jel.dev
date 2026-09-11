import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';

// The door draws its hazard rail to a canvas, and vitest runs in node with no DOM. A stub canvas is
// enough: nothing here reads a pixel back, the 2d calls only have to be accepted.
beforeAll(() => {
  const context = () => {
    const state: Record<string | symbol, unknown> = {};
    return new Proxy(state, {
      get: (t, k) => (k in t ? t[k] : () => ({ width: 100, addColorStop() {} })),
      set: (t, k, v) => { t[k] = v; return true; },
    });
  };
  (globalThis as unknown as { document: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => context() }) };
});

type Three = typeof import('three');
type DoorModule = typeof import('../../src/scenes/walk/door');

let THREE: Three;
let mod: DoorModule;
let font: import('three/addons/loaders/FontLoader.js').Font;

beforeAll(async () => {
  THREE = await import('three');
  mod = await import('../../src/scenes/walk/door');
  const { FontLoader } = await import('three/addons/loaders/FontLoader.js');
  font = new FontLoader().parse(JSON.parse(readFileSync('public/fonts/michroma.typeface.json', 'utf8')));
});

// buildDoor reads one texture set off the store and clones it. Nothing samples it here.
const store = () => ({
  texture: () => ({ map: new THREE.Texture(), normalMap: new THREE.Texture(), arm: new THREE.Texture(), repeat: [1, 1] as [number, number] }),
}) as unknown as import('../../src/scenes/walk/assets').AssetStore;

const build = () => mod.buildDoor(store(), { width: 6, height: 3.6, position: [0, 0, 22], typeface: font });

describe('doorPose', () => {
  it('is closed at 0 and rolled up at 1', () => {
    const c = mod.doorPose(0, 3.6), o = mod.doorPose(1, 3.6);
    expect(c.slatScaleY).toBe(1); expect(c.bottomY).toBeCloseTo(0, 6);
    expect(o.slatScaleY).toBeCloseTo(0, 6); expect(o.bottomY).toBeCloseTo(3.6, 6);
    expect(o.drumRadius).toBeGreaterThan(c.drumRadius);
  });
  it('moves the bottom edge linearly', () => { expect(mod.doorPose(0.5, 4).bottomY).toBeCloseTo(2, 6); });
});

describe('buildDoor', () => {
  it('hangs the sign on the door head, not on the curtain', () => {
    const door = build();
    const sign = door.root.getObjectByName('sign');
    expect(sign).toBeDefined();
    // The whole point of taking the lettering off the slats: it holds still while they roll up.
    const at = (open: number) => { door.update(open); door.root.updateMatrixWorld(true); return new THREE.Box3().setFromObject(sign!); };
    const shut = at(0), rolled = at(1);
    expect(rolled.min.distanceTo(shut.min)).toBeCloseTo(0, 6);
    expect(rolled.max.distanceTo(shut.max)).toBeCloseTo(0, 6);
    // And it sits on the head box, proud of the curtain rather than across it.
    expect(shut.min.y).toBeGreaterThan(3.4);
    expect(shut.min.z).toBeGreaterThan(22.25);
    door.dispose();
  });
  it('centres the lettering on the door width', () => {
    const door = build();
    type Mesh = import('three').Mesh;
    const letters = door.root.getObjectByName('sign')!.children.find((c) => (c as Mesh).isMesh && (c as Mesh).geometry.type === 'TextGeometry') as Mesh;
    const box = new THREE.Box3().setFromObject(letters);
    expect(box.min.x + box.max.x).toBeCloseTo(0, 5);
    door.dispose();
  });
  it('stands the standby light clear of its housing, in world space', () => {
    const door = build();
    expect(door.lamp.position).toEqual([3.15, 3.05, 22.5]);
    expect(door.lamp.color).toBe(0xc8322b);
    door.update(1);
    expect(door.lamp.color).toBe(0x2ecc71);
    door.dispose();
  });
});
