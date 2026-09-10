import * as THREE from 'three';
import type { Stage, StageContext, StageDef } from '../types';
import { disposeObject } from '../../materials';
import { buildShell } from './shell';
import { buildCleanRoom } from './cleanroom';
import { buildDressing } from './dressing';
import { buildLighting } from './lighting';

function build(ctx: StageContext): Stage {
  const { scene, anchors, tier } = ctx;
  const root = new THREE.Group(); root.name = 'fabrication'; scene.add(root);
  const shell = buildShell(ctx, root);
  const cleanRoomLight = buildCleanRoom(ctx, root);
  buildDressing(ctx, root);
  const lighting = buildLighting(ctx, root);
  const lights = [...lighting.lights, cleanRoomLight];
  anchors.set('fabrication', new THREE.Vector3(0, 2, 6));

  // Only the props cast. The shell planes are the room the shadows land on, and a floor or a wall
  // casting into its own neighbours buys nothing but shadow map draws.
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o instanceof THREE.Points) return;
    const translucent = (o.material as THREE.Material).transparent;
    o.castShadow = tier === 'high' && !shell.planes.has(o) && !translucent && !(o.geometry instanceof THREE.PlaneGeometry);
    o.receiveShadow = !translucent;
  });

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
