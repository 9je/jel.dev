import * as THREE from 'three';
import type { Stage, StageContext, StageDef } from '../types';
import { disposeObject } from '../../materials';
import { buildShell } from './shell';
import { buildOffice } from './office';
import { buildDressing } from './dressing';
import { buildLighting } from './lighting';

// Paced against the frame budget: this stage builds in the background while the walk is already
// live, so it gives the render loop its time back between the heavy steps rather than blocking a
// frame for the whole floor.
async function build(ctx: StageContext): Promise<Stage> {
  const { scene, anchors, tier } = ctx;
  const root = new THREE.Group(); root.name = 'fabrication'; scene.add(root);
  const shell = buildShell(ctx, root);
  await ctx.pace();
  const officeLight = buildOffice(ctx, root);
  await ctx.pace();
  await buildDressing(ctx, root);
  await ctx.pace();
  const lighting = buildLighting(ctx, root);
  await ctx.pace();
  const lights = [...lighting.lights, officeLight];
  anchors.set('fabrication', new THREE.Vector3(0, 2, 6));

  // Only the props cast. The shell planes are the room the shadows land on, and a floor or a wall
  // casting into its own neighbours buys nothing but shadow map draws.
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o instanceof THREE.Points) return;
    const translucent = (o.material as THREE.Material).transparent;
    o.castShadow = tier === 'high' && !shell.planes.has(o) && !translucent && !(o.geometry instanceof THREE.PlaneGeometry);
    o.receiveShadow = !translucent;
  });
  await ctx.pace();

  return {
    id: 'fabrication', root, lights,
    update(_t, dt) { lighting.update(dt); },
    dispose() {
      lighting.dispose();
      root.traverse((o) => { if (o instanceof THREE.InstancedMesh) o.dispose(); });
      disposeObject(root); scene.remove(root);
    },
  };
}

export const FABRICATION_DEF: StageDef = { id: 'fabrication', stop: 'fabrication', groups: ['fabrication', 'fabrication-extra', 'fabrication-dressing'], near: ['booth', 'fabrication', 'recreation'], replaces: 'hangar', build };
