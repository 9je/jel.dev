import * as THREE from 'three';

/** A 2d canvas of a size, with its context. Exported for `furniture.ts`, whose canvases belong to
 *  one room and would otherwise sit in the first visit bundle for the sake of one later chunk. */
export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d', { willReadFrequently: true })!];  // CPU raster, see textures.ts
}
/** Wraps a canvas as a texture this scene owns, so `disposeObject` may free it. */
export function own(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.userData.owned = true; return t;
}
/**
 * Television static: a square of luminance noise that tiles, for a set with no signal on it.
 *
 * It is one still frame, not an animation. A canvas repainted every frame is a texture upload every
 * frame, and static does not need one: the field is noise, so a random offset into a tiling noise
 * texture is a new field of static, and moving the offset costs two numbers. The caller jumps
 * `map.offset` on each update and the screen crawls exactly the way a dead channel does.
 *
 * The distribution matters more than the resolution. Real static is mostly mid grey with the tails
 * pulled out, so the noise is the average of three samples, which bunches it toward the middle, and
 * then a few per cent of pixels are driven to black or white to put the sparkle back.
 */
export function staticNoise(size = 256, seed = 3): THREE.DataTexture {
  const r = rng(seed);
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    let v = Math.round(((r() + r() + r()) / 3) * 190);
    const spike = r();
    if (spike < 0.03) v = 245; else if (spike < 0.07) v = 8;
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  // No mipmaps, and nearest magnification. Every other texture in the walk wants the opposite, and
  // this one is the exception for the same reason it exists: mipmapped, the noise averages to its
  // own mean the moment the screen is more than a couple of metres off, and a screen full of static
  // becomes a flat white card. Static has to stay grainy at distance or it is not static, and the
  // aliasing that costs is the artefact being drawn.
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Deterministic noise so a room looks the same on every load and every screenshot. */
export function rng(seed: number): () => number { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/**
 * The face of one rack unit, 0.52 by 0.09 in the world: two drive handles with their own activity
 * lights, a vent grille, and a pair of status LEDs on the right. Emissive map, so only the lit parts
 * of it glow and the bezel itself stays lit by the room.
 *
 * The v1 rack painted a whole 2 m front as one 256 by 768 canvas, and at hall distance that reads as
 * a smear of coloured dots. One canvas per unit at its own aspect keeps the handles and the grille
 * legible instead, and the unit is what a person counts when they read a rack.
 */
export function unitFace(seed = 1): THREE.CanvasTexture {
  const w = 320, h = 56;
  const [c, ctx] = canvas(w, h); const r = rng(seed);
  ctx.fillStyle = '#0b1219'; ctx.fillRect(0, 0, w, h);
  // Two drive carriers on the left, each a lit face with a handle bar and its own activity lights.
  // The carriers glow rather than sit dark with a pinprick on them: at hall distance a unit is five
  // pixels tall, and a lit bezel is the only part of it anybody can actually read.
  for (let i = 0; i < 2; i++) {
    const x = 10 + i * 74;
    ctx.fillStyle = '#4a5f70'; ctx.fillRect(x, 8, 66, h - 16);
    ctx.fillStyle = '#8ba4b4'; ctx.fillRect(x + 6, 14, 46, 7);
    ctx.fillStyle = '#2b3946'; ctx.fillRect(x + 6, 28, 46, 12);
    ctx.fillStyle = r() > 0.25 ? '#5fe89a' : '#16242e'; ctx.fillRect(x + 55, 14, 7, 7);
    ctx.fillStyle = r() > 0.6 ? '#ffd24a' : '#16242e'; ctx.fillRect(x + 55, 33, 7, 7);
  }
  // The grille: hairlines, not a texture of holes. At this size holes fill in and go grey.
  ctx.fillStyle = '#1a2630'; ctx.fillRect(166, 8, 106, h - 16);
  ctx.fillStyle = '#44596b';
  for (let x = 170; x < 268; x += 6) ctx.fillRect(x, 12, 3, h - 24);
  // Two status LEDs on the right, sometimes amber, occasionally out.
  for (let i = 0; i < 2; i++) {
    const on = r() > 0.18;
    ctx.fillStyle = !on ? '#16242e' : r() > 0.35 ? '#9be6f6' : '#ffd24a';
    ctx.fillRect(284, 12 + i * 22, 10, 10);
  }
  return own(c);
}

/** A screen showing a few lines of text on a dark ground, with a scanline wash. Emissive map. */
export function screenFace(lines: string[], accent = '#6EC1D6', w = 512, h = 320): THREE.CanvasTexture {
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = '#06101a'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = accent; ctx.fillRect(0, 0, w, 6);
  ctx.font = '600 34px Michroma, system-ui, sans-serif'; ctx.fillStyle = '#CFE6EE'; ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, 28, 36 + i * 52));
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 2);
  return own(c);
}

/**
 * The break room television's idle picture: the Labs mark, large, over the word, on the deep blue
 * a set shows between programmes. Colour and emissive map, 4:3. It was a status board of three
 * rows, which from the walk was text too small to read: "id rather lose visibility and just do a
 * logo or something than text thats hard to read". A mark reads at any size and any angle. The
 * word is JEL, the building's own name, not LABS.
 */
export function labsIdent(): THREE.CanvasTexture {
  const w = 640, h = 480;
  const [c, ctx] = canvas(w, h);
  const bg = ctx.createRadialGradient(w / 2, h * 0.45, 30, w / 2, h / 2, w * 0.7);
  bg.addColorStop(0, '#1d4f9e'); bg.addColorStop(1, '#071a38');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  // The mark: two chevrons stacked into an arrow, the cut the wall stencil in the server hall uses.
  ctx.fillStyle = '#E6F2F7';
  const mx = w / 2, my = h * 0.36, s = 190;
  for (const dy of [-s * 0.42, s * 0.18]) {
    ctx.beginPath(); ctx.moveTo(mx - s * 0.5, my + dy + s * 0.5); ctx.lineTo(mx, my + dy); ctx.lineTo(mx + s * 0.5, my + dy + s * 0.5);
    ctx.lineTo(mx + s * 0.5, my + dy + s * 0.28); ctx.lineTo(mx, my + dy - s * 0.22); ctx.lineTo(mx - s * 0.5, my + dy + s * 0.28); ctx.closePath(); ctx.fill();
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = '600 104px Michroma, system-ui, sans-serif';
  ctx.fillText('JEL', mx, h * 0.86);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
  return own(c);
}

/**
 * Someone walking past behind the sealed door, as two emissive maps: the wired glass and the seam
 * of light under the door. Each is a strip three times its own width, lit white at both ends, with
 * the figure in the middle third, so a map at `repeat.x` 1/3 shows plain light and sliding its
 * offset walks the figure across. Clamped at the edges, so anywhere past the strip is lit.
 *
 * The glass gets a head and shoulders, the seam gets the shadow of two feet and the body over
 * them. Both are drawn soft: the glass is wired and frosted and the figure is a metre behind it,
 * and a hard edged cut out would read as a sticker sliding over the pane.
 */
export function passerby(): { glass: THREE.CanvasTexture; seam: THREE.CanvasTexture } {
  const shadowed = (ctx: CanvasRenderingContext2D, blur: number, draw: () => void) => {
    // A blurred shape without ctx.filter, which Safari does not have: draw it far off the canvas
    // and let its shadow land where it belongs.
    ctx.save(); ctx.shadowColor = '#000000'; ctx.shadowBlur = blur; ctx.shadowOffsetX = 4000;
    ctx.translate(-4000, 0); ctx.fillStyle = '#000000'; draw(); ctx.restore();
  };
  // The pane is 0.4 by 0.5 m, 128 by 160 here, its top edge 1.97 m off the floor.
  const [gc, g] = canvas(384, 160);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 384, 160);
  shadowed(g, 14, () => {
    const cx = 192, px = 320; // px per metre
    const y = (m: number) => (1.97 - m) * px;
    g.beginPath(); g.ellipse(cx, y(1.68), 0.085 * px, 0.11 * px, 0, 0, Math.PI * 2); g.fill();
    g.fillRect(cx - 0.05 * px, y(1.58), 0.1 * px, 0.06 * px);
    g.beginPath(); g.moveTo(cx - 0.22 * px, 170); g.quadraticCurveTo(cx - 0.21 * px, y(1.5), cx - 0.08 * px, y(1.54));
    g.lineTo(cx + 0.08 * px, y(1.54)); g.quadraticCurveTo(cx + 0.21 * px, y(1.5), cx + 0.22 * px, 170); g.closePath(); g.fill();
  });
  // The seam is 1.6 m along, 128 px here: the body's shadow wide and faint, the feet dark in it.
  const [sc, sctx] = canvas(384, 16);
  const body = sctx.createLinearGradient(192 - 40, 0, 192 + 40, 0);
  body.addColorStop(0, '#ffffff'); body.addColorStop(0.5, '#3a3a3a'); body.addColorStop(1, '#ffffff');
  sctx.fillStyle = body; sctx.fillRect(0, 0, 384, 16);
  shadowed(sctx, 5, () => { sctx.fillRect(192 - 13, 0, 9, 16); sctx.fillRect(192 + 4, 0, 9, 16); });
  const strip = (c: HTMLCanvasElement) => {
    const t = own(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.repeat.set(1 / 3, 1); return t;
  };
  return { glass: strip(gc), seam: strip(sc) };
}

/** A sheet of paper with grey lines of text, slightly yellowed. Colour map. */
export function paperSheet(seed = 1): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 180); const r = rng(seed);
  ctx.fillStyle = '#e8e4d8'; ctx.fillRect(0, 0, 128, 180);
  ctx.fillStyle = '#6b6f72';
  for (let y = 20; y < 160; y += 9) { const len = 40 + r() * 70; ctx.fillRect(14, y, len, 2); }
  ctx.fillStyle = '#2455A4'; ctx.fillRect(14, 8, 36, 5);
  return own(c);
}

/** Barrier tape: hazard yellow with black lettering, tiling along x. Colour map. */
export function tapeStripe(text = 'RESTRICTED AREA'): THREE.CanvasTexture {
  const [c, ctx] = canvas(1024, 64);
  ctx.fillStyle = '#E8B923'; ctx.fillRect(0, 0, 1024, 64);
  ctx.fillStyle = '#111111'; ctx.font = '700 40px system-ui, sans-serif'; ctx.textBaseline = 'middle';
  for (let x = 0; x < 1024; x += 520) ctx.fillText(text, x + 20, 32);
  const t = own(c); t.wrapS = THREE.RepeatWrapping; return t;
}

/** A hazard plate for a cabinet door: yellow triangle and a label. Colour map. */
export function hazardPlate(text = 'HIGH VOLTAGE'): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#d8dde1'; ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#E8B923'; ctx.beginPath(); ctx.moveTo(128, 40); ctx.lineTo(220, 190); ctx.lineTo(36, 190); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#111111'; ctx.font = '700 90px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', 128, 135);
  ctx.font = '700 22px system-ui, sans-serif'; ctx.fillText(text, 128, 226);
  return own(c);
}

/** Chain-link mesh as an alpha map: diamond wire on clear, tiling. */
export function chainlink(size = 256): THREE.CanvasTexture {
  const [c, ctx] = canvas(size, size);
  ctx.clearRect(0, 0, size, size);
  // Line width 4, not the thinner 3: at cage viewing distance the thinner line breaks into a
  // speckle of sub-pixel dots instead of a clean diamond crossing, which reads as shimmer as the
  // camera moves.
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5;
  const cell = size / 4;
  for (let i = -1; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell + size, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i * cell + size, 0); ctx.lineTo(i * cell, size); ctx.stroke();
  }
  // Anisotropy 16, not the kit default of 4: a cage run tiles this twenty times along its length and
  // an alpha tested wire at a grazing angle sparkles into speckle without it.
  const t = own(c, false); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16; return t;
}

/**
 * The inside of a switch cabinet: rows of breaker toggles on a back plate, a few of them thrown.
 * Colour map, so the cabinet's interior reads as hardware in shadow rather than as a lit panel.
 * The face is only ever seen through an open door at an angle, so it is drawn coarse on purpose:
 * legible toggles beat a finely rendered panel nobody gets closer than two metres to.
 */
export function breakerFace(seed = 1): THREE.CanvasTexture {
  const w = 256, h = 384;
  const [c, ctx] = canvas(w, h); const r = rng(seed);
  ctx.fillStyle = '#20282e'; ctx.fillRect(0, 0, w, h);
  // Three din rails, twelve breakers on each, with a busbar running down the left of the plate.
  ctx.fillStyle = '#3c4750'; ctx.fillRect(14, 30, w - 28, 4);
  for (let row = 0; row < 3; row++) {
    const y = 60 + row * 106;
    ctx.fillStyle = '#161d23'; ctx.fillRect(16, y - 6, w - 32, 62);
    for (let i = 0; i < 12; i++) {
      const x = 22 + i * 18;
      ctx.fillStyle = '#c8ccce'; ctx.fillRect(x, y, 14, 50);
      // The toggle: up and grey is closed, down and red is a breaker somebody has thrown.
      const tripped = r() > 0.78;
      ctx.fillStyle = tripped ? '#c8322b' : '#4d5760';
      ctx.fillRect(x + 3, tripped ? y + 30 : y + 8, 8, 12);
    }
  }
  ctx.fillStyle = '#8a939a'; ctx.fillRect(14, h - 46, w - 28, 6);
  ctx.fillStyle = '#e8b923'; ctx.fillRect(14, h - 28, 40, 10);
  return own(c);
}

/**
 * The first disclosure: a typed page with five of its eight lines struck out in black and a
 * PENDING RELEASE stamp across it. Colour map for a sheet of A4 lying on the table under the lamp.
 *
 * The bars are the whole point of the prop, so they are drawn at full black on cream rather than as
 * a soft redaction: under a 3.5 intensity warm point at half a metre, anything lighter reads as a
 * smudge on the paper instead of as something deliberately taken out.
 */
export function redactedSheet(): THREE.CanvasTexture {
  const w = 420, h = 594;
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = '#f1eee2'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1b2129'; ctx.font = '700 26px Michroma, system-ui, sans-serif'; ctx.textBaseline = 'top';
  ctx.fillText('FIRST DISCLOSURE', 40, 56);
  ctx.fillStyle = '#5d646a'; ctx.fillRect(40, 96, w - 80, 2);
  // Eight lines of body: three left as typed grey, five struck out.
  const struck = new Set([1, 2, 4, 5, 7]);
  const runs = [0.86, 0.92, 0.74, 0.9, 0.81, 0.95, 0.68, 0.88];
  runs.forEach((run, i) => {
    const y = 136 + i * 46, len = (w - 80) * run;
    if (struck.has(i)) { ctx.fillStyle = '#0a0c0e'; ctx.fillRect(40, y - 4, len, 26); return; }
    ctx.fillStyle = '#6b7075';
    for (let x = 40; x < 40 + len; x += 12) ctx.fillRect(x, y + 6, 8, 3);
  });
  // The stamp, tilted across the lower third, drawn as an outlined box with the words inside it.
  ctx.save();
  ctx.translate(w * 0.5, h * 0.74); ctx.rotate((-20 * Math.PI) / 180);
  ctx.strokeStyle = '#b8322c'; ctx.lineWidth = 5; ctx.strokeRect(-150, -34, 300, 68);
  ctx.fillStyle = '#b8322c'; ctx.font = '700 34px Michroma, system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('PENDING RELEASE', 0, 2);
  ctx.restore();
  return own(c);
}

/**
 * The personnel file's propped leaf: a buff form, landscape, with a black header band carrying the
 * name, a photograph blocked out beside two typed fields, and the service record ruled under them.
 * `lines[0]` is the name, `lines[1]` and `lines[2]` are the fields, and the rest are records.
 *
 * Drawn coarse on purpose, and the coarseness is the whole design. On the settled frame the leaf is
 * fifty pixels across, so nothing survives that is not a block at full black on buff: the band, the
 * bordered photograph, the two field rules and three ruled rows. The words on it are for the reader
 * who opens the still, and the blocks are for everyone else.
 */
export function personnelSheet(lines: string[]): THREE.CanvasTexture {
  const w = 560, h = 420;
  const [c, ctx] = canvas(w, h);
  const [name = '', role = '', origin = '', ...records] = lines;
  // Buff rather than white. Under the lamp the form is the brightest thing in the room by a long
  // way, and a white ground clips to flat paper with nothing on it at all.
  ctx.fillStyle = '#cbbf9e'; ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = 'middle';
  // Header band. Black, full bleed, a fifth of the sheet, the name reversed out of it.
  ctx.fillStyle = '#0c1014'; ctx.fillRect(0, 0, w, 86);
  ctx.fillStyle = '#f2eee2'; ctx.font = '700 46px Michroma, system-ui, sans-serif';
  ctx.fillText(fit(ctx, name, w - 48), 24, 45);
  // The photograph: a head and shoulders blocked out on grey inside a heavy black border. At the
  // size the form is read from the hold this is the one element that says personnel file at all.
  ctx.fillStyle = '#0c1014'; ctx.fillRect(20, 110, 152, 186);
  ctx.fillStyle = '#7d776a'; ctx.fillRect(28, 118, 136, 170);
  ctx.fillStyle = '#3a3730'; ctx.beginPath(); ctx.arc(96, 176, 38, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(52, 222, 88, 66);
  // Two fields beside it, each a value on a heavy rule.
  [role, origin].forEach((value, i) => {
    const y = 146 + i * 84;
    ctx.font = '600 32px Michroma, system-ui, sans-serif'; ctx.fillStyle = '#12171d';
    ctx.fillText(fit(ctx, value, 340), 194, y);
    ctx.fillStyle = '#0c1014'; ctx.fillRect(194, y + 28, 344, 7);
  });
  // The record, ruled: the year in the file's one accent and the entry beside it.
  records.slice(0, 3).forEach((entry, i) => {
    const y = 330 + i * 34;
    const cut = entry.indexOf(' ');
    ctx.font = '700 28px Michroma, system-ui, sans-serif'; ctx.fillStyle = '#8a3a2c';
    ctx.fillText(cut > 0 ? entry.slice(0, cut) : entry, 22, y);
    ctx.font = '600 22px system-ui, sans-serif'; ctx.fillStyle = '#0c1014';
    ctx.fillText(fit(ctx, cut > 0 ? entry.slice(cut + 1) : '', 390), 126, y + 1);
    ctx.fillStyle = '#0c1014'; ctx.fillRect(22, y + 16, w - 44, 3);
  });
  return own(c);
}

/** Shrinks `text` until it fits `max` pixels at the context's current font, so a long entry loses
 *  its tail rather than running off the edge of the form it is typed on. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let cut = text.length;
  while (cut > 4 && ctx.measureText(`${text.slice(0, cut)}...`).width > max) cut--;
  return `${text.slice(0, cut).trimEnd()}...`;
}

/** The same, over `rows` lines: words are broken at spaces and only the last line is cut short. A
 *  record of a year in one truncated line is a line that says nothing, which is what the timeline
 *  on the control desk read as once the years carried more than one thing each. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number, rows: number): string[] {
  const words = text.split(' ');
  const out: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= max || !line) { line = next; continue; }
    out.push(line); line = word;
    if (out.length === rows - 1) break;
  }
  const rest = words.slice(out.join(' ').split(' ').filter(Boolean).length).join(' ');
  out.push(fit(ctx, out.length === rows - 1 ? rest : line, max));
  return out.slice(0, rows);
}

/**
 * The control room's live screen: a plan of the facility with the walk's own route on it and where
 * the reader is standing, beside a short status board.
 *
 * It carried the personnel file's three dated lines, which is the same copy the stop's own text
 * column is already showing a metre to the left of it. Jordan's note was that it was hard to read
 * and offered nothing new, and both halves of that are the same problem: three lines of prose on a
 * 0.95 m panel four metres away are always going to be small, and small is only worth paying for
 * when the thing being said is not already said better somewhere else.
 *
 * A plan is the answer to both. It is the one thing a control room over a loading yard would
 * actually have on the wall, it says something no other surface on the site says, and it survives
 * being small in a way prose does not: a plan communicates by shape first, so the outline of the
 * building and the route drawn through it read from the hold even when the room labels are down at
 * annotation size. The type that has to be read is the status board beside it and the callout on
 * the reader's own position, and both of those are set large.
 *
 * The footprints are the rooms' own, taken from each stage's layout and drawn to one scale, and the
 * route is `CONTROL_POINTS`. Carrying the numbers here rather than importing six layout modules
 * keeps the first visit bundle out of it, and the plan is a diagram either way: the test pins it to
 * the same values the rooms are built from.
 */
export function facilityPlan(): THREE.CanvasTexture {
  const W = 768, H = 480;
  const [c, ctx] = canvas(W, H);
  const INK = '#cfe6ee', DIM = '#5f89a3', LINE = '#22435c';

  ctx.fillStyle = '#04101a'; ctx.fillRect(0, 0, W, H);
  // A survey grid under everything, five metres to the square.
  ctx.strokeStyle = 'rgba(60,110,145,0.16)'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x + 0.5, 64); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
  for (let y = 64; y < H; y += 24) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }

  // The header.
  ctx.fillStyle = '#6ec1d6'; ctx.fillRect(0, 0, W, 64);
  ctx.fillStyle = '#04222c'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.font = '600 34px Michroma, system-ui, sans-serif';
  ctx.fillText('FACILITY PLAN', 20, 34);
  ctx.textAlign = 'right'; ctx.font = '600 22px Michroma, system-ui, sans-serif';
  ctx.fillText('CONTROL 01', W - 20, 34);

  // ---- The plan --------------------------------------------------------------------------------
  // World x -86..14 and z -38..34, drawn west to the left and +z up, to one scale that fits both.
  const S = 3.9, ox = 28, oz = 132;
  const px = (x: number) => ox + (x + 86) * S;
  const py = (z: number) => oz + (34 - z) * S;

  /** A room: its footprint, and a short name set inside it. */
  const room = (x0: number, x1: number, z0: number, z1: number, name: string) => {
    const l = px(x0), r = px(x1), t = py(z1), b = py(z0);
    ctx.fillStyle = 'rgba(20,52,76,0.85)'; ctx.fillRect(l, t, r - l, b - t);
    ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.strokeRect(l + 1, t + 1, r - l - 2, b - t - 2);
    ctx.fillStyle = DIM; ctx.font = '600 13px Michroma, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(name, (l + r) / 2, (t + b) / 2);
  };
  room(-20, 14, -30, 22, 'BAY');
  room(-58, -20, -35, -27, 'BREAK');
  room(-76, -58, -38, -24, 'SERVER');
  room(-83, -75, -30, 6, 'CERTS');
  room(-86, -72, 6, 26, 'SWITCH');
  room(-77, -62, 26, 34, '');

  // The route, dashed, with a tick at every stop the walk holds at.
  const route: [number, number][] = [
    [0, 26], [0, 12], [-3, -14], [-8, -26], [-16, -31], [-30, -31], [-44, -31], [-58, -31],
    [-70, -31], [-79, -26], [-79, -12], [-79, 4], [-79, 18], [-75, 27], [-70, 30],
  ];
  ctx.strokeStyle = '#e0a13a'; ctx.lineWidth = 3; ctx.setLineDash([9, 6]);
  ctx.beginPath(); route.forEach(([x, z], i) => (i ? ctx.lineTo(px(x), py(z)) : ctx.moveTo(px(x), py(z))));
  ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#e0a13a';
  for (const [x, z] of [[0, 26], [-7, -11], [-28, -31], [-58, -31], [-79, -22], [-79, 4]] as [number, number][]) {
    ctx.beginPath(); ctx.arc(px(x), py(z), 4, 0, Math.PI * 2); ctx.fill();
  }

  // Where the reader is standing. The one thing on the plan set at reading size.
  const hx = px(-70), hz = py(30);
  ctx.strokeStyle = '#e8b923'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(hx, hz, 13, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#e8b923'; ctx.beginPath(); ctx.arc(hx, hz, 6, 0, Math.PI * 2); ctx.fill();
  // The callout goes to the right of the mark. The control room is at the north west corner of the
  // building, which is the top left of the plan, so set right aligned it ran off the panel: the
  // screen read "ROL" over "E HERE". East of the mark there is nothing until the bay.
  ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.font = '600 22px Michroma, system-ui, sans-serif';
  ctx.fillText('CONTROL', hx + 22, hz + 4);
  ctx.font = '600 14px Michroma, system-ui, sans-serif'; ctx.fillStyle = DIM;
  ctx.textBaseline = 'top'; ctx.fillText('YOU ARE HERE', hx + 22, hz + 6);

  // A north arrow, over the empty quarter of the plan.
  const nx = px(10), ny = py(-34);
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(nx, ny + 22); ctx.lineTo(nx, ny - 14); ctx.stroke();
  ctx.fillStyle = INK; ctx.beginPath();
  ctx.moveTo(nx, ny - 22); ctx.lineTo(nx - 7, ny - 8); ctx.lineTo(nx + 7, ny - 8); ctx.closePath(); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = '600 15px Michroma, system-ui, sans-serif'; ctx.fillText('N', nx, ny + 26);

  // ---- The status board ------------------------------------------------------------------------
  const bx = 452;
  ctx.strokeStyle = LINE; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(bx - 16, 82); ctx.lineTo(bx - 16, H - 22); ctx.stroke();
  const rows: [string, string, string][] = [
    ['BAY DOOR', 'CLOSED', '#3fd47a'],
    ['SERVER HALL', 'ROW B FAULT', '#e0a13a'],
    ['CONTAINMENT', 'SEALED', '#d7383a'],
    ['YARD', 'LIT', '#3fd47a'],
  ];
  rows.forEach(([label, value, lamp], i) => {
    const y = 108 + i * 92;
    ctx.fillStyle = lamp; ctx.beginPath(); ctx.arc(bx + 9, y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = DIM; ctx.font = '600 19px Michroma, system-ui, sans-serif';
    ctx.fillText(label, bx + 28, y);
    ctx.fillStyle = lamp; ctx.font = '600 25px Michroma, system-ui, sans-serif';
    ctx.fillText(value, bx + 28, y + 34);
    if (i < rows.length - 1) {
      ctx.strokeStyle = LINE; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx, y + 62.5); ctx.lineTo(W - 24, y + 62.5); ctx.stroke();
    }
  });

  const t = own(c); t.anisotropy = 8; return t;
}

/**
 * A control desk's face: the recessed wells the key caps sit in, stencilled legends over each bank,
 * the slider track and the two lamps. Colour and emissive map, so the live keys glow and the rest of
 * the panel stays lit by the room. The caps themselves are geometry: see `controlConsole`.
 */
export function consoleFace(): THREE.CanvasTexture {
  const w = 512, h = 256;
  const [c, ctx] = canvas(w, h);
  // A brushed panel rather than a flat grey. The first pass filled it with one colour and printed
  // the keys on it, and a printed key has no edge to catch a light: from the hold the whole console
  // was a grey slab with a chequerboard on it, which is what Jordan called mid.
  const ground = ctx.createLinearGradient(0, 0, 0, h);
  ground.addColorStop(0, '#c3c7c5'); ground.addColorStop(0.5, '#b4b9b7'); ground.addColorStop(1, '#9ea4a2');
  ctx.fillStyle = ground; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(0, 0, w, 3);
  ctx.fillStyle = 'rgba(40,48,52,0.35)'; ctx.fillRect(0, h - 4, w, 4);
  for (let y = 0; y < h; y += 3) { ctx.fillStyle = 'rgba(255,255,255,0.035)'; ctx.fillRect(0, y, w, 1); }

  // The wells the caps drop into: a dark recess with a lit top lip and a shadow under it, on the
  // same six by three grid `controlConsole` places the caps on.
  for (let row = 0; row < 3; row++) for (let col = 0; col < 6; col++) {
    const x = KEY_GRID.x0 + col * KEY_GRID.dx, y = KEY_GRID.y0 + row * KEY_GRID.dy;
    ctx.fillStyle = 'rgba(30,36,40,0.55)'; ctx.fillRect(x - 5, y - 5, KEY_GRID.w + 10, KEY_GRID.h + 10);
    ctx.fillStyle = '#2f3438'; ctx.fillRect(x - 3, y - 3, KEY_GRID.w + 6, KEY_GRID.h + 6);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x - 3, y - 3, KEY_GRID.w + 6, 2);
  }
  // Legends stencilled over each bank of two.
  ctx.font = '600 15px Michroma, system-ui, sans-serif'; ctx.fillStyle = '#41474a';
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('BAY', 26, 40); ctx.fillText('DOOR', 142, 40); ctx.fillText('LIGHTS', 258, 40);
  // The slider, and the two lamps under it.
  ctx.fillStyle = '#8d9290'; ctx.fillRect(404, 48, 72, 156);
  ctx.fillStyle = 'rgba(30,36,40,0.5)'; ctx.fillRect(404, 48, 72, 3);
  ctx.fillStyle = '#31373a'; ctx.fillRect(436, 60, 8, 132);
  ctx.fillStyle = '#d8dcda'; ctx.fillRect(422, 126, 36, 18);
  ctx.fillStyle = '#3fd47a'; ctx.fillRect(410, 216, 24, 16);
  ctx.fillStyle = '#2a3033'; ctx.fillRect(446, 216, 24, 16);
  return own(c);
}

/**
 * The key grid, in canvas pixels on a 512 by 256 face. `consoleFace` prints a well at each of these
 * and `controlConsole` stands a cap in it, so the two have to agree: one of them alone is either a
 * printed chequerboard or a row of caps floating on a blank panel.
 */
export const KEY_GRID = { x0: 26, y0: 56, dx: 58, dy: 56, w: 40, h: 34, canvas: [512, 256] as [number, number] };
/** Which of the eighteen keys are lit, as `[row, col]`. */
export const KEY_LIVE: [number, number][] = [[1, 2], [2, 4]];


/**
 * A neon run's corona, text-shaped: the letters drawn in the tube colour under a wide blur on a
 * clear ground, to stand behind the extruded run and show past its strokes. Bloom draws a corona on
 * the tiers that run the post stack. This is the one the low tier has no bloom to draw, and on the
 * tiers that do it is the wider, dimmer half the bloom radius does not reach. Michroma is loaded
 * before any room builds (see `scene.ts`), so the canvas draws the same face the geometry was cut
 * from and the blurred ink lands on the letters. The ink box comes back in canvas pixels so the
 * caller can scale the plane to lay that ink over its run.
 */
export function neonGlow(text: string, color: string): { texture: THREE.CanvasTexture; w: number; h: number; ink: { x: number; y: number; w: number; h: number } } {
  const w = 1536, h = 272, pad = 120;
  const [c, ctx] = canvas(w, h);
  ctx.clearRect(0, 0, w, h);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  // Michroma is wide: size the face so the run fits inside the pad with room for the blur's tail.
  const face = (px: number) => `600 ${px}px Michroma, system-ui, sans-serif`;
  ctx.font = face(100);
  const size = Math.min(200, Math.floor(((w - 2 * pad) * 100) / Math.max(1, ctx.measureText(text).width)));
  ctx.font = face(size);
  const m = ctx.measureText(text);
  // Node's stub context measures nothing: fall back to the face's typical proportions, 0.95 em
  // per capital and caps 0.72 em tall, so a plane built without a DOM is still sign sized.
  const measured = m.actualBoundingBoxAscent !== undefined;
  const left = measured ? m.actualBoundingBoxLeft : 0, right = measured ? m.actualBoundingBoxRight : text.length * size * 0.95;
  const asc = measured ? m.actualBoundingBoxAscent : size * 0.72, desc = measured ? m.actualBoundingBoxDescent : 0;
  const inkW = left + right, inkH = asc + desc;
  const x = (w - inkW) / 2 + left, y = (h - inkH) / 2 + asc;
  ctx.fillStyle = color; ctx.shadowColor = color;
  // Three passes: a tight bright blur that hugs the strokes, a wide faint one for the tail, and
  // one more tight pass so the near corona keeps up with the tail's accumulation.
  for (const blur of [22, 70, 22]) { ctx.shadowBlur = blur; ctx.fillText(text, x, y); }
  return { texture: own(c), w, h, ink: { x: x - left, y: y - asc, w: inkW, h: inkH } };
}

/**
 * One acoustic ceiling tile, off white with the pinholes and fissures mineral tile is pressed with,
 * and a slightly darker bevel where it sits in the grid. Clean rooms have these. The shared
 * ceiling texture is a sprayed plaster that goes brown under a bright lamp, which is what made the
 * lab's lid read as a cheap stucco ceiling. Repeat it once per tile.
 */
export function acousticTile(size = 256): THREE.CanvasTexture {
  const [c, ctx] = canvas(size, size); const r = rng(77);
  ctx.fillStyle = '#eef1f2'; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 90; i++) {
    ctx.strokeStyle = `rgba(150,160,166,${0.12 + r() * 0.12})`; ctx.lineWidth = 0.8 + r();
    ctx.beginPath(); let x = r() * size, y = r() * size; ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 16; y += (r() - 0.5) * 16; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  for (let i = 0; i < 700; i++) { ctx.fillStyle = `rgba(120,130,136,${0.25 + r() * 0.3})`; ctx.fillRect(r() * size, r() * size, 1.5, 1.5); }
  ctx.fillStyle = 'rgba(90,100,106,0.18)';
  ctx.fillRect(0, 0, size, 5); ctx.fillRect(0, size - 5, size, 5); ctx.fillRect(0, 0, 5, size); ctx.fillRect(size - 5, 0, 5, size);
  const t = own(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

/**
 * A clean room's sheet vinyl, `w` by `d` metres, 64 px to the metre: pale and faintly mottled, a
 * welded seam every two metres, scuffed along the line people walk, and a band of blue hexagons
 * laid into it across the middle of the room, which is the one pattern the reference labs floor has.
 */
export function vinylFloor(w: number, d: number): THREE.CanvasTexture {
  const ppm = 64, W = Math.round(w * ppm), Hh = Math.round(d * ppm);
  const [c, ctx] = canvas(W, Hh); const r = rng(19);
  ctx.fillStyle = '#d3dade'; ctx.fillRect(0, 0, W, Hh);
  for (let i = 0; i < W * Hh * 0.02; i++) {
    const v = 190 + Math.floor(r() * 40);
    ctx.fillStyle = `rgba(${v},${v + 6},${v + 10},0.35)`; ctx.fillRect(r() * W, r() * Hh, 2, 2);
  }
  // The hexagons: a band of them down the middle third, alternate cells blue, some half worn.
  const R = 0.42 * ppm, hx = R * Math.sqrt(3);
  for (let row = 0; row * R * 1.5 < Hh; row++) {
    for (let col = -1; col * hx < W + hx; col++) {
      const cx = col * hx + (row % 2 ? hx / 2 : 0), cy = row * R * 1.5;
      if (Math.abs(cx - W / 2) > W * 0.22) continue;
      if (r() < 0.45) continue;
      ctx.fillStyle = r() < 0.7 ? `rgba(36,85,164,${0.55 + r() * 0.3})` : `rgba(110,193,214,${0.35 + r() * 0.2})`;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; const x = cx + Math.cos(a) * (R - 2), y = cy + Math.sin(a) * (R - 2); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(90,100,108,0.35)';
  for (let x = 2 * ppm; x < W; x += 2 * ppm) ctx.fillRect(x, 0, 1.5, Hh);
  // Scuffing down the walked line.
  for (let i = 0; i < 260; i++) {
    ctx.strokeStyle = `rgba(60,64,66,${0.05 + r() * 0.08})`; ctx.lineWidth = 1 + r() * 2;
    const x = W / 2 + (r() - 0.5) * W * 0.35, y = r() * Hh;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 10); ctx.stroke();
  }
  return own(c);
}
