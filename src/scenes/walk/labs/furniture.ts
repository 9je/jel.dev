import * as THREE from 'three';
import { instances, merged, type Spot } from '../merge';
import { LABS, labSteel } from './materials';
import { stencilTexture } from '../textures';
import { canvas, own, paperSheet, rng } from './textures';

/**
 * The break room kit and the clean lab's, in that order. Everything here has its origin on the
 * floor at its own centre and faces +z, so a room places one with `place(piece, x, 0, z, ry)` and
 * never has to know how tall it is.
 *
 * These are the pieces that have to carry a room on their own: Jordan's read of the first pass was
 * "idk what any of these things are", and the fix is not more props but more of the few details
 * that name a thing at a glance. A vending machine is its lit stock behind glass. An arcade cabinet
 * is its marquee, its side art and its control deck. A kitchen is a counter with doors under it and
 * cupboards over it. Every piece below spends its triangles on exactly those.
 */

const carcass = (color: number, roughness = 0.5) => new THREE.MeshStandardMaterial({ color, roughness });
const DARK = 0x141c24;

/** A run of base units with a steel counter, a sink and a bank of wall cupboards over it, `len`
 *  metres long. One cupboard door hangs open. Six draw calls. */
export function kitchenette(len: number): THREE.Group {
  const g = new THREE.Group();
  const bays = Math.max(1, Math.round(len / 0.6));
  const pitch = len / bays;
  const xs = Array.from({ length: bays }, (_, i) => -len / 2 + (i + 0.5) * pitch);
  const white = carcass(0xccd6dc, 0.58);
  const handle = new THREE.MeshStandardMaterial({ color: 0x323d46, roughness: 0.45, metalness: 0.5 });
  g.add(instances(new THREE.BoxGeometry(pitch - 0.012, 0.86, 0.6), white, xs.map((x) => [x, 0.43, 0] as Spot)));
  g.add(instances(new THREE.BoxGeometry(pitch * 0.5, 0.022, 0.022), handle, xs.map((x) => [x, 0.76, 0.313] as Spot)));

  const steel = labSteel(0x9aa5ad);
  const top = new THREE.Mesh(new THREE.BoxGeometry(len, 0.045, 0.66), steel);
  top.position.set(0, 0.8825, 0.02); g.add(top);
  // The sink is a dark inset in the counter rather than a basin: at standing height the eye reads
  // the rectangle and the tap over it, and a modelled bowl is triangles nobody sees into.
  const sinkX = xs[Math.min(1, bays - 1)];
  const sink = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.4), carcass(0x39434b, 0.4));
  sink.position.set(sinkX, 0.9, 0.02); g.add(sink);
  const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.25, 8), steel);
  tap.position.set(sinkX, 1.03, -0.2); g.add(tap);

  // Wall cupboards, one bay short of the run at each end so the counter reads longer than them.
  const uppers = xs.slice(1, Math.max(2, bays - 1));
  const open = uppers[uppers.length - 1];
  g.add(instances(new THREE.BoxGeometry(pitch - 0.012, 0.7, 0.35), white, uppers.filter((x) => x !== open).map((x) => [x, 1.5, -0.12] as Spot)));
  // Handles on the wall cupboards as well as the base units. Without them a bank of uppers is a
  // white slab hanging off the wall, which is exactly what it looked like in the first pass.
  g.add(instances(new THREE.BoxGeometry(pitch * 0.5, 0.02, 0.02), handle, uppers.map((x) => [x, 1.19, 0.058] as Spot)));
  const carcassOpen = new THREE.Mesh(new THREE.BoxGeometry(pitch - 0.05, 0.66, 0.33), carcass(0x2d3840, 0.8));
  carcassOpen.position.set(open, 1.5, -0.13); g.add(carcassOpen);
  // The open door swings about its own hinge edge, so the pivot carries the panel out by half its
  // width. It is hinged on the inboard side and swings toward the room, which keeps the run's
  // footprint the length it was asked for.
  const hinge = new THREE.Group();
  hinge.position.set(open - (pitch - 0.012) / 2, 1.5, 0.055);
  hinge.rotation.y = -1.2;
  const door = new THREE.Mesh(new THREE.BoxGeometry(pitch - 0.012, 0.7, 0.02), white);
  door.position.x = (pitch - 0.012) / 2; hinge.add(door); g.add(hinge);
  return g;
}

/** A tall fridge, door ajar on a lit interior, notes stuck to the front. Five draw calls. */
export function fridge(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.7), carcass(0xcbd3d8, 0.5));
  body.position.y = 0.9; g.add(body);
  // The lit face stands a millimetre proud of the body, so the wedge the open door leaves is a
  // slice of light rather than a slice of the box it is cut into.
  const inner = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.7, 0.02), new THREE.MeshStandardMaterial({ color: 0xdfeaf2, emissive: 0xeaf6ff, emissiveIntensity: 0.5, roughness: 0.6 }));
  inner.position.set(0, 0.92, 0.351); g.add(inner);

  const hinge = new THREE.Group();
  hinge.position.set(-0.34, 0.9, 0.36); hinge.rotation.y = -0.2;
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.74, 0.03), carcass(0xcbd3d8, 0.5));
  door.position.x = 0.34; hinge.add(door);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.03), labSteel(0x9aa5ad));
  grip.position.set(0.61, 0.3, 0.03); hinge.add(grip);
  const notes: THREE.BufferGeometry[] = [];
  for (const [x, y, r] of [[0.22, 0.42, 0.18], [0.42, 0.1, -0.12], [0.28, -0.28, 0.3]] as [number, number, number][]) {
    const n = new THREE.PlaneGeometry(0.1, 0.14); n.rotateZ(r); n.translate(x, y, 0.017); notes.push(n);
  }
  hinge.add(merged(notes, new THREE.MeshStandardMaterial({ map: paperSheet(4), roughness: 0.9 })));
  g.add(hinge);
  return g;
}

export interface VendingSpec { accent: string; lit: boolean; seed: number }

/** A drinks machine: a dark carcass with a real recess in its front, the stock lit behind glass and
 *  a header that carries the room's accent. Unlit, the stock goes dark and the header goes out, and
 *  the same machine reads as a dead one. Six draw calls. */
export function vendingMachine(spec: VendingSpec): THREE.Group {
  const g = new THREE.Group();
  const body: THREE.BufferGeometry[] = [];
  const put = (geo: THREE.BufferGeometry, x: number, y: number, z: number) => { geo.translate(x, y, z); body.push(geo); };
  for (const side of [-1, 1]) put(new THREE.BoxGeometry(0.17, 1.9, 0.8), side * 0.415, 0.95, 0);
  put(new THREE.BoxGeometry(0.66, 0.5, 0.8), 0, 0.25, 0);
  put(new THREE.BoxGeometry(0.66, 0.3, 0.8), 0, 1.75, 0);
  put(new THREE.BoxGeometry(0.66, 1.1, 0.4), 0, 1.05, -0.2);
  put(new THREE.BoxGeometry(0.22, 0.4, 0.03), 0.415, 1.05, 0.405);
  put(new THREE.BoxGeometry(0.66, 0.2, 0.03), 0, 0.35, 0.405);
  g.add(merged(body, carcass(0x1a2530, 0.45)));

  const shelves = vendingShelves(spec.seed);
  const stock = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 1.1), new THREE.MeshStandardMaterial({
    map: shelves, emissive: 0xffffff, emissiveMap: shelves, emissiveIntensity: spec.lit ? 0.85 : 0, roughness: 0.8,
  }));
  stock.position.set(0, 1.05, 0.02); g.add(stock);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 1.1), new THREE.MeshPhysicalMaterial({
    // Glass this clean mirrors the room and the stock behind it disappears into the reflection,
    // which is how the first pass turned a machine full of cans into a pale blue rectangle.
    color: LABS.glassTint, transparent: true, opacity: 0.13, roughness: 0.22, metalness: 0, depthWrite: false,
  }));
  glass.position.set(0, 1.05, 0.398); glass.renderOrder = 2; g.add(glass);

  const header = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.3), new THREE.MeshStandardMaterial({
    color: 0x0c131a, emissive: new THREE.Color(spec.accent), emissiveIntensity: spec.lit ? 1.6 : 0, roughness: 0.6,
  }));
  header.position.set(0, 1.75, 0.404); header.name = 'header'; g.add(header);
  const ink = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.2), new THREE.MeshBasicMaterial({
    map: stencilTexture('COLD DRINKS', { width: 512, height: 128, color: '#0b1117', font: '600 84px Michroma, system-ui, sans-serif', alpha: 0.9, flecks: false }),
    transparent: true, depthWrite: false,
  }));
  ink.position.set(0, 1.75, 0.408); g.add(ink);
  return g;
}

export interface ArcadeSpec { title: string; accent: string; seed: number }

/** The cabinet silhouette as a side panel: full depth to the elbow, set back above it. A plain
 *  rectangle of side art floating behind the head of a cabinet is the tell that a room was built
 *  out of boxes, and a row of four of them is four tells. `mirror` builds the panel for the other
 *  side, with the art the way round a cabinet really carries it. */
function sidePanel(mirror: boolean): THREE.BufferGeometry {
  const s = mirror ? -1 : 1;
  const shape = new THREE.Shape();
  shape.moveTo(-0.4 * s, 0); shape.lineTo(0.4 * s, 0); shape.lineTo(0.4 * s, 1.0);
  shape.lineTo(0.15 * s, 1.0); shape.lineTo(0.15 * s, 1.9); shape.lineTo(-0.4 * s, 1.9); shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  // ShapeGeometry uses the shape's own coordinates as uv, so the art would tile off the panel.
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * s + 0.4) / 0.8, uv.getY(i) / 1.9);
  uv.needsUpdate = true;
  // A quarter turn lays the silhouette into the cabinet's depth and points the face outward.
  geo.rotateY(mirror ? Math.PI / 2 : -Math.PI / 2);
  geo.translate(mirror ? 0.381 : -0.381, 0, 0);
  return geo;
}

/** An arcade cabinet: 0.76 wide, 1.9 tall, 0.8 deep, marquee lit, attract screen holding a high
 *  score table nobody is going to beat. Origin at floor centre, facing +z. Seven draw calls. */
export function arcadeCabinet(spec: ArcadeSpec): THREE.Group {
  const g = new THREE.Group();
  g.add(merged([
    new THREE.BoxGeometry(0.76, 1.0, 0.8).translate(0, 0.5, 0),
    new THREE.BoxGeometry(0.76, 0.9, 0.55).translate(0, 1.45, -0.125),
  ], carcass(DARK, 0.5)));
  g.add(merged([sidePanel(false), sidePanel(true)], new THREE.MeshStandardMaterial({ map: arcadeSide(spec.accent), roughness: 0.55 })));

  // Deck, joystick shafts and balls, coin door: one dark mesh. The deck tips back a quarter radian,
  // so everything standing on it is placed off the tilted surface rather than off the floor.
  const deck: THREE.BufferGeometry[] = [new THREE.BoxGeometry(0.76, 0.06, 0.34).rotateX(-0.25).translate(0, 0.98, 0.28)];
  for (const x of [-0.19, 0.19]) {
    deck.push(new THREE.CylinderGeometry(0.02, 0.02, 0.07, 8).translate(x, 1.031, 0.214));
    deck.push(new THREE.SphereGeometry(0.028, 8, 6).translate(x, 1.073, 0.214));
  }
  deck.push(new THREE.BoxGeometry(0.3, 0.2, 0.02).translate(0, 0.4, 0.405));
  g.add(merged(deck, carcass(0x0b1117, 0.55)));
  const button = () => new THREE.CylinderGeometry(0.016, 0.016, 0.012, 8);
  g.add(instances(button(), carcass(0xd7383a, 0.4), [[-0.08, 1.015, 0.291], [0.0, 1.015, 0.291], [0.08, 1.015, 0.291]]));
  g.add(instances(button(), carcass(0x3d7be0, 0.4), [[-0.08, 1.032, 0.359], [0.0, 1.032, 0.359], [0.08, 1.032, 0.359]]));

  const face = attractScreen(spec.title, spec.accent, spec.seed);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.44), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1.15, emissiveMap: face, map: face }));
  screen.position.set(0, 1.41, 0.17); screen.rotation.x = -0.2; g.add(screen);
  const lamp = marqueeFace(spec.title, spec.accent);
  const marquee = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.2), new THREE.MeshStandardMaterial({ color: 0xffffff, map: lamp, emissive: 0xffffff, emissiveMap: lamp, emissiveIntensity: 1.4 }));
  marquee.position.set(0, 1.79, 0.153); marquee.name = 'marquee'; g.add(marquee);
  return g;
}

/** A wall bracket for the break room's television: a back plate, a shelf and two braces, with the
 *  model already standing on it. Origin at the wall, shelf top on y 0. Two draw calls plus the
 *  model's own. */
export function crtBracket(model: THREE.Object3D, w: number): THREE.Group {
  const g = new THREE.Group();
  const steel: THREE.BufferGeometry[] = [
    new THREE.BoxGeometry(w * 0.9, 0.07, 0.025).translate(0, 0.04, 0.012),
    new THREE.BoxGeometry(w, 0.03, 0.42).translate(0, -0.015, 0.21),
  ];
  for (const side of [-1, 1]) steel.push(new THREE.BoxGeometry(0.03, 0.5, 0.03).rotateX(0.87).translate(side * w * 0.4, -0.16, 0.21));
  g.add(merged(steel, labSteel(0x39434b)));
  model.position.set(0, 0.002, 0.22); g.add(model);
  return g;
}

/** A bank of `bays` lockers, one door hanging open and one bay dented in. Origin at floor centre,
 *  facing +z. Two draw calls plus one per door. */
export function locker(bays: number): THREE.Group {
  const g = new THREE.Group();
  const xs = Array.from({ length: bays }, (_, i) => -(bays * 0.4) / 2 + (i + 0.5) * 0.4);
  const dented = Math.min(1, bays - 1), ajar = Math.min(bays - 1, Math.max(0, bays - 2));
  g.add(instances(new THREE.BoxGeometry(0.4, 1.8, 0.5), carcass(0x9fb0b8, 0.6), xs.map((x) => [x, 0.9, 0] as Spot)));
  const skin = carcass(0x8d9ea6, 0.6);
  const panel = () => {
    const parts: THREE.BufferGeometry[] = [new THREE.BoxGeometry(0.37, 1.74, 0.024).translate(0, 0, 0.262)];
    for (const y of [1.5, 1.56, 1.62]) parts.push(new THREE.BoxGeometry(0.2, 0.018, 0.014).translate(0, y - 0.9, 0.272));
    parts.push(new THREE.BoxGeometry(0.022, 0.12, 0.022).translate(0.14, 0.06, 0.274));
    return merged(parts, skin).geometry;
  };
  const shared = panel();
  xs.forEach((x, i) => {
    const door = new THREE.Mesh(shared, skin);
    door.name = 'door';
    if (i === ajar) { door.position.set(x - 0.185, 0.9, 0); door.rotation.y = -1.0; door.translateX(0.185); }
    else door.position.set(x, 0.9, i === dented ? -0.05 : 0);
    g.add(door);
  });
  return g;
}

/** A notice taped to a wall: pale stock, a blue header and a hazard triangle when its title carries
 *  an exclamation mark. The corners lift off the wall, which is the difference between a notice and
 *  a decal. Origin at the centre of the sheet, facing +z. One draw call. */
export function poster(text: string, w: number, h: number, seed = 1): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, h, 4, 4);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (const i of [0, 4, 20, 24]) pos.setZ(i, 0.02);
  pos.needsUpdate = true; geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: posterSheet(text, seed), roughness: 0.92 }));
  m.name = 'poster';
  return m;
}

/** A band of wall tile over a counter. `w` by `h` metres at a 0.15 m tile, origin at its centre,
 *  facing +z. One draw call. */
export function splashback(w: number, h: number): THREE.Mesh {
  const map = tileGrid(); map.repeat.set(w / 0.6, h / 0.6);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0xbfd4dc, map, roughness: 0.35, metalness: 0.05 }));
}

// ---------------------------------------------------------------------------------------------
// The canvases these pieces are painted with. They live here rather than in the shared `textures.ts`
// because only this room draws them, and a shared module's exports are bundled with the first visit
// whichever chunk happens to call them.

/** The stock behind a vending machine's glass: five shelves of cans and bottles with a few slots
 *  already cleared out. Colour and emissive map, so one canvas lights the machine and paints it. */
export function vendingShelves(seed = 1): THREE.CanvasTexture {
  const [c, ctx] = canvas(512, 900); const r = rng(seed);
  const stock = ['#3fd47a', '#d7383a', '#6ec1d6', '#e8b923'];
  ctx.fillStyle = '#0b1117'; ctx.fillRect(0, 0, 512, 900);
  const shelf = 180;
  for (let s = 0; s < 5; s++) {
    const base = (s + 1) * shelf - 14;
    for (let x = 12; x < 496; x += 26) {
      if (r() < 0.18) continue;
      const bottle = r() < 0.4;
      const h = bottle ? 118 : 64;
      const colour = stock[Math.floor(r() * stock.length)];
      ctx.fillStyle = colour; ctx.fillRect(x, base - h, 20, h);
      // A lighter band down the left of each can is the cheapest cylinder there is.
      ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(x + 2, base - h + 4, 4, h - 8);
      if (bottle) { ctx.fillStyle = '#0b1117'; ctx.fillRect(x + 6, base - h - 10, 8, 12); }
    }
    ctx.fillStyle = '#1a2530'; ctx.fillRect(0, base, 512, 14);
    ctx.fillStyle = '#2b3740'; ctx.fillRect(0, base + 11, 512, 3);
  }
  return own(c);
}

/** Arcade cabinet side art: two diagonal bands, the game's accent over hazard yellow. Colour map. */
export function arcadeSide(accent = '#3D7BE0'): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 512);
  ctx.fillStyle = '#141c24'; ctx.fillRect(0, 0, 256, 512);
  const band = (offset: number, width: number, fill: string) => {
    ctx.fillStyle = fill; ctx.beginPath();
    ctx.moveTo(-40 + offset, 512); ctx.lineTo(-40 + offset + width, 512);
    ctx.lineTo(256 + offset + width, 0); ctx.lineTo(256 + offset, 0);
    ctx.closePath(); ctx.fill();
  };
  band(-70, 96, accent);
  band(40, 34, '#e8b923');
  band(96, 10, '#cfe6ee');
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 430, 256, 82);
  return own(c);
}

/** A cabinet's attract screen: the game's name, the table it is holding and the coin prompt. The
 *  scores are drawn from `seed`, so the row reads as four different machines and never changes
 *  between loads. Emissive map. */
export function attractScreen(title: string, accent = '#3D7BE0', seed = 1): THREE.CanvasTexture {
  const [c, ctx] = canvas(512, 400); const r = rng(seed);
  ctx.fillStyle = '#06101a'; ctx.fillRect(0, 0, 512, 400);
  ctx.fillStyle = accent; ctx.fillRect(0, 0, 512, 8);
  ctx.textBaseline = 'top'; ctx.textAlign = 'center';
  ctx.fillStyle = '#CFE6EE'; ctx.font = '600 44px Michroma, system-ui, sans-serif';
  ctx.fillText(title, 256, 34);
  ctx.font = '600 22px Michroma, system-ui, sans-serif'; ctx.fillStyle = accent;
  ctx.fillText('HIGH SCORES', 256, 116);
  ctx.fillStyle = '#8fa6b4'; ctx.font = '600 24px Michroma, system-ui, sans-serif';
  ['1ST', '2ND', '3RD', '4TH'].forEach((rank, i) => {
    const score = Math.floor(52000 - i * 9000 - r() * 5000);
    ctx.fillText(`${rank}  ${String(score).padStart(6, '0')}`, 256, 164 + i * 40);
  });
  ctx.fillStyle = '#e8b923'; ctx.font = '600 26px Michroma, system-ui, sans-serif';
  ctx.fillText('INSERT COIN', 256, 344);
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; for (let y = 0; y < 400; y += 4) ctx.fillRect(0, y, 512, 2);
  return own(c);
}

/** A lit marquee: the accent as the ground with the title punched through it in white. One texture
 *  on one plane, rather than a lit panel with a stencil plane in front of it. Colour and emissive. */
export function marqueeFace(title: string, accent = '#3D7BE0'): THREE.CanvasTexture {
  const [c, ctx] = canvas(512, 146);
  ctx.fillStyle = accent; ctx.fillRect(0, 0, 512, 146);
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(0, 0, 512, 10); ctx.fillRect(0, 136, 512, 10);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
  const px = 64;
  ctx.font = `600 ${px}px Michroma, system-ui, sans-serif`;
  const wide = ctx.measureText(title).width;
  if (wide > 460) ctx.font = `600 ${Math.max(12, Math.floor((px * 460) / wide))}px Michroma, system-ui, sans-serif`;
  ctx.fillText(title, 256, 76);
  return own(c);
}

/** A printed notice: pale stock, a blue header band with its title, three lines of body copy and a
 *  hazard triangle when the title carries an exclamation mark. Colour map. */
export function posterSheet(text: string, seed = 1): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 360); const r = rng(seed);
  const warn = text.includes('!');
  ctx.fillStyle = '#e6e1d3'; ctx.fillRect(0, 0, 256, 360);
  ctx.fillStyle = '#2455A4'; ctx.fillRect(0, 0, 256, 62);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
  const px = 30;
  ctx.font = `600 ${px}px Michroma, system-ui, sans-serif`;
  const wide = ctx.measureText(text).width;
  if (wide > 232) ctx.font = `600 ${Math.max(9, Math.floor((px * 232) / wide))}px Michroma, system-ui, sans-serif`;
  ctx.fillText(text, 128, 32);
  if (warn) {
    ctx.fillStyle = '#E8B923'; ctx.beginPath();
    ctx.moveTo(128, 92); ctx.lineTo(190, 194); ctx.lineTo(66, 194); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#141c24'; ctx.font = '700 66px system-ui, sans-serif'; ctx.fillText('!', 128, 164);
  }
  const top = warn ? 226 : 110;
  ctx.fillStyle = '#6b6f72';
  for (let i = 0; i < 3; i++) for (let y = 0; y < 3; y++) ctx.fillRect(28, top + i * 38 + y * 11, 60 + r() * 140, 5);
  ctx.fillStyle = '#b9b3a2'; ctx.fillRect(28, 330, 90, 4);
  return own(c);
}

/** A run of wall tile as a grid of light squares on darker grout, tiling in both directions.
 *  Tint it with the material's colour. */
export function tileGrid(size = 128): THREE.CanvasTexture {
  const [c, ctx] = canvas(size, size);
  ctx.fillStyle = '#8f9ea6'; ctx.fillRect(0, 0, size, size);
  const cell = size / 4, grout = Math.max(1, size / 64);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) ctx.fillRect(i * cell + grout, j * cell + grout, cell - grout * 2, cell - grout * 2);
  const t = own(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// ---------------------------------------------------------------------------------------------
// The clean lab's kit. Terragroup's lab reference is a white glass box with a shoot set up around
// it: a sheeted gurney inside, a camera on a tripod outside the glass, orange flight cases on the
// floor, a coiled yellow cable off the ceiling and a blue tarp slung along the wall. These are the
// five pieces that turn an empty white box into a room somebody was working in this morning.

/** A hospital gurney with a sheet thrown over it, one edge hanging off the end. 0.8 by 2.0 on plan,
 *  origin at floor centre, long axis along z. Three draw calls. */
export function gurney(): THREE.Group {
  const g = new THREE.Group();
  const steel = labSteel(0x9aa5ad);
  g.add(instances(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 8), steel, [[-0.3, 0.3, -0.85], [0.3, 0.3, -0.85], [-0.3, 0.3, 0.85], [0.3, 0.3, 0.85]]));
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 1.9), steel); deck.position.y = 0.64; g.add(deck);
  // The sheet is a slab rather than cloth, and the one thing that sells it as cloth is the piece
  // hanging off the foot: a flat white box on a trolley reads as a box, a box with a fall does not.
  const linen = new THREE.MeshStandardMaterial({ color: 0xeef2f4, roughness: 0.9, side: THREE.DoubleSide });
  g.add(merged([
    new THREE.BoxGeometry(0.8, 0.25, 2.0).translate(0, 0.805, 0),
    new THREE.PlaneGeometry(0.8, 0.5).translate(0, 0.43, 1.0),
  ], linen));
  return g;
}

/** A cinema camera on a tripod: three splayed legs, a body and a lens, facing +z. 1.5 m to the top
 *  of the head, origin at floor centre. Three draw calls. */
export function tripodCamera(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x1b242c, roughness: 0.5, metalness: 0.4 });
  const lean = 0.28, apex = 1.4 * Math.cos(lean);
  const legs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3;
    // Each leg is built leaning back, then swung round the apex: the lean is about x and the
    // spacing about y, and baking both into the geometry keeps the three of them one mesh.
    const leg = new THREE.CylinderGeometry(0.012, 0.012, 1.4, 6);
    leg.rotateX(lean); leg.translate(0, apex / 2, -0.7 * Math.sin(lean)); leg.rotateY(a);
    legs.push(leg);
  }
  legs.push(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 8).translate(0, apex + 0.06, 0));
  g.add(merged(legs, labSteel(0x39434b)));
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.32), body); head.position.set(0, apex + 0.19, 0); g.add(head);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.16, 12).rotateX(Math.PI / 2), body);
  lens.position.set(0, apex + 0.19, 0.24); g.add(lens);
  return g;
}

/** A moulded flight case: coloured shell, a lid seam, two latches and a handle. 0.6 by 0.4 on plan,
 *  origin at floor centre, latches facing +z. Three draw calls. */
export function hardCase(color = 0xe07a2a): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.4), new THREE.MeshStandardMaterial({ color, roughness: 0.55 }));
  shell.position.y = 0.225; g.add(shell);
  const seam = new THREE.Mesh(new THREE.BoxGeometry(0.61, 0.02, 0.41), new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.7), roughness: 0.6 }));
  seam.position.y = 0.31; g.add(seam);
  g.add(merged([
    new THREE.BoxGeometry(0.08, 0.05, 0.02).translate(-0.18, 0.27, 0.21),
    new THREE.BoxGeometry(0.08, 0.05, 0.02).translate(0.18, 0.27, 0.21),
    new THREE.BoxGeometry(0.22, 0.03, 0.03).translate(0, 0.14, 0.215),
  ], new THREE.MeshStandardMaterial({ color: 0x14191d, roughness: 0.5 })));
  return g;
}

/** A yellow cable hung off the ceiling with its slack coiled at the bottom. The origin is the top
 *  of the coil and the cord runs 1.8 m up from it, so a room places it 1.8 m below its ceiling.
 *  Two draw calls. */
export function cableCoil(): THREE.Group {
  const g = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xe8b923, roughness: 0.6 });
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.8, 6), yellow); cord.position.y = 0.9; g.add(cord);
  g.add(instances(new THREE.TorusGeometry(0.22, 0.02, 8, 24).rotateX(Math.PI / 2), yellow, Array.from({ length: 6 }, (_, i) => [0, -i * 0.05, 0] as Spot)));
  return g;
}

/** A polythene tarp slung off a rail, `w` by `h`, origin at the centre of the sheet, facing +z. The
 *  sheet's vertices are pushed off the plane by a few centimetres, which is all it takes for the
 *  light to break up across it instead of laying one flat blue rectangle on the wall. Two calls. */
export function tarpWall(w: number, h: number, seed = 1): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(w, h, 12, 6);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const r = rng(seed);
  for (let i = 0; i < pos.count; i++) pos.setZ(i, (r() - 0.5) * 0.06);
  pos.needsUpdate = true; geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x2a5aa0, roughness: 0.95, side: THREE.DoubleSide })));
  const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.05), labSteel(0x9aa5ad));
  rail.position.y = h / 2 + 0.04; g.add(rail);
  return g;
}

// ---------------------------------------------------------------------------------------------
// The control room's kit. Ref 18 is a dispatch office read from the operator's own chair: a keyed
// console under the window, screens along the desk, a board of paperwork on the wall behind, and a
// file open under a lamp. These four pieces are what put a person at that desk five minutes ago.

/** A keyed control console: a carcass with a slanted face carrying the keys, on the desk. 1.0 along
 *  the desk by 0.5 deep, origin at the desk top on its own centre, face toward +z. Three calls. */
export function controlConsole(face: THREE.Texture): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.16, 0.5), carcass(0x9ea5a3, 0.6));
  body.position.set(0, 0.08, 0); g.add(body);
  // The keyed face is a wedge lying back over the carcass: a slab with a printed top reads as a
  // table mat, and the tilt is the whole reason a console looks like something a person operates.
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.02, 0.44), carcass(0xb3b8b6, 0.55));
  deck.rotation.x = -0.3; deck.position.set(0, 0.2, 0.02); g.add(deck);
  const keys = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.42), new THREE.MeshStandardMaterial({
    map: face, emissive: 0xffffff, emissiveMap: face, emissiveIntensity: 0.5, roughness: 0.75,
  }));
  keys.rotation.x = -Math.PI / 2 - 0.3; keys.position.set(0, 0.212, 0.023); keys.name = 'keys'; g.add(keys);
  return g;
}

export interface MonitorSpec { alive: boolean; face?: THREE.Texture }

/** A desk monitor on a plinth stand, 0.55 by 0.36, origin at the desk top on its own centre, screen
 *  toward +z. A dead one carries the same dark glass with nothing behind it, which is what a room
 *  with one live screen and two dark ones needs to read as a shift that ended. Three calls. */
export function monitor(spec: MonitorSpec): THREE.Group {
  const g = new THREE.Group();
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.02), carcass(DARK, 0.5));
  stand.position.set(0, 0.1, -0.01); g.add(stand);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.36, 0.04), carcass(DARK, 0.5));
  body.position.set(0, 0.38, 0); g.add(body);
  const map = spec.alive ? spec.face : undefined;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.31), new THREE.MeshStandardMaterial({
    color: 0x0b1117, map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: spec.alive ? 1.1 : 0,
    roughness: 0.4,
  }));
  screen.position.set(0, 0.38, 0.021); screen.name = 'face'; g.add(screen);
  return g;
}

/** A cork board with paperwork pinned to it: `w` by `h`, origin at the centre of the board, facing
 *  +z. Six sheets on their own angles, a pin in each, and a stencilled strip across the bottom that
 *  says what the board is for. Four draw calls. */
export function pinboard(w: number, h: number, label = 'ROSTER'): THREE.Group {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, h + 0.06, 0.04), carcass(0x4a3b2a, 0.85));
  g.add(frame);
  const cork = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0x6f5636, roughness: 0.95 }));
  cork.position.z = 0.021; g.add(cork);
  const r = rng(11);
  const sheets: THREE.BufferGeometry[] = [];
  const pins: Spot[] = [];
  for (let i = 0; i < 6; i++) {
    const x = -w / 2 + 0.2 + (i % 3) * (w - 0.4) / 2, y = h / 2 - 0.24 - Math.floor(i / 3) * (h - 0.62);
    const tilt = (r() - 0.5) * 0.22;
    const s = new THREE.PlaneGeometry(0.16, 0.22); s.rotateZ(tilt); s.translate(x, y, 0.024);
    sheets.push(s);
    pins.push([x + Math.sin(tilt) * 0.09, y + 0.09, 0.03]);
  }
  g.add(merged(sheets, new THREE.MeshStandardMaterial({ map: paperSheet(6), roughness: 0.92 })));
  g.add(instances(new THREE.CylinderGeometry(0.008, 0.008, 0.014, 6).rotateX(Math.PI / 2), carcass(0xd7383a, 0.4), pins));
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.5, 0.1), new THREE.MeshBasicMaterial({
    map: stencilTexture(label, { width: 256, height: 64, color: '#e8e4d8', font: '600 34px Michroma, system-ui, sans-serif', alpha: 0.85, flecks: false }),
    transparent: true, depthWrite: false,
  }));
  strip.position.set(0, -h / 2 + 0.09, 0.026); g.add(strip);
  return g;
}

/** A manila folder standing open on a desk: two leaves hinged at the fold, the near one propped up
 *  on the fold at fifty degrees with the form on it. Origin at the desk top on the fold, leaves
 *  along z, the propped one toward +z and facing +z. The form is a child named `page`, so a room
 *  can aim a lamp at it and a test can find it. Three draw calls.
 *
 *  The lift is fifty degrees rather than the eight it was drawn with. A folder lying flat on a desk
 *  is read from seven metres back at fifteen degrees off the horizontal, and at that angle an A4
 *  leaf is a seventy by twenty pixel sliver with nothing on it anybody can see. Propped, the same
 *  leaf is a card facing the lens, and a room turns the whole folder so that card faces the camera.
 */
export function openFile(page?: THREE.Texture): THREE.Group {
  const g = new THREE.Group();
  const LEAF = 0.4, DEEP = 0.29;
  const card = new THREE.MeshStandardMaterial({ color: 0xd6b979, roughness: 0.9, side: THREE.DoubleSide });
  const flat = new THREE.Mesh(new THREE.BoxGeometry(LEAF, 0.005, DEEP), card);
  flat.position.set(0, 0.0025, -DEEP / 2); g.add(flat);
  // The propped leaf swings about the fold, so it hangs off a pivot at the fold rather than sitting
  // at its own centre and turning, which would drive its hinge edge down through the desk.
  const hinge = new THREE.Group(); hinge.rotation.x = -0.87; g.add(hinge);
  const lifted = new THREE.Mesh(new THREE.BoxGeometry(LEAF, 0.005, DEEP), card);
  lifted.position.set(0, 0.0025, DEEP / 2); hinge.add(lifted);
  // Half a turn about the sheet's own normal before it is laid down, or the form is typed upside
  // down on the leaf: laying a plane flat maps the top of its canvas toward the fold, which is the
  // bottom of the card once the leaf is propped.
  const form = new THREE.PlaneGeometry(LEAF * 0.84, DEEP * 0.9).rotateZ(Math.PI).rotateX(-Math.PI / 2);
  const sheet = new THREE.Mesh(form, new THREE.MeshStandardMaterial({ map: page, roughness: 0.9 }));
  sheet.position.set(0, 0.007, DEEP / 2); sheet.name = 'page';
  hinge.add(sheet);
  return g;
}
