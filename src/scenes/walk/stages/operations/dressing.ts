import * as THREE from 'three';
import type { Hotspot, StageContext } from '../types';
import { grounded, instances, merged, once, place, type Spot } from '../../merge';
import { papers, wallScreen } from '../../labs/props';
import { cage, cageGate, cableBundle, serverRack, trunkPipe, wallPanel } from '../../labs/plant';
import { labSteel } from '../../labs/materials';
import { tapeStrip } from '../../labs/signage';
import { X0, W, XC, ZC, Z0, Z1, RACK_Z, CAGE_Z, RACK_XS, GATE_X } from './layout';

/** One rack's unit material and the seed that gives it its own beat. */
export interface Blink { material: THREE.MeshStandardMaterial; seed: number }
export interface Dressing { hotspots: Hotspot[]; blink: Blink[] }

/** By ordinal along the row, counting from the east end: the two south racks somebody left open,
 *  and the north rack with no power. */
const OPEN_SOUTH = new Set([2, 6]);
const DEAD_NORTH = 4;

/**
 * The server hall. Sixteen racks in two caged rows under a hazard yellow trunk pipe, which is the
 * one bold thing in the room: everything else here is grey, red or dark, so the pipe is the only
 * warm line in the frame and it runs the whole length of the aisle with the lit racks glowing
 * underneath it.
 *
 * The first pass read as "ok, lacking". What it was missing was density and services: a rack was a
 * single lit plane, the cages were sticks, and nothing at all crossed the ceiling. Now every rack
 * carries fourteen units on its own beat behind a mesh door, the cages have a mid rail and a gate
 * that swings, and six cable bundles sag from the trunk into the trays over each row.
 */
export async function buildDressing(ctx: StageContext, root: THREE.Group): Promise<Dressing> {
  const { store, anchors, pace } = ctx;
  const prop = (key: string) => grounded(store.model(key));
  const add = async (o: THREE.Object3D) => { root.add(o); await pace(); };
  const hotspots: Hotspot[] = [];
  const blink: Blink[] = [];

  // ---- The rows -------------------------------------------------------------------------------
  // Racks against both long walls with their fronts to the aisle, a cage run in front of each. The
  // cage on each side is split around a 1.2 m gate at GATE_X, opposite the flagship: the south gate
  // stands open, the north one is shut, so the pair reads as one enclosure somebody walked into.
  for (const [side, z, ry] of [['south', RACK_Z.south, 0], ['north', RACK_Z.north, Math.PI]] as const) {
    for (const [i, x] of RACK_XS.entries()) {
      const seed = i + (side === 'south' ? 1 : 20);
      const dead = side === 'north' && i + 1 === DEAD_NORTH;
      const rack = serverRack({ seed, dead, open: side === 'south' && OPEN_SOUTH.has(i + 1) });
      await add(place(rack, x, 0, z, ry));
      if (!dead) blink.push({ material: (rack.userData.blink as THREE.MeshStandardMaterial[])[0], seed });
    }
  }

  const spanX0 = XC - (W - 4) / 2, spanX1 = XC + (W - 4) / 2, half = 0.6;
  for (const [side, z] of [['south', CAGE_Z.south], ['north', CAGE_Z.north]] as const) {
    const run1Len = GATE_X - half - spanX0, run1X = (spanX0 + GATE_X - half) / 2;
    const run2Len = spanX1 - (GATE_X + half), run2X = (GATE_X + half + spanX1) / 2;
    await add(place(cage(run1Len), run1X, 0, z));
    await add(place(cage(run2Len), run2X, 0, z));
    // The gate is turned with the run it belongs to, so both leaves swing into the aisle.
    await add(place(cageGate(1.2, 2.6, side === 'south' ? 0.4 : 0), GATE_X, 0, z, side === 'south' ? 0 : Math.PI));
  }
  // The flagship plate pins to the open gate, which is the one break in either row.
  anchors.set('operations', new THREE.Vector3(GATE_X, 1.7, CAGE_Z.south + 0.8));

  // ---- Overhead -------------------------------------------------------------------------------
  // The trunk is the one warm line in the room and it runs wall to wall, so it reads as a service
  // passing through rather than a pipe that stops in mid air. It hangs 1.8 m north of the walked
  // line rather than over it: on the centreline the walk looks straight up the pipe's own axis and
  // an 18 m cylinder foreshortens into a yellow wedge hanging in front of the lens. Off to one side
  // it is a line running away to the far wall, which is the whole point of it. 1.8 m and no further,
  // though: the hold already looks 2 m south of the line, and on a phone's 22 degrees of half frame
  // anything much north of that is out of shot for the length of the room.
  //
  // The bundles leave it for the tray over every third rack on each side. They land on the tray
  // rather than on the rack top, which is where a chord from the trunk would have wanted to go: the
  // cages stand 2.6 m and a cable slung from the trunk to a 2.1 m rack top crosses the cage plane at
  // about 2.3 m, which is a cable run straight through a wall of mesh. Over the top and into the
  // tray is what the reference does and the only route that clears.
  const trunkZ = ZC + 1.8;
  await add(place(trunkPipe(W - 0.2), XC, 4.2, trunkZ));
  for (const z of [RACK_Z.south, RACK_Z.north]) {
    const sign = Math.sign(z - trunkZ);
    for (const x of RACK_XS.filter((_, i) => i % 3 === 0)) await add(cableBundle([x, 4.05, trunkZ + sign * 0.15], [x, 4.06, z - sign * 0.18]));
  }

  // ---- The service walls ----------------------------------------------------------------------
  // Three electrical panels, a camera over the aisle and an extinguisher by the east end.
  //
  // The panels hang above the cage line rather than just above the dado, and on the south wall
  // rather than the north. Both of those are what the frame asks for: the racks stand 0.6 m off the
  // wall behind a 2.6 m cage, so anything at chest height is behind two metres of machine, and at
  // the hold the room's own copy fills the left of the frame while the strip of south wall above
  // the cage is the one long blank in it.
  for (const x of [-60, -64, -68]) await add(place(wallPanel(0.8, 1.2), x, 3.15, Z0 + 0.08));
  // Mounted mid-hall rather than in the east corner it was drawn in: the hold enters on the east
  // wall itself, so anything hung there sits behind the camera and is never once seen.
  await add(once(prop('security_camera'), -70, 3.6, Z1 - 0.35, -2.3));
  await add(place(extinguisher(), -59, 1.0, Z1 - 0.15));

  // ---- The west end: the flagship -------------------------------------------------------------
  // The desk with the laptop open on it is the operations exhibit, so it is one group the pointer
  // can pick rather than two props standing near each other.
  const bay = new THREE.Group(); bay.name = 'flagship-desk';
  bay.add(once(store.model('desk'), X0 + 1.2, 0, -31, Math.PI / 2));
  bay.add(once(prop('laptop'), X0 + 1.1, 0.76, -30.6, 1.3));
  await add(bay);
  hotspots.push({ id: 'msp-automation', kind: 'project', label: 'Platform development', object: bay, stop: 'operations' });

  await add(place(wallScreen(1.6, 0.9, ['RACK STATUS', 'row A  ok', 'row B  degraded'], '#CFE6EE'), X0 + 0.1, 2.4, -33.5, Math.PI / 2));

  // ---- The aisle ------------------------------------------------------------------------------
  await add(once(prop('office_chair'), -66, 0, -32.5, 1.1));
  await add(boxes([[-69, 0.2, -33.6, 0.3], [-68.62, 0.6, -33.74, -0.45]]));
  await add(place(stepladder(), -73.5, 0, -34.6, 0.5));
  await add(papers([
    [X0 + 3, 0, -30.4, 0.2], [X0 + 3.8, 0, -31.6, 1.1], [-66, 0, -30.2, 2.4], [-61, 0, -31.8, 0.7],
    [-64.2, 0, -33.1, 1.5], [-67.4, 0, -34.2, 0.3], [-70.6, 0, -28.3, 2.1], [-72.8, 0, -32.9, 0.9],
    [-62.6, 0, -28.9, 1.8], [-69.9, 0, -31.2, 0.4], [-73.9, 0, -34.4, 2.6], [-59.8, 0, -33.4, 1.2],
  ]));

  // ---- The tape -------------------------------------------------------------------------------
  // Strung between the two cage runs' west end posts, which is furniture it can be tied to. It hangs
  // at 0.75 m rather than the 1.05 it was at: from the hold the old run crossed the desk exactly
  // where the laptop's screen stands, and Jordan's note on that end was that the tape clips the
  // desk. At knee height it crosses the desk's legs instead and the exhibit above it reads clear.
  const cageEnd = spanX0;
  await add(tapeStrip([cageEnd, 0.75, CAGE_Z.south], [cageEnd, 0.75, CAGE_Z.north], 0.07));

  return { hotspots, blink };
}

/** A wall bracketed extinguisher: red bottle, black head. Origin at the middle of the bottle. */
function extinguisher(): THREE.Group {
  const g = new THREE.Group();
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 12), new THREE.MeshStandardMaterial({ color: 0xa8261f, roughness: 0.45, metalness: 0.3 }));
  g.add(bottle);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 10), new THREE.MeshStandardMaterial({ color: 0x14191e, roughness: 0.6, metalness: 0.4 }));
  head.position.y = 0.29; g.add(head);
  return g;
}

/** Cardboard boxes on the floor, each spot a box with its own turn. One draw call. */
function boxes(spots: Spot[]): THREE.InstancedMesh {
  return instances(new THREE.BoxGeometry(0.5, 0.4, 0.4), new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.9 }), spots);
}

/** A folded A-frame steps, two pairs of stiles leaning against each other. Origin at floor centre,
 *  the frame opening along z. One draw call. */
function stepladder(): THREE.Group {
  const stiles: THREE.BufferGeometry[] = [];
  for (const [lean, z] of [[0.16, -0.28], [-0.16, 0.28]] as const) {
    for (const x of [-0.22, 0.22]) {
      const s = new THREE.BoxGeometry(0.05, 2.0, 0.05);
      s.rotateX(lean); s.translate(x, 1.0, z);
      stiles.push(s);
    }
    // Three treads between each pair, so the thing reads as steps and not as four sticks.
    for (const y of [0.45, 0.95, 1.45]) {
      const t = new THREE.BoxGeometry(0.44, 0.04, 0.12);
      t.rotateX(lean); t.translate(0, y, z - lean * (y - 1.0));
      stiles.push(t);
    }
  }
  const g = new THREE.Group();
  g.add(merged(stiles, labSteel(0x7d8890)));
  return g;
}
