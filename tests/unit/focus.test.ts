import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Focus, leanTarget, DRIFT_MAX, DRIFT_OPEN, LEAN_IN, LEAN_OUT, DOLLY_MAX } from '../../src/scenes/walk/focus';

const FRAME = 1 / 60;
const run = (f: Focus, seconds: number, parked = 1) => { for (let t = 0; t < seconds; t += FRAME) f.update(FRAME, parked); };
const cam = () => ({ position: new Vector3(0, 1.7, 0), target: new Vector3(0, 1.7, -1) });
const angle = (c: { position: Vector3; target: Vector3 }, to: Vector3) => c.target.clone().sub(c.position).angleTo(to.clone().sub(c.position));

describe('the pointer drift on a hold', () => {
  it('never turns the head more than its cap, wherever the pointer is', () => {
    for (const [x, y] of [[1, 1], [-1, -1], [1, -1], [-1, 1], [0, 1], [1, 0], [5, -9]]) {
      const f = new Focus(); f.setPointer(x, y); run(f, 3);
      const c = cam(); f.apply(c);
      expect(angle(c, new Vector3(0, 1.7, -1))).toBeLessThanOrEqual(DRIFT_MAX * 1.42);
      expect(Math.abs(f.drift.yaw)).toBeLessThanOrEqual(DRIFT_MAX + 1e-9);
      expect(Math.abs(f.drift.pitch)).toBeLessThanOrEqual(DRIFT_MAX + 1e-9);
    }
  });
  it('turns toward the pointer: right of centre looks right, above looks up', () => {
    const f = new Focus(); f.setPointer(1, 1); run(f, 3);
    const c = cam(); f.apply(c);
    expect(c.target.x).toBeGreaterThan(0);
    expect(c.target.y).toBeGreaterThan(1.7);
  });
  it('is nothing in transit, so the walk never sees a turn the scroll did not make', () => {
    const f = new Focus(); f.setPointer(1, 1); run(f, 3, 0);
    const c = cam(); f.apply(c);
    expect(c.target.distanceTo(new Vector3(0, 1.7, -1))).toBeLessThan(1e-9);
  });
  it('lets go within a second of the walk moving on', () => {
    const f = new Focus(); f.setPointer(1, -1); run(f, 3);
    run(f, 1, 0);
    expect(Math.abs(f.drift.yaw)).toBeLessThan(1e-4);
    expect(Math.abs(f.drift.pitch)).toBeLessThan(1e-4);
  });
  it('is quieter while a project is open', () => {
    const f = new Focus(); f.setPointer(1, 0); f.setTarget(new Vector3(0, 1.7, -4)); run(f, 3);
    expect(Math.abs(f.drift.yaw)).toBeCloseTo(DRIFT_MAX * DRIFT_OPEN, 5);
  });
});

describe('the lean toward an exhibit', () => {
  const exhibit = new Vector3(3, 1.2, -4);
  it('is fully in after the lean time and fully out after the return time', () => {
    const f = new Focus(); f.setTarget(exhibit);
    run(f, LEAN_IN + FRAME);
    expect(f.level).toBe(1);
    f.setTarget(null);
    run(f, LEAN_OUT + FRAME);
    expect(f.level).toBe(0);
    expect(f.dim).toBe(0);
  });
  it('aims the camera at the exhibit when it is in, and leaves it alone when it is out', () => {
    const f = new Focus(); f.setTarget(exhibit); run(f, 2);
    const c = cam(); f.apply(c);
    expect(angle(c, exhibit)).toBeLessThan(0.01);
    f.setTarget(null); run(f, 2);
    const d = cam(); f.apply(d);
    expect(d.position.distanceTo(new Vector3(0, 1.7, 0))).toBeLessThan(1e-9);
    expect(d.target.distanceTo(new Vector3(0, 1.7, -1))).toBeLessThan(1e-9);
  });
  it('steps in toward it, never further than the cap and never off the floor line', () => {
    const f = new Focus(); f.setTarget(new Vector3(40, 0.5, -40)); run(f, 2);
    const c = cam(); f.apply(c);
    const moved = c.position.distanceTo(new Vector3(0, 1.7, 0));
    expect(moved).toBeGreaterThan(0.1);
    expect(moved).toBeLessThanOrEqual(DOLLY_MAX + 1e-9);
    expect(c.position.y).toBe(1.7);
  });
  it('holds the exhibit off centre by the offset it is given, to clear the panel', () => {
    const f = new Focus(); f.setTarget(exhibit); f.offset = 0.2; run(f, 2);
    const c = cam(); f.apply(c);
    expect(angle(c, exhibit)).toBeCloseTo(0.2, 1);
    // Looking to the right of it puts the exhibit left of centre, where the panel is not.
    const look = c.target.clone().sub(c.position), to = exhibit.clone().sub(c.position);
    expect(look.x * to.z - look.z * to.x).toBeLessThan(0);
  });
  it('closing part way through the lean leaves nothing behind', () => {
    const f = new Focus(); f.setTarget(exhibit); run(f, LEAN_IN / 2);
    expect(f.level).toBeGreaterThan(0);
    f.setTarget(null); run(f, LEAN_OUT + FRAME);
    expect(f.level).toBe(0);
    expect(f.dim).toBe(0);
  });
  it('moving to another exhibit while open never lets the room back up', () => {
    const f = new Focus(); f.setTarget(exhibit); run(f, 2);
    f.setTarget(new Vector3(-3, 1.2, -4));
    let low = 1;
    for (let i = 0; i < 60; i++) { f.update(FRAME, 1); low = Math.min(low, f.level); }
    expect(low).toBe(1);
    const c = cam(); f.apply(c);
    expect(angle(c, new Vector3(-3, 1.2, -4))).toBeLessThan(0.02);
  });
  it('reports where the exhibit is, for the light that stays on it', () => {
    const f = new Focus(); f.setTarget(exhibit); run(f, 2);
    expect(f.aim.distanceTo(exhibit)).toBeLessThan(0.01);
  });
});

describe('what the lean is aimed at', () => {
  const pose = () => ({ position: new Vector3(-40, 1.7, -31), target: new Vector3(-41, 1.7, -31) });
  it('the exhibit, when it is near and in front', () => {
    const r = leanTarget(new Vector3(-45, 2, -28), pose());
    expect(r.exhibit).toBe(true);
    expect(r.at.toArray()).toEqual([-45, 2, -28]);
  });
  it('the way the camera already looks, when the exhibit is too far off to lean to', () => {
    // Dead ahead and sixteen metres away: the break room's end wall set from the middle of the room.
    const r = leanTarget(new Vector3(-56.4, 2, -28), pose());
    expect(r.exhibit).toBe(false);
    const look = pose().target.sub(pose().position).normalize(), to = r.at.clone().sub(pose().position).normalize();
    expect(look.angleTo(to)).toBeLessThan(1e-6);
  });
  it('the way the camera already looks, when the exhibit is behind it', () => {
    const r = leanTarget(new Vector3(-36, 1.5, -31), pose());
    expect(r.exhibit).toBe(false);
    expect(r.at.x).toBeLessThan(-40);
  });
  it('the way the camera already looks, when there is no exhibit at all', () => {
    const r = leanTarget(null, pose());
    expect(r.exhibit).toBe(false);
    expect(r.at.x).toBeLessThan(-40);
  });
  it('and aimed there, the lean never turns the camera', () => {
    // The fault this pins: with no exhibit to lean to, the camera was aimed at its stop's own
    // subject from wherever it stood, which from the far end of a room is behind it.
    const r = leanTarget(new Vector3(-56.4, 2, -28), pose());
    const f = new Focus(); f.setTarget(r.at); run(f, 2);
    const c = pose(); f.apply(c);
    const before = pose().target.sub(pose().position).normalize(), after = c.target.clone().sub(c.position).normalize();
    expect(before.angleTo(after)).toBeLessThan(0.01);
  });
});
