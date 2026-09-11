import { describe, expect, it } from 'vitest';
import { ROOM_BUDGET, checkBudget, type Placement, type PointPlacement } from '../../src/scenes/walk/rig';
import { boothLights } from '../../src/scenes/walk/stages/booth';
import { lights as recreationLights } from '../../src/scenes/walk/stages/recreation/lighting';
import { lights as operationsLights } from '../../src/scenes/walk/stages/operations/lighting';
import { lights as credentialsLights } from '../../src/scenes/walk/stages/credentials/lighting';

// The door's own standby lamp, which the booth appends to its placements. Stood in for here so the
// booth's lighting can be read without building the door.
const doorLamp: PointPlacement = { kind: 'point', position: [3.15, 3.05, 22], color: 0xc8322b, intensity: 2.5, distance: 5, decay: 2 };

// The fabrication floor's lighting is built against the asset store and the LED ticker in the DOM,
// so it has no store-free path to call from a unit test. Every other dressed room declares its
// placements as data, and this is where they are held to the budget the rig enforces at register().
const ROOMS: [string, Placement[]][] = [
  ['booth', boothLights(doorLamp)],
  ['recreation', recreationLights()],
  ['operations', operationsLights()],
  ['credentials', credentialsLights()],
];

const allFinite = (n: number[]) => n.every((v) => Number.isFinite(v));

describe('room lighting', () => {
  for (const [id, lights] of ROOMS) {
    it(`${id} declares no more than the rig lends a room`, () => {
      expect(() => checkBudget(lights)).not.toThrow();
      expect(lights.filter((l) => l.kind === 'spot').length).toBeLessThanOrEqual(ROOM_BUDGET.spots);
      expect(lights.filter((l) => l.kind === 'point').length).toBeLessThanOrEqual(ROOM_BUDGET.points);
    });
    it(`${id} places every light somewhere real`, () => {
      expect(lights.length).toBeGreaterThan(0);
      for (const l of lights) {
        // A NaN from a layout constant would put the light at the origin and leave the room dark,
        // with nothing in the console to say so.
        expect(allFinite(l.position)).toBe(true);
        if (l.kind === 'spot') expect(allFinite(l.target)).toBe(true);
        expect(Number.isFinite(l.intensity) && l.intensity > 0).toBe(true);
        expect(Number.isFinite(l.distance) && l.distance > 0).toBe(true);
      }
    });
  }
});
