import { describe, it, expect } from 'vitest';
import { groupProgress, manifestFor } from '../../src/scenes/walk/assets';

describe('groupProgress', () => {
  it('weights progress by bytes', () => {
    const p = groupProgress([{ bytes: 100, done: true }, { bytes: 300, done: false }]);
    expect(p).toEqual({ loaded: 100, total: 400 });
  });
  it('handles an empty group', () => expect(groupProgress([])).toEqual({ loaded: 0, total: 0 }));
});

describe('manifestFor', () => {
  it('maps tiers to manifests', () => {
    expect(manifestFor('high')).toBe('desktop');
    expect(manifestFor('medium')).toBe('desktop');
    expect(manifestFor('low')).toBe('phone');
    expect(manifestFor('lite')).toBe('phone');
  });
});
