import * as THREE from 'three';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')!];
}

export function hazardTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 64);
  ctx.fillStyle = '#111111'; ctx.fillRect(0, 0, 256, 64); ctx.fillStyle = '#E8B923';
  for (let x = -64; x < 320; x += 64) { ctx.beginPath(); ctx.moveTo(x, 64); ctx.lineTo(x + 32, 64); ctx.lineTo(x + 96, 0); ctx.lineTo(x + 64, 0); ctx.closePath(); ctx.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.userData.owned = true;  // built here, so disposeObject() may free it
  return t;
}

/** Stencilled lettering with a transparent background, for decals on doors and walls. */
export function stencilTexture(text: string, opts: { width: number; height: number; color: string; font: string; alpha?: number }): THREE.CanvasTexture {
  const [c, ctx] = canvas(opts.width, opts.height);
  ctx.clearRect(0, 0, opts.width, opts.height);
  ctx.fillStyle = opts.color; ctx.font = opts.font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // Canvas text neither wraps nor shrinks, so a line wider than the canvas is simply cropped.
  // Measure once and step the pixel size down to fit inside a small margin.
  const px = Number(/(\d+(?:\.\d+)?)px/.exec(opts.font)?.[1] ?? 100);
  const wide = ctx.measureText(text).width;
  const room = opts.width * 0.9;
  if (wide > room) ctx.font = opts.font.replace(/(\d+(?:\.\d+)?)px/, `${Math.max(8, Math.floor(px * room / wide))}px`);
  ctx.globalAlpha = opts.alpha ?? 0.88; ctx.fillText(text, opts.width / 2, opts.height / 2);
  // Punch out flecks so the paint reads worn rather than printed.
  for (let i = 0; i < 400; i++) { ctx.clearRect(Math.random() * opts.width, Math.random() * opts.height, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.userData.owned = true;  // built here, so disposeObject() may free it
  return t;
}

/** A soft radial falloff, white in the centre and clear at the rim, for light pools and dust motes. */
export function radialTexture(size = 128, hardness = 0.15): THREE.CanvasTexture {
  const [c, ctx] = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(hardness, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.28)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.userData.owned = true;  // built here, so disposeObject() may free it
  return t;
}
