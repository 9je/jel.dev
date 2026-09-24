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
  const shell = await buildShell(ctx, root);
  const { hotspots, pulse, crt, passer } = await buildDressing(ctx, root);
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
  //
  // And every fifteen seconds or so, someone walks past on the other side of the door. Nothing more
  // than that: a head and shoulders crossing the wired glass, the feet crossing the seam, and the
  // red on the floor dipping while they are in front of the light. It is a second and a half, it
  // never happens on a beat, and the first one is late enough that a visitor has to have stood here
  // a while to see it. The red spot is the rig's, and the rig reads a placement's intensity every
  // frame, so the dip is made by moving the number on the placement this room handed it.
  let clock = 0, crtClock = 0;
  const CRT_FIELD = 1 / 24;
  const placements = lights();
  const red = placements.find((l) => l.kind === 'spot' && l.color === 0xd7383a)!;
  const RED_I = red.intensity;
  const WALK = { span: 1.5, speed: 1.1 };
  let nextPass = 9 + Math.random() * 4, passAt = -1;
  const walkTo = (p: number) => {
    // Each map is a strip three widths long with the figure centred, so the figure is `p` metres off
    // the centre of an opening `w` wide when the strip is offset by (w - p) / 3w. Past either end
    // the offset leaves the strip, and the clamped edge is plain light.
    passer.glass.offset.x = (0.4 - p) / 1.2;
    passer.seam.offset.x = (SEALED.w - p) / (3 * SEALED.w);
    red.intensity = RED_I * (1 - 0.7 * Math.exp(-((p / 0.45) ** 2)));
  };
  walkTo(10);
  return {
    id: 'containment', root, lights: placements, hotspots,
    update(_t, dt) {
      clock += dt;
      if (passAt < 0 && clock >= nextPass) passAt = clock;
      if (passAt >= 0) {
        const p = -WALK.span + (clock - passAt) * WALK.speed;
        if (p > WALK.span) { passAt = -1; nextPass = clock + 12 + Math.random() * 6; walkTo(10); } else walkTo(p);
      }
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
