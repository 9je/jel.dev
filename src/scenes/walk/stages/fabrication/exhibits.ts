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
function stand(g: THREE.Group, tilt: THREE.Group, pivot: number, opts: { w: number; back: number; from: number }, rake = RAKE): void {
  const foot = (pivot - opts.back * Math.cos(rake)) / Math.sin(rake);
  // The rail stops a centimetre and a half short of the foot, or its lower corner cuts the cap.
  const end = foot - 0.015;
  const rail = new THREE.Mesh(new THREE.BoxGeometry(opts.w, 0.012, end - opts.from), acrylic());
  rail.position.set(0, -opts.back - 0.006, (end + opts.from) / 2); tilt.add(rail);
  const base = new THREE.Mesh(new THREE.BoxGeometry(opts.w + 0.1, 0.012, foot * Math.cos(rake) + 0.16), acrylic());
  base.position.set(0, 0.006, (foot * Math.cos(rake)) / 2 - 0.02); g.add(base);
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
 * earworm.games: a cassette, five times life size.
 *
 * Two things were wrong with the first build and both came from the same place. It stood on the
 * shared RAKE, 54 degrees up from flat, which is right for a controller resting on its grips and
 * wrong for a flat object whose whole content is on one face: at three metres the face was so
 * foreshortened that the tape read as a wedge, which is Jordan's "idek what that object is". And
 * the label was a separate plate floating a centimetre above the shell, so the one part that did
 * read looked stuck on rather than printed. It stands near upright now, and everything on the face
 * is printed into one texture.
 *
 * That texture carries the shell, the label, the window, the tape packs behind it, the hub teeth,
 * the screw wells and the capstan openings along the bottom edge. Drawing the spools as geometry
 * was the other half of the problem: real cylinders cannot be cropped by the window the way a tape
 * pack is, so they stood proud of it as two grey discs. A cassette's window shows a slice of a pack
 * that is taller than the opening, and a canvas can draw exactly that. Three draw calls.
 */
const CASSETTE_RAKE = 1.32;

export function cassette(): THREE.Group {
  const W = 0.9, D = 0.56, T = 0.09;
  const g = new THREE.Group();
  const pivot = T * Math.cos(CASSETTE_RAKE) + (D / 2) * Math.sin(CASSETTE_RAKE) + 0.002;
  const tilt = new THREE.Group(); tilt.rotation.x = CASSETTE_RAKE; tilt.position.y = pivot; g.add(tilt);

  // The shell: one box, its face carrying the print. The edges are the moulded seam a cassette has
  // all the way round, so the body is a touch proud of the face plate on every side.
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, T, D), shell(0x1b2128, 0.62, 0.12));
  body.position.y = -T / 2; tilt.add(body);

  const map = cassetteFace();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.016, D - 0.016).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({
    map, roughness: 0.82, metalness: 0.04, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.16,
  }));
  face.position.y = 0.002; tilt.add(face);

  // The five screws, in relief. The only thing left as geometry: a screw head is 3 mm proud and it
  // is the grazing highlight off those heads that says the shell is plastic rather than printed.
  const screws: THREE.BufferGeometry[] = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1]] as [number, number][]) {
    screws.push(new THREE.CylinderGeometry(0.015, 0.015, 0.008, 10).translate(sx * 0.4, 0.005, sz * 0.245));
  }
  tilt.add(merged(screws, shell(0x8f979d, 0.45, 0.6)));

  stand(g, tilt, pivot, { w: W + 0.06, back: T + 0.01, from: -D / 2 }, CASSETTE_RAKE);
  return g;
}

/**
 * The whole front of the cassette on one canvas, 1024 by 640 for a face 0.884 by 0.544. The canvas
 * top is the tape's top: the plane is laid flat with `rotateX(-PI/2)`, which sends v 1 to -z, and
 * -z is the high edge once the group is raked back.
 */
function cassetteFace(): THREE.CanvasTexture {
  const W = 1024, H = 640;
  const [c, ctx] = canvas(W, H);
  const round = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  };

  // The shell, lit from the top edge the way a raked object in a lit case is.
  const ground = ctx.createLinearGradient(0, 0, 0, H);
  ground.addColorStop(0, '#2b333c'); ground.addColorStop(0.5, '#222931'); ground.addColorStop(1, '#161b21');
  ctx.fillStyle = ground; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(190,206,220,0.16)'; ctx.fillRect(0, 0, W, 5);
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, H - 6, W, 6);

  // The label, printed on. Its shadow goes down and right, which is where the shell's own shading
  // puts the light, so the card sits in the tape rather than over it.
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; round(46, 42, 940, 262, 5); ctx.fill();
  ctx.fillStyle = '#e9e4d6'; round(40, 36, 940, 262, 5); ctx.fill();
  ctx.fillStyle = '#8b5fc4'; ctx.fillRect(40, 36, 940, 38);
  ctx.fillStyle = '#1b2530'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.font = '600 84px Michroma, system-ui, sans-serif';
  ctx.fillText('earworm', W / 2, 146);
  ctx.font = '600 34px Michroma, system-ui, sans-serif'; ctx.fillStyle = '#5b6770';
  ctx.fillText('.GAMES', W / 2, 198);
  ctx.strokeStyle = 'rgba(27,37,48,0.3)'; ctx.lineWidth = 2;
  for (const y of [240, 272]) { ctx.beginPath(); ctx.moveTo(78, y); ctx.lineTo(W - 78, y); ctx.stroke(); }
  ctx.fillStyle = '#1b2530'; ctx.font = '600 24px Michroma, system-ui, sans-serif';
  ctx.textAlign = 'left'; ctx.fillText('SIDE A', 84, 228);
  ctx.textAlign = 'right'; ctx.fillText('0.1 SEC', W - 84, 228);

  // The window, and the tape behind it. The packs are drawn full size and clipped to the opening,
  // which is the whole reason this is a canvas: the left one is wound fuller than the right, and a
  // cassette that has been played is the only kind anybody owns.
  const win = { x: 188, y: 320, w: 648, h: 196, r: 14 };
  ctx.save();
  round(win.x, win.y, win.w, win.h, win.r); ctx.clip();
  ctx.fillStyle = '#0a0e12'; ctx.fillRect(win.x, win.y, win.w, win.h);
  for (const [cx, rad] of [[286, 152], [738, 104]] as [number, number][]) {
    const pack = ctx.createRadialGradient(cx - rad * 0.3, 418 - rad * 0.3, rad * 0.1, cx, 418, rad);
    pack.addColorStop(0, '#4a4036'); pack.addColorStop(0.7, '#2a241d'); pack.addColorStop(1, '#151210');
    ctx.fillStyle = pack; ctx.beginPath(); ctx.arc(cx, 418, rad, 0, Math.PI * 2); ctx.fill();
    // The wind, as rings. A pack of tape is a spiral and at this size the spiral is rings.
    ctx.strokeStyle = 'rgba(180,160,130,0.10)'; ctx.lineWidth = 2;
    for (let t = rad; t > 62; t -= 7) { ctx.beginPath(); ctx.arc(cx, 418, t, 0, Math.PI * 2); ctx.stroke(); }
    // The hub through the middle: a pale ring with six teeth.
    ctx.fillStyle = '#b8c0c6'; ctx.beginPath(); ctx.arc(cx, 418, 58, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0a0e12'; ctx.beginPath(); ctx.arc(cx, 418, 40, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8f979d';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 49, 418 + Math.sin(a) * 49, 9, 0, Math.PI * 2); ctx.fill();
    }
  }
  // The span of tape between the two packs, and the glass over the lot.
  ctx.fillStyle = '#1d1913'; ctx.fillRect(286, 404, 452, 5);
  const sheen = ctx.createLinearGradient(win.x, win.y, win.x + win.w * 0.7, win.y + win.h);
  sheen.addColorStop(0, 'rgba(226,240,248,0.18)'); sheen.addColorStop(0.45, 'rgba(226,240,248,0.03)'); sheen.addColorStop(1, 'rgba(226,240,248,0)');
  ctx.fillStyle = sheen; ctx.fillRect(win.x, win.y, win.w, win.h);
  ctx.restore();
  // The moulded lip around the opening: light on the top edge, dark on the bottom.
  ctx.strokeStyle = 'rgba(8,11,14,0.9)'; ctx.lineWidth = 6; round(win.x, win.y, win.w, win.h, win.r); ctx.stroke();
  ctx.strokeStyle = 'rgba(190,206,220,0.18)'; ctx.lineWidth = 2; round(win.x - 3, win.y - 3, win.w + 6, win.h + 6, win.r + 3); ctx.stroke();

  // The openings along the bottom edge: two capstan holes with the pressure pad slot between them.
  // This row is the single most recognisable thing about the object and the first build had none
  // of it.
  ctx.fillStyle = '#080b0e';
  round(246, 556, 74, 58, 6); ctx.fill();
  round(704, 556, 74, 58, 6); ctx.fill();
  round(430, 548, 164, 66, 8); ctx.fill();
  ctx.fillStyle = '#3a3128'; ctx.fillRect(448, 566, 128, 30);
  ctx.fillStyle = 'rgba(190,206,220,0.1)'; ctx.fillRect(430, 546, 164, 2);

  // The screw wells the five heads sit in, and the moulded name along the bottom.
  ctx.fillStyle = '#0d1116';
  for (const [x, y] of [[46, 46], [978, 46], [46, 594], [978, 594], [512, 620]] as [number, number][]) {
    ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(190,206,220,0.22)'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = '600 18px Michroma, system-ui, sans-serif';
  ctx.fillText('EARWORM.GAMES', 96, 588);
  ctx.textAlign = 'right'; ctx.fillText('TYPE I  NORMAL', W - 96, 588);

  const t = own(c); t.anisotropy = 8; return t;
}

