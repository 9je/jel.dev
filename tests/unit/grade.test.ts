import { describe, expect, it } from 'vitest';
import { GRADES, GradeState } from '../../src/scenes/walk/grade';
import { STOPS } from '../../src/scenes/walk/path';

describe('room grades', () => {
  it('grades every stop', () => { for (const s of STOPS) expect(GRADES[s.id], s.id).toBeDefined(); });
  it('keeps the fill low enough that a room is lit by its own lights', () => {
    for (const s of STOPS) expect(GRADES[s.id].fill, s.id).toBeLessThanOrEqual(0.8);
    // The clean lab is the one bright room.
    const brightest = STOPS.reduce((a, s) => (GRADES[s.id].fill > GRADES[a.id].fill ? s : a));
    expect(brightest.id).toBe('credentials');
  });
  it('eases toward the next room rather than jumping', () => {
    const g = new GradeState(GRADES.booth);
    g.toward(GRADES.credentials, 1 / 60);
    expect(g.fill).toBeGreaterThan(GRADES.booth.fill);
    expect(g.fill).toBeLessThan(GRADES.credentials.fill);
    for (let i = 0; i < 600; i++) g.toward(GRADES.credentials, 1 / 60);
    expect(g.fill).toBeCloseTo(GRADES.credentials.fill, 3);
  });
});
