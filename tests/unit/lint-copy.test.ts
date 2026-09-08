import { describe, it, expect } from 'vitest';
import { findViolations } from '../../scripts/lint-copy.mjs';

describe('copy lint', () => {
  it('flags em dashes, en dashes and semicolons in prose', () => {
    const v = findViolations('a.md', 'Fine line.\nBad — dash.\nAlso – this.\nAnd this; too.');
    expect(v.map((x) => x.line)).toEqual([2, 3, 4]);
  });
  it('ignores code fences and frontmatter arrays', () => {
    const v = findViolations('a.md', '---\nstack: [A, B]\n---\n```\nlet x = 1;\n```\nClean.');
    expect(v).toEqual([]);
  });
  it('checks only text nodes in astro files', () => {
    const v = findViolations('a.astro', '<p class="x">Hello; world</p>\n<script>const a = 1;</script>\n<style>a { color: red; }</style>');
    expect(v.length).toBe(1);
    expect(v[0].line).toBe(1);
  });
});
