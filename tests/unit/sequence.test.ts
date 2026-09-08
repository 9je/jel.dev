import { describe, it, expect } from 'vitest';
import { lightsOnState, LIT, SEQUENCE_DURATION } from '../../src/scenes/bay/sequence';

describe('lightsOnState', () => {
  it('starts dark', () => {
    const s = lightsOnState(0);
    expect(s.banks).toEqual([0, 0, 0, 0]);
    expect(s.cube).toBe(0); expect(s.gates).toBe(0); expect(s.sign).toBe(0); expect(s.console).toBe(0);
  });
  it('flickers bank 0 before bank 1 starts', () => {
    const s = lightsOnState(0.3);
    expect(s.banks[0]).toBeGreaterThan(0);
    expect(s.banks[0]).toBeLessThan(1);
    expect(s.banks[1]).toBe(0);
  });
  it('holds every bank at full after 1.2s while the cube is still rising', () => {
    const s = lightsOnState(1.3);
    expect(s.banks).toEqual([1, 1, 1, 1]);
    expect(s.cube).toBeGreaterThan(0); expect(s.cube).toBeLessThan(1);
    expect(s.gates).toBe(0);
  });
  it('lights gates before the sign', () => {
    const s = lightsOnState(1.9);
    expect(s.gates).toBeGreaterThan(0.5);
    expect(s.sign).toBe(0);
  });
  it('is fully lit at the end', () => {
    expect(lightsOnState(SEQUENCE_DURATION)).toEqual(LIT);
    expect(lightsOnState(10)).toEqual(LIT);
  });
});
