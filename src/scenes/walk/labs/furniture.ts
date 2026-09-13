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
  // Off white rather than near white: at 0xeef2f4 under the credentials lab's own lights the sheet
  // clipped to paper and the trolley read as one untextured slab with no form in it at all.
  const linen = new THREE.MeshStandardMaterial({ color: 0xc9d3d9, roughness: 0.95, side: THREE.DoubleSide });
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
  // The keyed face is a wedge raked up away from the operator, who stands at +z: the far edge of
  // the deck is the high one, so the keys are turned toward whoever is working them. Raked the
  // other way the console presents its blank back to the room, which is exactly what the first
  // pass put in the middle of the frame.
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.02, 0.44), carcass(0xb3b8b6, 0.55));
  deck.rotation.x = 0.3; deck.position.set(0, 0.2, 0.02); g.add(deck);
  const keys = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.42), new THREE.MeshStandardMaterial({
    map: face, emissive: 0xffffff, emissiveMap: face, emissiveIntensity: 0.5, roughness: 0.75,
  }));
  keys.rotation.x = -Math.PI / 2 + 0.3; keys.position.set(0, 0.212, 0.023); keys.name = 'keys'; g.add(keys);
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
 *  The leaves are 0.44 by 0.32, which is a dossier rather than a document wallet: at the distance
 *  the control room parks the camera it is the difference between a form a hundred and forty pixels
 *  across and one a hundred and ten across, and the form is the point of the room.
 */
export function openFile(page?: THREE.Texture): THREE.Group {
  const g = new THREE.Group();
  const LEAF = 0.44, DEEP = 0.32;
  const card = new THREE.MeshStandardMaterial({ color: 0xc2a469, roughness: 0.92, side: THREE.DoubleSide });
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
  const form = new THREE.PlaneGeometry(LEAF * 0.92, DEEP * 0.92).rotateZ(Math.PI).rotateX(-Math.PI / 2);
  const sheet = new THREE.Mesh(form, new THREE.MeshStandardMaterial({ map: page, roughness: 0.9 }));
  sheet.position.set(0, 0.007, DEEP / 2); sheet.name = 'page';
  hinge.add(sheet);
  return g;
}

/**
 * A task chair: five star base on casters, gas column, a fabric seat and a tilted back with the
 * lumbar bar and two armrests. Origin on the floor at the column, facing +z. Three draw calls.
 * The rooms that need a desk chair used a wooden armchair off Poly Haven, which has no office
 * chair, and Jordan read it as a weak model. A server hall and a control room get this instead.
 */
export function taskChair(): THREE.Group {
  const g = new THREE.Group();
  const chrome = new THREE.MeshStandardMaterial({ color: 0x9aa3aa, metalness: 0.85, roughness: 0.3 });
  const fabric = new THREE.MeshStandardMaterial({ color: 0x1c2126, roughness: 0.92, metalness: 0 });
  const plastic = new THREE.MeshStandardMaterial({ color: 0x0f1215, roughness: 0.6, metalness: 0.1 });
  const SEAT = 0.47;
  const metal: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.03, 0.035, SEAT - 0.09, 12).translate(0, (SEAT - 0.09) / 2 + 0.04, 0)];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 10;
    const spoke = new THREE.BoxGeometry(0.32, 0.03, 0.04).translate(0.16, 0.05, 0);
    spoke.rotateY(a); metal.push(spoke);
    metal.push(new THREE.SphereGeometry(0.028, 10, 8).translate(Math.cos(a) * 0.31, 0.028, -Math.sin(a) * 0.31));
  }
  g.add(merged(metal, chrome));
  const back = new THREE.BoxGeometry(0.46, 0.5, 0.06).translate(0, SEAT + 0.35, -0.24);
  back.rotateX(-0.12);
  g.add(merged([new THREE.BoxGeometry(0.5, 0.08, 0.48).translate(0, SEAT, 0.01), back], fabric));
  const trim: THREE.BufferGeometry[] = [
    new THREE.BoxGeometry(0.42, 0.04, 0.05).translate(0, SEAT + 0.12, -0.245),
    new THREE.BoxGeometry(0.5, 0.05, 0.5).translate(0, SEAT - 0.06, 0.01),
  ];
  for (const sx of [-1, 1]) {
    trim.push(new THREE.BoxGeometry(0.03, 0.2, 0.05).translate(sx * 0.27, SEAT + 0.08, 0.04));
    trim.push(new THREE.BoxGeometry(0.06, 0.025, 0.26).translate(sx * 0.27, SEAT + 0.19, 0.0));
  }
  g.add(merged(trim, plastic));
  return g;
}

// ---------------------------------------------------------------------------------------------
// The break room's second drinks machine. `vendingMachine` above is the first cut and stays as it
// is for any room that still uses it. This one is built the way the real object is built: a full
// height glass door in a steel frame with a handle, the stock on lit shelves behind it, a lit header
// over the door, a coin mech column beside it and a delivery flap and a vent in the plinth.

export interface DrinksSpec { accent: string; lit: boolean; seed: number }

/** Draws `text` one glyph at a time with `spacing` pixels between them, centred on `x`. The canvas
 *  `letterSpacing` property is not in every browser the walk runs on. */
function tracked(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number): void {
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let cx = x - total / 2;
  const align = ctx.textAlign; ctx.textAlign = 'left';
  [...text].forEach((ch, i) => { ctx.fillText(ch, cx, y); cx += widths[i] + spacing; });
  ctx.textAlign = align;
}

/** A rounded rectangle path. */
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

/** A can on a shelf: a cylinder shaded across its width, a rim at the top and a label band with a
 *  mark on it. `x` is the left edge and `base` the shelf it stands on. */
function can(ctx: CanvasRenderingContext2D, x: number, base: number, w: number, h: number, colour: string, label: string): void {
  const top = base - h;
  const shade = ctx.createLinearGradient(x, 0, x + w, 0);
  shade.addColorStop(0, 'rgba(0,0,0,0.55)'); shade.addColorStop(0.18, 'rgba(255,255,255,0.18)'); shade.addColorStop(0.42, 'rgba(255,255,255,0)');
  shade.addColorStop(0.8, 'rgba(0,0,0,0.25)'); shade.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = colour; rrect(ctx, x, top + 4, w, h - 4, 5); ctx.fill();
  ctx.fillStyle = shade; rrect(ctx, x, top + 4, w, h - 4, 5); ctx.fill();
  // The label: a band of the label colour with a lighter mark across it.
  ctx.fillStyle = label; ctx.fillRect(x + 2, top + Math.round(h * 0.34), w - 4, Math.round(h * 0.34));
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; rrect(ctx, x + w * 0.22, top + h * 0.44, w * 0.56, h * 0.09, 3); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + w * 0.3, top + h * 0.57, w * 0.4, 3);
  ctx.fillStyle = shade; ctx.fillRect(x + 2, top + Math.round(h * 0.34), w - 4, Math.round(h * 0.34));
  // The rim.
  ctx.fillStyle = '#b9c3c9'; ctx.beginPath(); ctx.ellipse(x + w / 2, top + 5, w / 2, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5f6a70'; ctx.beginPath(); ctx.ellipse(x + w / 2, top + 5, w / 2 - 4, 3, 0, 0, Math.PI * 2); ctx.fill();
}

/** A bottle: body, shoulders, neck and cap, shaded like the can, with a label band. */
function bottle(ctx: CanvasRenderingContext2D, x: number, base: number, w: number, h: number, colour: string, label: string, cap: string): void {
  const top = base - h, neckW = w * 0.42, neckH = h * 0.2, shoulder = h * 0.12;
  ctx.fillStyle = colour;
  ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, top + neckH + shoulder);
  ctx.quadraticCurveTo(x, top + neckH, x + (w - neckW) / 2, top + neckH);
  ctx.lineTo(x + (w - neckW) / 2, top + 8); ctx.lineTo(x + (w + neckW) / 2, top + 8); ctx.lineTo(x + (w + neckW) / 2, top + neckH);
  ctx.quadraticCurveTo(x + w, top + neckH, x + w, top + neckH + shoulder); ctx.lineTo(x + w, base); ctx.closePath(); ctx.fill();
  const shade = ctx.createLinearGradient(x, 0, x + w, 0);
  shade.addColorStop(0, 'rgba(0,0,0,0.5)'); shade.addColorStop(0.2, 'rgba(255,255,255,0.28)'); shade.addColorStop(0.45, 'rgba(255,255,255,0)');
  shade.addColorStop(0.85, 'rgba(0,0,0,0.3)'); shade.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = shade; ctx.fill();
  ctx.fillStyle = label; ctx.fillRect(x + 1, top + h * 0.48, w - 2, h * 0.28);
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; rrect(ctx, x + w * 0.2, top + h * 0.56, w * 0.6, h * 0.08, 3); ctx.fill();
  ctx.fillStyle = shade; ctx.fillRect(x + 1, top + h * 0.48, w - 2, h * 0.28);
  ctx.fillStyle = cap; rrect(ctx, x + (w - neckW) / 2 - 2, top, neckW + 4, 10, 2); ctx.fill();
}

/** The stock behind the glass: five lit shelves of cans and bottles with a price rail on each and
 *  a few slots sold out. Colour and emissive map, 512 by 1024, for a door 0.56 by 1.17. */
export function drinksStock(seed = 1): THREE.CanvasTexture {
  const W = 512, H = 1024;
  const [c, ctx] = canvas(W, H); const r = rng(seed);
  // The cabinet interior: dark, with the LED strips down both sides lighting the edges.
  ctx.fillStyle = '#0a1219'; ctx.fillRect(0, 0, W, H);
  for (const [x0, x1] of [[0, 90], [W, W - 90]] as [number, number][]) {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, 'rgba(190,220,240,0.32)'); g.addColorStop(1, 'rgba(190,220,240,0)');
    ctx.fillStyle = g; ctx.fillRect(Math.min(x0, x1), 0, 90, H);
  }
  const drinks: [string, string, string][] = [
    ['#3fd47a', '#0e6d3a', '#e8f2ea'], ['#d7383a', '#7a1517', '#e8e2e2'], ['#6ec1d6', '#1f6f8a', '#eaf4f8'],
    ['#e8b923', '#8a6a0c', '#f3ecd8'], ['#e4eaee', '#2455a4', '#e4eaee'], ['#2b1a12', '#c8322b', '#1a120d'],
  ];
  const pitch = 200, cols = 8, colW = W / cols;
  for (let s = 0; s < 5; s++) {
    const base = pitch * (s + 1) - 26;
    const soldOut = Math.floor(r() * cols);
    for (let k = 0; k < cols; k++) {
      if (k === soldOut || r() < 0.1) continue;
      const [body, label, cap] = drinks[Math.floor(r() * drinks.length)];
      const isBottle = s < 2 ? r() < 0.75 : r() < 0.2;
      const x = k * colW + 5;
      if (isBottle) bottle(ctx, x, base, colW - 10, 168, body, label, cap);
      else can(ctx, x, base, colW - 8, 112, body, label);
    }
    // The shelf: a steel plate with a lip, and the price rail on its front edge.
    const plate = ctx.createLinearGradient(0, base, 0, base + 14);
    plate.addColorStop(0, '#8b979e'); plate.addColorStop(1, '#4b565d');
    ctx.fillStyle = plate; ctx.fillRect(0, base, W, 14);
    ctx.fillStyle = '#dfe6ea'; ctx.fillRect(0, base + 14, W, 16);
    ctx.fillStyle = '#1a2530';
    for (let k = 0; k < cols; k++) { ctx.fillRect(k * colW + 10, base + 19, 22, 6); ctx.fillRect(k * colW + 36, base + 19, 14, 6); ctx.fillRect(k * colW + colW - 3, base + 14, 2, 16); }
    // The spiral in front of each slot: a coil seen end on is a ring, and three rings a little
    // apart are the turns of one.
    ctx.strokeStyle = 'rgba(210,222,230,0.5)'; ctx.lineWidth = 2;
    for (let k = 0; k < cols; k++) for (let t = 0; t < 3; t++) {
      ctx.beginPath(); ctx.ellipse(k * colW + colW / 2, base - 24 - t * 3, colW * 0.4, 20, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }
  // Frost on the inside of the glass, along the bottom, where the cold pools.
  const frost = ctx.createLinearGradient(0, H - 120, 0, H);
  frost.addColorStop(0, 'rgba(200,225,240,0)'); frost.addColorStop(1, 'rgba(200,225,240,0.22)');
  ctx.fillStyle = frost; ctx.fillRect(0, H - 120, W, 120);
  const t = own(c); t.anisotropy = 8; return t;
}

/** The header over the door: a cold blue gradient, a bottle mark and the words in tracked Michroma.
 *  Colour and emissive map, 512 by 171, for a header 0.84 by 0.28. */
export function drinksHeader(accent = '#3D7BE0'): THREE.CanvasTexture {
  const W = 512, H = 171;
  const [c, ctx] = canvas(W, H);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#123a86'); g.addColorStop(0.55, accent); g.addColorStop(1, '#6ec1d6');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // A light sweep across the face, as a lit sign has where the tubes sit behind it.
  const sweep = ctx.createLinearGradient(0, 0, W * 0.6, H);
  sweep.addColorStop(0, 'rgba(255,255,255,0)'); sweep.addColorStop(0.5, 'rgba(255,255,255,0.16)'); sweep.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sweep; ctx.fillRect(0, 0, W, H);
  // A few soft flecks of frost.
  for (const [x, y, rad] of [[60, 30, 3], [420, 140, 2.5], [470, 40, 2], [110, 145, 2], [300, 20, 1.6]] as [number, number, number][]) {
    const f = ctx.createRadialGradient(x, y, 0, x, y, rad * 3);
    f.addColorStop(0, 'rgba(255,255,255,0.8)'); f.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = f; ctx.fillRect(x - rad * 3, y - rad * 3, rad * 6, rad * 6);
  }
  // The bottle mark: a white bottle with a highlight down one side and a droplet off its shoulder.
  const bx = 70, by = 28, bw = 34, bh = 118;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(bx, by + bh); ctx.lineTo(bx, by + 44); ctx.quadraticCurveTo(bx, by + 30, bx + 10, by + 28);
  ctx.lineTo(bx + 10, by + 8); ctx.lineTo(bx + bw - 10, by + 8); ctx.lineTo(bx + bw - 10, by + 28);
  ctx.quadraticCurveTo(bx + bw, by + 30, bx + bw, by + 44); ctx.lineTo(bx + bw, by + bh); ctx.closePath(); ctx.fill();
  ctx.fillStyle = accent; ctx.fillRect(bx + 4, by + 62, bw - 8, 26);
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(bx + 6, by + 34, 5, bh - 42);
  ctx.fillStyle = '#ffffff'; rrect(ctx, bx + 8, by, bw - 16, 10, 3); ctx.fill();
  ctx.beginPath(); ctx.ellipse(bx + bw + 14, by + 52, 5, 8, 0, 0, Math.PI * 2); ctx.fill();
  // The words, tracked wide, with a hairline under them.
  ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.font = '600 44px Michroma, system-ui, sans-serif';
  tracked(ctx, 'COLD DRINKS', 312, 74, 7);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(160, 108, 304, 2);
  ctx.font = '600 15px Michroma, system-ui, sans-serif';
  tracked(ctx, 'SERVED CHILLED', 312, 130, 5);
  // The sign's own bezel, so the face reads as a lit panel in a frame and not a decal.
  ctx.strokeStyle = 'rgba(8,16,26,0.75)'; ctx.lineWidth = 10; ctx.strokeRect(0, 0, W, H);
  const t = own(c); t.anisotropy = 8; return t;
}

/** The coin mech column: a display, a keypad, the coin and note slots, the return cup. Two maps of
 *  192 by 664 for a panel 0.26 by 0.9: the printed face, and the parts of it that light up. */
export function drinksMech(): { map: THREE.CanvasTexture; glow: THREE.CanvasTexture } {
  const W = 192, H = 664;
  const [c, ctx] = canvas(W, H);
  const [gc, gctx] = canvas(W, H);
  gctx.fillStyle = '#000000'; gctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#1e2932'; ctx.fillRect(0, 0, W, H);
  // A brushed inset panel the controls sit in.
  ctx.fillStyle = '#2a353e'; rrect(ctx, 10, 12, W - 20, H - 24, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; rrect(ctx, 10, 12, W - 20, H - 24, 8); ctx.stroke();
  // The display: a dark window with a lit readout.
  ctx.fillStyle = '#05080b'; rrect(ctx, 24, 30, W - 48, 72, 4); ctx.fill();
  ctx.strokeStyle = '#4b565d'; ctx.lineWidth = 2; rrect(ctx, 24, 30, W - 48, 72, 4); ctx.stroke();
  for (const cx of [ctx, gctx]) {
    cx.fillStyle = cx === ctx ? '#7fe3d6' : '#9ff0e4'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.font = '600 22px Michroma, system-ui, sans-serif'; cx.fillText('1.20', W / 2, 54);
    cx.font = '600 10px Michroma, system-ui, sans-serif'; cx.fillText('INSERT COIN', W / 2, 84);
  }
  // The keypad: three by four keys, each with its digit.
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
  keys.forEach((k, i) => {
    const kx = 30 + (i % 3) * 46, ky = 128 + Math.floor(i / 3) * 52;
    ctx.fillStyle = '#0f151a'; rrect(ctx, kx, ky, 38, 40, 5); ctx.fill();
    ctx.fillStyle = '#39454e'; rrect(ctx, kx + 2, ky + 2, 34, 34, 4); ctx.fill();
    ctx.fillStyle = '#cfd8dd'; ctx.font = '600 15px Michroma, system-ui, sans-serif'; ctx.fillText(k, kx + 19, ky + 20);
    gctx.fillStyle = 'rgba(120,150,170,0.28)'; gctx.font = ctx.font; gctx.textAlign = 'center'; gctx.textBaseline = 'middle'; gctx.fillText(k, kx + 19, ky + 20);
  });
  // The note slot, with its ready lamp, and the coin slot beside it.
  ctx.fillStyle = '#0f151a'; rrect(ctx, 30, 366, 100, 34, 4); ctx.fill();
  ctx.fillStyle = '#05080b'; ctx.fillRect(38, 380, 84, 6);
  ctx.fillStyle = '#3fd47a'; ctx.beginPath(); ctx.arc(150, 383, 5, 0, Math.PI * 2); ctx.fill();
  gctx.fillStyle = '#3fd47a'; gctx.beginPath(); gctx.arc(150, 383, 5, 0, Math.PI * 2); gctx.fill();
  ctx.fillStyle = '#8b979e'; rrect(ctx, 76, 416, 40, 60, 4); ctx.fill();
  ctx.fillStyle = '#05080b'; ctx.fillRect(92, 424, 8, 44);
  ctx.fillStyle = '#cfd8dd'; ctx.font = '600 9px Michroma, system-ui, sans-serif';
  ctx.fillText('COINS', 96, 490); ctx.fillText('NOTES', 80, 410);
  // The coin return button and the cup below it.
  ctx.fillStyle = '#0f151a'; ctx.beginPath(); ctx.arc(150, 446, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d7383a'; ctx.beginPath(); ctx.arc(150, 446, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#05080b'; rrect(ctx, 40, 560, W - 80, 60, 6); ctx.fill();
  ctx.fillStyle = '#cfd8dd'; ctx.fillText('CHANGE', W / 2, 636);
  // A service label and the maker's plate at the top.
  ctx.fillStyle = '#e6e1d3'; ctx.fillRect(28, 520, 60, 22);
  ctx.fillStyle = '#2455A4'; ctx.fillRect(28, 520, 60, 5);
  ctx.fillStyle = '#6b6f72'; ctx.fillRect(32, 530, 40, 2); ctx.fillRect(32, 535, 30, 2);
  const map = own(c); map.anisotropy = 8;
  const glow = own(gc); glow.anisotropy = 8;
  return { map, glow };
}

/**
 * A glass fronted drinks machine, 0.9 wide, 1.9 tall, 0.8 deep, origin at floor centre, facing +z.
 * A dark painted carcass with a full height glass door in a steel frame, the stock lit on shelves
 * behind it under LED strips, a lit header over the door, the coin mech column beside it, a
 * delivery flap and a vent grille in the plinth, and rubber feet. Unlit, the header, the strips, the
 * readout and the stock all go dark and the same machine is a dead one. Eight draw calls. The header
 * is named `header` so a room can drive its emissive with a failing circuit.
 */
export function drinksMachine(spec: DrinksSpec): THREE.Group {
  const g = new THREE.Group();
  const W = 0.9, H = 1.9, D = 0.8, F = D / 2, BACK = 0.1, FOOT = 0.04;
  const DOOR = { x0: -0.41, x1: 0.15, y0: 0.36, y1: 1.53 };
  const doorW = DOOR.x1 - DOOR.x0, doorH = DOOR.y1 - DOOR.y0, doorX = (DOOR.x0 + DOOR.x1) / 2, doorY = (DOOR.y0 + DOOR.y1) / 2;
  const colX = (DOOR.x1 + W / 2) / 2, colW = W / 2 - DOOR.x1;
  const body: THREE.BufferGeometry[] = [];
  const put = (geo: THREE.BufferGeometry, x: number, y: number, z: number) => { geo.translate(x, y, z); body.push(geo); };
  // The carcass: a back slab up to the shelves, then the wall, the column, the top and the plinth
  // that frame the cavity the door closes.
  put(new THREE.BoxGeometry(W, H - FOOT, BACK + F), 0, FOOT + (H - FOOT) / 2, (BACK - F) / 2);
  put(new THREE.BoxGeometry(DOOR.x0 + W / 2, H - FOOT, F - BACK), (DOOR.x0 - W / 2) / 2, FOOT + (H - FOOT) / 2, (BACK + F) / 2);
  put(new THREE.BoxGeometry(colW, H - FOOT, F - BACK), colX, FOOT + (H - FOOT) / 2, (BACK + F) / 2);
  put(new THREE.BoxGeometry(doorW, H - DOOR.y1, F - BACK), doorX, (H + DOOR.y1) / 2, (BACK + F) / 2);
  put(new THREE.BoxGeometry(doorW, DOOR.y0 - FOOT, F - BACK), doorX, (DOOR.y0 + FOOT) / 2, (BACK + F) / 2);
  // The delivery flap, hinged at its top and pushed in a little at the bottom.
  const flap = new THREE.BoxGeometry(0.36, 0.17, 0.012).translate(0, -0.085, 0).rotateX(0.35);
  put(flap, doorX, 0.29, F - 0.006);
  // The vent slats over the recess in the plinth under the column.
  for (let k = 0; k < 6; k++) put(new THREE.BoxGeometry(0.22, 0.012, 0.012), colX, 0.1 + k * 0.032, F + 0.004);
  g.add(merged(body, carcass(0x1a2530, 0.42)));

  // The black parts: the recesses behind the flap and the vent, and the feet.
  const black: THREE.BufferGeometry[] = [
    new THREE.BoxGeometry(0.4, 0.2, 0.09).translate(doorX, 0.2, F - 0.045 + 0.0005),
    new THREE.BoxGeometry(0.24, 0.2, 0.031).translate(colX, 0.19, F - 0.015 + 0.0005),
  ];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) black.push(new THREE.CylinderGeometry(0.032, 0.036, FOOT, 10).translate(sx * 0.38, FOOT / 2, sz * 0.32));
  g.add(merged(black, carcass(0x0b0f13, 0.7)));

  // The steel: the door frame, the handle, the note slot mouth and the coin cup.
  const rail = 0.04, proud = 0.02;
  const steel: THREE.BufferGeometry[] = [
    new THREE.BoxGeometry(doorW + rail, rail, proud).translate(doorX, DOOR.y1 + rail / 2, F + proud / 2),
    new THREE.BoxGeometry(doorW + rail, rail, proud).translate(doorX, DOOR.y0 - rail / 2, F + proud / 2),
    new THREE.BoxGeometry(rail, doorH + rail * 2, proud).translate(DOOR.x0 - rail / 2 + 0.01, doorY, F + proud / 2),
    new THREE.BoxGeometry(rail, doorH + rail * 2, proud).translate(DOOR.x1 + rail / 2 - 0.01, doorY, F + proud / 2),
    new THREE.BoxGeometry(0.025, 0.5, 0.02).translate(DOOR.x1 - 0.06, 1.0, F + 0.06),
    new THREE.BoxGeometry(0.02, 0.03, 0.05).translate(DOOR.x1 - 0.06, 0.78, F + 0.035),
    new THREE.BoxGeometry(0.02, 0.03, 0.05).translate(DOOR.x1 - 0.06, 1.22, F + 0.035),
    new THREE.BoxGeometry(0.12, 0.03, 0.02).translate(colX, 0.98, F + 0.01),
    new THREE.BoxGeometry(0.1, 0.05, 0.03).translate(colX, 0.70, F + 0.015),
  ];
  g.add(merged(steel, labSteel(0x9aa5ad)));

  // The stock on its shelves at the back of the cavity, and the LED strips down the door reveals.
  const shelves = drinksStock(spec.seed);
  const stock = new THREE.Mesh(new THREE.PlaneGeometry(doorW, doorH), new THREE.MeshStandardMaterial({
    map: shelves, emissive: 0xffffff, emissiveMap: shelves, emissiveIntensity: spec.lit ? 0.9 : 0, roughness: 0.8,
  }));
  stock.position.set(doorX, doorY, BACK + 0.002); g.add(stock);
  const strips: THREE.BufferGeometry[] = [];
  for (const x of [DOOR.x0 + 0.012, DOOR.x1 - 0.012]) strips.push(new THREE.BoxGeometry(0.012, doorH - 0.02, 0.012).translate(x, doorY, F - 0.03));
  g.add(merged(strips, new THREE.MeshStandardMaterial({ color: spec.lit ? 0xffffff : 0x2a3138, emissive: 0xdff0f6, emissiveIntensity: spec.lit ? 2.4 : 0, roughness: 0.5 })));

  const glass = new THREE.Mesh(new THREE.PlaneGeometry(doorW, doorH), new THREE.MeshPhysicalMaterial({
    color: LABS.glassTint, transparent: true, opacity: 0.12, roughness: 0.14, metalness: 0, depthWrite: false,
  }));
  glass.position.set(doorX, doorY, F + 0.004); glass.renderOrder = 2; g.add(glass);

  const face = drinksHeader(spec.accent);
  const header = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.28), new THREE.MeshStandardMaterial({
    color: 0xffffff, map: face, emissive: 0xffffff, emissiveMap: face, emissiveIntensity: spec.lit ? 1.3 : 0, roughness: 0.5,
  }));
  header.position.set(0, (H + DOOR.y1) / 2 + 0.01, F + 0.002); header.name = 'header'; g.add(header);

  const mech = drinksMech();
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.9), new THREE.MeshStandardMaterial({
    color: 0xffffff, map: mech.map, emissive: 0xffffff, emissiveMap: mech.glow, emissiveIntensity: spec.lit ? 1.4 : 0, roughness: 0.6,
  }));
  panel.position.set(colX, 1.05, F + 0.002); g.add(panel);
  return g;
}
