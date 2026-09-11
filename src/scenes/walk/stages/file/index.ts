import * as THREE from 'three';
import type { Stage, StageContext, StageDef } from '../types';
import { disposeObject } from '../../materials';
import { buildShell } from './shell';
import { buildDressing } from './dressing';
import { lights } from './lighting';

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
  // Nothing in here moves. This is the last frame of the walk and it is a room somebody has just
  // left: the file is open, the mug is over, the chair is turned, and the only thing still running
  // is the yard outside the window. Motion in it would make it a room somebody is still in.
  return {
    id: 'file', root, lights: lights(), hotspots,
    update() {},
    dispose() { root.traverse((o) => { if (o instanceof THREE.InstancedMesh) o.dispose(); }); disposeObject(root); scene.remove(root); },
  };
}

export const FILE_DEF: StageDef = { id: 'file', stop: 'file', groups: ['labs', 'file', 'operations'], near: ['containment', 'file'], replaces: 'office', build };
