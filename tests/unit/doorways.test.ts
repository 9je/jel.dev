import { describe, expect, it } from 'vitest';
import { cameraAt } from '../../src/scenes/walk/path';
import { EXIT_X0, EXIT_X1, EXIT_H } from '../../src/scenes/walk/stages/fabrication/layout';
import { X0 as BREAK_X0, X1 as BREAK_X1, Z0 as BREAK_Z0, Z1 as BREAK_Z1, H as BREAK_H, LANDING, BAY_DOOR, HALL_DOOR } from '../../src/scenes/walk/stages/recreation/layout';
import { X0 as HALL_X0, X1 as HALL_X1, Z0 as HALL_Z0, Z1 as HALL_Z1, H as HALL_H, EAST_OPEN, WEST_OPEN, CREDENTIALS_X, HALL_DOOR as CRED_DOOR } from '../../src/scenes/walk/stages/operations/layout';

/**
 * Every transition is two shells meeting on one plane with a vestibule bridging them. The numbers
 * that make them meet live in four layout files, and a doorway whose mouth misses its wall by a
 * metre draws happily: it is the black void between the rooms Jordan saw. They are arithmetic, so
 * they are checked here rather than looked for in a screenshot.
 */
describe('the doorways between the rooms', () => {
  it('lands each vestibule mouth on the wall plane it joins', () => {
    // The bay: break room edge, 2.4 m of wall, then the bay's own opening in its far wall.
    expect(BAY_DOOR.x - BAY_DOOR.depth / 2).toBeCloseTo(BREAK_X1, 6);
    expect(BAY_DOOR.x + BAY_DOOR.depth / 2).toBeCloseTo(LANDING.x0, 6);
    expect(LANDING.x0).toBeCloseTo(EXIT_X0, 6);
    // The server hall: its east wall is the vestibule's far mouth, the break room closes the near one.
    expect(HALL_DOOR.x - HALL_DOOR.depth / 2).toBeCloseTo(HALL_X1, 6);
    // The credentials hall: the two shells overlap by a metre and the doorway is cut through it.
    expect(CRED_DOOR.x - CRED_DOOR.depth / 2).toBeCloseTo(HALL_X0, 6);
    expect(CRED_DOOR.x + CRED_DOOR.depth / 2).toBeCloseTo(CREDENTIALS_X, 6);
  });

  it('opens each doorway inside the room it opens into', () => {
    // Nothing may be wider than the space behind it, or the reveal stands in mid air.
    expect(BAY_DOOR.z - BAY_DOOR.w / 2).toBeGreaterThanOrEqual(LANDING.z0);
    expect(BAY_DOOR.z + BAY_DOOR.w / 2).toBeLessThanOrEqual(LANDING.z1);
    expect(BAY_DOOR.h).toBeLessThan(BREAK_H);
    expect(LANDING.z1).toBeCloseTo(-30, 6); // the bay's far wall, where the landing's north side is
    expect(EXIT_H).toBeCloseTo(BREAK_H, 6); // the bay's opening is as tall as the landing's ceiling
    for (const [door, z0, z1] of [[HALL_DOOR, BREAK_Z0, BREAK_Z1], [CRED_DOOR, HALL_Z0, HALL_Z1]] as [typeof HALL_DOOR, number, number][]) {
      expect(door.z - door.w / 2).toBeGreaterThanOrEqual(z0);
      expect(door.z + door.w / 2).toBeLessThanOrEqual(z1);
    }
    expect(HALL_DOOR.h).toBeLessThan(HALL_H);
    expect(CRED_DOOR.h).toBeLessThan(HALL_H);
  });

  it('closes each end wall around exactly the opening its doorway fills', () => {
    expect(EAST_OPEN.z0).toBeCloseTo(HALL_DOOR.z - HALL_DOOR.w / 2, 6);
    expect(EAST_OPEN.z1).toBeCloseTo(HALL_DOOR.z + HALL_DOOR.w / 2, 6);
    expect(EAST_OPEN.h).toBeCloseTo(HALL_DOOR.h, 6);
    expect(WEST_OPEN.z0).toBeCloseTo(CRED_DOOR.z - CRED_DOOR.w / 2, 6);
    expect(WEST_OPEN.z1).toBeCloseTo(CRED_DOOR.z + CRED_DOOR.w / 2, 6);
    // Both openings are inside the hall's own end walls, which flank them.
    for (const open of [EAST_OPEN, WEST_OPEN]) {
      expect(open.z0).toBeGreaterThan(HALL_Z0);
      expect(open.z1).toBeLessThan(HALL_Z1);
    }
  });

  /** Where the walk crosses a plane, sampled off the spline the camera actually rides. */
  const crossing = (axis: 'x' | 'z', at: number, from: number, to: number) => {
    let last = cameraAt(from).position.clone();
    for (let t = from; t <= to; t += 0.0005) {
      const p = cameraAt(t).position;
      if ((last[axis] - at) * (p[axis] - at) <= 0 && last[axis] !== p[axis]) {
        const k = (at - last[axis]) / (p[axis] - last[axis]);
        return { x: last.x + (p.x - last.x) * k, z: last.z + (p.z - last.z) * k };
      }
      last = p.clone();
    }
    throw new Error(`the walk never crosses ${axis} ${at}`);
  };

  it('walks the camera through every opening with a metre of clearance', () => {
    const bayWall = crossing('z', -30, 0.28, 0.35);
    expect(bayWall.x).toBeGreaterThan(EXIT_X0 + 1);
    expect(bayWall.x).toBeLessThan(EXIT_X1 - 1);

    const bayDoor = crossing('x', BAY_DOOR.x, 0.3, 0.36);
    expect(bayDoor.z).toBeGreaterThan(BAY_DOOR.z - BAY_DOOR.w / 2 + 1);
    expect(bayDoor.z).toBeLessThan(BAY_DOOR.z + BAY_DOOR.w / 2 - 1);

    const hallDoor = crossing('x', HALL_DOOR.x, 0.5, 0.56);
    expect(hallDoor.z).toBeGreaterThan(HALL_DOOR.z - HALL_DOOR.w / 2 + 1);
    expect(hallDoor.z).toBeLessThan(HALL_DOOR.z + HALL_DOOR.w / 2 - 1);

    // The credentials doorway is the narrowest, and the walk is already turning north through it.
    for (const x of [HALL_X0, CREDENTIALS_X]) {
      const at = crossing('x', x, 0.62, 0.68);
      expect(at.z).toBeGreaterThan(WEST_OPEN.z0 + 0.7);
      expect(at.z).toBeLessThan(WEST_OPEN.z1 - 0.7);
    }
  });

  it('keeps the landing between the bay and the break room', () => {
    // The landing's east wall is the far jamb of the bay's own opening, and its south wall carries
    // on from the break room's, so the two rooms read as one run of building.
    expect(LANDING.x1).toBeCloseTo(EXIT_X1, 6);
    expect(LANDING.z0).toBeCloseTo(BREAK_Z0, 6);
    expect(BREAK_X0).toBeLessThan(HALL_DOOR.x);
  });
});
