import { describe, it, expect } from 'vitest';
import { chooseTier, FrameGovernor, pixelRatioCap } from '../../src/scenes/walk/quality';

const base = { webgl: true, renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0)', threads: 8, coarse: false, reducedMotion: false, saveData: false, pref: null as null };

describe('chooseTier', () => {
  it('picks high for a discrete card with the threads and memory to feed it', () => expect(chooseTier(base)).toBe('high'));
  it('picks medium for a discrete card on a small machine', () => {
    expect(chooseTier({ ...base, threads: 4 })).toBe('medium');
    expect(chooseTier({ ...base, memoryGB: 4 })).toBe('medium');
  });
  it('picks low for integrated graphics no matter how many threads the CPU has', () => {
    expect(chooseTier({ ...base, renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x0000A7A1) Direct3D11 vs_5_0 ps_5_0, D3D11-32.0.101.7077)', threads: 12, memoryGB: 8 })).toBe('low');
    expect(chooseTier({ ...base, renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0)', threads: 8 })).toBe('low');
    expect(chooseTier({ ...base, renderer: 'ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0)', threads: 16 })).toBe('low');
  });
  it('treats Intel Arc as discrete', () => expect(chooseTier({ ...base, renderer: 'ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics Direct3D11 vs_5_0 ps_5_0)' })).toBe('high'));
  it('picks medium for Apple silicon and for a masked renderer', () => {
    expect(chooseTier({ ...base, renderer: 'Apple M2' })).toBe('medium');
    expect(chooseTier({ ...base, renderer: '' })).toBe('medium');
  });
  it('picks lite without webgl', () => expect(chooseTier({ ...base, webgl: false })).toBe('lite'));
  it('picks lite for software renderers and for a performance caveat', () => {
    expect(chooseTier({ ...base, renderer: 'Google SwiftShader' })).toBe('lite');
    expect(chooseTier({ ...base, renderer: 'llvmpipe (LLVM 15)' })).toBe('lite');
    expect(chooseTier({ ...base, caveat: true })).toBe('lite');
  });
  it('picks lite for reduced motion and save-data', () => {
    expect(chooseTier({ ...base, reducedMotion: true })).toBe('lite');
    expect(chooseTier({ ...base, saveData: true })).toBe('lite');
  });
  it('respects the user toggle both ways', () => {
    expect(chooseTier({ ...base, pref: 'off' })).toBe('lite');
    expect(chooseTier({ ...base, renderer: 'Google SwiftShader', pref: 'on' })).toBe('low');
    expect(chooseTier({ ...base, caveat: true, pref: 'on' })).toBe('low');
  });
  it('picks low on phones and lite on weak phones', () => {
    expect(chooseTier({ ...base, coarse: true, threads: 8 })).toBe('low');
    expect(chooseTier({ ...base, coarse: true, threads: 2 })).toBe('lite');
  });
});

describe('pixelRatioCap', () => {
  it('lets phones render sharp and keeps integrated desktop GPUs at one', () => {
    expect(pixelRatioCap('low', true)).toBe(1.5);
    expect(pixelRatioCap('low', false)).toBe(1);
    expect(pixelRatioCap('high', false)).toBe(1.5);
    expect(pixelRatioCap('lite', true)).toBe(1);
  });
});

const run = (g: FrameGovernor, seconds: number, fps: number) => {
  const dt = 1 / fps; let last: ReturnType<FrameGovernor['push']> = 'keep';
  for (let t = 0; t < seconds; t += dt) { const v = g.push(dt); if (v !== 'keep') last = v; }
  return last;
};

describe('FrameGovernor', () => {
  it('keeps a scene that holds the trim floor', () => expect(run(new FrameGovernor(), 6, 40)).toBe('keep'));
  it('ignores the warmup second', () => {
    const g = new FrameGovernor();
    for (let i = 0; i < 5; i++) expect(g.push(0.2)).toBe('keep');
    expect(run(g, 2.5, 60)).toBe('keep');
  });
  it('trims within about three seconds of a slow start', () => {
    const g = new FrameGovernor(); const dt = 1 / 8; let at = -1;
    for (let t = 0; t < 10; t += dt) { if (g.push(dt) === 'trim') { at = t; break; } }
    expect(at).toBeGreaterThan(2.5); expect(at).toBeLessThan(3.5);
  });
  it('bails when the trimmed scene is still slow, and only once', () => {
    const g = new FrameGovernor();
    expect(run(g, 3.5, 8)).toBe('trim');
    expect(run(g, 4.5, 8)).toBe('bail');
    expect(run(g, 10, 8)).toBe('keep');
  });
  it('starts over on reset, warmup and window both fresh', () => {
    // The scene resets the governor when the background build finishes. A trim decided on build
    // frames must not leave it in stage 1, and the new window must fill from empty.
    const g = new FrameGovernor();
    expect(run(g, 3.5, 8)).toBe('trim');
    g.reset();
    for (let i = 0; i < 8; i++) expect(g.push(1 / 8)).toBe('keep');
    expect(run(g, 1.5, 8)).toBe('keep');
    expect(run(g, 2.5, 8)).toBe('trim');
  });
  it('per room resets keep a background build from adding up to a verdict', () => {
    // What scene.ts does around the background build loop: each later room's loadGroup decode and
    // its compileAsync stall frames the pacer never saw, so they reach the governor undiscounted.
    // Six rooms of that, each stall on its own too short to decide anything, used to add up to a
    // trim and then to a bail, which hands the page to the lite path for the session.
    const stall = (g: FrameGovernor) => { let seen = 'keep'; for (let t = 0; t < 1.5; t += 1 / 8) { const v = g.push(1 / 8); if (v !== 'keep') seen = v; } return seen; };

    const without = new FrameGovernor();
    let verdict = 'keep';
    for (let room = 0; room < 6; room++) { const v = stall(without); if (v !== 'keep') verdict = v; }
    expect(verdict).not.toBe('keep');

    const withReset = new FrameGovernor();
    for (let room = 0; room < 6; room++) { expect(stall(withReset)).toBe('keep'); withReset.reset(); }
    // The finished scene is still judged normally.
    expect(run(withReset, 3.5, 8)).toBe('trim');
  });
  it('settles after a trim that worked', () => {
    const g = new FrameGovernor();
    expect(run(g, 3.5, 8)).toBe('trim');
    expect(run(g, 4.5, 30)).toBe('keep');
    expect(run(g, 10, 5)).toBe('keep');
  });
});
