import * as THREE from 'three';
import { canvas } from '../../labs/textures';

/**
 * A reel of real frames for a screen in the room: one small image holding a grid of them, shown one
 * at a time by moving the texture's window. The image loads out of band, the way the certification
 * badges do, and until it lands the screen is dark, which is what a screen with nothing on it is.
 * The texture is bound to its material from the start, so the frames arriving swaps an image and
 * compiles nothing.
 */
export interface Reel { texture: THREE.Texture; update(dt: number): void; dispose(): void }

/** The window onto frame `i` of a grid read left to right, top row first. */
export function reelWindow(i: number, cols: number, rows: number): { x: number; y: number } {
  return { x: (i % cols) / cols, y: 1 - (Math.floor(i / cols) + 1) / rows };
}

export function reel(url: string, cols: number, rows: number, seconds: number, opts: { pixel?: boolean } = {}): Reel {
  const [c, ctx] = canvas(2, 2);
  ctx.fillStyle = '#04070a'; ctx.fillRect(0, 0, 2, 2);
  const texture = new THREE.Texture();
  texture.image = c;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.userData.owned = true;
  // A window onto a grid: no mipmaps, or the frame next door bleeds in at the edges.
  texture.generateMipmaps = false; texture.minFilter = THREE.LinearFilter;
  if (opts.pixel) texture.magFilter = THREE.NearestFilter;
  texture.repeat.set(1 / cols, 1 / rows);
  texture.needsUpdate = true;
  let disposed = false, clock = 0, frame = -1;
  const show = (i: number) => { if (i === frame) return; frame = i; const w = reelWindow(i, cols, rows); texture.offset.set(w.x, w.y); };
  show(0);
  new THREE.ImageLoader().load(url, (img) => { if (disposed) return; texture.image = img; texture.needsUpdate = true; }, undefined, () => { /* the screen stays dark */ });
  return {
    texture,
    update(dt) { clock += dt; show(Math.floor(clock / seconds) % (cols * rows)); },
    dispose() { disposed = true; texture.dispose(); },
  };
}
