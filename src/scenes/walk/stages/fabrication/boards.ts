import * as THREE from 'three';
import { canvas, own, rng } from '../../labs/textures';

/**
 * The printed and engraved faces in the dispatch office, as canvas textures. Every one of them is
 * a thing that was made: a plate that was engraved, a board that was printed and then written on,
 * a tag that was painted through a stencil. Jordan's read of the earlier lettering was cheap, and
 * what cheap looks like is a word floating on a rectangle. Each face here carries the material it
 * is on as well as the words.
 */

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };
const tracked = (ctx: Ctx, px: number) => { ctx.letterSpacing = `${px}px`; };

const MICHROMA = 'Michroma, system-ui, sans-serif';
const SANS = '"Inter", "Segoe UI", system-ui, sans-serif';

/** Brushed steel: a mid grey ground with hairline streaks along x, a little brighter toward the
 *  top where the ceiling light catches it. Fills the whole canvas. */
function brushed(ctx: Ctx, w: number, h: number, seed: number): void {
  const r = rng(seed);
  const ground = ctx.createLinearGradient(0, 0, 0, h);
  ground.addColorStop(0, '#c6ced3'); ground.addColorStop(0.5, '#b3bcc2'); ground.addColorStop(1, '#a8b1b7');
  ctx.fillStyle = ground; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < h * 1.6; i++) {
    const y = r() * h, len = w * (0.2 + r() * 0.8), x = r() * (w - len);
    const light = r() > 0.5;
    ctx.fillStyle = light ? `rgba(255,255,255,${(0.04 + r() * 0.08).toFixed(3)})` : `rgba(20,30,36,${(0.03 + r() * 0.06).toFixed(3)})`;
    ctx.fillRect(x, y, len, 1);
  }
}

/** A machined edge round a face: a light line along the top and left, a dark one along the bottom
 *  and right, inset by `inset`. What separates a plate from a rectangle of texture. */
function bevel(ctx: Ctx, w: number, h: number, inset: number, weight = 3): void {
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(inset, inset, w - 2 * inset, weight); ctx.fillRect(inset, inset, weight, h - 2 * inset);
  ctx.fillStyle = 'rgba(10,16,22,0.45)';
  ctx.fillRect(inset, h - inset - weight, w - 2 * inset, weight); ctx.fillRect(w - inset - weight, inset, weight, h - 2 * inset);
}

/** Engraved lettering: the ink sits in a cut, so a pale highlight shows along its lower edge. */
function engrave(ctx: Ctx, text: string, x: number, y: number, ink = '#1b2129'): void {
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillText(text, x, y + 2);
  ctx.fillStyle = ink; ctx.fillText(text, x, y);
}

const CONDENSED = '"Saira Variable", "Saira", Michroma, system-ui, sans-serif';
const condensed = (ctx: Ctx, px: number, weight: number, track = 0.03) => {
  ctx.font = `${weight} ${px}px ${CONDENSED}`;
  (ctx as Ctx & { fontStretch?: string }).fontStretch = 'extra-condensed';
  tracked(ctx, Math.round(px * track));
};

/**
 * An equipment plate, 1024 by 280 for a plate 0.95 by 0.3: steel painted charcoal, the name
 * stencilled on it in the building's heavy condensed face in a cream that has gone a little yellow,
 * a block of the bay's sodium orange at the left end, the one line of what the thing is under a
 * rule, and a bolt through each end. The paint is worn back to the steel along the edges and round
 * the bolts, and scratched across the face.
 *
 * It was brushed steel with the name engraved in a wide display face, tracked out, with a bevel
 * drawn round it. Every part of that was clean and even, and in a loading bay it read as a label
 * drawn for a screen. The signs over the doors are painted metal that has been there for years,
 * and this is the same shop's work at a smaller size.
 */
export function nameplateFace(name: string, subtitle: string, seed = 5): THREE.CanvasTexture {
  const W = 1024, H = 280;
  const [c, raw] = canvas(W, H); const ctx = raw as Ctx;
  const r = rng(seed * 7 + 3);
  // The paint, a touch lighter through the middle where it has been wiped.
  const ground = ctx.createLinearGradient(0, 0, 0, H);
  ground.addColorStop(0, '#20262a'); ground.addColorStop(0.5, '#2a3136'); ground.addColorStop(1, '#1b2024');
  ctx.fillStyle = ground; ctx.fillRect(0, 0, W, H);
  // The orange block, with the paint's own unevenness.
  ctx.fillStyle = '#c96f26'; ctx.fillRect(0, 0, 34, H);
  ctx.fillStyle = 'rgba(20,14,8,0.25)'; for (let k = 0; k < 40; k++) ctx.fillRect(r() * 34, r() * H, 2 + r() * 10, 1 + r() * 3);
  // The name. Stencilled, so close set and heavy, sized to the plate and not tracked out.
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  let px = 150;
  condensed(ctx, px, 800);
  while (px > 60 && ctx.measureText(name).width > W - 150) { px -= 4; condensed(ctx, px, 800); }
  ctx.fillStyle = '#d8d3bd'; ctx.fillText(name, 74, 150);
  // The rule, and what it is under it.
  ctx.fillStyle = 'rgba(216,211,189,0.5)'; ctx.fillRect(74, 178, W - 148, 3);
  condensed(ctx, 54, 600, 0.08);
  ctx.fillStyle = '#a9a591'; ctx.fillText(subtitle.toUpperCase(), 74, 240);
  tracked(ctx, 0);
  // Wear. The stencil paint has gone in flecks, the charcoal has gone to bare steel along the edges
  // and in a few long scratches, and there is dirt in the corners and along the foot.
  ctx.fillStyle = '#252b30';
  for (let k = 0; k < 160; k++) ctx.fillRect(74 + r() * (W - 150), 40 + r() * 210, 1 + r() * 5, 1 + r() * 3);
  ctx.fillStyle = 'rgba(160,170,176,0.55)';
  for (let k = 0; k < 70; k++) { const top = r() > 0.5; ctx.fillRect(r() * W, top ? r() * 5 : H - r() * 6, 4 + r() * 30, 1 + r() * 3); }
  for (let k = 0; k < 30; k++) { const left = r() > 0.5; ctx.fillRect(left ? r() * 4 : W - r() * 6, r() * H, 1 + r() * 3, 4 + r() * 22); }
  ctx.strokeStyle = 'rgba(150,160,166,0.35)'; ctx.lineWidth = 1;
  for (let k = 0; k < 9; k++) { const x = r() * W, y = r() * H, len = 40 + r() * 220, a = (r() - 0.5) * 0.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke(); }
  for (const [cx, cy] of [[0, 0], [W, 0], [0, H], [W, H]] as [number, number][]) {
    const corner = ctx.createRadialGradient(cx, cy, 0, cx, cy, H * 0.7);
    corner.addColorStop(0, 'rgba(6,8,8,0.6)'); corner.addColorStop(1, 'rgba(6,8,8,0)');
    ctx.fillStyle = corner; ctx.fillRect(0, 0, W, H);
  }
  // The bolts, each in a ring of bare steel where the paint has cracked away from the washer.
  for (const x of [W - 40]) for (const y of [44, H - 44]) {
    ctx.fillStyle = 'rgba(150,160,166,0.5)'; ctx.beginPath(); ctx.arc(x, y, 19, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(x - 3, y - 3, 2, x, y, 14);
    g.addColorStop(0, '#c9d0d4'); g.addColorStop(0.7, '#737d83'); g.addColorStop(1, '#3a4348');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(16,22,26,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 9, y - 4); ctx.lineTo(x + 9, y + 4); ctx.stroke();
  }
  return own(c);
}

/** The small numbered tag on a plinth's front: the same steel, the number engraved. 256 by 128 for
 *  a tag 0.2 by 0.1. */
export function numberTag(n: string, seed = 9): THREE.CanvasTexture {
  const W = 256, H = 128;
  const [c, raw] = canvas(W, H); const ctx = raw as Ctx;
  brushed(ctx, W, H, seed);
  bevel(ctx, W, H, 4, 2);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `600 64px ${MICHROMA}`; tracked(ctx, 6);
  engrave(ctx, n, W / 2 + 3, H / 2 + 2);
  tracked(ctx, 0);
  return own(c);
}

export interface DispatchRow { product: string; bay: string; status: string; date: string; tick?: boolean; struck?: boolean }

/** The rows on the dispatch board: the three products on the plinths, each against its bay. */
export const DISPATCH_ROWS: DispatchRow[] = [
  { product: 'conch.gg', bay: 'bay 1', status: 'shipped', date: '09 SEP', tick: true },
  { product: 'ezkey.io', bay: 'bay 2', status: 'in flight', date: '12 SEP', tick: true },
  { product: 'earworm.games', bay: 'bay 3', status: 'shipped', date: '21 SEP', tick: true },
  { product: 'spares', bay: 'bay 4', status: 'held', date: '07 SEP', struck: true },
];

/** A stroke in marker: a slightly wavering line with round ends, the way a hand draws one. */
function marker(ctx: Ctx, from: [number, number], to: [number, number], width: number, color: string, r: () => number): void {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(from[0], from[1]);
  const n = 4;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    ctx.lineTo(from[0] + (to[0] - from[0]) * t + (r() - 0.5) * width * 0.8, from[1] + (to[1] - from[1]) * t + (r() - 0.5) * width * 0.8);
  }
  ctx.stroke();
}

/**
 * The dispatch board, 1024 by 576 for a board 1.8 by 1.0: a printed schedule under a blue header
 * carrying the Labs mark and DISPATCH, column heads, a row per product with its bay and status,
 * a date column, and then the hand on top of the print: ticks in blue marker against what has
 * gone, one row struck through, and a note scrawled in the margin. Whiteboard white, with the grey
 * ghost of an old wipe across it.
 */
export function dispatchBoardFace(rows: DispatchRow[] = DISPATCH_ROWS, seed = 21): THREE.CanvasTexture {
  const W = 1024, H = 576;
  const [c, raw] = canvas(W, H); const ctx = raw as Ctx;
  const r = rng(seed);
  const BLUE = '#2455A4', INK = '#1b2129', MARK = '#1f3f8f';
  // The board: white with a faint sheen and the ghost of wiped marker.
  const ground = ctx.createLinearGradient(0, 0, W, H);
  ground.addColorStop(0, '#f6f8f9'); ground.addColorStop(1, '#e9eef0');
  ctx.fillStyle = ground; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 9; i++) {
    const x = r() * W, y = 120 + r() * (H - 160), w = 80 + r() * 200, h = 20 + r() * 40;
    ctx.fillStyle = `rgba(60,80,110,${(0.02 + r() * 0.04).toFixed(3)})`;
    ctx.fillRect(x, y, w, h);
  }
  // The header band, with the mark, the title and the bay.
  const band = 92;
  ctx.fillStyle = BLUE; ctx.fillRect(0, 0, W, band);
  const hr = 20, mx = 44 + hr, my = band / 2;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.beginPath();
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; const x = mx + Math.cos(a) * hr, y = my + Math.sin(a) * hr; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.closePath(); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(mx - hr * 0.55, my - 2, hr * 1.1, 4);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.font = `600 46px ${MICHROMA}`; tracked(ctx, 6);
  ctx.fillText('DISPATCH', mx + hr + 30, my + 2);
  tracked(ctx, 0);
  ctx.textAlign = 'right'; ctx.font = `600 22px ${MICHROMA}`; tracked(ctx, 3);
  ctx.fillText('LOADING BAY 02', W - 40, my - 14);
  tracked(ctx, 0);
  ctx.font = `500 22px ${SANS}`; ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('week 37', W - 40, my + 18);
  // Column heads.
  const cols = [40, 340, 500, 730, 900];
  const heads = ['PRODUCT', 'BAY', 'STATUS', 'DATE', 'CHK'];
  ctx.textAlign = 'left'; ctx.fillStyle = '#3d4a55'; ctx.font = `600 22px ${SANS}`; tracked(ctx, 2);
  heads.forEach((h, i) => ctx.fillText(h, cols[i], band + 30));
  tracked(ctx, 0);
  ctx.fillStyle = 'rgba(27,33,41,0.6)'; ctx.fillRect(40, band + 52, W - 80, 2);
  // Rows: the print, then the hand.
  const top = band + 70, rowH = 96;
  rows.forEach((row, i) => {
    const y = top + i * rowH + rowH / 2;
    ctx.fillStyle = 'rgba(27,33,41,0.16)'; ctx.fillRect(40, top + (i + 1) * rowH - 6, W - 80, 1);
    ctx.fillStyle = INK; ctx.font = `600 38px ${SANS}`; ctx.fillText(row.product, cols[0], y);
    ctx.font = `500 34px ${SANS}`; ctx.fillStyle = '#2b3740';
    ctx.fillText(row.bay, cols[1], y); ctx.fillText(row.date, cols[3], y);
    // Status is what someone wrote, not what was printed.
    ctx.save(); ctx.translate(cols[2], y); ctx.rotate((r() - 0.5) * 0.04);
    ctx.font = `italic 600 36px ${SANS}`; ctx.fillStyle = MARK; ctx.fillText(row.status, 0, 2);
    ctx.restore();
    if (row.tick) {
      const x = cols[4] + 18;
      marker(ctx, [x - 14, y + 2], [x - 2, y + 16], 7, MARK, r);
      marker(ctx, [x - 2, y + 16], [x + 26, y - 18], 7, MARK, r);
    }
    if (row.struck) {
      marker(ctx, [cols[0] - 6, y + (r() - 0.5) * 8], [cols[4] + 60, y + (r() - 0.5) * 8], 8, MARK, r);
      ctx.save(); ctx.translate(cols[3] + 150, y - 34); ctx.rotate(-0.06);
      ctx.font = `italic 600 26px ${SANS}`; ctx.fillStyle = MARK; ctx.fillText('returned', 0, 0);
      ctx.restore();
    }
  });
  // The margin note, in the same hand.
  ctx.save(); ctx.translate(48, H - 44); ctx.rotate(-0.03);
  ctx.font = `italic 600 28px ${SANS}`; ctx.fillStyle = MARK;
  ctx.fillText('dock 1 shutter sticks, use dock 2', 0, 0);
  ctx.restore();
  marker(ctx, [40, H - 24], [520, H - 26], 4, MARK, r);
  return own(c);
}

/**
 * A column tag, painted through a stencil onto the concrete: a hazard yellow frame round a blue
 * field with the number in white, the paint thin enough at the edges for the blockwork to show.
 * 256 square for a tag 0.7 m across. Alpha where there is no paint.
 */
export function columnTag(n: string, seed = 3): THREE.CanvasTexture {
  const S = 256;
  const [c, raw] = canvas(S, S); const ctx = raw as Ctx;
  const r = rng(seed);
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = 'rgba(232,185,35,0.92)'; ctx.fillRect(12, 12, S - 24, S - 24);
  ctx.fillStyle = 'rgba(36,85,164,0.94)'; ctx.fillRect(30, 30, S - 60, S - 60);
  ctx.fillStyle = 'rgba(232,185,35,0.92)'; ctx.fillRect(30, S - 62, S - 60, 8);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `600 132px ${MICHROMA}`; ctx.fillStyle = '#f2f6f8';
  ctx.fillText(n, S / 2, S / 2 - 18);
  ctx.font = `600 18px ${MICHROMA}`; tracked(ctx, 3);
  ctx.fillText('COLUMN', S / 2, S - 44);
  tracked(ctx, 0);
  // Wear: the paint has flaked where the forklifts scuffed it.
  for (let i = 0; i < 260; i++) { ctx.clearRect(r() * S, r() * S, 1 + r() * 3, 1 + r() * 3); }
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 6; i++) { const x = r() * S, y = S * 0.6 + r() * S * 0.4; ctx.fillStyle = `rgba(0,0,0,${(0.2 + r() * 0.4).toFixed(2)})`; ctx.fillRect(x, y, 8 + r() * 40, 2 + r() * 6); }
  ctx.globalCompositeOperation = 'source-over';
  return own(c);
}

/**
 * The keypad half of the dispatch console: a cream panel with a grid of rounded keys, each with
 * its legend, three larger keys for the docks and a call key in the wing's orange, and a printed
 * label strip. 512 by 256 for a panel 0.56 by 0.28. Colour map.
 */
export function consoleKeys(): THREE.CanvasTexture {
  const W = 512, H = 256;
  const [c, raw] = canvas(W, H); const ctx = raw as Ctx;
  ctx.fillStyle = '#d5d6cf'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(0, 0, W, 3); ctx.fillRect(0, 0, 3, H);
  const key = (x: number, y: number, w: number, h: number, fill: string, legend: string, ink = '#2b3740') => {
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.roundRect(x + 2, y + 3, w, h, 6); ctx.fill();
    ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x + 4, y + 3, w - 8, 2);
    ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `600 ${Math.round(h * 0.42)}px ${SANS}`; ctx.fillText(legend, x + w / 2, y + h / 2 + 1);
  };
  const legends = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
  legends.forEach((l, i) => key(28 + (i % 3) * 58, 26 + Math.floor(i / 3) * 50, 48, 40, '#eceee9', l));
  ['DOCK 1', 'DOCK 2', 'GATE'].forEach((l, i) => key(226, 26 + i * 50, 120, 40, '#c9ccc6', l));
  key(226, 176, 120, 40, '#e0813a', 'CALL', '#1b1208');
  ['PA', 'MUTE', 'LOG'].forEach((l, i) => key(370, 26 + i * 50, 110, 40, '#c9ccc6', l));
  key(370, 176, 110, 40, '#2455a4', 'ACK', '#f2f6f8');
  // The label strip along the foot.
  ctx.fillStyle = '#b9bcb6'; ctx.fillRect(28, 228, 452, 18);
  ctx.fillStyle = '#2b3740'; ctx.textAlign = 'left'; ctx.font = `600 11px ${MICHROMA}`; tracked(ctx, 2);
  ctx.fillText('DISPATCH CONSOLE  BAY 02', 36, 237);
  tracked(ctx, 0);
  return own(c);
}
