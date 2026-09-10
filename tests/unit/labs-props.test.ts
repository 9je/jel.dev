import { describe, expect, it } from 'vitest';
import { rackSlots, gridPitch } from '../../src/scenes/walk/labs/props';

describe('labs kit helpers', () => {
  it('spaces rack beams evenly with a clear floor level', () => {
    expect(rackSlots(3, 4.5)).toEqual([1.5, 3, 4.5]);
    expect(rackSlots(1, 2)).toEqual([2]);
  });
  it('fits a ceiling grid to whole tiles', () => {
    expect(gridPitch(10, 8, 1.2)).toEqual({ cols: 8, rows: 6 });
    expect(gridPitch(1, 1, 1.2)).toEqual({ cols: 1, rows: 1 });
  });
});
