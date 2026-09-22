import { describe, expect, it } from 'vitest';
import { cardLeft, cardSide, cardTop } from '../../src/scenes/walk/overlays';

// A 1600 wide frame, a 300 wide card, the default 16 px gap.
const VW = 1600, CARD = 300;

describe('where an exhibit card hangs', () => {
  it('hangs against the outer margin on the side its exhibit is on', () => {
    expect(cardSide(500, VW)).toBe('left');
    expect(cardLeft(500, CARD, VW)).toBe(16);
    expect(cardSide(1100, VW)).toBe('right');
    expect(cardLeft(1100, CARD, VW)).toBe(VW - CARD - 16);
  });

  it('leaves the middle of the frame, where the room is, clear of the card', () => {
    // A row of exhibits stands across the middle. Wherever in it the reader clicks, the card is
    // out at the frame's edge rather than over the machine next to the one they picked.
    expect(cardLeft(700, CARD, VW) + CARD).toBeLessThan(700);
    expect(cardLeft(900, CARD, VW)).toBeGreaterThan(900);
  });

  it('never hangs off the frame', () => {
    expect(cardLeft(100, CARD, VW)).toBe(16);
    expect(cardLeft(1500, CARD, VW)).toBe(VW - CARD - 16);
    // A card as wide as the frame still starts on it.
    expect(cardLeft(1500, VW, VW)).toBe(16);
  });

  it('stays out of the dock rail down the right of the frame', () => {
    expect(cardLeft(1500, CARD, VW, 16, 176)).toBe(VW - 176 - CARD - 16);
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
