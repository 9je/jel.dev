import { describe, it, expect, beforeAll } from 'vitest';

// The soft disc is drawn to a canvas, and vitest runs in node with no DOM. A stub is enough.
beforeAll(() => {
  const context = () => new Proxy({} as Record<string | symbol, unknown>, {
    get: (t, k) => (k in t ? t[k] : () => ({ width: 100, addColorStop() {} })),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  (globalThis as unknown as { document: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => context() }) };
});

describe('particles', () => {
  it('fills a dust volume with the count asked for, inside its box, and moves on the clock', async () => {
    const THREE = await import('three');
    const { dust } = await import('../../src/scenes/walk/labs/particles');
    const d = dust([0, 1, 2], [3, 4, 5], 50);
    const pos = d.points.geometry.getAttribute('position');
    expect(pos.count).toBe(50);
    for (let i = 0; i < pos.count; i++) { expect(pos.getX(i)).toBeGreaterThanOrEqual(0); expect(pos.getX(i)).toBeLessThanOrEqual(3); expect(pos.getY(i)).toBeGreaterThanOrEqual(1); expect(pos.getZ(i)).toBeLessThanOrEqual(5); }
    const m = d.points.material as InstanceType<typeof THREE.ShaderMaterial>;
    expect(m.blending).toBe(THREE.AdditiveBlending); expect(m.depthWrite).toBe(false);
    d.update(0.5); d.update(0.25);
    expect(m.uniforms.uTime.value).toBeCloseTo(0.75, 6);
    d.dispose();
  });
  it('births a plume along a line through its origin', async () => {
    const { plume } = await import('../../src/scenes/walk/labs/particles');
    const p = plume([10, 0, 5], { count: 80, along: [2, 0, 0] });
    const pos = p.points.geometry.getAttribute('position');
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < pos.count; i++) { lo = Math.min(lo, pos.getX(i)); hi = Math.max(hi, pos.getX(i)); expect(pos.getZ(i)).toBe(5); }
    expect(lo).toBeGreaterThanOrEqual(9); expect(hi).toBeLessThanOrEqual(11); expect(hi - lo).toBeGreaterThan(1.2);
    expect(p.points.frustumCulled).toBe(false);
    p.dispose();
  });
});
