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
  it('gives an entry with none of the panel fields empty media and facts', () => {
    const p = projectSchema.parse(valid);
    expect(p.media).toEqual([]);
    expect(p.facts).toEqual([]);
    expect(p.role).toBeUndefined();
  });
  it('accepts an image and a video with a poster under /projects/', () => {
    const p = projectSchema.parse({ ...valid, media: [
      { kind: 'image', src: '/projects/x/01.webp', alt: 'A screen', width: 960, height: 960 },
      { kind: 'video', src: '/projects/x/loop.mp4', poster: '/projects/x/loop-poster.webp', alt: 'A loop', width: 960, height: 540 },
    ] });
    expect(p.media).toHaveLength(2);
  });
  it('rejects a video with no poster', () => {
    expect(() => projectSchema.parse({ ...valid, media: [{ kind: 'video', src: '/projects/x/loop.mp4', alt: 'A loop', width: 960, height: 540 }] })).toThrow();
  });
  it('rejects media kept outside /projects/', () => {
    expect(() => projectSchema.parse({ ...valid, media: [{ kind: 'image', src: '/assets/01.webp', alt: 'A screen', width: 960, height: 960 }] })).toThrow();
    expect(() => projectSchema.parse({ ...valid, media: [{ kind: 'video', src: '/projects/x/loop.mp4', poster: 'https://example.com/p.webp', alt: 'A loop', width: 960, height: 540 }] })).toThrow();
  });
  it('rejects a fifth fact', () => {
    const facts = [1, 2, 3, 4, 5].map((n) => ({ label: `L${n}`, value: `${n}` }));
    expect(() => projectSchema.parse({ ...valid, facts })).toThrow();
    expect(projectSchema.parse({ ...valid, facts: facts.slice(0, 4) }).facts).toHaveLength(4);
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
