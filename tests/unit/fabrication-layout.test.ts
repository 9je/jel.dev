import { describe, expect, it } from 'vitest';
import { X0, X1, Z0, Z1, COLUMNS, OFFICE, AISLE, AISLE_HALF } from '../../src/scenes/walk/stages/fabrication/layout';

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
