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
  it('lights the sign as neon: a tube core driven past white on a black backing', () => {
    const door = build();
    const sign = door.root.getObjectByName('sign')!;
    const letters = sign.getObjectByName('letters') as import('three').Mesh;
    const [tube, walls] = letters.material as import('three').MeshStandardMaterial[];
    expect(tube.emissive.getHex()).toBe(mod.NEON);
    expect(walls.emissiveIntensity).toBeLessThan(tube.emissiveIntensity * 0.6);
    expect(tube.emissiveIntensity).toBeGreaterThan(1);
    // The old lit cyan panel is gone: what the letters sit on is near black, so only the tubes glow.
    const backing = (sign.getObjectByName('backing') as import('three').Mesh).material as import('three').MeshStandardMaterial;
    expect(backing.emissive.getHex()).toBe(0x000000);
    expect(backing.color.getHex()).toBeLessThan(0x101010);
    // The halo sits between the backing and the letters, additive, and never writes depth.
    const halo = sign.getObjectByName('halo') as import('three').Mesh;
    const hm = halo.material as import('three').MeshBasicMaterial;
    expect(hm.blending).toBe(THREE.AdditiveBlending); expect(hm.depthWrite).toBe(false);
    expect(halo.position.z).toBeGreaterThan((sign.getObjectByName('backing') as import('three').Mesh).position.z);
    expect(halo.position.z).toBeLessThan(letters.position.z);
    door.dispose();
  });
  it('washes the fascia with the tube colour from in front of the sign, in world space', () => {
    const door = build();
    expect(door.glow.kind).toBe('rect'); expect(door.glow.color).toBe(mod.NEON);
    if (door.glow.kind !== 'rect') throw new Error('not a rect');
    // The wash is the run's shape, not a disc: as wide as the letters and much wider than tall.
    const letters = door.root.getObjectByName('letters') as import('three').Mesh;
    letters.geometry.computeBoundingBox(); const box = letters.geometry.boundingBox!;
    expect(door.glow.width).toBeCloseTo(box.max.x - box.min.x, 5);
    expect(door.glow.width).toBeGreaterThan(door.glow.height * 4);
    expect(door.glow.position[2]).toBeGreaterThan(door.glow.target[2]);
    expect(door.glow.target[2]).toBeCloseTo(22, 5);
    expect(door.glow.target[1]).toBeCloseTo(3.7, 5);
    door.dispose();
  });
  it('hums and stutters on its own clock, and the wash follows', () => {
    const door = build();
    const tube = ((door.root.getObjectByName('letters') as import('three').Mesh).material as import('three').MeshStandardMaterial[])[0];
    door.update(0, 1); const steady = tube.emissiveIntensity, wash = door.glow.intensity;
    door.update(0, mod.NEON_PERIOD + 0.02); expect(tube.emissiveIntensity).toBeLessThan(steady * 0.7); expect(door.glow.intensity).toBeLessThan(wash * 0.7); expect(door.glow.intensity).toBeGreaterThan(wash * 0.4);
    door.update(0, 12); expect(tube.emissiveIntensity).toBeGreaterThan(steady * 0.9);
    door.dispose();
  });
  it('carries the wash as a strip light in the door\'s own shaders, so no other material pays for it', () => {
    const door = build();
    const slats = door.root.children.find((c) => (c as import('three').Mesh).geometry?.type === 'PlaneGeometry') as import('three').Mesh;
    const mats = [slats.material, (door.root.getObjectByName('backing') as import('three').Mesh).material] as import('three').MeshStandardMaterial[];
    const tube = ((door.root.getObjectByName('letters') as import('three').Mesh).material as import('three').MeshStandardMaterial[])[0];
    expect(tube.customProgramCacheKey()).not.toBe(mats[0].customProgramCacheKey());
    for (const m of mats) {
      const shader = { uniforms: {} as Record<string, { value: unknown }>, fragmentShader: '#include <lights_pars_begin>\n#include <lights_physical_pars_fragment>\n#include <lights_fragment_begin>' };
      m.onBeforeCompile(shader as never, { extensions: { has: () => true } } as never);
      expect(shader.fragmentShader).toContain('signStrip[ 1 ]');
      expect(shader.fragmentShader).not.toMatch(/NUM_RECT_AREA_LIGHTS|rectAreaLights|ltc_1/);
      expect(shader.uniforms.signLtc1.value).toBeDefined();
      // The strip follows the tube's catch like the rest of the sign.
      const strip = (shader.uniforms.signStrip.value as { color: import('three').Color }[])[0];
      door.update(0, 1); const steady = strip.color.g;
      door.update(0, mod.NEON_PERIOD + 0.02); expect(strip.color.g).toBeLessThan(steady * 0.7); expect(strip.color.g).toBeGreaterThan(steady * 0.4);
    }
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

describe('neonLevel', () => {
  it('runs near full between catches', () => {
    const levels = Array.from({ length: 200 }, (_, i) => mod.neonLevel(0.4 + i * 0.045));
    for (const l of levels) { expect(l).toBeGreaterThan(0.94); expect(l).toBeLessThanOrEqual(1); }
  });
  it('never sags below half, so the closed booth is never blacked out', () => {
    for (let i = 0; i < 5000; i++) expect(mod.neonLevel(i * 0.01)).toBeGreaterThanOrEqual(0.5);
    expect(mod.neonLevel(mod.NEON_PERIOD)).toBeLessThan(0.7);
  });
  it('catches rarely and briefly', () => {
    expect(mod.NEON_PERIOD).toBeGreaterThan(20);
    const low = Array.from({ length: 2330 }, (_, i) => mod.neonLevel(i * 0.01)).filter((l) => l < 0.9).length * 0.01;
    expect(low).toBeLessThan(0.3);
  });
});
