import * as THREE from 'three';
import { CUBE, HANGAR } from './constants';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
}

export function makeNoiseTexture(size = 256): THREE.CanvasTexture {
  const [c, ctx] = canvas(size, size);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 190 + Math.random() * 65;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 8);
  return t;
}

export function makeHazardTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 64);
  ctx.fillStyle = '#111111'; ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#E8B923';
  for (let x = -64; x < 320; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, 64); ctx.lineTo(x + 32, 64); ctx.lineTo(x + 96, 0); ctx.lineTo(x + 64, 0); ctx.closePath(); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(2, 1); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Terrazzo floor with a blue hex inlay at the centre and painted cable runs. Sized to the 40 x 70 floor. */
export function makeFloorTexture(): THREE.CanvasTexture {
  const W = 1024, H = 1792;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#1a2630'; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 7000; i++) {
    const g = 22 + Math.random() * 34;
    ctx.fillStyle = `rgb(${g},${g + 8},${g + 14})`;
    ctx.beginPath(); ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 1.4, 0, Math.PI * 2); ctx.fill();
  }
  const hex = (cx: number, cy: number, r: number, fill: string) => {
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k + Math.PI / 6;
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  };
  const R = 70;
  const cells: [number, number][] = [[0, 0], [1, 0], [-1, 0], [0.5, 1], [-0.5, 1], [0.5, -1], [-0.5, -1], [1.5, 1], [-1.5, -1]];
  // Keep the inlay under the cube: floor u maps to x across HANGAR.width, v to z along HANGAR.length.
  const hx = W * (0.5 + CUBE.x / HANGAR.width);
  const hy = H * (0.5 - CUBE.z / HANGAR.length);
  for (const [i, j] of cells) hex(hx + i * R * Math.sqrt(3), hy + j * R * 1.5, R - 4, j === 0 ? '#2455A4' : '#1c3f7a');
  ctx.lineWidth = 4; ctx.strokeStyle = '#d8b23a';
  ctx.beginPath(); ctx.moveTo(0, H * 0.72); ctx.bezierCurveTo(W * 0.3, H * 0.76, W * 0.5, H * 0.58, W, H * 0.64); ctx.stroke();
  ctx.lineWidth = 6; ctx.strokeStyle = '#0b0f13';
  ctx.beginPath(); ctx.moveTo(W * 0.12, 0); ctx.bezierCurveTo(W * 0.15, H * 0.4, W * 0.35, H * 0.6, W * 0.3, H); ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/** Wayfinding board above a gate. Requires the Michroma font to be loaded in the document. */
export function makeBoardTexture(label: string, cssColor: string): THREE.CanvasTexture {
  const [c, ctx] = canvas(512, 128);
  ctx.fillStyle = '#0a1016'; ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = cssColor; ctx.lineWidth = 4; ctx.strokeRect(6, 6, 500, 116);
  ctx.fillStyle = cssColor;
  ctx.font = '44px Michroma, system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label.toUpperCase(), 256, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
