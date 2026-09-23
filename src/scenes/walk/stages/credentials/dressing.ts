import * as THREE from 'three';
import type { Hotspot, StageContext } from '../types';
import { grounded, place, merged, instances, type Spot } from '../../merge';
import { papers } from '../../labs/props';
import { tripodCamera, cableCoil } from '../../labs/furniture';
import { wallPanel } from '../../labs/plant';
import { labSteel, LABS } from '../../labs/materials';
import { canvas, own, rng } from '../../labs/textures';
import { X0, X1, Z1, H, LAB, PANEL_Y, PANEL_Z, PLATE_X, PLATE_Z, PLATE_TURN, SERVICE_Y } from './layout';
import certs from '../../../../content/certs.json';

/** Whatever the dressing has to clean up itself. The badge textures load out of band, so the stage
 *  has to be able to tell the dressing it is gone. */
export interface Dressing {
  hotspots: Hotspot[];
  /** The theatre lamp's lit face and cells, for the stage to brown out now and then. */
  lampGlow: THREE.MeshStandardMaterial[];
  dispose(): void;
}

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
  // The mount the badge sits in. Six vendors draw their badge six ways, and hung as they come the
  // wall reads as an export from a badge site rather than as a set of things that were earned. One
  // frame around all six is what makes them a collection: a ruled window, a shade cooler than the
  // acrylic, with the vendor's own artwork centred in it.
  const mount = PLATE.badge * ppm * 0.62;
  const mx0 = W / 2 - mount, my0 = by - mount;
  ctx.fillStyle = 'rgba(210,224,232,0.5)';
  ctx.fillRect(mx0, my0, mount * 2, mount * 2);
  ctx.strokeStyle = 'rgba(30,44,58,0.22)'; ctx.lineWidth = 2;
  ctx.strokeRect(mx0 + 1, my0 + 1, mount * 2 - 2, mount * 2 - 2);
  // A corner tick at each corner of the window, the way a mount is scored before it is cut.
  ctx.strokeStyle = 'rgba(30,44,58,0.35)'; ctx.lineWidth = 3;
  const tick = mount * 0.16;
  for (const [cx, cy, sx, sy] of [[mx0, my0, 1, 1], [mx0 + mount * 2, my0, -1, 1], [mx0, my0 + mount * 2, 1, -1], [mx0 + mount * 2, my0 + mount * 2, -1, -1]] as [number, number, number, number][]) {
    ctx.beginPath(); ctx.moveTo(cx + sx * tick, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * tick); ctx.stroke();
  }
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
  // The issuer, tracked out in caps under the rule: it is the authority, not a caption.
  ctx.fillStyle = INK_SOFT; ctx.font = '600 30px Inter, "Segoe UI", system-ui, sans-serif'; spacing(7);
  ctx.fillText(issuer.toUpperCase(), W / 2, ruleY + 46);
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
 * An operating theatre lamp on a ceiling pendant: a stem, a yoke, a shallow dish and the ring of
 * lamp cells burning under it. Origin at the ceiling, hanging 0.9 m down. Three draw calls.
 */
function theatreLamp(): THREE.Group {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xdfe6e9, roughness: 0.35, metalness: 0.55 });
  const drop = 0.9;
  const body: THREE.BufferGeometry[] = [
    new THREE.CylinderGeometry(0.06, 0.06, 0.06, 12).translate(0, -0.03, 0),
    new THREE.CylinderGeometry(0.028, 0.028, drop - 0.2, 10).translate(0, -0.06 - (drop - 0.2) / 2, 0),
    new THREE.CylinderGeometry(0.44, 0.34, 0.11, 24).translate(0, -drop + 0.02, 0),
    new THREE.TorusGeometry(0.44, 0.018, 6, 24).rotateX(Math.PI / 2).translate(0, -drop - 0.03, 0),
  ];
  g.add(merged(body, steel));
  const faceMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf3f9ff, emissiveIntensity: 0.6, roughness: 0.3 });
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.4, 24), faceMat);
  face.rotation.x = Math.PI / 2; face.position.y = -drop - 0.04; g.add(face);
  const cells: Spot[] = [];
  for (let i = 0; i < 6; i++) cells.push([Math.cos((i / 6) * Math.PI * 2) * 0.22, -drop - 0.05, Math.sin((i / 6) * Math.PI * 2) * 0.22]);
  const cellMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.1 });
  g.add(instances(new THREE.SphereGeometry(0.045, 8, 6), cellMat, cells));
  g.userData.glow = [faceMat, cellMat];
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
  // The order the six hang in, by their index in certs.json. Down the file the two Cisco plates are
  // next to each other, and hung in that order the aisle showed "CCNA" beside "CCNA Cybersecurity",
  // which Jordan read as the same plate twice. This puts them on opposite sides at different depths.
  const ORDER = [0, 2, 4, 3, 1, 5];
  const certList = ORDER.map((n) => (certs as { id: string; name: string; issuer: string; badgeImage: string }[])[n]!);
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
  await add(place(steelBench(2.0, 0.6, 0.9), -81.6, 0, -20.4, Math.PI / 2));
  await add(place(grounded(store.model('tote')), -81.6, 0.9, -21.0, 0.5));
  await add(place(grounded(store.model('medical_box')), -81.55, 0.9, -19.8, Math.PI / 2 - 0.3));
  // The theatre lamp, on its pendant from the lab ceiling, with the room's second point light in the
  // dish. Jordan's read of the room was that it is "like a room surgeries are performed in", which
  // is the right instinct for a white glass box with a draped trolley in it, and one fitting says it
  // outright. It hangs over the far trolley on the east side rather than over the near one: two
  // metres ahead of where the camera parks and a foot over the eye line it was "light too in the
  // face", and a lamp you are standing under is not a lamp you can see. At the north end of the lab
  // it stands past the last pair of plates, framed in the gap between the two rows, and what the
  // hold reads is a lit table at the end of the room.
  const lamp = theatreLamp();
  // Over the bench, not on the lab's own north glass. At z -13.0 the pendant hung in the plane of
  // that wall and the dish cut straight through its frame, which is the light Jordan caught
  // clipping. The lab runs z -23.8 to -13, so anything on its ceiling has to stand clear of both ends.
  lamp.position.set(-77.4, LAB.h, -15.4); await add(lamp);
  // No hospital in here any more. The room had two sheeted gurneys, a drip stand, a wheelchair and
  // an old bed frame in it, all of which came straight off the Terragroup labs reference and none
  // of which belong in a hall about certifications: "the hospital beds dont even make sense idk if
  // that was carried over from the labs reference images". They are gone. What is left is what a
  // test bench area actually has, which is benches, instruments, stools and stock in totes.
  await add(place(steelBench(1.6, 0.6, 0.9), -77.6, 0, -15.4, -Math.PI / 2));
  await add(place(grounded(store.model('tote')), -77.55, 0.9, -15.9, -0.4));

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

  // Along the hall, a coil of yellow cable off the ceiling. There was a blue tarp slung down the
  // east wall here too, 8 m of it, full height and in the dado's own blue, so from the walk it read
  // as the paint running up the wall to the ceiling and stopping on a torn edge.
  await add(place(cableCoil(), -76.4, H - 1.8, -9, 0));

  // A stool knocked over up the hall, and stock left standing in the corridor. The wheelchair and
  // the bed frame that stood here are gone with the rest of the hospital, and the bed frame was
  // half inside the west wall besides: 2 m of frame stood on its edge 0.6 m off a wall reaches
  // through it whichever way it is turned.
  const tipped = store.model('stool_2'); tipped.rotation.x = Math.PI / 2;
  await add(place(grounded(tipped), -77.5, HALL_FLOOR, -9.7, 1.1));

  const tote = (x: number, z: number, ry: number) => place(grounded(store.model('tote')), x, HALL_FLOOR, z, ry);
  await add(tote(X1 - 1.2, -12, 0.3));
  await add(tote(X1 - 0.95, 1.9, -0.4));
  await add(tote(X0 + 1.0, -7.6, 0.9));

  // Papers on the hall floor, which sits 6 mm up: laid on that, they clear it by the kit's own lift.
  await add(papers([[X1 - 2.4, HALL_FLOOR, -9.2, 0.5], [X1 - 2.0, HALL_FLOOR, -6.4, 1.3], [X0 + 2.2, HALL_FLOOR, -11.6, 0.9]]));

  // ---- The corridor walls ------------------------------------------------------------------------
  // Nineteen metres of hall runs north from the lab to the containment door with 7 m walls on both
  // sides, and until now there was nothing on any of it: a blue skirt along the floor and bare grey
  // the whole way up. Jordan's read was that the blue and the grey did not make sense together, and
  // the height of the blue was only half of it. A wall that tall needs something at head height and
  // above, or the only thing the eye can measure is the ratio.
  //
  // So: a service run down both walls above the dado, and three panels hung under it on each side.
  // Both are things the building would actually have, both carry a horizontal line the length of
  // the corridor, and between them no stretch of this wall is more than two metres of nothing. Two
  // draw calls for the pipes and two for the panels, because every one of them is the same object
  // at a different z.
  const pipes: THREE.BufferGeometry[] = [], straps: THREE.BufferGeometry[] = [];
  const RUN_Z0 = -13, RUN_Z1 = Z1 - 0.1, runLen = RUN_Z1 - RUN_Z0, runZ = (RUN_Z0 + RUN_Z1) / 2;
  for (const [x, inward] of [[X0, 1], [X1, -1]] as [number, number][]) {
    // Two conduits one above the other, the lower one fatter, turned along z.
    for (const [dy, r] of [[0, 0.075], [0.22, 0.05]] as [number, number][]) {
      pipes.push(new THREE.CylinderGeometry(r, r, runLen, 10).rotateX(Math.PI / 2).translate(x + inward * 0.14, SERVICE_Y + dy, runZ));
    }
    // The brackets they are strapped to the wall on, every two metres.
    for (let z = RUN_Z0 + 1; z < RUN_Z1; z += 2) {
      straps.push(new THREE.BoxGeometry(0.2, 0.42, 0.04).rotateY(Math.PI / 2).translate(x + inward * 0.08, SERVICE_Y + 0.11, z));
    }
  }
  await add(merged(pipes, new THREE.MeshStandardMaterial({ color: 0x8e9aa2, roughness: 0.5, metalness: 0.45 })));
  await add(merged(straps, labSteel(0x39434b)));

  for (const [x, ry] of [[X0 + 0.08, Math.PI / 2], [X1 - 0.08, -Math.PI / 2]] as [number, number][]) {
    for (const z of PANEL_Z) await add(place(wallPanel(0.7, 1.0), x, PANEL_Y, z, ry));
  }

  // disposeObject() reaches the badge textures through their materials, so this is belt and braces
  // for the ones already assigned and the only cleanup for one still in flight.
  return { hotspots, lampGlow: lamp.userData.glow as THREE.MeshStandardMaterial[], dispose() { disposed = true; for (const t of badges) t.dispose(); badges.length = 0; } };
}
