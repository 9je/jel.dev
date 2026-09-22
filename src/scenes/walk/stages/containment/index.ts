import * as THREE from 'three';
import type { Stage, StageContext, StageDef } from '../types';
import { disposeObject } from '../../materials';
import { buildShell } from './shell';
import { buildDressing } from './dressing';
import { lights } from './lighting';
import { dust, haze, type ParticleSystem } from '../../labs/particles';
import { SEALED, TABLE } from './layout';

async function build(ctx: StageContext): Promise<Stage> {
  const { scene, tier } = ctx;
  const root = new THREE.Group(); root.name = 'containment'; scene.add(root);
  const shell = buildShell(ctx, root); await ctx.pace();
  const { hotspots, pulse, crt } = await buildDressing(ctx, root);
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o instanceof THREE.Points) return;
    const translucent = (o.material as THREE.Material).transparent;
    o.castShadow = tier === 'high' && !shell.planes.has(o) && !translucent && !(o.geometry instanceof THREE.PlaneGeometry);
    o.receiveShadow = !translucent;
  });
  // What is behind the sealed door leaks under it: not a column of puffs rising off the threshold,
  // which is what Jordan read as cheap smoke standing in the wrong place, but a bank of fog lying on
  // the floor. Big slow sprites born along the full width of the door, barely rising, spreading wide
  // and creeping into the room, so a dozen faint overlaps read as one low bank rather than as
  // individual blobs. The red seam above it does the colouring. A second, fainter bank sits in the
  // far corner by the office door so the floor is not fogged in exactly one place.
  const fx: ParticleSystem[] = [
    haze([SEALED.x, 0.06, SEALED.z - 0.55], {
      count: tier === 'high' ? 34 : 16, along: [SEALED.w + 0.6, 0, 0], drift: [0, 0, -0.05],
      life: 12, rise: 0.28, spread: 2.6, size: 1.9, color: 0x9aa7b0, opacity: 0.07, seed: 5,
    }),
    haze([-75.4, 0.06, 23.4], {
      count: tier === 'high' ? 18 : 8, along: [2.4, 0, 0], drift: [-0.03, 0, 0],
      life: 14, rise: 0.22, spread: 2.0, size: 1.7, color: 0x98a4ae, opacity: 0.05, seed: 9,
    }),
    dust([TABLE.x - 1.2, 0.7, TABLE.z - 1.2], [TABLE.x + 1.2, 1.9, TABLE.z + 1.2], tier === 'high' ? 90 : 40, { size: 0.05, opacity: 0.28, color: 0xffe2b0, amp: 0.12 }),
  ];
  for (const p of fx) root.add(p.points);
  // Two things move. The seam under the sealed door and the wired glass in it breathe together,
  // slowly: one period, not a flicker. A flicker would read as a fault, and the point of the door
  // is that whatever is behind it is working perfectly well and is not coming out.
  //
  // And the television on the floor plays static. The screen is one tiling field of noise, so the
  // static is made by jumping where the texture is sampled from rather than by drawing a new field:
  // a random offset into noise is new noise, and it costs two numbers a frame instead of a 256 by
  // 256 upload. Twenty four jumps a second, not sixty, because static on a set of that age is a
  // field rate and not a frame rate, and at sixty it reads as a shimmer rather than as a picture
  // that is not there. The brightness swims a little under it, which is the set's own gain hunting
  // for a signal it is never going to find.
  let clock = 0, crtClock = 0;
  const CRT_FIELD = 1 / 24;
  return {
    id: 'containment', root, lights: lights(), hotspots,
    update(_t, dt) {
      clock += dt;
      for (const p of fx) p.update(dt);
      const level = 2.4 + 0.8 * Math.sin(clock * 1.7);
      pulse[0].emissiveIntensity = level * 0.33;
      pulse[1].emissiveIntensity = level;
      crtClock += dt;
      if (crtClock >= CRT_FIELD) {
        crtClock %= CRT_FIELD;
        crt.map.offset.set(Math.random(), Math.random());
        crt.material.emissiveIntensity = 0.62 + Math.random() * 0.2;
      }
    },
    dispose() { for (const p of fx) p.dispose(); root.traverse((o) => { if (o instanceof THREE.InstancedMesh) o.dispose(); }); disposeObject(root); scene.remove(root); },
  };
}

export const CONTAINMENT_DEF: StageDef = { id: 'containment', stop: 'containment', groups: ['labs', 'containment'], near: ['credentials', 'containment', 'file'], replaces: 'bay', build };
