import { describe, expect, it } from 'vitest';
import { lensFor, MAX_HFOV, MIN_HFOV } from '../../src/scenes/walk/framing';

const hfov = (l: { fov: number; aspect: number }) => (2 * Math.atan(Math.tan((l.fov * Math.PI) / 360) * l.aspect) * 180) / Math.PI;

describe('lensFor', () => {
  it('keeps the composed 55 degree lens on 16 by 9', () => {
    const l = lensFor(1920, 1080);
    expect(l.fov).toBeCloseTo(55, 5);
    expect(l.narrow).toBe(false); expect(l.wide).toBe(false); expect(l.shift).toBeNull();
  });
  it('caps the horizontal field on 32 by 9 and flags it wide, but not on 21 by 9', () => {
    const uw = lensFor(5120, 1440);
    expect(hfov(uw)).toBeCloseTo(MAX_HFOV, 3);
    expect(uw.wide).toBe(true);
    expect(lensFor(3440, 1440).wide).toBe(false);
  });
  it('never gives a portrait phone less than the minimum across, and pans it', () => {
    const l = lensFor(390, 844);
    expect(hfov(l)).toBeGreaterThanOrEqual(MIN_HFOV - 1e-6);
    expect(l.narrow).toBe(true);
  });
  it('lifts the aim above the sheet without changing the horizontal field', () => {
    const plain = lensFor(390, 844), shifted = lensFor(390, 844, 190);
    expect(hfov(shifted)).toBeCloseTo(hfov(plain), 5);
    expect(shifted.shift).toEqual({ fullH: 844 + 190, y: 190 });
  });
});
