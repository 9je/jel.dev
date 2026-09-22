import { describe, it, expect } from 'vitest';
import { buildTickerLines, retickStreak } from '../../src/content/ticker';

describe('buildTickerLines', () => {
  it('runs the commit streak and nothing else', () => {
    expect(buildTickerLines(40)).toEqual(['40 days without a missed commit']);
  });

  it('says the idle line rather than a streak of one day or none', () => {
    expect(buildTickerLines(1)).toEqual(['jel labs']);
    expect(buildTickerLines()).toEqual(['jel labs']);
  });

  it('never emits banned characters', () => {
    for (const l of buildTickerLines(40)) expect(l).not.toMatch(/[—–;]/);
  });
});

describe('retickStreak', () => {
  it('replaces the streak line the build wrote with the live one', () => {
    expect(retickStreak('40 days without a missed commit', 41)).toBe('41 days without a missed commit');
  });

  it('replaces the idle line when a run arrives', () => {
    expect(retickStreak('jel labs', 7)).toBe('7 days without a missed commit');
  });

  it('falls back to the idle line the day the run ends', () => {
    expect(retickStreak('40 days without a missed commit', 0)).toBe('jel labs');
  });

  it('never says it twice', () => {
    expect(retickStreak(retickStreak('40 days without a missed commit', 41), 42).match(/without a missed commit/g)).toHaveLength(1);
  });
});
