import * as THREE from 'three';

/** A 2d canvas of a size, with its context. Exported for `furniture.ts`, whose canvases belong to
 *  one room and would otherwise sit in the first visit bundle for the sake of one later chunk. */
export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')!];
}
/** Wraps a canvas as a texture this scene owns, so `disposeObject` may free it. */
export function own(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.userData.owned = true; return t;
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
