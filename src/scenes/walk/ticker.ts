import * as THREE from 'three';

/** Pure scroll maths for the ticker: advance by speed and wrap at the loop width. */
export function tickerOffset(offset: number, dt: number, speedPx: number, loopWidth: number): number {
  const o = offset + dt * speedPx;
  return loopWidth > 0 ? o % loopWidth : o;
}

export interface LedTicker { texture: THREE.CanvasTexture; update(dt: number): void; dispose(): void }

/**
 * A dot-matrix LED board. The whole loop of text is drawn to a canvas once, with a grid knocked out
 * of it so the letters read as lamps rather than as type, and uploaded once. Scrolling is a texture
 * offset: the board shows a `width` px window onto the loop and the window slides. The old version
 * redrew and re-uploaded a 2048 px canvas 24 times a second, which an integrated GPU felt.
 */
export function createLedTicker(lines: string[], opts: { width: number; height: number }): LedTicker {
  const c = document.createElement('canvas');
  const measure = c.getContext('2d')!;
  const font = `700 ${Math.round(opts.height * 0.62)}px "Saira Variable", Saira, system-ui, sans-serif`;
  const text = lines.map((l) => l.toUpperCase()).join('      •      ') + '      •      ';
  measure.font = font;
  const dot = 4;
  // The loop is at least one window wide so a short line still fills the board, and a multiple of
  // the dot pitch so the grid tiles cleanly across the wrap.
  const loopWidth = Math.max(opts.width, Math.ceil(Math.max(1, measure.measureText(text).width) / dot) * dot);
  c.width = loopWidth; c.height = opts.height;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#05080b'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#F2C230'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.font = font;
  for (let x = 0; x < c.width; x += loopWidth) ctx.fillText(text, x, c.height / 2);
  ctx.fillStyle = '#05080b';
  for (let y = 0; y < c.height; y += dot) ctx.fillRect(0, y, c.width, 1);
  for (let x = 0; x < c.width; x += dot) ctx.fillRect(x, 0, 1, c.height);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.x = opts.width / loopWidth;
  texture.userData.owned = true;  // built here, so disposeObject() may free it
  let offset = 0;
  return {
    texture,
    update(dt) { offset = tickerOffset(offset, dt, 90, loopWidth); texture.offset.x = offset / loopWidth; },
    dispose() { texture.dispose(); },
  };
}
