import { describe, expect, it } from 'vitest';
import { CatmullRomCurve3, Vector3 } from 'three';
import { CONTROL_POINTS, STOPS, cameraAt } from '../../src/scenes/walk/path';
import { lights } from '../../src/scenes/walk/stages/operations/lighting';
import { BATTEN_ROWS, BATTEN_XS, BATTEN_Y, CARTONS, RACK_Z, STANCHIONS, TAPE_RUNS, TRUNK, X0 } from '../../src/scenes/walk/stages/operations/layout';

// The walked line, as the path builds it, sampled finely enough to measure a clearance against.
const curve = new CatmullRomCurve3(CONTROL_POINTS.map((p) => new Vector3(...p)), false, 'centripetal', 0.5);
const line = curve.getSpacedPoints(4000);
const clearance = (x: number, z: number) => Math.min(...line.map((p) => Math.hypot(p.x - x, p.z - z)));

/** The flagship desk's footprint on plan: 1.2 m in from the west wall, turned along z. */
const DESK = { x0: X0 + 0.7, x1: X0 + 1.7, z0: -31.9, z1: -30.1 };

describe('the server hall', () => {
  it('sits every spot under a batten in one of the two rows', () => {
    const spots = lights().filter((l) => l.kind === 'spot');
    expect(spots).toHaveLength(2);
    const rows = new Set<number>();
    for (const s of spots) {
      expect(BATTEN_XS).toContain(s.position[0]);
      expect(BATTEN_ROWS).toContain(s.position[2]);
      expect(s.position[1]).toBeLessThan(BATTEN_Y);
      rows.add(s.position[2]);
    }
    // One in each row, not two in the same one.
    expect(rows.size).toBe(2);
  });

  it('keeps the tape and its stanchions clear of the walked line', () => {
    for (const [x, z] of STANCHIONS) expect(clearance(x, z)).toBeGreaterThanOrEqual(2.2);
    for (const [a, b] of TAPE_RUNS) for (let k = 0; k <= 10; k++) {
      const x = a[0] + (b[0] - a[0]) * (k / 10), z = a[1] + (b[1] - a[1]) * (k / 10);
      expect(clearance(x, z)).toBeGreaterThanOrEqual(2.2);
    }
  });

  // The trunk runs west along the walk's own sight line and the hold parks on that line, so the
  // trunk's near end sits at the camera's own x however long the pipe is. There is no distance
  // along the run to buy: the only thing that keeps a 0.32 m cylinder from foreshortening into a
  // wedge across the frame is how far off to the side it hangs. Over the aisle it was 1.8 m off and
  // filled the top of the shot. Four metres puts the near end past the edge of a 50 degree frame.
  it('hangs the trunk far enough off the walked line to clear the frame', () => {
    const stop = STOPS.find((s) => s.id === 'operations')!;
    const [t0, t1] = stop.hold;
    for (let k = 0; k <= 20; k++) {
      const { position } = cameraAt(t0 + (t1 - t0) * (k / 20));
      expect(Math.abs(TRUNK.z - position.z)).toBeGreaterThanOrEqual(4);
    }
    // And it feeds the tray it hangs over, so the drops into it stay short.
    expect(Math.abs(TRUNK.z - RACK_Z.south)).toBeLessThanOrEqual(2);
  });

  it('strings no tape through the flagship desk', () => {
    for (const [a, b] of TAPE_RUNS) for (let k = 0; k <= 20; k++) {
      const x = a[0] + (b[0] - a[0]) * (k / 20), z = a[1] + (b[1] - a[1]) * (k / 20);
      const inDesk = x > DESK.x0 && x < DESK.x1 && z > DESK.z0 && z < DESK.z1;
      expect(inDesk).toBe(false);
    }
  });

  it('stacks the cartons on the floor and on each other, none floating', () => {
    const [a, b, top] = CARTONS;
    expect(a[1]).toBe(0);
    expect(b[1]).toBe(0);
    // The one on top stands on the first carton's own lid, square to it.
    expect(top[1]).toBeCloseTo(0.38 * a[4]);
    expect(top[0]).toBe(a[0]); expect(top[2]).toBe(a[2]); expect(top[3]).toBe(a[3]);
    expect(top[4]).toBeLessThan(a[4]);
    for (const [x, z] of [[a[0], a[2]], [b[0], b[2]]]) expect(clearance(x, z)).toBeGreaterThanOrEqual(2.2);
  });
});
