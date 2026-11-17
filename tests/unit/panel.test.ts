import { describe, expect, it } from 'vitest';
import { parseHash } from '../../src/scenes/walk/panel';

const stops = ['booth', 'fabrication', 'recreation'];
const projects = new Set(['phob-screen', 'ezkey']);

describe('what a hash on the walk names', () => {
  it('a stop', () => { expect(parseHash('#fabrication', stops, projects)).toEqual({ stop: 'fabrication' }); });
  it('a project', () => { expect(parseHash('#phob-screen', stops, projects)).toEqual({ project: 'phob-screen' }); });
  it('nothing, for a name it does not know', () => { expect(parseHash('#nope', stops, projects)).toEqual({}); });
  it('nothing, for no hash at all', () => {
    expect(parseHash('', stops, projects)).toEqual({});
    expect(parseHash('#', stops, projects)).toEqual({});
  });
  it('nothing, for a hash that is not a slug', () => {
    expect(parseHash('#ezkey"]', stops, projects)).toEqual({});
    expect(parseHash('#%E0%A4%A', stops, projects)).toEqual({});
  });
  it('a stop before a project of the same name', () => {
    expect(parseHash('#booth', stops, new Set(['booth']))).toEqual({ stop: 'booth' });
  });
});
