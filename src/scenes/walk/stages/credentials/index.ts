import * as THREE from 'three';
import type { Stage, StageContext, StageDef } from '../types';
import { disposeObject } from '../../materials';
import { buildShell } from './shell';
import { buildDressing } from './dressing';
import { lights } from './lighting';

async function build(ctx: StageContext): Promise<Stage> {
  const { scene, tier } = ctx;
  const root = new THREE.Group(); root.name = 'credentials'; scene.add(root);
  const shell = await buildShell(ctx, root);
  const dressing = await buildDressing(ctx, root);
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o instanceof THREE.Points) return;
    const translucent = (o.material as THREE.Material).transparent;
    o.castShadow = tier === 'high' && !shell.planes.has(o) && !translucent && !(o.geometry instanceof THREE.PlaneGeometry);
    o.receiveShadow = !translucent;
  });
  // Now and then the lab's theatre lamp browns out: it sags, catches, sags again and comes back, a
  // second and a bit from start to end, every twenty to thirty seconds. Its point light is the rig's
  // and the rig reads a placement's intensity every frame, so the lamp's light dips with its face.
  const placements = lights();
  const lampLight = placements.find((l) => l.kind === 'point' && l.position[2] === -15.4)!;
  const LAMP_I = lampLight.intensity;
  const glowBase = dressing.lampGlow.map((m) => m.emissiveIntensity);
  // Level over the event's own time: down, a catch, down again, and back.
  const SAG: [number, number][] = [[0, 1], [0.08, 0.25], [0.3, 0.3], [0.38, 0.8], [0.46, 0.2], [0.9, 0.35], [1.25, 1]];
  const sag = (t: number) => {
    for (let i = 1; i < SAG.length; i++) {
      const [t0, a] = SAG[i - 1]!, [t1, b] = SAG[i]!;
      if (t <= t1) return a + (b - a) * ((t - t0) / (t1 - t0));
    }
    return 1;
  };
  let clock = 0, next = 14 + Math.random() * 10, at = -1;
  return {
    id: 'credentials', root, lights: placements, hotspots: dressing.hotspots,
    update(_t, dt) {
      clock += dt;
      if (at < 0 && clock >= next) at = clock;
      let k = 1;
      if (at >= 0) {
        const e = clock - at;
        if (e > SAG[SAG.length - 1]![0]) { at = -1; next = clock + 20 + Math.random() * 10; } else k = sag(e);
      }
      lampLight.intensity = LAMP_I * k;
      dressing.lampGlow.forEach((m, i) => { m.emissiveIntensity = glowBase[i]! * k; });
    },
    dispose() { dressing.dispose(); root.traverse((o) => { if (o instanceof THREE.InstancedMesh) o.dispose(); }); disposeObject(root); scene.remove(root); },
  };
}

export const CREDENTIALS_DEF: StageDef = { id: 'credentials', stop: 'credentials', groups: ['labs', 'credentials'], near: ['operations', 'credentials', 'containment'], replaces: 'hall', build };
