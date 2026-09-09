import * as THREE from 'three';

/** Pure scroll maths for the ticker: advance by speed and wrap at the loop width. */
export function tickerOffset(offset: number, dt: number, speedPx: number, loopWidth: number): number {
  const o = offset + dt * speedPx;
  return loopWidth > 0 ? o % loopWidth : o;
}

export interface LedTicker { texture: THREE.CanvasTexture; update(dt: number): void; dispose(): void }

/**
 * A dot-matrix LED board drawn to a canvas. The text is laid out once, measured to find the loop
 * width, then redrawn each frame at a scrolling offset with a grid knocked out of it so the letters
 * read as lamps rather than as type.
 */
export function createLedTicker(lines: string[], opts: { width: number; height: number }): LedTicker {
  const c = document.createElement('canvas');
  c.width = opts.width; c.height = opts.height;
  const ctx = c.getContext('2d')!;
  const font = `700 ${Math.round(opts.height * 0.62)}px "Saira Variable", Saira, system-ui, sans-serif`;
  const text = lines.map((l) => l.toUpperCase()).join('      •      ') + '      •      ';
  ctx.font = font;
  // A zero loop width (an empty line list) would make the draw loop below never advance.
  const loopWidth = Math.max(1, Math.ceil(ctx.measureText(text).width));
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.userData.owned = true;  // built here, so disposeObject() may free it
  let offset = 0;
  const dot = 4;
  function draw() {
    ctx.fillStyle = '#05080b'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#F2C230'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = font;
    for (let x = -offset; x < c.width; x += loopWidth) ctx.fillText(text, x, c.height / 2);
    // dot-matrix mask: knock out a grid so the text reads as LEDs
    ctx.fillStyle = '#05080b';
    for (let y = 0; y < c.height; y += dot) ctx.fillRect(0, y, c.width, 1);
    for (let x = 0; x < c.width; x += dot) ctx.fillRect(x, 0, 1, c.height);
    texture.needsUpdate = true;
  }
  draw();
  return {
    texture,
    update(dt) { offset = tickerOffset(offset, dt, 90, loopWidth); draw(); },
    dispose() { texture.dispose(); },
  };
}
