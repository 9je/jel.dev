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
    // The cigar. A thread rather than a cloud: it leaves the coal narrow, widens as it rises, and
    // leans the way the room's air moves, which is toward the window the yard is outside of.
    plume(CIGAR_TIP, { count: 26, life: 3.6, rise: 0.5, spread: 0.11, size: 0.095, grow: 2.8, drift: [0.008, 0, 0.022], color: 0xccd4d9, opacity: 0.6, seed: 23 }),
  ];
  for (const p of fx) root.add(p.points);
  // This is the last frame of the walk, and it is a room somebody has just stepped out of rather
  // than left for good: the file is open, the mug is over, the chair is turned, the glass is
  // poured, and the cigar in the ashtray is still going. The smoke off it is the only thing in the
  // room that moves under its own steam, which is what puts a person in the chair a minute ago.
  return {
    id: 'file', root, lights: lights(), hotspots,
    update(_t, dt) { for (const p of fx) p.update(dt); },
    dispose() { for (const p of fx) p.dispose(); root.traverse((o) => { if (o instanceof THREE.InstancedMesh) o.dispose(); }); disposeObject(root); scene.remove(root); },
  };
}

export const FILE_DEF: StageDef = { id: 'file', stop: 'file', groups: ['labs', 'file', 'operations'], near: ['containment', 'file'], replaces: 'office', build };
