import * as THREE from 'three';
import type { Stage, StageContext, StageDef } from '../types';
import { disposeObject } from '../../materials';
import { buildShell } from './shell';
import { buildDressing } from './dressing';
import { lights } from './lighting';

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
  // The only motion in the room: the seam under the sealed door and the wired glass in it breathe
  // together, slowly. One period, not a flicker. A flicker would read as a fault, and the point of
  // the door is that whatever is behind it is working perfectly well and is not coming out.
  let clock = 0;
  return {
    id: 'containment', root, lights: lights(), hotspots,
    update(_t, dt) {
      clock += dt;
      const level = 2.4 + 0.8 * Math.sin(clock * 1.7);
      pulse[0].emissiveIntensity = level * 0.33;
      pulse[1].emissiveIntensity = level;
    },
    dispose() { root.traverse((o) => { if (o instanceof THREE.InstancedMesh) o.dispose(); }); disposeObject(root); scene.remove(root); },
  };
}

export const CONTAINMENT_DEF: StageDef = { id: 'containment', stop: 'containment', groups: ['labs', 'containment'], near: ['credentials', 'containment', 'file'], replaces: 'bay', build };
