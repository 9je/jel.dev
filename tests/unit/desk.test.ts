import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DESK } from '../../src/content/desk';

describe('the trading desk on the break room television', () => {
  const entry = readFileSync('src/content/projects/trading-desk.md', 'utf8');
  it('quotes the peak the project panel quotes', () => {
    expect(entry).toContain(`value: ${DESK.peak}`);
    expect(entry).toContain(`value: ${DESK.on}`);
  });
  it('shows the peak and never a current figure', () => {
    expect(entry).toMatch(/label: Peak return/);
    expect(entry).not.toMatch(/label: Return\n/);
    expect(entry).not.toMatch(/it (is|was) up/i);
  });
  it('never shows a dollar amount', () => {
    expect(DESK.peak).not.toContain('$');
    expect(entry).not.toMatch(/\$\s?\d/);
  });
});
