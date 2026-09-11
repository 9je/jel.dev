import * as THREE from 'three';
import type { Stage, StageContext, StageDef } from '../types';
import { disposeObject } from '../../materials';
import { buildShell } from './shell';
import { buildDressing } from './dressing';
import { lights } from './lighting';
import { dust, plume, type ParticleSystem } from '../../labs/particles';
import { X0, X1, Z0, Z1 } from './layout';

async function build(ctx: StageContext): Promise<Stage> {
  const { scene, tier } = ctx;
  const root = new THREE.Group(); root.name = 'operations'; scene.add(root);
  const shell = buildShell(ctx, root); await ctx.pace();
  const { hotspots, blink } = await buildDressing(ctx, root);
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o instanceof THREE.Points) return;
    const translucent = (o.material as THREE.Material).transparent;
    o.castShadow = tier === 'high' && !shell.planes.has(o) && !translucent && !(o.geometry instanceof THREE.PlaneGeometry);
    o.receiveShadow = !translucent;
  });
  // Dust in the aisle, in the cold light off the racks. Server rooms are never as clean as they look.
  const fx: ParticleSystem[] = [
    dust([X0 + 2, 0.3, Z0 + 2.4], [X1 - 1, 4.0, Z1 - 2.4], tier === 'high' ? 320 : 120, { size: 0.04, opacity: 0.3, color: 0xd8e8f0 }),
  ];
  for (const p of fx) root.add(p.points);
  // The rows breathe. Every rack's units are one batch over one material, so a whole rack pulses on
  // a single write and the room costs fifteen of them a frame rather than one per unit. The period
  // comes off the rack's own seed, so no two racks are ever in step and the rows read as a lot of
  // machines each doing its own work instead of one animation playing sixteen times.
  let clock = 0;
  return {
    id: 'operations', root, lights: lights(), hotspots,
    update(_t, dt) {
      clock += dt;
      for (const p of fx) p.update(dt);
      for (const { material, seed } of blink) material.emissiveIntensity = 1.1 + 0.15 * Math.sin(clock * (3 + (seed % 5)) + seed);
    },
    dispose() { for (const p of fx) p.dispose(); root.traverse((o) => { if (o instanceof THREE.InstancedMesh) o.dispose(); }); disposeObject(root); scene.remove(root); },
  };
}

export const OPERATIONS_DEF: StageDef = { id: 'operations', stop: 'operations', groups: ['labs', 'operations'], near: ['recreation', 'operations', 'credentials'], replaces: 'lab', build };
