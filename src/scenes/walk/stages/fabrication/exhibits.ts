import * as THREE from 'three';
import { merged } from '../../merge';
import { LABS } from '../../labs/materials';
import { canvas, own } from '../../labs/textures';

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
 * earworm.games: a cassette. The product is a web page, so the exhibit is the thing the game is
 * made of rather than the thing it runs on: a tape at five times life size, leaned back on the
 * stand with its label facing the camera. Hubs, spools wound to different diameters, the window
 * between them and the screws in the corners are what makes a shape this plain read as a cassette
 * at three metres. Four draw calls and one printed label.
 */
export function cassette(): THREE.Group {
  const W = 0.9, D = 0.56, T = 0.09;
  const g = new THREE.Group();
  const pivot = T * Math.cos(RAKE) + (D / 2) * Math.sin(RAKE) + 0.002;
  const tilt = new THREE.Group(); tilt.rotation.x = RAKE; tilt.position.y = pivot; g.add(tilt);

  // The shell, with the two flats either side of the window that a cassette has.
  tilt.add(merged([
    new THREE.BoxGeometry(W, T, D).translate(0, -T / 2, 0),
    new THREE.BoxGeometry(W - 0.06, 0.012, D - 0.06).translate(0, 0.004, 0),
  ], shell(0x20262d, 0.62, 0.12)));

  // Hubs and spools. Two teeth rings, the left wound fuller than the right, which is the detail
  // that says a tape has been played rather than pressed.
  const hubs: THREE.BufferGeometry[] = [];
  const tape: THREE.BufferGeometry[] = [];
  for (const [sx, r] of [[-1, 0.125], [1, 0.082]] as [number, number][]) {
    hubs.push(new THREE.CylinderGeometry(0.048, 0.048, 0.02, 16).translate(sx * 0.2, 0.006, 0.07));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      hubs.push(new THREE.BoxGeometry(0.016, 0.024, 0.02).translate(sx * 0.2 + Math.cos(a) * 0.04, 0.008, 0.07 + Math.sin(a) * 0.04));
    }
    tape.push(new THREE.CylinderGeometry(r, r, 0.016, 28).translate(sx * 0.2, 0.002, 0.07));
  }
  tilt.add(merged(tape, shell(0x14181d, 0.85, 0.05)));
  tilt.add(merged(hubs, shell(0xb8c0c6, 0.4, 0.5)));

  // The window over the spools, and five screws.
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.01, 0.2), acrylic());
  win.position.set(0, 0.012, 0.07); tilt.add(win);
  const screws: THREE.BufferGeometry[] = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1]] as [number, number][]) {
    screws.push(new THREE.CylinderGeometry(0.014, 0.014, 0.014, 8).translate(sx * 0.4, 0.006, sz * 0.24));
  }
  tilt.add(merged(screws, shell(0x8f979d, 0.45, 0.6)));

  // The label, in the upper half where a cassette carries one.
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.26), new THREE.MeshStandardMaterial({
    map: cassetteLabel(), roughness: 0.85, emissive: 0xffffff, emissiveMap: cassetteLabel(), emissiveIntensity: 0.18,
  }));
  label.rotation.x = -Math.PI / 2; label.position.set(0, 0.013, -0.15); tilt.add(label);

  stand(g, tilt, pivot, { w: W + 0.06, back: T + 0.01, from: -D / 2 });
  return g;
}

/** The printed label: a stock card with the name set across it, a ruled line for a side and a run
 *  time, and the accent down the head. 768 by 256 for a plate 0.78 by 0.26. */
function cassetteLabel(): THREE.CanvasTexture {
  const W = 768, H = 256;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#e9e4d6'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#8b5fc4'; ctx.fillRect(0, 0, W, 34);
  ctx.fillStyle = 'rgba(30,36,44,0.18)'; ctx.fillRect(0, H - 6, W, 6);
  ctx.fillStyle = '#1b2530'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.font = '600 66px Michroma, system-ui, sans-serif';
  ctx.fillText('earworm', W / 2, 108);
  ctx.font = '600 30px Michroma, system-ui, sans-serif';
  ctx.fillStyle = '#5b6770'; ctx.fillText('.GAMES', W / 2, 156);
  // The two ruled lines somebody would have written on.
  ctx.strokeStyle = 'rgba(27,37,48,0.35)'; ctx.lineWidth = 2;
  for (const y of [196, 226]) { ctx.beginPath(); ctx.moveTo(48, y); ctx.lineTo(W - 48, y); ctx.stroke(); }
  ctx.textAlign = 'left'; ctx.font = '600 22px Michroma, system-ui, sans-serif'; ctx.fillStyle = '#1b2530';
  ctx.fillText('SIDE A', 54, 184);
  ctx.textAlign = 'right'; ctx.fillText('0.1 SEC', W - 54, 184);
  return own(c);
}
