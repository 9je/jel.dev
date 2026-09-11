import { describe, expect, it } from 'vitest';
import { Light, Scene } from 'three';
import { ROOM_BUDGET, RIG_DESKTOP, RIG_PHONE, checkBudget, composeSet, assignSlots, rigSizeFor, LightRig, type Placement } from '../../src/scenes/walk/rig';
import { STOPS, type StopId } from '../../src/scenes/walk/path';

const spot = (x: number, shadow = false): Placement => ({ kind: 'spot', position: [x, 6, 0], target: [x, 0, 0], color: 0xffffff, intensity: 100, distance: 30, angle: 1, penumbra: 0.5, shadow });
const point = (x: number): Placement => ({ kind: 'point', position: [x, 3, 0], color: 0xffffff, intensity: 5, distance: 10 });

function lightsIn(scene: Scene): Light[] {
  const out: Light[] = [];
  scene.traverse((o) => { if ((o as Light).isLight) out.push(o as Light); });
  return out;
}

describe('rig sizing', () => {
  it('gives phones the small rig and desktops the large one', () => {
    expect(rigSizeFor('low', true)).toEqual(RIG_PHONE);
    expect(rigSizeFor('low', false)).toEqual(RIG_DESKTOP);
    expect(rigSizeFor('high', false)).toEqual(RIG_DESKTOP);
  });
  it('refuses a room over the room budget', () => {
    expect(() => checkBudget([spot(0), spot(1), spot(2), spot(3), point(0), point(1)])).not.toThrow();
    expect(() => checkBudget([spot(0), spot(1), spot(2), spot(3), spot(4)])).toThrow(/spots/);
    expect(() => checkBudget([point(0), point(1), point(2)])).toThrow(/points/);
    expect(ROOM_BUDGET).toEqual({ spots: 4, points: 2 });
  });
});

describe('composeSet', () => {
  const rooms = new Map<StopId, Placement[]>([
    ['booth', [spot(0), point(0)]],
    ['fabrication', [spot(10), spot(11, true), point(10)]],
    ['recreation', [spot(20)]],
  ]);
  it('orders current, next, previous, and shadow casters first within a room', () => {
    const set = composeSet(rooms, 'fabrication');
    expect(set.map((p) => p.position[0])).toEqual([11, 10, 10, 20, 0, 0]);
  });
  it('skips rooms that have not registered', () => {
    expect(composeSet(rooms, 'operations').map((p) => p.position[0])).toEqual([20]);
  });
});

describe('assignSlots', () => {
  const size = { spots: 2, points: 1 };
  it('keeps a placement in the slot it already holds', () => {
    const a = spot(0), b = spot(1), p = point(0);
    const first = assignSlots([null, null, null], [a, b, p], size, false);
    expect(first).toEqual([a, b, p]);
    const second = assignSlots(first, [b, a, p], size, false);
    expect(second).toEqual([a, b, p]);
  });
  it('drops what does not fit and never puts a point in a spot slot', () => {
    const out = assignSlots([null, null, null], [spot(0), spot(1), spot(2), point(0), point(1)], size, false);
    expect(out.map((p) => p?.position[0])).toEqual([0, 1, 0]);
    expect(out[2]?.kind).toBe('point');
  });
  it('gives the current room\'s shadow caster the lowest spot slot, over a resident plain spot', () => {
    const plain = spot(0), caster = spot(1, true);
    const out = assignSlots([plain, null, null], [caster, plain], size, true);
    expect(out[0]).toBe(caster);
    expect(out[1]).toBe(plain);
  });
  it('ranks a caster as a plain spot when the rig casts no shadows', () => {
    // A previous room's caster sits behind the current room's spot in the composed set, and with
    // shadows off there is no shadow map to win: the room the camera is standing in keeps the slot.
    const current = spot(0), previousCaster = spot(9, true);
    const out = assignSlots([null], [current, previousCaster], { spots: 1, points: 0 }, false);
    expect(out[0]).toBe(current);
  });
  it('lets only the current room\'s casters take shadow slots', () => {
    // composeSet puts the current room first, its casters ahead of its plain lights. The previous
    // room's caster trails the lot, so it must not push the current room's plain spot out.
    const currentCaster = spot(0, true), currentPlain = spot(1), previousCaster = spot(9, true);
    const out = assignSlots([null, null], [currentCaster, currentPlain, previousCaster], { spots: 2, points: 0 }, true);
    expect(out[0]).toBe(currentCaster);
    expect(out[1]).toBe(currentPlain);
  });
  it('migrates a caster down into a freed shadow slot even when it already holds a plain slot', () => {
    // A caster sitting in slot 1 must not stay there once it is the higher-priority item: it belongs
    // in slot 0, the shadow slot, and the fade hides the hop. Retention is only for non-casters.
    const plainSize = { spots: 2, points: 0 };
    const spotA = spot(0), spotCaster = spot(1, true);
    const out = assignSlots([spotA, spotCaster], [spotCaster, spotA], plainSize, true);
    expect(out[0]).toBe(spotCaster);
    expect(out[1]).toBe(spotA);
  });
  it('packs the two highest-priority casters into the lowest slots ahead of a lower-priority one already resident', () => {
    // Stand-in for the real rig: the booth key spot and sodium-1 hold slots 0 and 1 from an earlier
    // stop. At the next stop sodium-1 and sodium-2 (both casters, both higher priority than the
    // booth key now behind the camera) must take the lowest slots, and the booth key drops to slot 2.
    const threeSpots = { spots: 3, points: 0 };
    const boothKey = spot(0, true), sodium1 = spot(1, true), sodium2 = spot(2, true);
    const out = assignSlots([boothKey, sodium1], [sodium1, sodium2, boothKey], threeSpots, true);
    expect([out[0], out[1]]).toEqual(expect.arrayContaining([sodium1, sodium2]));
    expect(out[2]).toBe(boothKey);
  });
});

describe('LightRig', () => {
  it('holds a constant light count whatever registers, and at every stop', () => {
    const scene = new Scene();
    const rig = new LightRig(scene, RIG_DESKTOP, false);
    const n = () => lightsIn(scene).length;
    expect(n()).toBe(RIG_DESKTOP.spots + RIG_DESKTOP.points + 1);
    rig.register('booth', [spot(0), point(0)]);
    rig.register('fabrication', [spot(10), spot(11), spot(12), spot(13), point(10), point(11)]);
    for (const s of STOPS) { rig.update(s.t, 0.016); expect(n()).toBe(RIG_DESKTOP.spots + RIG_DESKTOP.points + 1); }
    rig.unregister('fabrication');
    rig.update(0.2, 0.016);
    expect(n()).toBe(RIG_DESKTOP.spots + RIG_DESKTOP.points + 1);
  });
  it('fades a slot out before moving it, then fades it in', () => {
    const scene = new Scene();
    const rig = new LightRig(scene, { spots: 1, points: 0 }, false);
    rig.register('booth', [spot(0)]);
    for (let i = 0; i < 120; i++) rig.update(0, 0.016);
    const l = lightsIn(scene).find((x) => (x as any).isSpotLight)!;
    expect(l.intensity).toBeCloseTo(100, 0);
    expect(l.position.x).toBe(0);
    rig.register('fabrication', [spot(10)]);
    rig.update(0.2, 0.016);
    // First frame after the switch: still at the old position, on its way down.
    expect(l.position.x).toBe(0);
    expect(l.intensity).toBeLessThan(100);
    for (let i = 0; i < 120; i++) rig.update(0.2, 0.016);
    expect(l.position.x).toBe(10);
    expect(l.intensity).toBeCloseTo(100, 0);
  });
  it('reads mutated placement fields every frame', () => {
    const scene = new Scene();
    const rig = new LightRig(scene, { spots: 0, points: 1 }, false);
    const p = point(0);
    rig.register('booth', [p]);
    for (let i = 0; i < 60; i++) rig.update(0, 0.016);
    p.color = 0x00ff00;
    rig.update(0, 0.016);
    const l = lightsIn(scene).find((x) => (x as any).isPointLight)!;
    expect(l.color.getHex()).toBe(0x00ff00);
  });
  it('only ever casts shadows from the first two spot slots on the shadow tier', () => {
    const scene = new Scene();
    const rig = new LightRig(scene, RIG_DESKTOP, true);
    const casting = lightsIn(scene).filter((l) => l.castShadow);
    expect(casting).toHaveLength(2);
    const rigOff = new LightRig(new Scene(), RIG_DESKTOP, false);
    expect(rigOff.lightCount).toBe(RIG_DESKTOP.spots + RIG_DESKTOP.points + 1);
  });
});
