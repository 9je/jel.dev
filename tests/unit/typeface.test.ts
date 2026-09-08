import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('michroma typeface json', () => {
  const data = JSON.parse(readFileSync('public/fonts/michroma.typeface.json', 'utf8'));
  it('has every glyph in JEL LABS', () => {
    for (const ch of 'JEL LABS') expect(data.glyphs[ch], `glyph ${JSON.stringify(ch)}`).toBeDefined();
  });
  it('glyph outlines use three.js commands only', () => {
    for (const ch of 'JELABS') {
      const tokens = data.glyphs[ch].o.split(' ');
      const cmds = tokens.filter((t: string) => /^[a-z]$/.test(t));
      expect(cmds.length).toBeGreaterThan(0);
      for (const c of cmds) expect(['m', 'l', 'q', 'b', 'z']).toContain(c);
    }
  });
  it('carries resolution and bounding box', () => {
    expect(data.resolution).toBeGreaterThan(0);
    expect(data.boundingBox.yMax).toBeGreaterThan(data.boundingBox.yMin);
  });
});
