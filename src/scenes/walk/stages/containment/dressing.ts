import * as THREE from 'three';
import type { Hotspot, StageContext } from '../types';
import { grounded, merged, place, type Spot } from '../../merge';
import { papers } from '../../labs/props';
import { cabinetBank, fallenTiles, switchCabinet, wallPanel } from '../../labs/plant';
import { labSteel } from '../../labs/materials';
import { signBox, tapeCross } from '../../labs/signage';
import { chainlink, redactedSheet } from '../../labs/textures';
import { X1, Z1, AISLE_CLEAR, BANK, HALL_DOOR, ISLANDS, MISSING, SEALED, TABLE } from './layout';
import { holeAt } from './shell';

/** What the room animates: the seam of red around the sealed door. */
export interface Dressing { hotspots: Hotspot[]; pulse: THREE.MeshStandardMaterial[] }

/** Terragroup's switchgear green, off the reference. */
const GREEN = 0x3a5a4a;
/** The door's red, which is the only red in the room. */
const RED = 0xd7383a;
/** Table top height, which is also what the lamp and the page are set from. */
const TOP = 0.75;

/**
 * The switchgear room. Cold, low, and almost entirely grey green: four islands of cabinets down a
 * taped aisle, a cream control bank the length of the west wall, and a ceiling with tiles missing
 * out of it.
 *
 * One warm thing in it. A steel table halfway up the aisle with a desk lamp on it and the first
 * disclosure lying under the lamp, five of its eight lines struck out and PENDING RELEASE stamped
 * across it, with the red seam of the sealed door glowing twelve metres beyond. Everything else in
 * here is deliberately quiet so those two things are the only places the eye lands.
 */
export async function buildDressing(ctx: StageContext, root: THREE.Group): Promise<Dressing> {
  const { store, anchors, pace } = ctx;
  const add = async (o: THREE.Object3D) => { root.add(o); await pace(); };
  const prop = (key: string) => grounded(store.model(key));
  const hotspots: Hotspot[] = [];
  const AISLE_X = HALL_DOOR.x;
  const pulse: THREE.MeshStandardMaterial[] = [];

  // ---- The islands ----------------------------------------------------------------------------
  // Three cabinets to an island, shoulder to shoulder along x with their doors to the south, which
  // is the face the walk arrives at. Four islands down the west side of the aisle, all of them well
  // outside the 2.2 m of clearance either side of the walked line, with the cream bank facing them
  // across it.
  const ISLAND_HALF = 0.92 * 1.5;
  for (const [n, [x, z]] of ISLANDS.entries()) {
    // Pushed off the walked line if the layout ever moves one in: three bays of 0.92 need their own
    // half width on top of the clearance, and a cabinet inside that is a cabinet walked through.
    const side = Math.sign(x - AISLE_X) || 1;
    const reach = AISLE_CLEAR + ISLAND_HALF;
    const cx = Math.abs(x - AISLE_X) < reach ? AISLE_X + side * reach : x;
    for (let i = 0; i < 3; i++) {
      // One door standing open, on the middle cabinet of the third island: the breakers behind it
      // are the only machinery in the room anyone actually gets to see, and the third island is the
      // one that stands clear of the flagship panel at the hold.
      const open = n === 2 && i === 1;
      const cab = switchCabinet({ w: 0.9, h: 2.2, color: GREEN, open, label: open ? 'ISOLATED' : undefined });
      await add(place(cab, cx + (i - 1) * 0.92, 0, z, Math.PI));
    }
  }

  // The cream bank down the east side of the aisle, faced west at the islands (ref 17). Blue band
  // at 1.6 m, a block letter on every third bay, and the only warm neutral in a room of grey green.
  // Turned a quarter the other way from a west wall run, so its bays count up the room from the
  // doorway and its lettering reads the right way round to the walk.
  const bank = place(cabinetBank(BANK.z1 - BANK.z0), BANK.x, 0, (BANK.z0 + BANK.z1) / 2, -Math.PI / 2);
  bank.name = 'control-bank';
  await add(bank);

  // ---- The table ------------------------------------------------------------------------------
  // The exhibit. One group, so the pointer picks the table, the lamp and the page as one thing.
  const table = new THREE.Group(); table.name = 'disclosure-table';
  const legs: THREE.BufferGeometry[] = [];
  for (const dx of [-0.52, 0.52]) for (const dz of [-0.27, 0.27]) {
    const leg = new THREE.BoxGeometry(0.05, TOP - 0.02, 0.05);
    leg.translate(TABLE.x + dx, (TOP - 0.02) / 2, TABLE.z + dz);
    legs.push(leg);
  }
  table.add(merged(legs, labSteel(0x6f7a82)));
  // Painted, not polished. `labSteel` is 0.7 metal, and a metal top 0.3 m under a warm point blows
  // to white specular: the page lying on it is an unlit cream canvas, and against a white top there
  // was nothing left of it to read.
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.7), new THREE.MeshStandardMaterial({ color: 0x4a545c, roughness: 0.72, metalness: 0.12 }));
  top.position.set(TABLE.x, TOP, TABLE.z); table.add(top);

  // The page, and a second sheet slid out from under it. Lit, not unlit: an unlit sheet holds the
  // contrast the canvas was drawn at, which sounds right and is not, because the table under it is
  // lit and at the lamp's distance the steel came out brighter than the paper. Lit paper against a
  // painted top is a card three times the value of what it lies on, which is how a page reads.
  const sheet = (tex: THREE.Texture, x: number, z: number, ry: number, y: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.297), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = ry; m.position.set(x, y, z);
    return m;
  };
  const page = redactedSheet();
  table.add(sheet(page, -80.72, 12.0, 0.12, TOP + 0.023));
  table.add(sheet(page, -80.58, 12.1, -0.34, TOP + 0.022));
  await add(table);

  // The lamp stands at the back corner of the table with its head over the page. Its bulb is the
  // room's one warm light, declared in lighting.ts at the head's own position.
  const lamp = store.model('desk_lamp');
  lamp.position.set(-81.05, TOP + 0.02, 11.78); lamp.rotation.y = -0.9;
  await add(lamp);

  // The panel hangs on the far side of the table, over the west islands. The walk looks north here
  // and the camera's own right hand is the room's west, so an anchor west of the aim is a panel to
  // the right of the frame: at -79.9, half a metre east of the table, the copy landed dead centre of
  // the shot and covered the lamp, the page and the sealed door all three.
  anchors.set('bug-bounty-1', new THREE.Vector3(-82.4, 1.5, 12.4));
  anchors.set('containment', new THREE.Vector3(-79, 1.8, 10));
  hotspots.push({ id: 'bug-bounty-1', kind: 'project', label: 'First disclosure', object: table, stop: 'containment' });

  // ---- The sealed bay -------------------------------------------------------------------------
  // A steel door in the north wall with the light on behind it, taped shut, and a lit sign over it
  // saying why. The seam under the door and the wired glass both pulse, slowly, in update().
  const sealed = new THREE.Group(); sealed.name = 'sealed-door';
  sealed.position.set(SEALED.x, 0, Z1);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(SEALED.w, SEALED.h, 0.08), labSteel(0x4a545c));
  leaf.position.y = SEALED.h / 2; sealed.add(leaf);

  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a0a0b, emissive: RED, emissiveIntensity: 0.8 });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.5), glassMat);
  glass.rotation.y = Math.PI; glass.position.set(0, 1.72, -0.045); sealed.add(glass);
  // The wire in the wired glass: the cage mesh at a third opacity, over the lit pane.
  const wire = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.5), new THREE.MeshBasicMaterial({
    color: 0x1b1214, alphaMap: (() => { const t = chainlink(128); t.repeat.set(2, 2.5); return t; })(),
    transparent: true, opacity: 0.3, depthWrite: false,
  }));
  wire.rotation.y = Math.PI; wire.position.set(0, 1.72, -0.05); sealed.add(wire);

  const seamMat = new THREE.MeshStandardMaterial({ color: 0x1a0a0b, emissive: RED, emissiveIntensity: 3 });
  const seam = new THREE.Mesh(new THREE.BoxGeometry(SEALED.w, 0.02, 0.05), seamMat);
  seam.position.set(0, 0.02, -0.06); sealed.add(seam);
  pulse.push(glassMat, seamMat);

  const sign = signBox('SEALED UNTIL DISCLOSURE', { w: 1.4, h: 0.28, accent: RED, on: true });
  sign.rotation.y = Math.PI; sign.position.set(0, SEALED.h + 0.35, -0.1); sealed.add(sign);
  const tape = tapeCross(SEALED.w + 0.3, SEALED.h);
  tape.rotation.y = Math.PI; tape.position.z = -0.14; sealed.add(tape);
  await add(sealed);

  // ---- The practice range ---------------------------------------------------------------------
  // A panel with a lit sign over it, on the strip of north wall between the sealed bay and the
  // control room's glass. It was drawn on the east wall at z 22, and from the aisle the east wall
  // is never once seen: the two east islands stand 2.2 m tall in front of it for the whole length
  // of the room, and everything below their tops is behind them from every point on the walk. On
  // the north wall it is in shot from the doorway on, which is what a hotspot needs, and the pair
  // reads the way the room's copy does: the bay that is sealed, and the one that is not.
  const range = new THREE.Group(); range.name = 'practice-range';
  const panel = wallPanel(0.9, 1.3);
  panel.rotation.y = Math.PI; panel.position.set(-78.1, 1.85, Z1 - 0.07); range.add(panel);
  const rangeSign = signBox('PRACTICE RANGE', { w: 0.9, h: 0.2, on: true });
  rangeSign.rotation.y = Math.PI; rangeSign.position.set(-78.1, 2.72, Z1 - 0.09); range.add(rangeSign);
  await add(range);
  anchors.set('pentest-practice', new THREE.Vector3(-78.1, 2.0, Z1 - 0.3));
  hotspots.push({ id: 'pentest-practice', kind: 'project', label: 'Practice range', object: range, stop: 'containment' });

  // ---- The services and the mess --------------------------------------------------------------
  const box = store.model('utility_box_2'); box.position.set(X1 - 0.08, 1.6, 24); box.rotation.y = -Math.PI / 2;
  await add(box);
  const alarm = store.model('fire_alarm'); alarm.position.set(X1 - 0.08, 2.1, 24.9); alarm.rotation.y = -Math.PI / 2;
  await add(alarm);
  // The generator is parked past the bank's north end, by the office door, rather than in the south
  // east corner it was drawn in. From the walked line the corner is 58 degrees off the heading and
  // out of every frame the room is ever seen in, and a quarter megabyte of model nobody sees is
  // worse than no model. Here the sightline to it clears the end of the bank by half a metre.
  await add(place(prop('generator'), -74.8, 0, 22.5, -0.7));

  // The tiles that came down, on the floor under the gaps they came out of.
  const spots: Spot[] = [];
  for (const [i, j] of MISSING) {
    const [x, z] = holeAt(i, j);
    // Not directly under the hole: a tile that drops out of a grid slides. Each lands a little
    // south and to one side of its own gap, on its own lie.
    spots.push([x + (j % 2 ? 0.7 : -0.8), 0.02, z - 0.9 - (i % 3) * 0.4, (i + j) * 0.7]);
  }
  await add(fallenTiles(spots));

  await add(papers([
    [-81.9, 0, 10.4, 0.4], [-78.3, 0, 13.6, 1.7], [-76.4, 0, 18.9, 0.9],
    [-82.6, 0, 19.8, 2.2], [-79.6, 0, 23.4, 1.2],
  ]));

  return { hotspots, pulse };
}
