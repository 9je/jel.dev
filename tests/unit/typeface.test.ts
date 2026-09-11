import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Every glyph the signage kit can be asked for, so a sign's copy can change without regenerating
// the font: see scripts/make-typeface.mjs.
const SET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .-';

describe('michroma typeface json', () => {
  const data = JSON.parse(readFileSync('public/fonts/michroma.typeface.json', 'utf8'));
  it('has every capital, digit, space, full stop and hyphen', () => {
    for (const ch of SET) expect(data.glyphs[ch], `glyph ${JSON.stringify(ch)}`).toBeDefined();
    expect(Object.keys(data.glyphs)).toHaveLength(SET.length);
  });
  it('still has every glyph in JEL LABS', () => {
    for (const ch of 'JEL LABS') expect(data.glyphs[ch], `glyph ${JSON.stringify(ch)}`).toBeDefined();
  });
  it('glyph outlines use three.js commands only', () => {
    for (const ch of SET.replace(' ', '')) {
      const tokens = data.glyphs[ch].o.split(' ');
      const cmds = tokens.filter((t: string) => /^[a-z]$/.test(t));
      expect(cmds.length, `glyph ${ch}`).toBeGreaterThan(0);
      for (const c of cmds) expect(['m', 'l', 'q', 'b', 'z']).toContain(c);
    }
  });
  it('carries an advance for every glyph', () => {
    for (const ch of SET) expect(data.glyphs[ch].ha, `glyph ${JSON.stringify(ch)}`).toBeGreaterThan(0);
  });
  it('carries resolution and bounding box', () => {
    expect(data.resolution).toBeGreaterThan(0);
    expect(data.boundingBox.yMax).toBeGreaterThan(data.boundingBox.yMin);
  });
});
