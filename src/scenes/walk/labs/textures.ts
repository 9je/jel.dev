import * as THREE from 'three';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')!];
}
function own(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.userData.owned = true; return t;
}
/** Deterministic noise so a room looks the same on every load and every screenshot. */
export function rng(seed: number): () => number { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/** A server rack front: dark panels with rows of status LEDs, a few dark. Emissive map. */
export function rackFace(w = 256, h = 768, rows = 18, seed = 1): THREE.CanvasTexture {
  const [c, ctx] = canvas(w, h); const r = rng(seed);
  ctx.fillStyle = '#05080b'; ctx.fillRect(0, 0, w, h);
  const pitch = h / rows;
  for (let i = 0; i < rows; i++) {
    const y = i * pitch;
    ctx.fillStyle = i % 3 === 0 ? '#0b1117' : '#080d12'; ctx.fillRect(8, y + 2, w - 16, pitch - 4);
    const leds = 2 + Math.floor(r() * 4);
    for (let j = 0; j < leds; j++) {
      const on = r() > 0.15; const green = r() > 0.3;
      ctx.fillStyle = !on ? '#141a1f' : green ? '#3fd47a' : '#6ec1d6';
      ctx.fillRect(16 + j * 14, y + pitch / 2 - 3, 6, 6);
    }
    if (r() > 0.6) { ctx.fillStyle = '#1a2530'; ctx.fillRect(w - 70, y + pitch / 2 - 5, 50, 10); }
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
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
  const cell = size / 4;
  for (let i = -1; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell + size, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i * cell + size, 0); ctx.lineTo(i * cell, size); ctx.stroke();
  }
  const t = own(c, false); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
