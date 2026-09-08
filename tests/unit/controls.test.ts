import { describe, it, expect } from 'vitest';
import { parallaxTarget, damp, scrollCameraZ, MAX_YAW, MAX_PITCH, clamp01 } from '../../src/scenes/bay/controls';
import { CAMERA } from '../../src/scenes/bay/constants';

describe('parallaxTarget', () => {
  it('turns away from the pointer within the limits', () => {
    const right = parallaxTarget(1, 0);
    expect(right.yaw).toBeCloseTo(-MAX_YAW, 9); expect(right.pitch).toBeCloseTo(0, 9);
    const up = parallaxTarget(0, -1);
    expect(up.yaw).toBeCloseTo(0, 9); expect(up.pitch).toBeCloseTo(MAX_PITCH, 9);
    const centre = parallaxTarget(0, 0);
    expect(centre.yaw).toBeCloseTo(0, 9); expect(centre.pitch).toBeCloseTo(0, 9);
  });
  it('limits are two degrees', () => {
    expect(MAX_YAW).toBeCloseTo((2 * Math.PI) / 180, 6);
    expect(MAX_PITCH).toBeCloseTo((2 * Math.PI) / 180, 6);
  });
});

describe('damp', () => {
  it('moves toward the target and never overshoots', () => {
    let v = 0;
    for (let i = 0; i < 60; i++) v = damp(v, 1, 5, 1 / 60);
    expect(v).toBeGreaterThan(0.99); expect(v).toBeLessThanOrEqual(1);
  });
  it('stays put when at the target', () => { expect(damp(3, 3, 5, 0.016)).toBe(3); });
});

describe('scrollCameraZ', () => {
  it('starts at the booth and walks 30% of the hangar', () => {
    expect(scrollCameraZ(0)).toBe(CAMERA.zStart);
    expect(scrollCameraZ(1)).toBeCloseTo(CAMERA.zStart - 21, 6);
    expect(scrollCameraZ(2)).toBeCloseTo(CAMERA.zStart - 21, 6);
    expect(scrollCameraZ(-1)).toBe(CAMERA.zStart);
  });
});

describe('clamp01', () => {
  it('clamps', () => { expect(clamp01(-2)).toBe(0); expect(clamp01(0.4)).toBe(0.4); expect(clamp01(9)).toBe(1); });
});
