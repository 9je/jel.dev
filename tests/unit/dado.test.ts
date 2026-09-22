import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DADO_H, dadoBands } from '../../src/scenes/walk/labs/materials';

/**
 * The blue lower wall is one height for the whole building, and this is what holds it there.
 *
 * It was briefly a per room decision: the credentials hall's walls are 7 m and a 1.2 m band on one
 * of those is a stripe, so that hall alone went to 2.3. Every room in this walk is seen through a
 * doorway into the next, though, and a dado that steps from 2.3 to 1.2 across an opening does not
 * read as two rooms with their own proportions. It reads as a wall that changed its mind, and it
 * took three rounds of Jordan pointing at the same seam before that landed.
 *
 * Any scheme that scales the height with the room breaks at every junction in the building, so the
 * rule is simply that there is no scheme: one number, and no caller overrides it.
 */
describe('the dado', () => {
  const walk = 'src/scenes/walk';

  const sources = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : path.endsWith('.ts') ? [path] : [];
  });

  it('is the same height in every room, because every room is seen through the next one', () => {
    const offenders: string[] = [];
    for (const path of sources(walk)) {
      if (path.endsWith('labs/materials.ts')) continue;
      for (const line of readFileSync(path, 'utf8').split('\n')) {
        // A call that reaches a fifth argument is passing a height of its own.
        const call = /dadoBands\(([^)]*)\)/.exec(line);
        if (call && call[1]!.split(',').length > 4) offenders.push(`${path}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('stands the cap on top of the band rather than through it', () => {
    const { band, line } = dadoBands(4, 0, 0, 0);
    band.computeBoundingBox(); line.computeBoundingBox();
    expect(band.boundingBox!.max.y).toBeCloseTo(DADO_H, 5);
    // The cap sits just above the band's top with no gap a wall could show through.
    expect(line.boundingBox!.min.y).toBeGreaterThanOrEqual(DADO_H - 0.001);
    expect(line.boundingBox!.min.y).toBeLessThan(DADO_H + 0.03);
    // And it stands proud of the band, or it is not a cap.
    expect(line.boundingBox!.max.z).toBeGreaterThan(band.boundingBox!.max.z);
  });

  // Chest high, not a skirt and not half a wall. The number itself is the decision.
  it('paints to a height a building would actually paint to', () => {
    expect(DADO_H).toBeGreaterThan(1.4);
    expect(DADO_H).toBeLessThan(1.9);
  });
});
