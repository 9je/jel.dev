import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { X0, X1, Z0, Z1, COLUMNS, OFFICE, AISLE, AISLE_HALF, EXHIBITS, PLINTH } from '../../src/scenes/walk/stages/fabrication/layout';

// The bay's shell, dressing and office all measure themselves off these numbers, and each of them
// is placed by hand. A column outside the walls, a door off the end of its own face or an aisle
// point outside the hall are all mistakes the renderer draws happily and nobody sees until a
// screenshot. They are arithmetic, so they are checked here rather than looked for.
describe('the loading bay layout', () => {
  it('stands every column inside the hall', () => {
    expect(COLUMNS.length).toBeGreaterThan(0);
    for (const [x, z] of COLUMNS) {
      expect(x).toBeGreaterThan(X0);
      expect(x).toBeLessThan(X1);
      expect(z).toBeGreaterThan(Z0);
      expect(z).toBeLessThan(Z1);
    }
  });

  it('keeps both office doors inside the face they are cut into', () => {
    const half = OFFICE.w / 2;
    for (const doorX of [OFFICE.frontDoorX, OFFICE.backDoorX]) {
      const local = doorX - OFFICE.x;
      expect(local - OFFICE.doorW / 2).toBeGreaterThan(-half);
      expect(local + OFFICE.doorW / 2).toBeLessThan(half);
    }
  });

  it('stands the three flagships in the middle of the row, where the copy and the dock leave the frame clear', () => {
    expect(EXHIBITS.map((e) => e.id)).toEqual(['conch', 'phob-screen', 'hollow-knight-melee', 'ezkey', 'earworm']);
    // The row is no wider than the three it replaced: 6.6 m from the outside of one end cap to the other.
    expect(EXHIBITS[0]!.dz - EXHIBITS[4]!.dz + PLINTH.w + 0.1).toBeLessThanOrEqual(6.6);
    // Positive z is the camera's left at the hold, so the row reads left to right.
    for (let i = 1; i < EXHIBITS.length; i++) expect(EXHIBITS[i]!.dz).toBeLessThan(EXHIBITS[i - 1]!.dz);
  });

  it('leaves a gap between every pair of plinth caps, and keeps the row inside the office glass', () => {
    const cap = PLINTH.w + 0.1;
    for (let i = 1; i < EXHIBITS.length; i++) expect(EXHIBITS[i - 1]!.dz - EXHIBITS[i]!.dz - cap).toBeGreaterThanOrEqual(0.2);
    for (const e of EXHIBITS) expect(Math.abs(e.dz) + cap / 2).toBeLessThan(OFFICE.d / 2 - 0.15);
  });

  it('names every exhibit after a project the content carries', () => {
    for (const e of EXHIBITS) expect(existsSync(`src/content/projects/${e.id}.md`), e.id).toBe(true);
  });

  it('stands the office itself inside the hall', () => {
    expect(OFFICE.x - OFFICE.w / 2).toBeGreaterThan(X0);
    expect(OFFICE.x + OFFICE.w / 2).toBeLessThan(X1);
    expect(OFFICE.z - OFFICE.d / 2).toBeGreaterThan(Z0);
    expect(OFFICE.z + OFFICE.d / 2).toBeLessThan(Z1);
  });

  it('keeps the aisle and its paint inside the hall', () => {
    for (const [x, z] of AISLE) {
      expect(x - AISLE_HALF).toBeGreaterThan(X0);
      expect(x + AISLE_HALF).toBeLessThan(X1);
      expect(z).toBeGreaterThanOrEqual(Z0);
      expect(z).toBeLessThanOrEqual(Z1);
    }
  });
});
