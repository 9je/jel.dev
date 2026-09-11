import * as THREE from 'three';

const v = new THREE.Vector3(), edge = new THREE.Vector3(), axis = new THREE.Vector3();

/** The gap between an exhibit and the card describing it, and between the card and the frame. */
const GAP = 16;
/** The dock's strip down the right of the frame: its own inset plus the width its labels reserve. */
const RAIL = 176;

/** Which side of the exhibit the card hangs on: the outer one, away from the middle of the frame,
 *  because the middle of the frame is the part of the room worth looking at. */
export function cardSide(x: number, vw: number): 'left' | 'right' {
  return x < vw / 2 ? 'left' : 'right';
}

/**
 * Where the card's left edge goes: clear of the exhibit, outward from the middle of the frame, and
 * never off it. `x` is the exhibit's anchor in screen pixels and `halfW` is how far its own geometry
 * reaches from that anchor, so a card never lands on the thing it is captioning. `rail` is the strip
 * the dock holds down the right of the frame, which the card is not allowed to slide under.
 *
 * Arithmetic only, so the placement can be read without a browser.
 */
export function cardLeft(x: number, halfW: number, cardW: number, vw: number, gap = GAP, rail = 0): number {
  const side = cardSide(x, vw) === 'left' ? x - halfW - gap - cardW : x + halfW + gap;
  return Math.max(gap, Math.min(side, vw - rail - cardW - gap));
}

/** The card's vertical centre, held inside the frame however tall the card is. */
export function cardTop(y: number, cardH: number, vh: number, gap = GAP): number {
  const half = Math.min(cardH, vh - gap * 2) / 2;
  return Math.max(gap + half, Math.min(y, vh - gap - half));
}

/**
 * Pins the open exhibit card beside the exhibit it describes. The camera moves every frame, so this
 * runs every frame; `data-offscreen` hides the card when its exhibit is behind the camera or well
 * out of frame, which is what a jump to another stop looks like before the card is closed.
 */
export function pinOverlays(card: HTMLElement, anchors: Map<string, THREE.Vector3>, radii: Map<string, number>, camera: THREE.PerspectiveCamera): void {
  const id = card.dataset.anchor ?? '';
  const a = anchors.get(id);
  // The stage that owns this exhibit may have been streamed out. Park the card rather than leave it
  // at the default, which would drop it over the middle of the room.
  if (!a) { card.toggleAttribute('data-offscreen', true); return; }
  v.copy(a).project(camera);
  card.toggleAttribute('data-offscreen', v.z > 1 || Math.abs(v.x) > 1.4 || Math.abs(v.y) > 1.4);
  const vw = window.innerWidth, vh = window.innerHeight;
  const x = ((v.x + 1) / 2) * vw;
  // The exhibit's reach across the frame, measured by projecting a point one radius along the
  // camera's own right: the same prop is a hand's width from the far end of the hall and half the
  // frame from the hold, and the card has to clear it in both.
  axis.setFromMatrixColumn(camera.matrixWorld, 0);
  edge.copy(a).addScaledVector(axis, radii.get(id) ?? 0).project(camera);
  const halfW = Math.abs(((edge.x + 1) / 2) * vw - x);
  // The dock stands down the right of the frame above its own breakpoint, over the card's layer.
  const rail = vw > 700 ? RAIL : 0;
  card.dataset.side = cardSide(x, vw);
  card.style.setProperty('--cx', `${Math.round(cardLeft(x, halfW, card.offsetWidth, vw, GAP, rail))}px`);
  card.style.setProperty('--cy', `${Math.round(cardTop(((1 - v.y) / 2) * vh, card.offsetHeight, vh))}px`);
}
