import { describe, it, expect } from 'vitest';
import { chooseTier } from '../../src/scenes/walk/quality';

const base = { webgl: true, renderer: 'ANGLE (NVIDIA)', threads: 8, coarse: false, reducedMotion: false, saveData: false, pref: null as null };

describe('chooseTier', () => {
  it('picks high for a capable desktop', () => expect(chooseTier(base)).toBe('high'));
  it('picks lite without webgl', () => expect(chooseTier({ ...base, webgl: false })).toBe('lite'));
  it('picks lite for software renderers', () => {
    expect(chooseTier({ ...base, renderer: 'Google SwiftShader' })).toBe('lite');
    expect(chooseTier({ ...base, renderer: 'llvmpipe (LLVM 15)' })).toBe('lite');
  });
  it('picks lite for reduced motion and save-data', () => {
    expect(chooseTier({ ...base, reducedMotion: true })).toBe('lite');
    expect(chooseTier({ ...base, saveData: true })).toBe('lite');
  });
  it('respects the user toggle both ways', () => {
    expect(chooseTier({ ...base, pref: 'off' })).toBe('lite');
    expect(chooseTier({ ...base, renderer: 'Google SwiftShader', pref: 'on' })).toBe('low');
  });
  it('picks low on phones and medium on modest desktops', () => {
    expect(chooseTier({ ...base, coarse: true, threads: 8 })).toBe('low');
    expect(chooseTier({ ...base, coarse: true, threads: 2 })).toBe('lite');
    expect(chooseTier({ ...base, threads: 4 })).toBe('medium');
  });
});
