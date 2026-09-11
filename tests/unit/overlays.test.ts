import { describe, expect, it } from 'vitest';
import { cardLeft, cardTop } from '../../src/scenes/walk/overlays';

// A 1600 wide frame, a 400 wide card, the default 16 px gap.
const VW = 1600, CARD = 400;

describe('where an exhibit card hangs', () => {
  it('goes to the right of an exhibit on the left of the frame', () => {
    expect(cardLeft(300, 80, CARD, VW)).toBe(300 + 80 + 16);
  });

  it('goes to the left of an exhibit on the right of the frame', () => {
    expect(cardLeft(1300, 80, CARD, VW)).toBe(1300 - 80 - 16 - CARD);
  });

  it('clears the exhibit by its own reach, not by a fixed gap', () => {
    const near = cardLeft(300, 20, CARD, VW);
    const wide = cardLeft(300, 300, CARD, VW);
    expect(wide - near).toBe(280);
  });

  it('never hangs off the frame, however wide the exhibit is', () => {
    expect(cardLeft(40, 1500, CARD, VW)).toBe(VW - CARD - 16);
    expect(cardLeft(1560, 1500, CARD, VW)).toBe(16);
  });

  it('centres on the anchor vertically and stays inside the frame', () => {
    expect(cardTop(500, 300, 1000)).toBe(500);
    expect(cardTop(20, 300, 1000)).toBe(16 + 150);
    expect(cardTop(990, 300, 1000)).toBe(1000 - 16 - 150);
  });

  it('centres a card taller than the frame rather than pushing it off the top', () => {
    expect(cardTop(500, 2000, 1000)).toBe(500);
  });
});
