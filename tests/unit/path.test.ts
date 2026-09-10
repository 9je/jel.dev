import { describe, it, expect } from 'vitest';
import { STOPS, cameraAt, stopAt, tForStop, doorOpenAmount, DOOR_RANGE, holdWeight, localProgress, travelParam, EYE } from '../../src/scenes/walk/path';

describe('stops', () => {
  it('are seven, in increasing t, from 0 to 1', () => {
    expect(STOPS.map((s) => s.id)).toEqual(['booth', 'fabrication', 'recreation', 'operations', 'credentials', 'containment', 'file']);
    for (let i = 1; i < STOPS.length; i++) expect(STOPS[i].t).toBeGreaterThan(STOPS[i - 1].t);
    expect(STOPS[0].t).toBe(0); expect(STOPS[STOPS.length - 1].t).toBe(1);
  });
  it('holds contain their stop and never overlap', () => {
    for (const s of STOPS) { expect(s.hold[0]).toBeLessThanOrEqual(s.t); expect(s.hold[1]).toBeGreaterThanOrEqual(s.t); }
    for (let i = 1; i < STOPS.length; i++) expect(STOPS[i].hold[0]).toBeGreaterThan(STOPS[i - 1].hold[1]);
  });
  it('door opens before the fabrication hold and is never walked through', () => {
    expect(DOOR_RANGE[1]).toBeLessThanOrEqual(STOPS[1].hold[0]);
    expect(doorOpenAmount(0)).toBe(0);
    expect(doorOpenAmount(DOOR_RANGE[1])).toBe(1);
    expect(doorOpenAmount((DOOR_RANGE[0] + DOOR_RANGE[1]) / 2)).toBeCloseTo(0.5, 5);
    // The shutter plane sits at z 22. Wherever the camera has come within 0.6 m of it, the door
    // has to be all the way up, or the walk drives the lens through a closed door.
    for (let t = 0; t <= 0.3 + 1e-9; t += 0.001) {
      if (cameraAt(t).position.z <= 22.6) expect(doorOpenAmount(t)).toBe(1);
    }
    // And the reveal has to finish while the camera is still parked, so it is watched, not passed.
    expect(doorOpenAmount(STOPS[0].hold[1])).toBe(1);
  });
});

describe('camera', () => {
  it('starts in the booth at eye height looking down the hangar', () => {
    const c = cameraAt(0);
    expect(c.position.x).toBeCloseTo(0, 5); expect(c.position.y).toBeCloseTo(EYE, 5); expect(c.position.z).toBeCloseTo(26, 5);
    expect(c.target.z).toBeLessThan(c.position.z);
  });
  it('stands still through a hold and moves between holds', () => {
    const fab = STOPS[1];
    expect(cameraAt(fab.hold[0]).position.distanceTo(cameraAt(fab.hold[1]).position)).toBeLessThan(1e-6);
    expect(travelParam(fab.hold[0])).toBe(fab.t);
    expect(travelParam(fab.hold[1])).toBe(fab.t);
    const a = STOPS[0].hold[1], b = STOPS[1].hold[0];
    expect(travelParam((a + b) / 2)).toBeCloseTo((STOPS[0].t + STOPS[1].t) / 2, 6);
    expect(cameraAt(a).position.distanceTo(cameraAt(b).position)).toBeGreaterThan(5);
  });
  it('covers the whole distance between holds, fastest in the middle and symmetric', () => {
    const d = [];
    const a = STOPS[0].hold[1], b = STOPS[1].hold[0];
    for (let i = 0; i < 10; i++) { const t0 = a + ((b - a) * i) / 10, t1 = a + ((b - a) * (i + 1)) / 10; d.push(cameraAt(t0).position.distanceTo(cameraAt(t1).position)); }
    expect(Math.max(...d)).toBe(Math.max(d[4], d[5]));
    for (let i = 0; i < 5; i++) expect(d[i]).toBeCloseTo(d[9 - i], 2);
    expect(cameraAt(a).position.distanceTo(cameraAt(b).position)).toBeGreaterThan(20);
  });
  it('looks at the stop target while held and ahead while walking', () => {
    const fab = STOPS[1];
    expect(holdWeight(fab.t)).toBe(1);
    expect(holdWeight((STOPS[1].hold[1] + STOPS[2].hold[0]) / 2)).toBe(0);
    const held = cameraAt(fab.t);
    const want = held.target.clone().set(fab.lookAt[0], fab.lookAt[1], fab.lookAt[2]).sub(held.position).normalize();
    expect(held.target.clone().sub(held.position).normalize().dot(want)).toBeGreaterThan(0.9999);
  });
  it('has continuous look-ahead near path end', () => {
    const samples = [0.9490, 0.9495, 0.9500, 0.9505, 0.9510];
    for (let i = 0; i < samples.length - 1; i++) {
      const t0 = samples[i], t1 = samples[i + 1];
      const target0 = cameraAt(t0).target;
      const target1 = cameraAt(t1).target;
      expect(target0.distanceTo(target1)).toBeLessThan(1.5);
    }
  });
});

describe('lookup', () => {
  it('finds the stop by hold or nearest t', () => {
    expect(stopAt(0.21).id).toBe('fabrication');
    expect(stopAt(0.28).id).toBe('fabrication');
    expect(stopAt(1).id).toBe('file');
    expect(tForStop('recreation')).toBe(STOPS[2].t);
  });
  it('local progress runs 0 to 1 between neighbouring stops', () => {
    expect(localProgress(STOPS[0].t, 'fabrication')).toBe(0);
    expect(localProgress(STOPS[1].t, 'fabrication')).toBeCloseTo(0.5, 5);
    expect(localProgress(STOPS[2].t, 'fabrication')).toBe(1);
  });
});

describe('camera motion', () => {
  const dirAt = (t: number) => { const c = cameraAt(t); return c.target.clone().sub(c.position).normalize(); };
  const STEP = 0.0005; // about 5 px of scroll at a 900 px viewport
  it('never turns more than 3 degrees in one 5 px step of scroll', () => {
    // A 160 degree turn used to happen inside 70 px at the edge of the fabrication hold: the aim
    // point was lerped in a straight line that passed beside the camera.
    let prev = dirAt(0), worst = 0, at = 0;
    for (let t = STEP; t <= 1 + 1e-9; t += STEP) {
      const d = dirAt(t);
      const deg = Math.acos(Math.max(-1, Math.min(1, prev.dot(d)))) * 180 / Math.PI;
      if (deg > worst) { worst = deg; at = t; }
      prev = d;
    }
    expect(worst, `worst turn ${worst.toFixed(1)} deg at t ${at.toFixed(4)}`).toBeLessThan(3);
  });
  it('looks straight at the stop through the middle of every hold', () => {
    for (const s of STOPS) {
      const c = cameraAt(s.t);
      const want = c.target.clone().set(s.lookAt[0], s.lookAt[1], s.lookAt[2]).sub(c.position).normalize();
      expect(dirAt(s.t).dot(want)).toBeGreaterThan(0.9999);
    }
  });
  it('eases into and out of every hold instead of stopping dead', () => {
    for (let i = 0; i < STOPS.length - 1; i++) {
      const a = STOPS[i].hold[1], b = STOPS[i + 1].hold[0];
      const edge = travelParam(a + STEP) - travelParam(a);
      const mid = travelParam((a + b) / 2 + STEP) - travelParam((a + b) / 2);
      expect(edge).toBeLessThan(mid * 0.2);
      expect(travelParam(b) - travelParam(b - STEP)).toBeLessThan(mid * 0.2);
    }
  });
});
