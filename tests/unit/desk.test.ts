import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DESK } from '../../src/content/desk';

describe('the trading desk on the break room television', () => {
  const entry = readFileSync('src/content/projects/trading-desk.md', 'utf8');
  it('quotes the return the project panel quotes', () => {
    expect(entry).toContain(`value: ${DESK.ret}`);
    expect(entry).toContain(`value: ${DESK.since}`);
  });
  it('never shows a dollar amount', () => {
    expect(DESK.ret).not.toContain('$');
    expect(entry).not.toMatch(/\$\s?\d/);
  });
});
