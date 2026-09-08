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
  it('door opens after the booth hold and before the fabrication hold', () => {
    expect(DOOR_RANGE[0]).toBeGreaterThanOrEqual(STOPS[0].hold[1]);
    expect(DOOR_RANGE[1]).toBeLessThanOrEqual(STOPS[1].hold[0]);
    expect(doorOpenAmount(0)).toBe(0);
    expect(doorOpenAmount(DOOR_RANGE[1])).toBe(1);
    expect(doorOpenAmount((DOOR_RANGE[0] + DOOR_RANGE[1]) / 2)).toBeCloseTo(0.5, 5);
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
  it('moves a roughly constant distance per unit of travel between holds', () => {
    const d = [];
    const a = STOPS[0].hold[1], b = STOPS[1].hold[0];
    for (let i = 0; i < 10; i++) { const t0 = a + ((b - a) * i) / 10, t1 = a + ((b - a) * (i + 1)) / 10; d.push(cameraAt(t0).position.distanceTo(cameraAt(t1).position)); }
    const mean = d.reduce((x, y) => x + y) / d.length;
    for (const x of d) expect(Math.abs(x - mean) / mean).toBeLessThan(0.35);
  });
  it('looks at the stop target while held and ahead while walking', () => {
    const fab = STOPS[1];
    expect(holdWeight(fab.t)).toBe(1);
    expect(holdWeight((STOPS[1].hold[1] + STOPS[2].hold[0]) / 2)).toBe(0);
    const held = cameraAt(fab.t);
    expect(held.target.x).toBeCloseTo(fab.lookAt[0], 3); expect(held.target.z).toBeCloseTo(fab.lookAt[2], 3);
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
