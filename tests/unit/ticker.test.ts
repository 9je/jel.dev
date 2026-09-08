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
});
