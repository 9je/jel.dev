import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';

// The door draws its hazard rail to a canvas and vitest has no DOM: a stub that accepts the 2d calls.
beforeAll(() => {
  const context = () => new Proxy({} as Record<string | symbol, unknown>, {
    get: (t, k) => (k in t ? t[k] : () => ({ width: 100, addColorStop() {} })),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  (globalThis as unknown as { document: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => context() }) };
});

describe('booth lighting', () => {
  it('never cuts the ceiling wash, so the shutter is never dropped to black', async () => {
    const THREE = await import('three');
    const { FontLoader } = await import('three/addons/loaders/FontLoader.js');
    const { BOOTH_DEF } = await import('../../src/scenes/walk/stages/booth');
    const typeface = new FontLoader().parse(JSON.parse(readFileSync('public/fonts/michroma.typeface.json', 'utf8')));
    const store = {
      texture: () => ({ map: new THREE.Texture(), normalMap: new THREE.Texture(), arm: new THREE.Texture(), repeat: [1, 1] }),
      model: () => new THREE.Group(),
    } as unknown as import('../../src/scenes/walk/assets').AssetStore;
    const stage = await BOOTH_DEF.build({ scene: new THREE.Scene(), store, anchors: new Map(), tier: 'high', typeface } as never);
    const wash = stage.lights![0]!; const full = wash.intensity;
    // Two minutes at 60 fps covers several of the old stutters, which came every 10 to 17 seconds.
    for (let i = 0; i < 7200; i++) { stage.update(0, 1 / 60); expect(wash.intensity).toBe(full); }
    stage.dispose();
  });
});

describe('booth props', () => {
  it('clamps the desk lamp to the desk\'s edge, its clamp top on the desktop', async () => {
    const { LAMP_CLAMP, DESK } = await import('../../src/scenes/walk/stages/booth');
    // The lamp is a clamp lamp with no base. Stood in the middle of the desk its clamp sank into the
    // top and the arm read as growing out of the wood.
    expect(LAMP_CLAMP.position[1]).toBeCloseTo(DESK.top, 3);
    expect(LAMP_CLAMP.position[0]).toBeCloseTo(DESK.backX, 3);
    // The jaw opens along the model's -z, the side its shade reaches toward. Turned, that has to point
    // in over the desk (world -x from its back edge), or the clamp grips air.
    const jawX = -Math.sin(LAMP_CLAMP.rotationY); expect(jawX).toBeLessThan(-0.8);
  });
});
