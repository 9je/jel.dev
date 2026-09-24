import { describe, expect, it } from 'vitest';
import { ROOM_BUDGET, checkBudget } from '../../src/scenes/walk/rig';
import { lights, FIXTURES, FIXTURE_Y, FIXTURE_ROWS, SODIUM_LAMPS, LAMP_Y, WORKING, TRACK, rowStrikeAt, tubeStrike } from '../../src/scenes/walk/stages/fabrication/lighting';
import { X0, X1, Z0, Z1 } from '../../src/scenes/walk/stages/fabrication/layout';
import { DISPATCH_ROWS } from '../../src/scenes/walk/stages/fabrication/boards';
import { DOOR_RANGE } from '../../src/scenes/walk/path';

// Jordan's note on the bay was that the lights do not line up: a pool on the floor with nothing
// above it, and a fitting with nothing under it. The placements are data now, so the rule that
// every spot hangs under a fitting the room draws is arithmetic here rather than a screenshot.
describe('the loading bay lighting', () => {
  const placed = lights();

  it('keeps to the rig budget with the office point counted', () => {
    expect(() => checkBudget(placed)).not.toThrow();
    expect(placed.filter((l) => l.kind === 'spot').length).toBeLessThanOrEqual(ROOM_BUDGET.spots);
    expect(placed.filter((l) => l.kind === 'point').length).toBeLessThanOrEqual(ROOM_BUDGET.points - 1);
  });

  it('hangs every spot under a fitting', () => {
    const fittings: [number, number, number][] = [
      ...FIXTURES.map(([x, z]) => [x, FIXTURE_Y, z] as [number, number, number]),
      ...SODIUM_LAMPS.map(([x, z]) => [x, LAMP_Y, z] as [number, number, number]),
    ];
    for (const l of placed) {
      if (l.kind !== 'spot') continue;
      // The exhibit track's spot hangs from the track and is aimed across at the plinths.
      if (l.position[0] === TRACK.x && l.position[1] === TRACK.y && l.position[2] === TRACK.z) continue;
      const under = fittings.some(([x, y, z]) => Math.abs(l.position[0] - x) < 0.05 && Math.abs(l.position[1] - y) < 0.05 && Math.abs(l.position[2] - z) < 0.05);
      expect(under, `spot at ${l.position.join(',')} hangs from nothing`).toBe(true);
      // Straight down: a fitting throws its light under itself.
      expect(l.target[0]).toBeCloseTo(l.position[0]);
      expect(l.target[2]).toBeCloseTo(l.position[2]);
    }
  });

  it('carries a working spot on a fitting it draws', () => {
    for (const [x, z] of WORKING) expect(FIXTURES.some(([fx, fz]) => fx === x && fz === z)).toBe(true);
  });

  it('keeps every fitting inside the hall', () => {
    for (const [x, z] of [...FIXTURES, ...SODIUM_LAMPS]) {
      expect(x).toBeGreaterThan(X0); expect(x).toBeLessThan(X1);
      expect(z).toBeGreaterThan(Z0); expect(z).toBeLessThan(Z1);
    }
  });
});

describe('the dispatch board', () => {
  it('lists the three products on the plinths against a bay', () => {
    for (const name of ['conch.gg', 'ezkey.io', 'earworm.games']) {
      const row = DISPATCH_ROWS.find((r) => r.product === name);
      expect(row, name).toBeDefined();
      expect(row?.bay).toMatch(/^bay \d$/);
      expect(row?.struck).toBeFalsy();
    }
    expect(DISPATCH_ROWS.some((r) => r.struck)).toBe(true);
  });
});

describe('the bay lights on the first scroll', () => {
  it('strikes every row, nearest the door first, while the shutter is still lifting', () => {
    for (let i = 0; i < FIXTURE_ROWS.length; i++) {
      expect(rowStrikeAt(i)).toBeGreaterThan(0);
      expect(rowStrikeAt(i)).toBeLessThan(DOOR_RANGE[1]);
      if (i > 0) expect(rowStrikeAt(i)).toBeGreaterThan(rowStrikeAt(i - 1));
    }
    expect(FIXTURE_ROWS[0]).toBeGreaterThan(FIXTURE_ROWS[FIXTURE_ROWS.length - 1]!);
  });
  it('stutters and then holds full', () => {
    expect(tubeStrike(-1)).toBe(0);
    expect(tubeStrike(0.1)).toBe(0);
    expect(tubeStrike(0.6)).toBe(1);
    expect(tubeStrike(5)).toBe(1);
  });
});
