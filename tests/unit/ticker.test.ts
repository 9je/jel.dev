import { describe, it, expect } from 'vitest';
import { buildTickerLines } from '../../src/content/ticker';

describe('buildTickerLines', () => {
  it('turns projects into lower-case status lines', () => {
    expect(buildTickerLines([
      { title: 'torn.bet', status: 'operational' },
      { title: 'ezkey.io', status: 'in-flight' },
      { title: 'First disclosure', status: 'pending-release' },
    ])).toEqual(['torn.bet operational', 'ezkey.io in flight', 'first disclosure pending release']);
  });
  it('skips restricted work and never emits banned characters', () => {
    const lines = buildTickerLines([{ title: 'Platform development', status: 'restricted' }, { title: 'Kayou bot', status: 'closed-source' }]);
    expect(lines).toEqual(['kayou bot closed source']);
    for (const l of lines) expect(l).not.toMatch(/[—–;]/);
  });

  it('runs the commit streak at the head of the list when there is one', () => {
    const lines = buildTickerLines([{ title: 'torn.bet', status: 'operational' }], 40);
    expect(lines[0]).toBe('40 days without a missed commit');
    expect(lines).toHaveLength(2);
  });

  it('says nothing about a streak of one day or none', () => {
    expect(buildTickerLines([{ title: 'torn.bet', status: 'operational' }], 1)).toHaveLength(1);
    expect(buildTickerLines([{ title: 'torn.bet', status: 'operational' }])).toHaveLength(1);
  });
});
