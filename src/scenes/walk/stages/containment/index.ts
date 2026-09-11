import * as THREE from 'three';
import type { Stage, StageContext, StageDef } from '../types';
import { disposeObject } from '../../materials';
import { buildShell } from './shell';
import { buildDressing } from './dressing';
import { lights } from './lighting';
import { dust, plume, type ParticleSystem } from '../../labs/particles';
import { SEALED, TABLE } from './layout';

async function build(ctx: StageContext): Promise<Stage> {
  const { scene, tier } = ctx;
  const root = new THREE.Group(); root.name = 'containment'; scene.add(root);
  const shell = buildShell(ctx, root); await ctx.pace();
  const { hotspots, pulse } = await buildDressing(ctx, root);
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o instanceof THREE.Points) return;
    const translucent = (o.material as THREE.Material).transparent;
    o.castShadow = tier === 'high' && !shell.planes.has(o) && !translucent && !(o.geometry instanceof THREE.PlaneGeometry);
    o.receiveShadow = !translucent;
  });
  // Smoke seeping from under the sealed door, born along its full width and rising slow through the
  // red seam, and dust in the lamp over the table. The smoke is the room's answer to what is behind
  // the door: something warm and running.
  const fx: ParticleSystem[] = [
    plume([SEALED.x, 0.04, SEALED.z - 0.3], { count: tier === 'high' ? 110 : 50, life: 5, rise: 2.0, spread: 0.7, size: 0.95, color: 0xa88a8e, opacity: 0.5, along: [SEALED.w, 0, 0] }),
    dust([TABLE.x - 1.2, 0.7, TABLE.z - 1.2], [TABLE.x + 1.2, 1.9, TABLE.z + 1.2], tier === 'high' ? 110 : 50, { size: 0.03, opacity: 0.3, color: 0xffe2b0, amp: 0.12 }),
  ];
  for (const p of fx) root.add(p.points);
  // The only motion in the room: the seam under the sealed door and the wired glass in it breathe
  // together, slowly. One period, not a flicker. A flicker would read as a fault, and the point of
  // the door is that whatever is behind it is working perfectly well and is not coming out.
  let clock = 0;
  return {
    id: 'containment', root, lights: lights(), hotspots,
    update(_t, dt) {
      clock += dt;
      for (const p of fx) p.update(dt);
      const level = 2.4 + 0.8 * Math.sin(clock * 1.7);
      pulse[0].emissiveIntensity = level * 0.33;
      pulse[1].emissiveIntensity = level;
    },
    dispose() { for (const p of fx) p.dispose(); root.traverse((o) => { if (o instanceof THREE.InstancedMesh) o.dispose(); }); disposeObject(root); scene.remove(root); },
  };
}

export const CONTAINMENT_DEF: StageDef = { id: 'containment', stop: 'containment', groups: ['labs', 'containment'], near: ['credentials', 'containment', 'file'], replaces: 'bay', build };
