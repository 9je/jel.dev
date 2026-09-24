import * as THREE from 'three';
import type { Hotspot, StageContext } from '../types';
import { grounded, place, merged, instances, repeat, type Spot } from '../../merge';
import { papers, wrappedPallet } from '../../labs/props';
import { tripodCamera, cableCoil, locker, pinboard, hardCase } from '../../labs/furniture';
import { wallPanel } from '../../labs/plant';
import { labSteel, LABS } from '../../labs/materials';
import { canvas, own, rng } from '../../labs/textures';
import { X0, X1, Z1, H, LAB, PANEL_Y, PANEL_Z, VIEWER_X, VIEWER_Z, VIEWER_ORDER, SERVICE_Y } from './layout';
import certs from '../../../../content/certs.json';

/** Whatever the dressing has to clean up itself. The badge textures load out of band, so the stage
 *  has to be able to tell the dressing it is gone. */
export interface Dressing {
  hotspots: Hotspot[];
  /** The theatre lamp's lit face and cells, for the stage to brown out now and then. */
  lampGlow: THREE.MeshStandardMaterial[];
  dispose(): void;
}

/** The type on a film: the pale grey an exposed plate's lettering comes out, lit from behind. */
const INK = '#dfe9ee';
/** The issuer line, a step dimmer than the name so the two read as a hierarchy. */
const INK_SOFT = '#9fb2bd';

/**
 * A film viewer on a mobile stand, the lightbox a radiology room reads plates on, with the
 * certificate as the film clipped to it. The lit panel is `w` by `h` with its centre at `y`; the film
 * is `sw` by `sh`, hung from the clip bar, and leaves a lit margin all round it, which is what says
 * lightbox; the badge is a square of `badge` on a side, `badgeDrop` below the film's top edge. The
 * plates this replaces were lit posters on rods, and next to a scanned microscope they read as the
 * cheapest things in the room.
 */
const VIEWER = { w: 1.25, h: 1.45, y: 1.55, deep: 0.14, sw: 1.02, sh: 1.2, badge: 0.56, badgeDrop: 0.42 };

/** The hall floor sits 6 mm over its neighbours (see the shell), so anything laid flat on it is laid
 *  flat on 0.006, not on 0. */
const HALL_FLOOR = 0.006;

/**
 * The certificate as a film, 800 px across: blue black base with the density falling off toward
 * the edges, the lab's register printed along the head the way a plate carries its patient line, a
 * lead side marker in the corner, a pale field behind where the badge goes, the name in Michroma and
 * the issuer under it, light on dark. Colour and emissive both: the viewer's light comes through
 * where the film is thin, so the lettering glows and the base stays dark.
 */
export function filmFace(name: string, issuer: string, index: number): THREE.CanvasTexture {
  const W = 800, Hpx = Math.round((W * VIEWER.sh) / VIEWER.sw), ppm = W / VIEWER.sw;
  const [c, ctx] = canvas(W, Hpx);
  const r = rng(101 + index * 17);
  const base = ctx.createRadialGradient(W / 2, Hpx * 0.42, 60, W / 2, Hpx * 0.5, W * 0.9);
  base.addColorStop(0, '#1d2a35'); base.addColorStop(1, '#070b10');
  ctx.fillStyle = base; ctx.fillRect(0, 0, W, Hpx);
  for (let i = 0; i < 2600; i++) { ctx.fillStyle = `rgba(160,190,205,${r() * 0.05})`; ctx.fillRect(r() * W, r() * Hpx, 2, 2); }
  const spacing = (n: number) => { (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${n}px`; };
  // The register along the head, small and tracked, and the plate's number.
  ctx.fillStyle = INK_SOFT; ctx.textBaseline = 'alphabetic';
  ctx.font = '600 24px Michroma, system-ui, sans-serif'; spacing(4);
  ctx.textAlign = 'left'; ctx.fillText('JEL LABS', 40, 62);
  ctx.textAlign = 'right'; ctx.fillText(`REG ${String(index + 1).padStart(2, '0')}`, W - 40, 62);
  spacing(0);
  // The lead marker in the lower corner, a letter in a square, the way every plate is marked.
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.strokeRect(40, Hpx - 110, 64, 64);
  ctx.fillStyle = INK; ctx.font = '600 40px Michroma, system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('R', 72, Hpx - 62);
  // A pale field behind the badge, the one bright patch on the plate, so every vendor's artwork
  // sits on the same ground.
  const by = VIEWER.badgeDrop * ppm, half = (VIEWER.badge / 2) * ppm * 1.14;
  const field = ctx.createRadialGradient(W / 2, by, 10, W / 2, by, half * 1.5);
  field.addColorStop(0, 'rgba(176,192,202,0.9)'); field.addColorStop(0.62, 'rgba(150,168,180,0.7)'); field.addColorStop(1, 'rgba(150,168,180,0)');
  ctx.fillStyle = field; ctx.fillRect(W / 2 - half * 1.5, by - half * 1.5, half * 3, half * 3);
  // The name, fitted: one line if it goes at a size that reads from the aisle, otherwise broken at
  // words over as few lines as it takes, up to three, shrinking only as far as it has to.
  const room = W * 0.86;
  const font = (n: number) => { ctx.font = `600 ${n}px Michroma, system-ui, sans-serif`; spacing(Math.round(n * 0.06)); };
  ctx.fillStyle = INK;
  const wrap = (words: string[]) => {
    const out: string[] = [];
    for (const w of words) {
      const last = out[out.length - 1];
      if (last !== undefined && ctx.measureText(`${last} ${w}`).width <= room) out[out.length - 1] = `${last} ${w}`;
      else out.push(w);
    }
    return out;
  };
  let px = 62; font(px);
  while (px > 46 && ctx.measureText(name).width > room) { px -= 2; font(px); }
  let lines = ctx.measureText(name).width <= room ? [name] : wrap(name.split(' '));
  while (px > 30 && (lines.length > 3 || lines.some((l) => ctx.measureText(l).width > room))) { px -= 2; font(px); lines = wrap(name.split(' ')); }
  const nameY = by + half * 1.25 + 70, lead = px * 1.3;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, nameY + i * lead));
  spacing(0);
  const ruleY = nameY + (lines.length - 1) * lead + 34;
  ctx.fillStyle = 'rgba(200,216,225,0.4)'; ctx.fillRect(W / 2 - 110, ruleY, 220, 2);
  ctx.fillStyle = INK_SOFT; ctx.font = '600 34px Saira, "Segoe UI", system-ui, sans-serif';
  ctx.fillText(issuer, W / 2, ruleY + 50);
  return own(c);
}

/** A film, hung by its top edge, with its lower outer corner lifting off the glass. */
function curledSheet(w: number, h: number): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(w, h, 6, 10);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    // Clamped: a vertex a rounding error outside the sheet gives a negative base, and a negative
    // number to a fractional power is NaN, which blacks out the whole frame through the post chain.
    const u = Math.min(1, Math.max(0, (p.getX(i) + w / 2) / w)), v = Math.min(1, Math.max(0, (h / 2 - p.getY(i)) / h));
    p.setZ(i, 0.05 * Math.pow(u, 2.2) * Math.pow(v, 2.4));
  }
  g.computeVertexNormals();
  return g;
}

/**
 * One viewer, built facing +z about the floor under its own centre: an enamelled housing, the lit
 * diffuser, a clip bar across its head, a rail under it with the switch and a dimmer, two poles down
 * to an H base on casters, and when it has one, the sheet and its badge. Materials are its own, not
 * shared, because the hover light mutates whatever it touches.
 */
function viewer(sheet: { face: THREE.Texture; badge: THREE.Mesh } | null): THREE.Group {
  const g = new THREE.Group();
  const { w, h, y, deep } = VIEWER;
  const top = y + h / 2, bottom = y - h / 2;
  const enamel = new THREE.MeshStandardMaterial({ color: 0xa9aea8, roughness: 0.45, metalness: 0.15 });
  g.add(merged([
    new THREE.BoxGeometry(w + 0.1, h + 0.1, deep).translate(0, y, -deep / 2 - 0.004),
    // The rail under the panel, deeper than the housing so the switch has somewhere to sit.
    new THREE.BoxGeometry(w + 0.1, 0.1, deep + 0.05).translate(0, bottom - 0.1, -deep / 2 + 0.02),
  ], enamel));
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa4aa, roughness: 0.3, metalness: 0.8 });
  const parts: THREE.BufferGeometry[] = [
    // The clip bar and its three spring clips.
    new THREE.BoxGeometry(w - 0.1, 0.03, 0.02).translate(0, top - 0.03, 0.014),
  ];
  for (const x of [-0.36, 0, 0.36]) parts.push(new THREE.BoxGeometry(0.06, 0.07, 0.028).translate(x, top - 0.04, 0.03));
  // Two poles down to the base, the base an H of two feet and a cross bar.
  const footY = 0.07;
  for (const x of [-0.42, 0.42]) {
    parts.push(new THREE.CylinderGeometry(0.018, 0.018, bottom - 0.15 - footY, 10).translate(x, footY + (bottom - 0.15 - footY) / 2, -deep / 2));
    parts.push(new THREE.BoxGeometry(0.05, 0.04, 0.62).translate(x, footY, -deep / 2));
  }
  parts.push(new THREE.BoxGeometry(0.84, 0.035, 0.04).translate(0, footY + 0.1, -deep / 2));
  g.add(merged(parts, steel));
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b2127, roughness: 0.6 });
  const darkParts: THREE.BufferGeometry[] = [
    new THREE.BoxGeometry(0.05, 0.03, 0.02).translate(w / 2 - 0.12, bottom - 0.1, 0.046),
    new THREE.CylinderGeometry(0.02, 0.02, 0.02, 12).rotateX(Math.PI / 2).translate(w / 2 - 0.24, bottom - 0.1, 0.046),
  ];
  for (const x of [-0.42, 0.42]) for (const z of [-0.29, 0.29]) {
    darkParts.push(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 12).rotateZ(Math.PI / 2).translate(x, 0.035, -deep / 2 + z));
  }
  g.add(merged(darkParts, dark));
  // The diffuser. Held under white and under the bloom threshold: a clipped panel swallows the pale
  // paper in front of it, which is what made the old plates hard to read.
  const lit = !!sheet;
  const diffuser = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({
    color: lit ? 0xf2f7fa : 0x9aa3a8, roughness: 0.5, emissive: 0xeaf3f8, emissiveIntensity: lit ? 1.1 : 0,
  }));
  diffuser.position.set(0, y, 0.001); diffuser.name = 'diffuser'; g.add(diffuser);
  if (sheet) {
    // Film: glossy, dark where it is dense, and lit through wherever it is not.
    const paper = new THREE.Mesh(curledSheet(VIEWER.sw, VIEWER.sh), new THREE.MeshStandardMaterial({
      color: 0x8a97a0, map: sheet.face, roughness: 0.25, emissive: 0xffffff, emissiveMap: sheet.face, emissiveIntensity: 0.6, side: THREE.DoubleSide,
    }));
    const sheetTop = top - 0.045;
    paper.position.set(0, sheetTop - VIEWER.sh / 2, 0.006); g.add(paper);
    sheet.badge.position.set(0, sheetTop - VIEWER.badgeDrop, 0.01); g.add(sheet.badge);
  }
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


const cloth = () => new THREE.MeshStandardMaterial({ color: 0xe3e9ec, roughness: 0.95, side: THREE.DoubleSide });
const brushed = () => new THREE.MeshStandardMaterial({ color: 0xb8c1c6, roughness: 0.32, metalness: 0.8 });

/**
 * A hospital gurney made up with a sheet: a steel frame on four casters with a shelf under it, a
 * mattress, a pillow, and the sheet over both with its sides hanging. Along z, head at -z. Three
 * draw calls.
 */
function gurney(): THREE.Group {
  const g = new THREE.Group();
  const L = 1.95, Wd = 0.68, top = 0.78;
  const frame: THREE.BufferGeometry[] = [
    new THREE.BoxGeometry(Wd, 0.05, L).translate(0, top - 0.12, 0),
    new THREE.BoxGeometry(Wd - 0.1, 0.02, L - 0.3).translate(0, 0.3, 0),
    // The head rail.
    new THREE.BoxGeometry(Wd - 0.06, 0.025, 0.025).translate(0, top + 0.2, -L / 2 + 0.03),
  ];
  for (const x of [-Wd / 2 + 0.05, Wd / 2 - 0.05]) {
    for (const z of [-L / 2 + 0.1, L / 2 - 0.1]) frame.push(new THREE.CylinderGeometry(0.02, 0.02, top - 0.2, 8).translate(x, (top - 0.2) / 2 + 0.08, z));
    frame.push(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 8).translate(x, top + 0.07, -L / 2 + 0.03));
  }
  g.add(merged(frame, brushed()));
  const casters: THREE.BufferGeometry[] = [];
  for (const x of [-Wd / 2 + 0.05, Wd / 2 - 0.05]) for (const z of [-L / 2 + 0.1, L / 2 - 0.1]) casters.push(new THREE.CylinderGeometry(0.05, 0.05, 0.035, 12).rotateZ(Math.PI / 2).translate(x, 0.05, z));
  g.add(merged(casters, new THREE.MeshStandardMaterial({ color: 0x1b2127, roughness: 0.7 })));
  // The sheet: a top over the mattress and pillow, and a side hanging down each long edge with a
  // little flare, drawn as one shape so the fold at the edge is a fold and not two boxes meeting.
  const sheet: THREE.BufferGeometry[] = [
    new THREE.BoxGeometry(Wd - 0.04, 0.1, L - 0.04).translate(0, top - 0.04, 0),
    new THREE.CapsuleGeometry(0.08, Wd - 0.3, 4, 10).rotateZ(Math.PI / 2).scale(1, 0.6, 1.3).translate(0, top + 0.04, -L / 2 + 0.22),
  ];
  for (const sx of [-1, 1]) {
    const side = new THREE.PlaneGeometry(L - 0.02, 0.3, 12, 3);
    const p = side.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const drop = (0.15 - p.getY(i)) / 0.3;
      p.setZ(i, 0.04 * drop * drop + 0.012 * Math.sin(p.getX(i) * 9) * drop);
    }
    side.computeVertexNormals();
    side.rotateY(sx * Math.PI / 2).translate(sx * (Wd / 2 - 0.01), top - 0.24, 0);
    sheet.push(side);
  }
  g.add(merged(sheet, cloth()));
  return g;
}

/** A drip stand: a five spoke base on casters, a pole, two hooks, a bag on one of them and its line
 *  hanging. Three draw calls. */
function ivStand(): THREE.Group {
  const g = new THREE.Group();
  const parts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.013, 0.013, 1.95, 8).translate(0, 1.0, 0)];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    parts.push(new THREE.BoxGeometry(0.28, 0.02, 0.025).translate(0.14, 0.07, 0).rotateY(a));
  }
  parts.push(new THREE.BoxGeometry(0.3, 0.012, 0.012).translate(0, 1.96, 0));
  g.add(merged(parts, brushed()));
  const wheels: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; wheels.push(new THREE.SphereGeometry(0.025, 8, 6).translate(Math.cos(a) * 0.27, 0.03, -Math.sin(a) * 0.27)); }
  g.add(merged(wheels, new THREE.MeshStandardMaterial({ color: 0x1b2127, roughness: 0.7 })));
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.035), new THREE.MeshPhysicalMaterial({ color: 0xe8f2f4, roughness: 0.2, transparent: true, opacity: 0.55 }));
  bag.position.set(0.13, 1.82, 0); g.add(bag);
  const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.13, 1.72, 0), new THREE.Vector3(0.16, 1.3, 0.02), new THREE.Vector3(0.2, 1.0, -0.05), new THREE.Vector3(0.3, 0.92, -0.2)]), 16, 0.004, 5), bag.material);
  g.add(line);
  return g;
}

/** A two shelf instrument trolley, stainless, on casters, with a push handle. Two draw calls. */
function trolley(): THREE.Group {
  const g = new THREE.Group();
  const w = 0.6, d = 0.42, top = 0.85;
  const parts: THREE.BufferGeometry[] = [
    new THREE.BoxGeometry(w, 0.02, d).translate(0, top, 0),
    new THREE.BoxGeometry(w, 0.02, d).translate(0, 0.35, 0),
    new THREE.BoxGeometry(0.02, 0.05, d).translate(-w / 2 - 0.08, top + 0.02, 0),
  ];
  for (const x of [-w / 2 + 0.02, w / 2 - 0.02]) for (const z of [-d / 2 + 0.02, d / 2 - 0.02]) parts.push(new THREE.CylinderGeometry(0.012, 0.012, top - 0.06, 8).translate(x, (top - 0.06) / 2 + 0.06, z));
  for (const z of [-d / 2 + 0.03, d / 2 - 0.03]) parts.push(new THREE.CylinderGeometry(0.01, 0.01, 0.1, 8).rotateZ(Math.PI / 2).translate(-w / 2 - 0.04, top + 0.02, z));
  g.add(merged(parts, brushed()));
  const wheels: THREE.BufferGeometry[] = [];
  for (const x of [-w / 2 + 0.02, w / 2 - 0.02]) for (const z of [-d / 2 + 0.02, d / 2 - 0.02]) wheels.push(new THREE.CylinderGeometry(0.035, 0.035, 0.025, 10).rotateZ(Math.PI / 2).translate(x, 0.035, z));
  g.add(merged(wheels, new THREE.MeshStandardMaterial({ color: 0x1b2127, roughness: 0.7 })));
  return g;
}

/** A yellow coiled air line hanging from a ceiling fitting: a straight drop, a coil of loose turns,
 *  and a coupling on the end. Origin at the ceiling. One draw call. */
function airHose(): THREE.Group {
  const g = new THREE.Group();
  const pts: THREE.Vector3[] = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.25, 0)];
  const turns = 11, top = -0.3, len = 1.1;
  for (let i = 0; i <= turns * 12; i++) {
    const t = i / (turns * 12), a = t * turns * Math.PI * 2;
    const r = 0.09 + 0.01 * Math.sin(t * 7);
    pts.push(new THREE.Vector3(Math.cos(a) * r, top - t * len * (0.8 + 0.4 * t), Math.sin(a) * r));
  }
  pts.push(new THREE.Vector3(0.02, top - len * 1.2 - 0.15, 0.05));
  const yellow = new THREE.MeshStandardMaterial({ color: 0xe8b923, roughness: 0.45 });
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.009, 6), yellow));
  const coupling = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.014, 0.07, 10), brushed());
  coupling.position.set(0.02, top - len * 1.2 - 0.19, 0.05); g.add(coupling);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 12), brushed());
  plate.position.y = -0.01; g.add(plate);
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

  // The certifications, four viewers down each side of the aisle on mobile stands, the two CCNAs as
  // the nearest pair where the hold frames them largest. A slot with no certification is a viewer
  // with nothing clipped to it, switched off, which is what a lab with one more viewer than films has.
  const loader = new THREE.TextureLoader();
  const byId = new Map((certs as { id: string; name: string; issuer: string; badgeImage: string }[]).map((c) => [c.id, c]));
  let n = 0;
  for (const side of ['west', 'east'] as const) {
    VIEWER_ORDER[side].forEach((id, i) => {
      const x = VIEWER_X[side], z = VIEWER_Z[i]!;
      const c = id ? byId.get(id) : undefined;
      const badge = new THREE.Mesh(new THREE.PlaneGeometry(VIEWER.badge, VIEWER.badge), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      const v = viewer(c ? { face: filmFace(c.name, c.issuer, n++), badge } : null);
      v.name = c?.id ?? `viewer-${side}-${i}`;
      v.position.set(x, 0, z);
      v.rotation.y = side === 'west' ? Math.PI / 2 : -Math.PI / 2;
      root.add(v);
      if (!c) return;
      hotspots.push({ id: c.id, kind: 'cert', label: c.name, object: v, stop: 'credentials' });
      loader.load(c.badgeImage, (t) => {
        if (disposed) { t.dispose(); return; }
        t.colorSpace = THREE.SRGBColorSpace; t.userData.owned = true; badges.push(t);
        const m = badge.material as THREE.MeshBasicMaterial; m.map = t; m.opacity = 1; m.needsUpdate = true;
      }, undefined, () => { /* name only */ });
    });
  }
  await pace();

  // Inside the glass: the room Terragroup left set up (ref 14). A sheeted trolley down the west
  // side, flight cases on the floor, and along the east glass a stainless bench with the lab's own
  // instruments on it and a stool pushed back from it. The trolley sits at x -81.4 rather than on
  // the lab's centre line, where `cameraAt` puts the walk within 0.1 m of it, and a metre south of
  // where it first stood so its sheet stays under the near plate's frame at the hold.
  // By the south door, the instrument trolley somebody wheeled in and left: tape and a kit on top.
  await add(place(trolley(), -81.3, 0, -21.6, 0.35));
  await add(place(grounded(store.model('medical_box')), -81.32, 0.86, -21.62, 0.2));
  await add(place(grounded(store.model('medical_tape')), -81.15, 0.86, -21.35, 1.1));
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
  // Under it, a gurney made up with a sheet, and the drip stand beside it. The room is a clean lab
  // with a treatment bay in it, the way the reference labs are: one corner of it set up for a
  // person, the rest for the work. The line from the hold to the east viewers clears the gurney's
  // top by a quarter of a metre, so it never covers a sheet.
  await add(place(gurney(), -77.35, 0, -15.4, 0));
  await add(place(ivStand(), -78.05, 0, -16.55, 0.4));

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
  // The yellow air line coiled down off the lab's ceiling over the bench, a coupling on its end.
  await add(place(airHose(), -76.3, LAB.h, -21.0, 0));

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

  // The corridor as a corridor people used, not nineteen metres of floor between two rooms: a bank
  // of lockers and a notice board on the west wall, a bench on the east wall with a flight case and
  // a tote left on it, and stock on pallets by the containment door where a delivery was dropped and
  // never put away. All of it stands against a wall, square to it, at least two metres off the
  // walked line.
  await add(place(locker(4), X0 + 0.26, HALL_FLOOR, -4.2, Math.PI / 2));
  await add(place(pinboard(1.2, 0.9, 'NOTICES'), X0 + 0.03, 1.75, -0.8, Math.PI / 2));
  await add(place(steelBench(1.8, 0.55, 0.85), X1 - 0.32, 0, -3.4, Math.PI / 2));
  await add(place(hardCase(), X1 - 0.34, 0.85, -3.9, -Math.PI / 2));
  await add(place(grounded(store.model('tote')), X1 - 0.34, 0.85, -2.9, -Math.PI / 2 + 0.1));
  await add(repeat(wrappedPallet(2), [[X1 - 0.8, HALL_FLOOR, 4.2, 0], [X0 + 0.8, HALL_FLOOR, 3.9, 0]]));

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
