import { describe, expect, it } from 'vitest';
import { cardLeft, cardSide, cardTop } from '../../src/scenes/walk/overlays';

// A 1600 wide frame, a 300 wide card, the default 16 px gap.
const VW = 1600, CARD = 300;

describe('where an exhibit card hangs', () => {
  it('hangs outward: an exhibit left of centre gets its card to its left', () => {
    expect(cardSide(500, VW)).toBe('left');
    expect(cardLeft(500, 60, CARD, VW)).toBe(500 - 60 - 16 - CARD);
  });

  it('hangs outward: an exhibit right of centre gets its card to its right', () => {
    expect(cardSide(1100, VW)).toBe('right');
    expect(cardLeft(1100, 60, CARD, VW)).toBe(1100 + 60 + 16);
  });

  it('leaves the middle of the frame, where the room is, clear of the card', () => {
    // Either side of the centre line, the card is further out than the exhibit it belongs to.
    expect(cardLeft(790, 40, CARD, VW) + CARD).toBeLessThan(790);
    expect(cardLeft(810, 40, CARD, VW)).toBeGreaterThan(810);
  });

  it('clears the exhibit by its own reach, not by a fixed gap', () => {
    const near = cardLeft(500, 20, CARD, VW);
    const wide = cardLeft(500, 100, CARD, VW);
    expect(near - wide).toBe(80);
  });

  it('never hangs off the frame, however little room the outer side has', () => {
    expect(cardLeft(100, 60, CARD, VW)).toBe(16);
    expect(cardLeft(1500, 60, CARD, VW)).toBe(VW - CARD - 16);
  });

  it('stays out of the dock rail down the right of the frame', () => {
    expect(cardLeft(1500, 60, CARD, VW, 16, 176)).toBe(VW - 176 - CARD - 16);
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
