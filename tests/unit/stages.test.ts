import { describe, expect, it } from 'vitest';
import { BOOTH_DEF } from '../../src/scenes/walk/stages/booth';
import { FABRICATION_DEF } from '../../src/scenes/walk/stages/fabrication';
import { RECREATION_DEF } from '../../src/scenes/walk/stages/recreation';
import { OPERATIONS_DEF } from '../../src/scenes/walk/stages/operations';
import { CREDENTIALS_DEF } from '../../src/scenes/walk/stages/credentials';
import { CONTAINMENT_DEF } from '../../src/scenes/walk/stages/containment';
import { FILE_DEF } from '../../src/scenes/walk/stages/file';
import { STOPS } from '../../src/scenes/walk/path';

const DEFS = [BOOTH_DEF, FABRICATION_DEF, RECREATION_DEF, OPERATIONS_DEF, CREDENTIALS_DEF, CONTAINMENT_DEF, FILE_DEF];

describe('stage definitions', () => {
  it('each names a real stop and is near it', () => {
    for (const d of DEFS) {
      expect(STOPS.some((s) => s.id === d.stop)).toBe(true);
      expect(d.near).toContain(d.stop);
      expect(d.groups.length).toBeGreaterThan(0);
    }
  });
  it('stops are unique across rooms', () => {
    expect(new Set(DEFS.map((d) => d.stop)).size).toBe(DEFS.length);
  });
});
