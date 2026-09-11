import * as THREE from 'three';
import { merged } from '../../merge';
import { LABS } from '../../labs/materials';

/**
 * The three products on the dispatch office plinths. Each is built at exhibition scale, four to
 * six times life size, because the plinths are a metre across and the camera holds three metres
 * off: at life size all three were thumbnails, and Jordan could not tell what any of them were.
 *
 * Every builder returns a group with its origin at the plinth top, its face up before any rake,
 * and +z toward the camera. The office rotates the group into the room. Nothing in here touches
 * the asset store, so the shapes can be measured in a unit test.
 */

const shell = (color: number, roughness = 0.5, metalness = 0.3) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const acrylic = () => new THREE.MeshPhysicalMaterial({ color: LABS.glassTint, transparent: true, opacity: 0.26, roughness: 0.08, metalness: 0 });

/** How far a raked product face leans toward the camera, from vertical. Steep, because the camera
 *  stands only a little above the plinths and a shallow rake showed each face edge on. */
const RAKE = 0.95;

/**
 * A clear acrylic display stand for a product that leans back at RAKE. `tilt` is the raked group
 * with the product's face on its y 0 plane and its pivot `pivot` above the cap. The rail goes into
 * that group, `back` below the face so it sits flush behind the product, and runs from `from` to
 * where the raked plane meets the cap, so its foot rests on the base plate rather than floating.
 */
function stand(g: THREE.Group, tilt: THREE.Group, pivot: number, opts: { w: number; back: number; from: number }): void {
  const foot = (pivot - opts.back * Math.cos(RAKE)) / Math.sin(RAKE);
  // The rail stops a centimetre and a half short of the foot, or its lower corner cuts the cap.
  const end = foot - 0.015;
  const rail = new THREE.Mesh(new THREE.BoxGeometry(opts.w, 0.012, end - opts.from), acrylic());
  rail.position.set(0, -opts.back - 0.006, (end + opts.from) / 2); tilt.add(rail);
  const base = new THREE.Mesh(new THREE.BoxGeometry(opts.w + 0.1, 0.012, foot * Math.cos(RAKE) + 0.16), acrylic());
  base.position.set(0, 0.006, (foot * Math.cos(RAKE)) / 2 - 0.02); g.add(base);
}

/**
 * conch.gg: a GameCube controller, the Sketchfab model conch.gg itself ships (CoryRichards,
 * CC BY 4.0, credited on the page and in assets/CREDITS.md). `model` is the store's clone. It
 * arrives at the author's scale, so it is fitted to WIDTH across, its face laid on the raked
 * group's y 0 plane, then leaned back toward the camera. A real controller rests on its grip ends
 * and its shoulder humps, both about as deep, so the shell cannot lean on a rail the way the key
 * does: leaned back it stands on its grips with a matte riser under the shoulders, the way a shop
 * props one.
 */
export function controller(model: THREE.Object3D): THREE.Group {
  const WIDTH = 0.66, LEAN = 0.45;
  const g = new THREE.Group();
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const s = WIDTH / (box.max.x - box.min.x);
  model.scale.multiplyScalar(s);
  model.position.set(-(box.min.x + box.max.x) / 2 * s, -box.max.y * s, -(box.min.z + box.max.z) / 2 * s);
  const thick = (box.max.y - box.min.y) * s, half = (box.max.z - box.min.z) / 2 * s;
  // The lowest point after the lean is the front bottom corner of the box, so the pivot lifts it
  // to the cap. The real grips sit a touch inside that corner, which is a millimetre or two of air.
  const pivot = thick * Math.cos(LEAN) + half * Math.sin(LEAN) + 0.002;
  const tilt = new THREE.Group(); tilt.rotation.x = LEAN; tilt.position.y = pivot; tilt.add(model); g.add(tilt);
  const riser = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.14), shell(0x1b2129, 0.7, 0.2));
  riser.position.set(0, 0.07, -0.23); g.add(riser);
  // The cable, off the top of the shell and away across the cap short of the label plate.
  const top = new THREE.Vector3(0, 0, -half).applyAxisAngle(new THREE.Vector3(1, 0, 0), LEAN).add(new THREE.Vector3(0, pivot, 0));
  const end = new THREE.Vector3(0, 0.012, -0.36);
  const run = end.clone().sub(top), len = run.length();
  const lead = new THREE.CylinderGeometry(0.009, 0.009, len, 8);
  lead.rotateX(Math.atan2(run.z, run.y));
  const cable = new THREE.Mesh(lead, shell(0x9aa4ac, 0.7, 0.1)); cable.position.copy(top.clone().add(end).multiplyScalar(0.5)); g.add(cable);
  const curl = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.009, 6, 18, Math.PI * 1.45).rotateX(Math.PI / 2), shell(0x9aa4ac, 0.7, 0.1));
  curl.position.set(0.06, 0.012, -0.4); g.add(curl);
  return g;
}

/**
 * ezkey.io: a key store, so a key. Brushed steel, a round bow with the product's cyan lit through
 * it, a long shaft and three bits standing up off it. It lies on its side across the cap, leaning
 * back a little on the stand, because the classic silhouette is the side view: stood on end and
 * raked toward the eye it read as a lollipop and hid its own label.
 */
export function key(): THREE.Group {
  const g = new THREE.Group();
  const LEAN = 0.6, PIVOT = 0.15;
  const tilt = new THREE.Group(); tilt.rotation.x = LEAN; tilt.position.y = PIVOT; g.add(tilt);
  const steel = [
    new THREE.TorusGeometry(0.105, 0.03, 10, 28).translate(-0.22, 0, 0),
    new THREE.BoxGeometry(0.5, 0.06, 0.03).translate(0.11, 0, 0),
    new THREE.BoxGeometry(0.06, 0.04, 0.03).translate(0.38, 0, 0),
    new THREE.BoxGeometry(0.045, 0.075, 0.03).translate(0.13, 0.06, 0),
    new THREE.BoxGeometry(0.045, 0.09, 0.03).translate(0.215, 0.068, 0),
    new THREE.BoxGeometry(0.045, 0.065, 0.03).translate(0.3, 0.055, 0),
  ];
  tilt.add(merged(steel, shell(0xd6dde2, 0.3, 0.8)));
  const inlay = new THREE.Mesh(new THREE.CircleGeometry(0.08, 24), new THREE.MeshStandardMaterial({ color: 0x06131a, emissive: 0x6ec1d6, emissiveIntensity: 1.8, side: THREE.DoubleSide }));
  inlay.position.set(-0.22, 0, 0); tilt.add(inlay);
  // Its own stand: the key's plane is upright, so the rail is a clear sheet behind it.
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.3, 0.012), acrylic()); rail.position.set(0.05, 0.02, -0.024); tilt.add(rail);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.012, 0.28), acrylic()); base.position.set(0.05, 0.006, 0.04); g.add(base);
  return g;
}

/**
 * gc-bridge: a bridge. A scale model suspension bridge spanning the plinth, towers and deck in the
 * console's indigo, main cables hung between the tower tops in a parabola with a hanger every six
 * centimetres, and concrete abutments at each end. The adapter box it replaces read as a network
 * switch twice over. Five draw calls.
 */
export function bridge(): THREE.Group {
  const g = new THREE.Group();
  const HALF = 0.62, TX = 0.33, TH = 0.44, DECK = 0.12, SAG = 0.26, W = 0.15;
  const indigo = shell(0x46398f, 0.45, 0.1);
  // Towers: two legs each with a cross beam at the top and one under the deck, on a pier block.
  const towers: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) towers.push(new THREE.BoxGeometry(0.03, TH, 0.03).translate(sx * TX, TH / 2, sz * (W / 2 + 0.005)));
    towers.push(new THREE.BoxGeometry(0.03, 0.025, W + 0.04).translate(sx * TX, TH - 0.0125, 0));
    towers.push(new THREE.BoxGeometry(0.03, 0.02, W + 0.04).translate(sx * TX, TH * 0.68, 0));
    towers.push(new THREE.BoxGeometry(0.03, 0.02, W + 0.04).translate(sx * TX, DECK - 0.03, 0));
  }
  g.add(merged(towers, indigo));
  // The deck: a slab with a kerb down each side, carried the full span between the abutments.
  const deck = [
    new THREE.BoxGeometry(HALF * 2, 0.018, W).translate(0, DECK, 0),
    new THREE.BoxGeometry(HALF * 2, 0.014, 0.012).translate(0, DECK + 0.016, W / 2 - 0.006),
    new THREE.BoxGeometry(HALF * 2, 0.014, 0.012).translate(0, DECK + 0.016, -(W / 2 - 0.006)),
  ];
  g.add(merged(deck, shell(0x2f2a5e, 0.6, 0.1)));
  // Main cables: from the anchor at each end up to the tower top, then a parabola to the far tower.
  const cableY = (x: number) => Math.abs(x) >= TX
    ? TH - ((Math.abs(x) - TX) / (HALF - TX)) * (TH - 0.03)
    : TH - SAG * (1 - (x / TX) ** 2);
  const cables: THREE.BufferGeometry[] = [];
  const hangers: THREE.BufferGeometry[] = [];
  for (const sz of [-1, 1]) {
    const pts: THREE.Vector3[] = [];
    for (let x = -HALF; x <= HALF + 1e-6; x += 0.02) pts.push(new THREE.Vector3(x, cableY(x), sz * (W / 2 + 0.005)));
    cables.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 96, 0.005, 6, false));
    for (let x = -TX + 0.06; x < TX - 0.03; x += 0.06) {
      const top = cableY(x), h = top - DECK;
      hangers.push(new THREE.CylinderGeometry(0.002, 0.002, h, 4).translate(x, DECK + h / 2, sz * (W / 2 + 0.005)));
    }
  }
  g.add(merged(cables, shell(0xc0c8ce, 0.4, 0.7)));
  g.add(merged(hangers, shell(0xc0c8ce, 0.4, 0.7)));
  // Abutments and piers: concrete blocks the deck lands on and the towers stand on.
  const blocks = [
    new THREE.BoxGeometry(0.1, DECK - 0.009, W + 0.06).translate(-HALF + 0.05, (DECK - 0.009) / 2, 0),
    new THREE.BoxGeometry(0.1, DECK - 0.009, W + 0.06).translate(HALF - 0.05, (DECK - 0.009) / 2, 0),
    new THREE.BoxGeometry(0.08, 0.05, W + 0.08).translate(-TX, 0.025, 0),
    new THREE.BoxGeometry(0.08, 0.05, W + 0.08).translate(TX, 0.025, 0),
  ];
  g.add(merged(blocks, shell(0x8f9aa2, 0.85, 0.05)));
  return g;
}
