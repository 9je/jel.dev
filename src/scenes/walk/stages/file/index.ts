import * as THREE from 'three';
import type { Stage, StageContext, StageDef } from '../types';
import { disposeObject } from '../../materials';
import { buildShell } from './shell';
import { buildDressing, CIGAR_TIP } from './dressing';
import { lights } from './lighting';
import { dust, plume, type ParticleSystem } from '../../labs/particles';
import { DESK } from './layout';

async function build(ctx: StageContext): Promise<Stage> {
  const { scene, tier } = ctx;
  const root = new THREE.Group(); root.name = 'file'; scene.add(root);
  const shell = await buildShell(ctx, root);
  const { hotspots, screen } = await buildDressing(ctx, root);
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
    // The cigar. A thread rather than a cloud: it leaves the coal narrow, widens as it rises, and
    // leans the way the room's air moves, which is toward the window the yard is outside of.
    plume(CIGAR_TIP, { count: 70, life: 4.6, rise: 0.62, spread: 0.07, size: 0.05, grow: 5, drift: [0.01, 0, 0.026], color: 0xc4ccd1, opacity: 0.2, seed: 23 }),
  ];
  for (const p of fx) root.add(p.points);
  // This is the last frame of the walk, and it is a room somebody has just stepped out of rather
  // than left for good: the file is open, the glasses are off, the chair is turned, the thermos is
  // out, and the cigar in the ashtray is still going. The smoke off it is the only thing in the
  // room that moves under its own steam, which is what puts a person in the chair a minute ago.
  // The live monitor on the desk loses sync now and then: the plan rolls up the screen twice,
  // faster as it goes, and the picture flickers until it catches and settles back where it was.
  // Every eighteen to twenty eight seconds, three quarters of a second each time.
  const ROLL = 0.75, SCREEN_I = screen.material.emissiveIntensity;
  let clock = 0, nextRoll = 10 + Math.random() * 8, rollAt = -1;
  return {
    id: 'file', root, lights: lights(), hotspots,
    update(_t, dt) {
      for (const p of fx) p.update(dt);
      clock += dt;
      if (rollAt < 0 && clock >= nextRoll) rollAt = clock;
      let dim = 1;
      if (rollAt >= 0) {
        const e = clock - rollAt;
        if (e > ROLL) { rollAt = -1; nextRoll = clock + 18 + Math.random() * 10; screen.map.offset.y = 0; }
        else { screen.map.offset.y = ((e / ROLL) ** 1.6) * 2; dim = 0.55 + 0.45 * Math.abs(Math.sin(e * 40)); }
      }
      screen.material.emissiveIntensity = SCREEN_I * dim;
    },
    dispose() { for (const p of fx) p.dispose(); root.traverse((o) => { if (o instanceof THREE.InstancedMesh) o.dispose(); }); disposeObject(root); scene.remove(root); },
  };
}

export const FILE_DEF: StageDef = { id: 'file', stop: 'file', groups: ['labs', 'file', 'operations'], near: ['containment', 'file'], replaces: 'office', build };
