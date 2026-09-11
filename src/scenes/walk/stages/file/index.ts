import * as THREE from 'three';
import type { Stage, StageContext, StageDef } from '../types';
import { disposeObject } from '../../materials';
import { buildShell } from './shell';
import { buildDressing } from './dressing';
import { lights } from './lighting';
import { dust, plume, type ParticleSystem } from '../../labs/particles';
import { DESK } from './layout';

async function build(ctx: StageContext): Promise<Stage> {
  const { scene, tier } = ctx;
  const root = new THREE.Group(); root.name = 'file'; scene.add(root);
  const shell = buildShell(ctx, root); await ctx.pace();
  const { hotspots } = await buildDressing(ctx, root);
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o instanceof THREE.Points) return;
    const translucent = (o.material as THREE.Material).transparent;
    o.castShadow = tier === 'high' && !shell.planes.has(o) && !translucent && !(o.geometry instanceof THREE.PlaneGeometry);
    o.receiveShadow = !translucent;
  });
  // The one thing that moves in here: dust turning in the lamp's pool over the desk. A room somebody
  // has just left still has its air.
  const fx: ParticleSystem[] = [
    dust([DESK.x - 0.9, 0.75, DESK.z0 + 1.2], [DESK.x + 0.9, 1.7, DESK.z1 - 1.2], tier === 'high' ? 160 : 60, { size: 0.035, opacity: 0.42, color: 0xffe0a8, amp: 0.1 }),
  ];
  for (const p of fx) root.add(p.points);
  // Nothing in here moves. This is the last frame of the walk and it is a room somebody has just
  // left: the file is open, the mug is over, the chair is turned, and the only thing still running
  // is the yard outside the window. Motion in it would make it a room somebody is still in.
  return {
    id: 'file', root, lights: lights(), hotspots,
    update(_t, dt) { for (const p of fx) p.update(dt); },
    dispose() { for (const p of fx) p.dispose(); root.traverse((o) => { if (o instanceof THREE.InstancedMesh) o.dispose(); }); disposeObject(root); scene.remove(root); },
  };
}

export const FILE_DEF: StageDef = { id: 'file', stop: 'file', groups: ['labs', 'file', 'operations'], near: ['containment', 'file'], replaces: 'office', build };
