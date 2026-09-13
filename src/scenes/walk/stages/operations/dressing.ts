import * as THREE from 'three';
import type { Hotspot, StageContext } from '../types';
import { grounded, instances, merged, once, place, type Spot } from '../../merge';
import { papers, wallScreen } from '../../labs/props';
import { taskChair } from '../../labs/furniture';
import { cage, cageGate, cableBundle, serverRack, trunkPipe, wallPanel } from '../../labs/plant';
import { labSteel } from '../../labs/materials';
import { stanchion, tapeStrip } from '../../labs/signage';
import { canvas, own, rng } from '../../labs/textures';
import { radialTexture } from '../../textures';
import { X0, W, XC, ZC, Z0, Z1, RACK_Z, CAGE_Z, RACK_XS, GATE_X, FIRE_NORTH, TAPE_Y, TAPE_RUNS, STANCHIONS, CARTONS } from './layout';

/** One rack's unit material and the seed that gives it its own beat. */
export interface Blink { material: THREE.MeshStandardMaterial; seed: number }
/** The burning rack: its units, the glow off its top, the strobe on the wall beside it, and where
 *  the smoke leaves it, in room space. */
export interface Fire { units: THREE.MeshStandardMaterial; glow: THREE.MeshBasicMaterial; strobe: THREE.MeshStandardMaterial; top: [number, number, number] }
/** The camera's yaw group and the bearing its sweep is centred on. */
export interface Camera { head: THREE.Group; bearing: number }
export interface Dressing { hotspots: Hotspot[]; blink: Blink[]; fire: Fire; camera: Camera }

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
 * that swings, and six cable bundles sag from the trunk into the trays over each row. This pass
 * adds the two things Jordan asked for, a camera that sweeps the aisle and a rack that is on fire,
 * and fixes the two he did not like: the tape through the desk and the box stack.
 */
export async function buildDressing(ctx: StageContext, root: THREE.Group): Promise<Dressing> {
  const { store, anchors, pace } = ctx;
  const prop = (key: string) => grounded(store.model(key));
  const add = async (o: THREE.Object3D) => { root.add(o); await pace(); };
  const hotspots: Hotspot[] = [];
  const blink: Blink[] = [];
  // The alarm strobe is built first so the burning rack can carry its lens from the start.
  const alarm = strobe();
  let fire: Fire | null = null;

  // ---- The rows -------------------------------------------------------------------------------
  // Racks against both long walls with their fronts to the aisle, a cage run in front of each. The
  // cage on each side is split around a 1.2 m gate at GATE_X, opposite the flagship: the south gate
  // stands open, the north one is shut, so the pair reads as one enclosure somebody walked into.
  for (const [side, z, ry] of [['south', RACK_Z.south, 0], ['north', RACK_Z.north, Math.PI]] as const) {
    for (const [i, x] of RACK_XS.entries()) {
      const seed = i + (side === 'south' ? 1 : 20);
      const dead = side === 'north' && i + 1 === DEAD_NORTH;
      const burning = side === 'north' && i + 1 === FIRE_NORTH;
      const rack = serverRack({ seed, dead, open: side === 'south' && OPEN_SOUTH.has(i + 1) });
      const units = (rack.userData.blink as THREE.MeshStandardMaterial[])[0];
      if (burning) {
        const { glow } = scorch(rack);
        // The smoke leaves the top of the carcass on the aisle side, which for the north row is -z.
        fire = { units, glow, strobe: alarm.userData.lens as THREE.MeshStandardMaterial, top: [x, 2.14, z - 0.2] };
      }
      await add(place(rack, x, 0, z, ry));
      if (!dead && !burning) blink.push({ material: units, seed });
    }
  }
  if (!fire) throw new Error('operations: FIRE_NORTH names no rack in the north row');

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
  // Three electrical panels, a camera over the aisle, the alarm strobe over the burning rack and an
  // extinguisher at each end of the hall.
  //
  // The panels hang above the cage line rather than just above the dado, and on the south wall
  // rather than the north. Both of those are what the frame asks for: the racks stand 0.6 m off the
  // wall behind a 2.6 m cage, so anything at chest height is behind two metres of machine, and at
  // the hold the room's own copy fills the left of the frame while the strip of south wall above
  // the cage is the one long blank in it.
  for (const x of [-60, -64, -68]) await add(place(wallPanel(0.8, 1.2), x, 3.15, Z0 + 0.08));

  // The camera is mid-hall on the north wall, where the hold sees it side on, and it pans the aisle:
  // the housing yaws on its yoke, which is the joint a real bracket camera turns on, and the plate
  // and arm stay bolted to the wall. The Poly Haven camera is one mesh from wall plate to lens, so
  // turning it would have swung the arm through the wall.
  const cam = cctv();
  cam.group.position.set(-70, 3.55, Z1 - 0.01); cam.group.rotation.y = Math.PI;
  await add(cam.group);
  // Facing the wall's own -z after the half turn, and swung a little east so the sweep is centred on
  // the hall rather than on the wall opposite.
  const camera: Camera = { head: cam.head, bearing: -0.35 };

  // The strobe hangs over the burning rack's own cage, high enough to clear the cage rail, and the
  // room drives its lens from update().
  alarm.position.set(fire.top[0] + 0.9, 3.05, Z1 - 0.04); alarm.rotation.y = Math.PI;
  await add(alarm);

  await add(place(extinguisher(), -59, 0, Z1 - 0.09, Math.PI));
  // The second one hangs on the cage post east of the open gate, the way the reference hangs them
  // on whatever steel is nearest the door.
  await add(place(extinguisher(), GATE_X + half, 0, CAGE_Z.south + 0.06));

  // ---- The west end: the flagship -------------------------------------------------------------
  // The desk with the laptop open on it is the operations exhibit, so it is one group the pointer
  // can pick rather than two props standing near each other.
  const bay = new THREE.Group(); bay.name = 'flagship-desk';
  bay.add(once(store.model('desk'), X0 + 1.2, 0, -31, Math.PI / 2));
  bay.add(once(prop('laptop'), X0 + 1.1, 0.76, -30.6, 1.3));
  await add(bay);
  hotspots.push({ id: 'msp-automation', kind: 'project', label: 'Platform development', object: bay, stop: 'operations' });

  // The LABS TERRAGROUP stencil from the reference, painted large on the west wall over the desk
  // and to the right of the credentials door, where the hold looks straight at it. The status
  // screen moves down the wall to make room and up above the cage rail, so it reads over the
  // south run rather than through its mesh.
  const decal = labsStencil(3.4, 1.15);
  decal.position.set(X0 + 0.012, 2.5, -33.0); decal.rotation.y = Math.PI / 2;
  await add(decal);
  await add(place(wallScreen(1.6, 0.9, ['RACK STATUS', 'row A  ok', 'row B  fault'], '#CFE6EE'), X0 + 0.1, 3.15, -36.2, Math.PI / 2));

  // ---- The aisle ------------------------------------------------------------------------------
  // Each loose thing is somewhere a person left it for a reason: the chair pushed back from the
  // desk, the cartons dropped at the cage gate waiting to go in, the ladder up at the wall panels.
  // Spread down the aisle they read as scatter, and Jordan's note was "model position feels random".
  await add(place(taskChair(), X0 + 2.2, 0, -31.7, -Math.PI / 2 + 0.3));
  await add(cartons(CARTONS));
  await add(place(stepladder(), -64.6, 0, Z1 - 0.75, 0.15));
  await add(papers([
    [X0 + 3, 0, -30.4, 0.2], [X0 + 3.8, 0, -31.6, 1.1], [-66, 0, -30.2, 2.4], [-61, 0, -31.8, 0.7],
    [-64.2, 0, -33.1, 1.5], [-67.4, 0, -34.2, 0.3], [-70.6, 0, -28.3, 2.1], [-72.8, 0, -32.9, 0.9],
    [-62.6, 0, -28.9, 1.8], [-69.9, 0, -31.2, 0.4], [-73.9, 0, -34.4, 2.6], [-59.8, 0, -33.4, 1.2],
  ]));

  // ---- The tape -------------------------------------------------------------------------------
  // One run each side, from the cage's west end post out to a stanchion in the hall, and the
  // middle left open. The old run went post to post straight across the aisle, which put it
  // through the desk and the laptop on it; these two stop well short of the desk and of the walk.
  for (const [i, [a, b]] of TAPE_RUNS.entries()) {
    await add(tapeStrip([a[0], TAPE_Y, a[1]], [b[0], TAPE_Y, b[1]], 0.04));
    await add(place(stanchion(), STANCHIONS[i][0], 0, STANCHIONS[i][1]));
  }

  return { hotspots, blink, fire, camera };
}

// -----------------------------------------------------------------------------------------------
// The pieces only this room draws.

/**
 * A bracket camera: a wall plate, an arm out from it, a yoke, and under the yoke the hooded
 * housing with its lens and a red LED. Origin at the wall plate, the arm along +z, the housing
 * looking down +z and tilted at the floor. `head` is the yaw group under the yoke, which is what
 * the room turns to sweep it. Four draw calls.
 */
function cctv(): { group: THREE.Group; head: THREE.Group } {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0xc3ccd1, roughness: 0.45, metalness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x141a1f, roughness: 0.5, metalness: 0.4 });
  const ARM = 0.3;
  group.add(merged([
    new THREE.BoxGeometry(0.12, 0.16, 0.014).translate(0, 0, 0.007),
    new THREE.CylinderGeometry(0.016, 0.016, ARM, 8).rotateX(Math.PI / 2).translate(0, 0.02, ARM / 2),
    new THREE.CylinderGeometry(0.024, 0.024, 0.05, 10).translate(0, -0.005, ARM),
  ], paint));

  const head = new THREE.Group(); head.position.set(0, -0.03, ARM); group.add(head);
  const tilt = new THREE.Group(); tilt.rotation.x = 0.42; head.add(tilt);
  // The housing hangs under the yoke on a short stem, its hood a shade longer at the front.
  tilt.add(merged([
    new THREE.CylinderGeometry(0.014, 0.014, 0.05, 8).translate(0, -0.02, 0),
    new THREE.BoxGeometry(0.11, 0.1, 0.34).translate(0, -0.095, 0.03),
    new THREE.BoxGeometry(0.125, 0.014, 0.37).translate(0, -0.038, 0.05),
  ], paint));
  tilt.add(merged([
    new THREE.CylinderGeometry(0.036, 0.036, 0.03, 14).rotateX(Math.PI / 2).translate(0, -0.095, 0.21),
    new THREE.CylinderGeometry(0.027, 0.027, 0.006, 14).rotateX(Math.PI / 2).translate(0, -0.095, 0.228),
  ], dark));
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), new THREE.MeshStandardMaterial({ color: 0x3a0806, emissive: 0xff2a1a, emissiveIntensity: 4 }));
  led.position.set(0.042, -0.06, 0.206); led.name = 'led'; tilt.add(led);
  return { group, head };
}

/**
 * A wall alarm strobe: a red box with a clear lens on its face and a FIRE strip under it. Origin
 * at the back of the box on the wall, facing +z. The lens material is `userData.lens`, which the
 * room drives to flash. Three draw calls.
 */
function strobe(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.07), new THREE.MeshStandardMaterial({ color: 0xb0362c, roughness: 0.5, metalness: 0.2 }));
  body.position.z = 0.035; g.add(body);
  const lens = new THREE.MeshStandardMaterial({ color: 0xe8eef2, roughness: 0.25, emissive: 0xff2a1a, emissiveIntensity: 0.2 });
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.04, 14).rotateX(Math.PI / 2), lens);
  dome.position.set(0, 0.03, 0.09); dome.name = 'lens'; g.add(dome);
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.036), new THREE.MeshBasicMaterial({
    map: stencilCanvas('FIRE', 256, 72, '#f2f2f2', '600 52px Michroma, system-ui, sans-serif'), transparent: true, depthWrite: false,
  }));
  strip.position.set(0, -0.06, 0.071); g.add(strip);
  g.userData.lens = lens;
  return g;
}

/**
 * The marks a rack fire leaves and the light it gives off: a soot bloom across the top of the
 * front, a smudge of it up the carcass, and an orange glow lying on the rack top for the smoke to
 * rise through. Added to the rack in its own frame before it is placed, so the north row's half
 * turn carries them round with it. Two draw calls.
 */
function scorch(rack: THREE.Group): { glow: THREE.MeshBasicMaterial } {
  const soot = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: radialTexture(64, 0.02), transparent: true, opacity: 0.7, depthWrite: false });
  // Over the door mesh, so the soot lies on the face of the rack rather than behind its units.
  const front = new THREE.PlaneGeometry(0.62, 0.7).translate(0, 1.92, 0.532);
  const top = new THREE.PlaneGeometry(0.66, 0.8).rotateX(-Math.PI / 2).translate(0, 2.106, 0.15);
  const smudge = merged([front, top], soot); smudge.renderOrder = 1; rack.add(smudge);

  const glow = new THREE.MeshBasicMaterial({ color: 0xff7a1e, alphaMap: radialTexture(64, 0.1), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  const ember = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.9).rotateX(-Math.PI / 2), glow);
  ember.position.set(0, 2.112, 0.05); ember.renderOrder = 2; ember.name = 'ember'; rack.add(ember);
  return { glow };
}

/**
 * A wall bracketed extinguisher: a red bottle with a domed shoulder on a bracket plate, a black
 * valve with its lever and a hose looped down the side, a printed label band round the middle.
 * Origin on the floor under the bottle, bracket at the back on -z, so it hangs on a surface facing
 * +z. Three draw calls.
 */
function extinguisher(): THREE.Group {
  const g = new THREE.Group();
  const y0 = 0.6, R = 0.075, H = 0.52;
  const red = new THREE.MeshStandardMaterial({ color: 0xb42a20, roughness: 0.4, metalness: 0.35 });
  g.add(merged([
    new THREE.CylinderGeometry(R, R, H, 16).translate(0, y0 + H / 2, 0),
    new THREE.SphereGeometry(R, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, y0 + H, 0),
    new THREE.SphereGeometry(R, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).translate(0, y0, 0),
  ], red));
  const black = new THREE.MeshStandardMaterial({ color: 0x14191e, roughness: 0.55, metalness: 0.4 });
  const hose = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.03, y0 + H + 0.09, 0.02), new THREE.Vector3(0.11, y0 + H + 0.02, 0.03),
    new THREE.Vector3(0.1, y0 + 0.2, 0.04), new THREE.Vector3(0.08, y0 + 0.06, 0.03),
  ]);
  g.add(merged([
    new THREE.CylinderGeometry(0.022, 0.022, 0.1, 10).translate(0, y0 + H + 0.1, 0),
    new THREE.BoxGeometry(0.02, 0.012, 0.11).rotateX(-0.25).translate(0, y0 + H + 0.165, 0.035),
    new THREE.BoxGeometry(0.024, 0.02, 0.1).translate(0, y0 + H + 0.135, 0.03),
    new THREE.TubeGeometry(hose, 12, 0.008, 6, false),
    new THREE.BoxGeometry(0.1, 0.16, 0.012).translate(0, y0 + H * 0.55, -R - 0.006),
    new THREE.TorusGeometry(R + 0.008, 0.006, 6, 20).rotateX(Math.PI / 2).translate(0, y0 + H * 0.55, 0),
  ], black));
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.002, R + 0.002, 0.14, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xe9e6dc, roughness: 0.7, side: THREE.DoubleSide }));
  band.position.y = y0 + H * 0.35; g.add(band);
  return g;
}

/**
 * Cardboard cartons, each spot a carton with its own turn and size, three draw calls in all. The
 * box is a shipping carton rather than a brown cube: its sides bulge a centimetre under the load,
 * the lid is domed where the flaps meet, and the faces are printed: a strip of brown tape across
 * the top seam, a label and an arrows mark on the sides. Origin on the floor under each carton.
 */
function cartons(spots: Spot[]): THREE.InstancedMesh {
  const W = 0.5, H = 0.38, D = 0.4;
  const geo = new THREE.BoxGeometry(W, H, D, 2, 2, 2);
  const pos = geo.attributes.position as THREE.BufferAttribute, nor = geo.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ny = nor.getY(i);
    // A side face's mid vertices push out along the face normal; the lid's centre lifts; the base
    // stays flat so the carton sits on the floor, or on the one under it.
    const centre = Math.abs(y) < 1e-6 && (Math.abs(x) < 1e-6 || Math.abs(z) < 1e-6);
    if (Math.abs(ny) < 0.5 && centre) { pos.setX(i, x + nor.getX(i) * 0.014); pos.setZ(i, z + nor.getZ(i) * 0.014); }
    if (ny > 0.5 && Math.abs(x) < 1e-6 && Math.abs(z) < 1e-6) pos.setY(i, y + 0.012);
  }
  pos.needsUpdate = true; geo.computeVertexNormals();
  geo.translate(0, H / 2, 0);
  const side = new THREE.MeshStandardMaterial({ map: cartonFace('side'), roughness: 0.92 });
  const top = new THREE.MeshStandardMaterial({ map: cartonFace('top'), roughness: 0.9 });
  const base = new THREE.MeshStandardMaterial({ map: cartonFace('base'), roughness: 0.95 });
  const mesh = instances(geo, side, spots);
  // BoxGeometry's groups run +x, -x, +y, -y, +z, -z.
  mesh.material = [side, side, top, base, side, side];
  mesh.name = 'cartons';
  return mesh;
}

/** One face of a carton: kraft with its own grain, and the print the face carries. */
function cartonFace(which: 'side' | 'top' | 'base'): THREE.CanvasTexture {
  const S = 256;
  const [c, ctx] = canvas(S, S); const r = rng(which === 'side' ? 3 : which === 'top' ? 5 : 9);
  ctx.fillStyle = '#a8865a'; ctx.fillRect(0, 0, S, S);
  // The grain: faint horizontal streaks, the way corrugated board prints.
  for (let i = 0; i < 90; i++) { ctx.fillStyle = `rgba(${r() > 0.5 ? '120,90,50' : '200,170,120'},${(0.05 + r() * 0.08).toFixed(3)})`; ctx.fillRect(0, r() * S, S, 1 + r() * 2); }
  ctx.fillStyle = 'rgba(70,45,20,0.18)'; ctx.fillRect(0, 0, S, 4); ctx.fillRect(0, S - 4, S, 4); ctx.fillRect(0, 0, 4, S); ctx.fillRect(S - 4, 0, 4, S);
  if (which === 'top') {
    // The flaps meet along the carton's length, and a strip of brown tape runs along the seam with
    // a short cross piece at each end. Canvas x is the carton's own x on the lid.
    ctx.fillStyle = 'rgba(60,40,18,0.55)'; ctx.fillRect(0, S / 2 - 2, S, 4);
    ctx.fillStyle = 'rgba(60,40,18,0.25)'; ctx.fillRect(S / 2 - 1, 0, 2, S);
    ctx.fillStyle = '#7a5530'; ctx.fillRect(0, S / 2 - 22, S, 44);
    ctx.fillStyle = 'rgba(255,230,190,0.16)'; ctx.fillRect(0, S / 2 - 18, S, 8);
    ctx.fillStyle = '#7a5530'; ctx.fillRect(14, 20, 30, 216); ctx.fillRect(S - 44, 20, 30, 216);
    ctx.fillStyle = 'rgba(255,230,190,0.14)'; ctx.fillRect(18, 20, 6, 216); ctx.fillRect(S - 40, 20, 6, 216);
  } else if (which === 'side') {
    // A shipping label, its barcode and two lines of print, and the arrows mark to the right.
    ctx.fillStyle = '#e9e4d6'; ctx.fillRect(22, 40, 128, 92);
    ctx.fillStyle = '#17334f'; ctx.fillRect(22, 40, 128, 14);
    ctx.fillStyle = '#1b1b1b';
    let x = 30; while (x < 140) { const w = 1 + Math.floor(r() * 3); ctx.fillRect(x, 96, w, 28); x += w + 1 + Math.floor(r() * 3); }
    for (let i = 0; i < 3; i++) ctx.fillRect(30, 62 + i * 10, 40 + r() * 60, 4);
    ctx.fillStyle = 'rgba(30,22,12,0.7)';
    ctx.beginPath(); ctx.moveTo(200, 52); ctx.lineTo(222, 84); ctx.lineTo(208, 84); ctx.lineTo(208, 118); ctx.lineTo(192, 118); ctx.lineTo(192, 84); ctx.lineTo(178, 84); ctx.closePath(); ctx.fill();
    ctx.fillRect(176, 126, 48, 4);
    ctx.font = '600 13px Michroma, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('FRAGILE', 86, 150);
    ctx.fillText('THIS WAY UP', 200, 150);
  }
  return own(c);
}

/**
 * The LABS TERRAGROUP wall stencil, as the reference paints it on the server hall's wall: the Labs
 * mark, the word large beside it, and the company name set under that in a smaller face. Dark
 * paint, worn, on one plane. Origin at the centre of the plane, facing +z. One draw call.
 */
function labsStencil(w: number, h: number): THREE.Mesh {
  const W = 1024, H = Math.round((W * h) / w);
  const [c, ctx] = canvas(W, H);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1b2833'; ctx.globalAlpha = 0.82;
  // The mark: two chevrons stacked into an arrow, the way the reference cuts it.
  const mx = 150, my = H * 0.5, s = H * 0.36;
  for (const dy of [-s * 0.42, s * 0.18]) {
    ctx.beginPath(); ctx.moveTo(mx - s * 0.5, my + dy + s * 0.5); ctx.lineTo(mx, my + dy); ctx.lineTo(mx + s * 0.5, my + dy + s * 0.5);
    ctx.lineTo(mx + s * 0.5, my + dy + s * 0.28); ctx.lineTo(mx, my + dy - s * 0.22); ctx.lineTo(mx - s * 0.5, my + dy + s * 0.28); ctx.closePath(); ctx.fill();
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `600 ${Math.round(H * 0.5)}px Michroma, system-ui, sans-serif`;
  ctx.fillText('LABS', 290, H * 0.6);
  ctx.font = `600 ${Math.round(H * 0.15)}px Michroma, system-ui, sans-serif`;
  const word = 'TERRAGROUP'; let x = 296;
  for (const ch of word) { ctx.fillText(ch, x, H * 0.85); x += ctx.measureText(ch).width + H * 0.035; }
  ctx.globalAlpha = 1;
  // Wear: flecks knocked out of the paint, and a band scuffed along the bottom where things leaned.
  const r = rng(21);
  for (let i = 0; i < 900; i++) ctx.clearRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 3);
  for (let i = 0; i < 40; i++) ctx.clearRect(r() * W, H * 0.7 + r() * H * 0.3, 2 + r() * 14, 1);
  const map = own(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }));
  m.name = 'stencil';
  return m;
}

/** A line of lettering on a clear ground. The strobe's label. */
function stencilCanvas(text: string, w: number, h: number, color: string, font: string): THREE.CanvasTexture {
  const [c, ctx] = canvas(w, h);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = color; ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2);
  return own(c);
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
