import * as THREE from 'three';
import type { Stage, StageContext, StageDef } from '../types';
import { disposeObject } from '../../materials';
import { buildShell } from './shell';
import { buildDressing } from './dressing';
import { lights } from './lighting';

async function build(ctx: StageContext): Promise<Stage> {
  const { scene, tier } = ctx;
  const root = new THREE.Group(); root.name = 'recreation'; scene.add(root);
  const shell = buildShell(ctx, root); await ctx.pace();
  const hotspots = await buildDressing(ctx, root);
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o instanceof THREE.Points) return;
    const translucent = (o.material as THREE.Material).transparent;
    o.castShadow = tier === 'high' && !shell.planes.has(o) && !translucent && !(o.geometry instanceof THREE.PlaneGeometry);
    o.receiveShadow = !translucent;
  });
  // One ceiling panel flickers: the abandonment layer's moving part. buildShell pulled the panel
  // nearest the entrance into its own instanced mesh, so only it dims, not the whole grid.
  const mat = shell.flicker.material as THREE.MeshStandardMaterial;
  let clock = 0;
  return {
    id: 'recreation', root, lights: lights(), hotspots,
    update(_t, dt) { clock += dt; mat.emissiveIntensity = clock % 2.7 < 0.08 || (clock % 2.7 > 0.31 && clock % 2.7 < 0.36) ? 0.35 : 1.3; },
    dispose() { root.traverse((o) => { if (o instanceof THREE.InstancedMesh) o.dispose(); }); disposeObject(root); scene.remove(root); },
  };
}

export const RECREATION_DEF: StageDef = { id: 'recreation', stop: 'recreation', groups: ['labs', 'recreation'], near: ['fabrication', 'recreation', 'operations'], replaces: 'corridor', build };
