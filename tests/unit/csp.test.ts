import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The live preloader once stuck at 57% because the Content-Security-Policy blocked the very things
 * the walk needs to load a Draco-compressed GLTF: blob: URLs for the decoded textures, a blob:
 * worker for the Draco decoder, and WebAssembly compilation. These assertions pin that fix.
 */
const conf = readFileSync('nginx-headers.conf', 'utf8');

function policy(): Map<string, string[]> {
  const line = /add_header\s+Content-Security-Policy\s+"([^"]+)"/.exec(conf);
  expect(line, 'nginx-headers.conf must set a Content-Security-Policy header').not.toBeNull();
  const map = new Map<string, string[]>();
  for (const part of line![1].split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length) map.set(tokens[0], tokens.slice(1));
  }
  return map;
}

describe('content security policy', () => {
  const csp = policy();

  it('lets GLTF decode its textures through blob URLs', () => {
    expect(csp.get('connect-src')).toContain('blob:');
    expect(csp.get('img-src')).toContain('blob:');
    expect(csp.get('img-src')).toContain('data:');
  });

  it('lets the Draco decoder start its blob worker', () => {
    expect(csp.get('worker-src')).toContain('blob:');
  });

  it('allows WebAssembly compilation without opening up eval', () => {
    const script = csp.get('script-src') ?? [];
    expect(script).toContain("'wasm-unsafe-eval'");
    expect(script).not.toContain("'unsafe-eval'");
  });

  it('refuses to be framed', () => {
    expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
  });
});
