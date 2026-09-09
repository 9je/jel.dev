import { describe, it, expect } from 'vitest';
import { tickerOffset } from '../../src/scenes/walk/ticker';

describe('tickerOffset', () => {
  it('advances by speed and wraps at the loop width', () => {
    expect(tickerOffset(0, 1, 100, 1000)).toBe(100);
    expect(tickerOffset(950, 1, 100, 1000)).toBe(50);
  });
});
