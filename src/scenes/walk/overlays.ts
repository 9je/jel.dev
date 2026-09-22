import * as THREE from 'three';

const v = new THREE.Vector3();

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
 * Where the card's left edge goes: hard against the outer margin on the side of the frame the
 * exhibit is on. `x` is the exhibit's anchor in screen pixels and `rail` is the strip the dock
 * holds down the right of the frame, which the card is not allowed to slide under.
 *
 * It used to hang tight to the exhibit, clear of the prop's own reach. In a room where the
 * exhibits stand in a row that put the card over the two machines next to the one that was
 * clicked, and Jordan stopped opening them: "covers cab, i wont click the other one now". Against
 * the margin it still reads as belonging to its side of the frame and the room stays visible.
 *
 * Arithmetic only, so the placement can be read without a browser.
 */
export function cardLeft(x: number, cardW: number, vw: number, gap = GAP, rail = 0): number {
  return cardSide(x, vw) === 'left' ? gap : Math.max(gap, vw - rail - cardW - gap);
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
export function pinOverlays(card: HTMLElement, anchors: Map<string, THREE.Vector3>, camera: THREE.PerspectiveCamera): void {
  const id = card.dataset.anchor ?? '';
  const a = anchors.get(id);
  // The stage that owns this exhibit may have been streamed out. Park the card rather than leave it
  // at the default, which would drop it over the middle of the room.
  if (!a) { card.toggleAttribute('data-offscreen', true); return; }
  v.copy(a).project(camera);
  card.toggleAttribute('data-offscreen', v.z > 1 || Math.abs(v.x) > 1.4 || Math.abs(v.y) > 1.4);
  const vw = window.innerWidth, vh = window.innerHeight;
  const x = ((v.x + 1) / 2) * vw;
  // The dock stands down the right of the frame above its own breakpoint, over the card's layer.
  const rail = vw > 700 ? RAIL : 0;
  card.dataset.side = cardSide(x, vw);
  card.style.setProperty('--cx', `${Math.round(cardLeft(x, card.offsetWidth, vw, GAP, rail))}px`);
  card.style.setProperty('--cy', `${Math.round(cardTop(((1 - v.y) / 2) * vh, card.offsetHeight, vh))}px`);
}
