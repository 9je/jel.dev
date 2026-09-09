import { describe, it, expect } from 'vitest';
import { doorPose } from '../../src/scenes/walk/door';

describe('doorPose', () => {
  it('is closed at 0 and rolled up at 1', () => {
    const c = doorPose(0, 3.6); const o = doorPose(1, 3.6);
    expect(c.slatScaleY).toBe(1); expect(c.bottomY).toBeCloseTo(0, 6); expect(c.stencilVisible).toBe(true);
    expect(o.slatScaleY).toBeCloseTo(0, 6); expect(o.bottomY).toBeCloseTo(3.6, 6); expect(o.stencilVisible).toBe(false);
    expect(o.drumRadius).toBeGreaterThan(c.drumRadius);
  });
  it('moves the bottom edge linearly', () => { expect(doorPose(0.5, 4).bottomY).toBeCloseTo(2, 6); });
});
