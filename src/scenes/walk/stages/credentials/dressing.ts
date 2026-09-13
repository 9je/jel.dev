import * as THREE from 'three';
import type { Hotspot, StageContext } from '../types';
import { grounded, place, merged, instances, type Spot } from '../../merge';
import { papers } from '../../labs/props';
import { tripodCamera, hardCase, cableCoil, tarpWall } from '../../labs/furniture';
import { labSteel, LABS } from '../../labs/materials';
import { canvas, own, rng } from '../../labs/textures';
import { X0, X1, H, LAB, PLATE_X, PLATE_Z, PLATE_TURN } from './layout';
import certs from '../../../../content/certs.json';

/** Whatever the dressing has to clean up itself. The badge textures load out of band, so the stage
 *  has to be able to tell the dressing it is gone. */
export interface Dressing { hotspots: Hotspot[]; dispose(): void }

/** The ink on a plate: dark enough to read as print on a lit panel rather than as a second light. */
const INK = '#1e2c3a';
/** The issuer line, a step lighter than the name so the two read as a hierarchy. */
const INK_SOFT = '#4f6070';

/** One exhibit plate: the acrylic face is `w` by `h` with its centre at `y`, the badge a square of
 *  `badge` on a side centred `badgeY` up the face. The plate hangs from the lab's ceiling on two
 *  rods, so its top rail has to clear the rods' plates at `LAB.h`. */
const PLATE = { w: 1.36, h: 1.7, y: 1.8, badge: 1.0, badgeY: 2.02, lip: 0.035, deep: 0.045 };

/** The hall floor sits 6 mm over its neighbours (see the shell), so anything laid flat on it is laid
 *  flat on 0.006, not on 0. */
const HALL_FLOOR = 0.006;

/**
 * The printed face of an exhibit plate, 1024 px wide at the face's own aspect: frosted acrylic lit
 * from behind (a soft bloom behind the badge, greyer toward the edges, a fine grain), the Labs
 * band across its head with the plate's number, the name in tracked Michroma under where the badge
 * hangs, a hairline, and the issuer in a small sans. Colour and emissive map both, one canvas per
 * plate, so the type is printed on the acrylic rather than floating on a stencil plane in front of
 * it. The badge is not drawn here: it loads out of band and stays its own plane.
 */
export function plateFace(name: string, issuer: string, index: number): THREE.CanvasTexture {
  const W = 1024, Hpx = Math.round((W * PLATE.h) / PLATE.w);
  const [c, ctx] = canvas(W, Hpx);
  const ppm = W / PLATE.w;
  const accent = '#' + new THREE.Color(LABS.dado).getHexString();
  // The acrylic: a vertical wash, brightest a third of the way down where the tubes sit behind it.
  const ground = ctx.createLinearGradient(0, 0, 0, Hpx);
  ground.addColorStop(0, '#e6edf1'); ground.addColorStop(0.35, '#f6f9fb'); ground.addColorStop(0.75, '#eef3f6'); ground.addColorStop(1, '#dfe7ec');
  ctx.fillStyle = ground; ctx.fillRect(0, 0, W, Hpx);
  // The bloom behind the badge.
  const by = (PLATE.y + PLATE.h / 2 - PLATE.badgeY) * ppm;
  const glow = ctx.createRadialGradient(W / 2, by, 40, W / 2, by, W * 0.62);
  glow.addColorStop(0, 'rgba(255,255,255,0.75)'); glow.addColorStop(0.55, 'rgba(255,255,255,0.18)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, Hpx);
  // Frosting: a fine grain, half light and half dark, at an alpha the eye reads as texture and not
  // as dirt. Seeded per plate so no two faces carry the same grain.
  const r = rng(101 + index * 17);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.09)' : 'rgba(110,130,142,0.06)';
    ctx.fillRect(r() * W, r() * Hpx, 2, 2);
  }
  // The band across the head: the Labs mark, the plate's number, the accent.
  const band = Math.round(0.075 * ppm);
  ctx.fillStyle = accent; ctx.fillRect(0, 0, W, band);
  const spacing = (n: number) => { (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${n}px`; };
  ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
  const mr = band * 0.28, mx = 36 + mr, my = band / 2;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath();
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; const x = mx + Math.cos(a) * mr, y = my + Math.sin(a) * mr; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.closePath(); ctx.stroke();
  ctx.fillRect(mx - mr * 0.55, my - band * 0.05, mr * 1.1, band * 0.1);
  ctx.font = `600 ${Math.round(band * 0.4)}px Michroma, system-ui, sans-serif`; spacing(3);
  ctx.textAlign = 'left'; ctx.fillText('JEL LABS', mx + mr + 24, my + 1);
  ctx.textAlign = 'right'; ctx.fillText(`CERT ${String(index + 1).padStart(2, '0')}`, W - 36, my + 1);
  // The name, tracked out, fitted to the face, and wrapped to two lines when one line would have to
  // shrink past the size a person reads from the aisle.
  const room = W * 0.86;
  const font = (n: number) => { ctx.font = `600 ${n}px Michroma, system-ui, sans-serif`; spacing(Math.round(n * 0.08)); };
  ctx.textAlign = 'center'; ctx.fillStyle = INK;
  let px = 78; font(px);
  while (px > 58 && ctx.measureText(name).width > room) { px -= 2; font(px); }
  let lines = [name];
  if (ctx.measureText(name).width > room) {
    const words = name.split(' ');
    let best = 1, bestDiff = Infinity;
    for (let i = 1; i < words.length; i++) {
      const diff = Math.abs(ctx.measureText(words.slice(0, i).join(' ')).width - ctx.measureText(words.slice(i).join(' ')).width);
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    }
    lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
    while (px > 40 && lines.some((l) => ctx.measureText(l).width > room)) { px -= 2; font(px); }
  }
  const nameY = (PLATE.y + PLATE.h / 2 - 1.34) * ppm;
  const lead = px * 1.3;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, nameY + (i - (lines.length - 1) / 2) * lead + px * 0.06));
  spacing(0);
  // A hairline, then the issuer in a small sans.
  const ruleY = nameY + ((lines.length - 1) / 2) * lead + px * 0.95;
  ctx.fillStyle = 'rgba(30,44,58,0.28)'; ctx.fillRect(W / 2 - 120, ruleY, 240, 2);
  ctx.fillStyle = INK_SOFT; ctx.font = '500 34px Inter, "Segoe UI", system-ui, sans-serif'; spacing(2);
  ctx.fillText(issuer, W / 2, ruleY + 46);
  spacing(0);
  // The foot line.
  ctx.fillStyle = accent; ctx.fillRect(0, Hpx - 5, W, 5);
  return own(c);
}

/**
 * One certification as a hung lightbox exhibit, built facing +z about the floor under its own
 * centre: a dark steel back box, a slim brushed frame standing proud of the face with a darker
 * bevel stepped inside it, the printed acrylic recessed in that, a top rail, and two rods up to
 * clamp plates on the lab's ceiling. Four draw calls: the two steels, the face, and the badge.
 * Materials are the plate's own, not shared, because the hover light mutates whatever it touches
 * and a shared steel would light all six plates for one pointer.
 */
function exhibitPlate(face: THREE.Texture, badge: THREE.Mesh): THREE.Group {
  const g = new THREE.Group();
  const { w, h, y, lip, deep } = PLATE;
  const top = y + h / 2;
  // Dark steel: the back box behind the face, and the bevel ring inside the frame. The box stops
  // two centimetres behind the face plane so nothing it has shares a plane with the frame's front.
  const dark = labSteel(LABS.steel);
  const bevel = 0.014;
  g.add(merged([
    new THREE.BoxGeometry(w + 2 * lip, h + 2 * lip, 0.05).translate(0, y, -0.045),
    new THREE.BoxGeometry(w, bevel, 0.032).translate(0, h / 2 - bevel / 2 + y, -0.004),
    new THREE.BoxGeometry(w, bevel, 0.032).translate(0, -(h / 2 - bevel / 2) + y, -0.004),
    new THREE.BoxGeometry(bevel, h - 2 * bevel, 0.032).translate(w / 2 - bevel / 2, y, -0.004),
    new THREE.BoxGeometry(bevel, h - 2 * bevel, 0.032).translate(-(w / 2 - bevel / 2), y, -0.004),
  ], dark));
  // Brushed steel: the frame, the top rail with its two clamps, the rods and the ceiling plates.
  const bright = new THREE.MeshStandardMaterial({ color: 0x9aa5ad, metalness: 0.75, roughness: 0.28 });
  const rodX = w / 2 - 0.22, railY = top + lip + 0.02, rodLen = LAB.h - 0.012 - (railY + 0.02);
  const parts: THREE.BufferGeometry[] = [
    new THREE.BoxGeometry(w + 2 * lip, lip, deep).translate(0, top + lip / 2, deep / 2 - 0.02),
    new THREE.BoxGeometry(w + 2 * lip, lip, deep).translate(0, y - h / 2 - lip / 2, deep / 2 - 0.02),
    new THREE.BoxGeometry(lip, h, deep).translate(w / 2 + lip / 2, y, deep / 2 - 0.02),
    new THREE.BoxGeometry(lip, h, deep).translate(-(w / 2 + lip / 2), y, deep / 2 - 0.02),
    new THREE.BoxGeometry(w + 2 * lip, 0.04, 0.04).translate(0, railY, 0),
  ];
  for (const x of [-rodX, rodX]) {
    parts.push(new THREE.BoxGeometry(0.06, 0.07, 0.06).translate(x, railY, 0));
    parts.push(new THREE.CylinderGeometry(0.012, 0.012, rodLen, 8).translate(x, railY + 0.02 + rodLen / 2, 0));
    parts.push(new THREE.BoxGeometry(0.1, 0.012, 0.1).translate(x, LAB.h - 0.006, 0));
  }
  g.add(merged(parts, bright));
  // The face, recessed inside the bevel. Lit from behind at a level that leaves the badge in front
  // of it the brightest thing on the plate.
  const acrylic = new THREE.Mesh(new THREE.PlaneGeometry(w - 2 * bevel, h - 2 * bevel), new THREE.MeshStandardMaterial({
    color: 0xffffff, map: face, roughness: 0.55, emissive: 0xffffff, emissiveMap: face, emissiveIntensity: 0.35,
  }));
  acrylic.position.set(0, y, 0); g.add(acrylic);
  badge.position.set(0, PLATE.badgeY, 0.006); g.add(badge);
  return g;
}

/**
 * A stainless preparation bench: a top with an upstand along its back, square tube legs, and an
 * undershelf. `len` along x, `depth` along z, `h` to the top, origin at floor centre with the
 * upstand at -z. One draw call.
 */
function steelBench(len: number, depth: number, h: number): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [
    new THREE.BoxGeometry(len, 0.04, depth).translate(0, h - 0.02, 0),
    new THREE.BoxGeometry(len, 0.1, 0.02).translate(0, h + 0.05, -depth / 2 + 0.01),
    new THREE.BoxGeometry(len - 0.12, 0.025, depth - 0.12).translate(0, 0.3, 0),
  ];
  for (const x of [-len / 2 + 0.05, len / 2 - 0.05]) for (const z of [-depth / 2 + 0.05, depth / 2 - 0.05]) {
    parts.push(new THREE.BoxGeometry(0.035, h - 0.04, 0.035).translate(x, (h - 0.04) / 2, z));
  }
  const m = merged(parts, new THREE.MeshStandardMaterial({ color: 0xc6ced3, metalness: 0.85, roughness: 0.3 }));
  m.name = 'bench'; return m;
}

/**
 * A trolley with a sheet thrown over it. The frame is steel on castors; the sheet is a cloth, a
 * plane draped over the deck whose vertices past the deck's edge fall down its sides, with a fold
 * or two across the top, so it reads as linen laid over a trolley rather than as a white slab with
 * a flap. 0.8 by 2.0 on plan, origin at floor centre, long axis along z. Three draw calls.
 */
function sheetedTrolley(): THREE.Group {
  const g = new THREE.Group();
  const steel = labSteel(0x9aa5ad);
  const deckY = 0.66, hx = 0.36, hz = 0.95;
  const frame: THREE.BufferGeometry[] = [new THREE.BoxGeometry(hx * 2, 0.05, hz * 2).translate(0, deckY - 0.025, 0)];
  for (const x of [-0.3, 0.3]) {
    frame.push(new THREE.BoxGeometry(0.025, 0.025, hz * 2 - 0.2).translate(x, 0.16, 0));
    for (const z of [-0.85, 0.85]) frame.push(new THREE.CylinderGeometry(0.018, 0.018, deckY - 0.1, 8).translate(x, 0.1 + (deckY - 0.1) / 2, z));
  }
  g.add(merged(frame, steel));
  const wheels: Spot[] = [];
  for (const x of [-0.3, 0.3]) for (const z of [-0.85, 0.85]) wheels.push([x, 0.05, z]);
  g.add(instances(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1b2229, roughness: 0.7 }), wheels));
  // The sheet. Built flat in xz, then every vertex past the deck's edge is pulled back to the edge
  // and dropped by the distance it overhung, which is a sheet hanging straight off the side. On the
  // deck it rises over a folded body of linen, with a little noise so no edge is a ruled line.
  const geo = new THREE.PlaneGeometry(1.24, 2.6, 26, 52); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const r = rng(23);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const ox = Math.max(0, Math.abs(x) - hx), oz = Math.max(0, Math.abs(z) - hz);
    const over = Math.max(ox, oz);
    const fold = 0.09 * Math.exp(-((z * z) / 0.5)) * Math.max(0, 1 - (x * x) / (hx * hx));
    const y = deckY + (over > 0 ? -over * 0.98 + 0.005 : fold + 0.012) + (r() - 0.5) * 0.012;
    pos.setXYZ(i, ox > 0 ? Math.sign(x) * (hx + 0.012 + ox * 0.08) : x, Math.max(0.12, y), oz > 0 ? Math.sign(z) * (hz + 0.012 + oz * 0.08) : z);
  }
  pos.needsUpdate = true; geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xcfd8de, roughness: 0.95, side: THREE.DoubleSide })));
  return g;
}

export async function buildDressing(ctx: StageContext, root: THREE.Group): Promise<Dressing> {
  const { store, pace } = ctx;
  const add = async (o: THREE.Object3D) => { root.add(o); await pace(); };
  // A badge image can land after the stage was disposed (a page swap, or a fallback, mid load).
  // Assigning it then would hang a live texture off a material nobody will ever dispose again, so a
  // late callback throws its texture away instead.
  let disposed = false;
  const badges: THREE.Texture[] = [];
  const hotspots: Hotspot[] = [];

  // The six certifications, three per side of the aisle at the same three z, hung from the lab's
  // ceiling on rods so the hold reads a display somebody installed rather than six signs in the air.
  // Each plate is a lightbox, not a lamp: the acrylic carries just enough glow to separate it from
  // the white room, the band across its head is the Labs blue, and the ink is dark.
  const loader = new THREE.TextureLoader();
  const certList = certs as { id: string; name: string; issuer: string; badgeImage: string }[];
  certList.forEach((c, i) => {
    const side = i < 3 ? 'west' : 'east'; const z = PLATE_Z[side][i % 3]; const x = PLATE_X[side];
    // One group per plate so the pointer can pick a single certification, built facing +z in its own
    // space and then turned onto its wall plus the quarter radian that squares it to the aisle.
    const badge = new THREE.Mesh(new THREE.PlaneGeometry(PLATE.badge, PLATE.badge), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    const plate = exhibitPlate(plateFace(c.name, c.issuer, i), badge); plate.name = c.id;
    plate.position.set(x, 0, z);
    plate.rotation.y = side === 'west' ? Math.PI / 2 + PLATE_TURN : -Math.PI / 2 - PLATE_TURN;
    root.add(plate);
    hotspots.push({ id: c.id, kind: 'cert', label: c.name, object: plate, stop: 'credentials' });
    loader.load(c.badgeImage, (t) => {
      if (disposed) { t.dispose(); return; }
      t.colorSpace = THREE.SRGBColorSpace; t.userData.owned = true; badges.push(t);
      const m = badge.material as THREE.MeshBasicMaterial; m.map = t; m.opacity = 1; m.needsUpdate = true;
    }, undefined, () => { /* name only */ });
  });
  await pace();

  // Inside the glass: the room Terragroup left set up (ref 14). A sheeted trolley down the west
  // side, flight cases on the floor, and along the east glass a stainless bench with the lab's own
  // instruments on it and a stool pushed back from it. The trolley sits at x -81.4 rather than on
  // the lab's centre line, where `cameraAt` puts the walk within 0.1 m of it, and a metre south of
  // where it first stood so its sheet stays under the near plate's frame at the hold.
  await add(place(sheetedTrolley(), -81.4, 0, -20.4, Math.PI + 0.15));
  // The stacked pair stands off the east glass rather than against it: from the hold the wall line
  // is behind the page's own certification card, and a case parked there is a case nobody sees.
  await add(place(hardCase(), -77.8, 0, -16.2, 0.2));
  await add(place(hardCase(), -77.8, 0.45, -16.2, -0.35));
  await add(place(hardCase(0xd6691f), -81.6, 0, -15.2, 1.1));

  // The bench: 2.2 m along the east glass, south of the east plates so nothing stands under them,
  // its top 0.9 up. The microscope and the chemistry set on it, the medical box at its end, and the
  // stool off its south end where it is 2.6 m from the walked line.
  const BENCH = { x: X1 - 0.5 - 0.35, z: -21.4, h: 0.9 };
  await add(place(steelBench(2.2, 0.6, BENCH.h), BENCH.x, 0, BENCH.z, Math.PI / 2));
  const onBench = (name: string, z: number, ry: number) => place(grounded(store.model(name)), BENCH.x, BENCH.h, z, ry);
  await add(onBench('microscope', BENCH.z - 0.55, Math.PI / 2 + 0.3));
  await add(onBench('chemistry_set', BENCH.z + 0.45, Math.PI / 2 - 0.2));
  await add(place(grounded(store.model('medical_box')), BENCH.x - 0.05, BENCH.h, BENCH.z + 0.95, Math.PI / 2 + 0.4));
  await add(place(grounded(store.model('stool_2')), X1 - 1.3, 0, BENCH.z - 1.55, 0.7));

  // Outside, the shoot's camera on its tripod in the hall north of the lab, pointed back in through
  // the glass the way the reference has it, and well clear of the walked line. Inside the lab it was
  // the one thing in the hold that was not the lab's own, and Jordan read it as out of place.
  await add(place(tripodCamera(), -76.2, HALL_FLOOR, -10.4, Math.PI + 0.42));

  // Along the hall. A coil of yellow cable off the ceiling and a blue tarp slung down the east wall
  // are the two notes of colour in a room that is otherwise white on white.
  await add(place(cableCoil(), -76.4, H - 1.8, -9, 0));
  await add(place(tarpWall(8, 3.2), X1 - 0.1, 1.9, -8, -Math.PI / 2));

  // A stool knocked over up the hall, a wheelchair parked further on and a stripped bed frame stood
  // on its edge against the west wall: the room was cleared out in a hurry.
  const tipped = store.model('stool_2'); tipped.rotation.x = Math.PI / 2;
  await add(place(grounded(tipped), -77.5, HALL_FLOOR, -9.7, 1.1));
  await add(place(grounded(store.model('wheelchair')), -76.2, HALL_FLOOR, 2.2, 2.4));
  const leaning = store.model('bed_frame'); leaning.rotation.z = Math.PI / 2 - 0.22;
  await add(place(grounded(leaning), -82.4, HALL_FLOOR, -8, Math.PI / 2));

  const tote = (x: number, z: number, ry: number) => place(grounded(store.model('tote')), x, HALL_FLOOR, z, ry);
  await add(tote(X1 - 1.2, -12, 0.3));

  // Papers on the hall floor, which sits 6 mm up: laid on that, they clear it by the kit's own lift.
  await add(papers([[X1 - 2.4, HALL_FLOOR, -9.2, 0.5], [X1 - 2.0, HALL_FLOOR, -6.4, 1.3], [X0 + 2.2, HALL_FLOOR, -11.6, 0.9]]));

  // disposeObject() reaches the badge textures through their materials, so this is belt and braces
  // for the ones already assigned and the only cleanup for one still in flight.
  return { hotspots, dispose() { disposed = true; for (const t of badges) t.dispose(); badges.length = 0; } };
}
