// Converts Michroma (OFL) to the three.js typeface JSON format, keeping only the glyphs the sign uses.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import opentype from 'opentype.js';

const TTF = 'scripts/Michroma.ttf';
const OUT = 'public/fonts/michroma.typeface.json';
const TEXT = 'JEL LABS';

if (!existsSync(TTF)) {
  const css = execSync('curl -sA "curl" "https://fonts.googleapis.com/css2?family=Michroma"').toString();
  const url = css.match(/url\((https:[^)]+\.ttf)\)/)?.[1];
  if (!url) throw new Error('Could not find a Michroma TTF url in the Google Fonts CSS');
  execSync(`curl -sL -o ${TTF} "${url}"`);
}

const buf = readFileSync(TTF);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const r = (v) => Math.round(v);

const glyphs = {};
for (const ch of new Set(TEXT)) {
  const g = font.charToGlyph(ch);
  const m = g.getMetrics();
  const parts = [];
  for (const c of g.path.commands) {
    if (c.type === 'M') parts.push('m', r(c.x), r(c.y));
    else if (c.type === 'L') parts.push('l', r(c.x), r(c.y));
    else if (c.type === 'Q') parts.push('q', r(c.x), r(c.y), r(c.x1), r(c.y1));
    else if (c.type === 'C') parts.push('b', r(c.x), r(c.y), r(c.x1), r(c.y1), r(c.x2), r(c.y2));
    else if (c.type === 'Z') parts.push('z');
  }
  glyphs[ch] = { ha: r(g.advanceWidth), x_min: r(m.xMin), x_max: r(m.xMax), o: parts.join(' ') };
}

const out = {
  glyphs,
  familyName: 'Michroma',
  ascender: font.ascender,
  descender: font.descender,
  underlinePosition: font.tables.post.underlinePosition,
  underlineThickness: font.tables.post.underlineThickness,
  boundingBox: { xMin: font.tables.head.xMin, yMin: font.tables.head.yMin, xMax: font.tables.head.xMax, yMax: font.tables.head.yMax },
  resolution: font.unitsPerEm,
  original_font_information: { full_font_name: 'Michroma', license: 'SIL Open Font License 1.1' },
};
mkdirSync('public/fonts', { recursive: true });
writeFileSync(OUT, JSON.stringify(out));
console.log(`wrote ${OUT} with ${Object.keys(glyphs).length} glyphs`);
