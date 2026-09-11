import * as THREE from 'three';
import type { Stage, StageContext, StageDef } from '../types';
import { disposeObject } from '../../materials';
import { buildShell } from './shell';
import { buildDressing } from './dressing';
import { lights } from './lighting';
import { dust, plume, type ParticleSystem } from '../../labs/particles';
import { ROOM, Z0, Z1 } from './layout';

async function build(ctx: StageContext): Promise<Stage> {
  const { scene, tier } = ctx;
  const root = new THREE.Group(); root.name = 'recreation'; scene.add(root);
  const shell = buildShell(ctx, root); await ctx.pace();
  const { hotspots, header } = await buildDressing(ctx, root);
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o instanceof THREE.Points) return;
    const translucent = (o.material as THREE.Material).transparent;
    o.castShadow = tier === 'high' && !shell.planes.has(o) && !translucent && !(o.geometry instanceof THREE.PlaneGeometry);
    o.receiveShadow = !translucent;
  });
  // The air: steam off the kettle on the counter, and dust hanging under the troffers the length of
  // the room. Both are one draw call each and move in the shader.
  const fx: ParticleSystem[] = [
    // Normal blended and a shade under the tiles: additive white on a white splashback was invisible.
    plume([-29.35, 1.16, Z0 + 0.34], { count: 30, life: 2.6, rise: 0.95, spread: 0.24, size: 0.32, color: 0x94a6b2, opacity: 0.55 }),
    dust([ROOM.x0 + 1, 0.4, Z0 + 0.5], [ROOM.x1 - 1, 3.0, Z1 - 0.5], tier === 'high' ? 360 : 140, { size: 0.04, opacity: 0.28, color: 0xe6eef2 }),
  ];
  for (const p of fx) root.add(p.points);
  // Two faults, on their own clocks, because one panel blinking on a loop reads as an animation and
  // two that never line up read as a building nobody is maintaining. Panel A over the arcade row
  // drops out twice in three seconds. Panel B over the drinks machine buzzes in bursts, and the
  // machine's own header buzzes with it: one failing circuit, two things on it.
  const [panelA, panelB] = shell.flicker.map((f) => f.material as THREE.MeshStandardMaterial);
  const rested = header.emissiveIntensity;
  let clock = 0;
  return {
    id: 'recreation', root, lights: lights(), hotspots,
    update(_t, dt) {
      clock += dt;
      for (const p of fx) p.update(dt);
      const a = clock % 3.1;
      panelA.emissiveIntensity = a < 0.06 || (a > 0.5 && a < 0.62) ? 0.2 : 1.1;
      const buzz = 0.9 + 0.2 * Math.sin(clock * 37) * (clock % 7 < 1.4 ? 1 : 0);
      panelB.emissiveIntensity = buzz;
      header.emissiveIntensity = (rested * buzz) / 0.9;
    },
    dispose() { for (const p of fx) p.dispose(); root.traverse((o) => { if (o instanceof THREE.InstancedMesh) o.dispose(); }); disposeObject(root); scene.remove(root); },
  };
}

export const RECREATION_DEF: StageDef = { id: 'recreation', stop: 'recreation', groups: ['labs', 'recreation'], near: ['fabrication', 'recreation', 'operations'], replaces: 'corridor', build };
