import { describe, it, expect } from 'vitest';
import { projectSchema, certSchema, WINGS, STATUSES, STATUS_LABEL } from '../../src/content/schema';

const valid = {
  title: 'torn.bet',
  wing: 'recreation',
  status: 'operational',
  summary: 'Gambling platform for Torn City players.',
  links: [{ label: 'Visit', href: 'https://torn.bet' }],
};

describe('projectSchema', () => {
  it('accepts a valid project and applies defaults', () => {
    const p = projectSchema.parse(valid);
    expect(p.flagship).toBe(false);
    expect(p.order).toBe(100);
    expect(p.stack).toEqual([]);
  });
  it('rejects an unknown wing', () => {
    expect(() => projectSchema.parse({ ...valid, wing: 'garage' })).toThrow();
  });
  it('rejects an unknown status', () => {
    expect(() => projectSchema.parse({ ...valid, status: 'done' })).toThrow();
  });
  it('rejects a missing wing', () => {
    const { wing, ...rest } = valid;
    expect(() => projectSchema.parse(rest)).toThrow();
  });
  it('rejects a non-URL link', () => {
    expect(() => projectSchema.parse({ ...valid, links: [{ label: 'x', href: 'torn.bet' }] })).toThrow();
  });
  it('has a label for every status', () => {
    for (const s of STATUSES) expect(STATUS_LABEL[s]).toBeTruthy();
  });
  it('lists exactly four wings', () => {
    expect(WINGS).toEqual(['operations', 'fabrication', 'recreation', 'containment']);
  });
});

describe('certSchema', () => {
  it('accepts a cert without a verify url', () => {
    expect(certSchema.parse({ id: 'ccna', name: 'CCNA', issuer: 'Cisco', badgeImage: '/certs/ccna.png' }).verifyUrl).toBeUndefined();
  });
});
