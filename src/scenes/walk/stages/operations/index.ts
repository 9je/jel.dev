import * as THREE from 'three';
import type { Stage, StageContext, StageDef } from '../types';
import { disposeObject } from '../../materials';
import { buildShell } from './shell';
import { buildDressing } from './dressing';
import { lights } from './lighting';
import { dust, plume, type ParticleSystem } from '../../labs/particles';
import { X0, X1, Z0, Z1 } from './layout';

/** The camera's sweep: a 1.2 rad arc at about 0.25 rad/s, easing to a stop at each end. */
const SWEEP_ARC = 1.2, SWEEP_PERIOD = (2 * SWEEP_ARC) / 0.25;
const ease = (v: number) => v * v * (3 - 2 * v);

const RED = new THREE.Color(0xff3a1a), AMBER = new THREE.Color(0xffa62b);

async function build(ctx: StageContext): Promise<Stage> {
  const { scene, tier } = ctx;
  const root = new THREE.Group(); root.name = 'operations'; scene.add(root);
  const shell = buildShell(ctx, root); await ctx.pace();
  const { hotspots, blink, fire, camera } = await buildDressing(ctx, root);
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o instanceof THREE.Points) return;
    const translucent = (Array.isArray(o.material) ? o.material : [o.material]).some((m) => m.transparent);
    o.castShadow = tier === 'high' && !shell.planes.has(o) && !translucent && !(o.geometry instanceof THREE.PlaneGeometry);
    o.receiveShadow = !translucent;
  });
  // Dust in the aisle, in the cold light off the racks: fewer motes than before and each larger and
  // softer, so they read as dust turning in a shaft rather than as speckle. And two plumes off the
  // burning rack.
  //
  // The smoke was the whole of it for a long time and it could not be seen, because grey smoke on
  // an unlit black ceiling is grey on black. Smoke is the consequence and the flame is the thing,
  // so the flame is drawn. Additive means it makes its own brightness rather than waiting on a
  // light this room has no budget left to give it, and it clears the bloom threshold, so the rack
  // top carries a halo the way the neon over the shutter does.
  //
  // The first cut of the flame was a third the size of the smoke above it and half as opaque, which
  // is how a burning rack ended up reading as a smoking one: "more smoke than fire". Three things
  // fix that and all three are proportion. The flame is as big as the smoke and brighter. There are
  // two of it, a wide orange body with a small near white core inside it, because what makes fire
  // read as fire rather than as an orange cloud is that it is hotter in the middle. And the smoke
  // is thinner and is born half a metre up, so the bottom of the column is flame and the grey
  // starts where a real plume goes cool.
  const fx: ParticleSystem[] = [
    dust([X0 + 2, 0.3, Z0 + 2.4], [X1 - 1, 4.0, Z1 - 2.4], tier === 'high' ? 160 : 60, { size: 0.07, opacity: 0.18, color: 0xd8e8f0 }),
    plume([fire.top[0], fire.top[1] + 0.55, fire.top[2]], {
      count: tier === 'high' ? 34 : 15, life: 4.2, rise: 1.8, spread: 0.36, size: 0.36, grow: 2.6,
      color: 0x8b9298, opacity: 0.34, drift: [0.02, 0, -0.12], texture: 'smoke', seed: 5,
    }),
    plume(fire.top, {
      count: tier === 'high' ? 30 : 14, life: 1.5, rise: 1.05, spread: 0.15, size: 0.34, grow: 1.7,
      color: 0xff6a12, opacity: 0.8, drift: [0.01, 0, -0.04], additive: true, texture: 'smoke', seed: 11,
    }),
    plume(fire.top, {
      count: tier === 'high' ? 16 : 8, life: 0.8, rise: 0.5, spread: 0.07, size: 0.19, grow: 1.4,
      color: 0xffcf7a, opacity: 0.95, drift: [0, 0, -0.02], additive: true, texture: 'soft', seed: 19,
    }),
  ];
  for (const p of fx) root.add(p.points);
  // The rows breathe. Every rack's units are one batch over one material, so a whole rack pulses on
  // a single write and the room costs fifteen of them a frame rather than one per unit. The period
  // comes off the rack's own seed, so no two racks are ever in step and the rows read as a lot of
  // machines each doing its own work instead of one animation playing sixteen times.
  let clock = 0;
  const glowColor = new THREE.Color();
  return {
    id: 'operations', root, lights: lights(), hotspots,
    update(_t, dt) {
      clock += dt;
      for (const p of fx) p.update(dt);
      for (const { material, seed } of blink) material.emissiveIntensity = 1.1 + 0.15 * Math.sin(clock * (3 + (seed % 5)) + seed);

      // The camera pans the aisle: a triangle wave over the period, eased at both turns.
      const phase = (clock % SWEEP_PERIOD) / SWEEP_PERIOD;
      camera.head.rotation.y = camera.bearing + SWEEP_ARC * (ease(1 - Math.abs(2 * phase - 1)) - 0.5);

      // The burning rack. Its units flash between amber and red on a beat that never quite repeats,
      // three sines that share no period, and the glow on its top flickers on its own two.
      const beat = Math.sin(clock * 7.3) * Math.sin(clock * 3.1 + 1) + 0.35 * Math.sin(clock * 11.7);
      const hot = beat > 0.3 ? 1 : 0;
      fire.units.emissive.copy(glowColor.lerpColors(RED, AMBER, hot));
      fire.units.emissiveIntensity = hot ? 2.2 : 0.55;
      fire.glow.opacity = 0.62 + 0.18 * Math.sin(clock * 13.1) + 0.1 * Math.sin(clock * 29.7);
      // The alarm strobe: two flashes a little over a second apart, the way a real one fires.
      const s = clock % 1.15;
      fire.strobe.emissiveIntensity = s < 0.06 || (s > 0.14 && s < 0.2) ? 6 : 0.2;
    },
    dispose() { for (const p of fx) p.dispose(); root.traverse((o) => { if (o instanceof THREE.InstancedMesh) o.dispose(); }); disposeObject(root); scene.remove(root); },
  };
}

export const OPERATIONS_DEF: StageDef = { id: 'operations', stop: 'operations', groups: ['labs', 'operations'], near: ['recreation', 'operations', 'credentials'], replaces: 'lab', build };
