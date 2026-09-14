import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { readStreak } from '../../src/content/streak';
import baked from '../../src/content/streak.json';

/**
 * The board in the bay draws whatever comes back from /live/streak.json, so the reader in front of
 * it is the only thing standing between a proxy error page and a wall in the scene.
 */
describe('readStreak', () => {
  it('accepts the payload the build bakes in', () => {
    expect(readStreak(baked)).toEqual(baked);
  });

  it('refuses anything that is not a payload', () => {
    for (const bad of [null, undefined, 42, 'forty', [], {}, '<html>502</html>']) expect(readStreak(bad)).toBeNull();
  });

  it('refuses counts that are not whole, positive and plausible', () => {
    const ok = { ...baked };
    for (const current of [-1, 1.5, 1e6, '40', NaN]) expect(readStreak({ ...ok, current })).toBeNull();
  });

  it('refuses a grid of anything but day levels', () => {
    for (const recent of ['0129', 'abc', '0'.repeat(85), 5]) expect(readStreak({ ...baked, recent })).toBeNull();
    expect(readStreak({ ...baked, recent: '' })).not.toBeNull();
  });
});

describe('the live file', () => {
  const conf = readFileSync('nginx.conf', 'utf8');

  it('is served from an exact location so the long json cache cannot swallow it', () => {
    const block = /location = \/live\/streak\.json \{([^}]+)\}/.exec(conf);
    expect(block, 'nginx.conf must serve /live/streak.json').not.toBeNull();
    expect(block![1]).toMatch(/no-store/);
  });

  it('is mounted into the container from outside the image', () => {
    expect(readFileSync('compose.yml', 'utf8')).toMatch(/\.\/live:\/usr\/share\/nginx\/html\/live:ro/);
  });
});
