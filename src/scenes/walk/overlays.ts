import * as THREE from 'three';
import { holdWeight } from './path';

const v = new THREE.Vector3();

/**
 * Pins the panels of the active stop to the world anchors the stage registered, so a flagship bay
 * hangs beside the exhibit it describes. `--ax`/`--ay` are screen pixels, which CSS clamps into a
 * column of its own beside the copy; `data-offscreen` hides the panel when its anchor is behind the
 * camera or well outside the frame, and `data-settled` holds it back until the camera has stopped.
 */
export function pinOverlays(sections: HTMLElement[], anchors: Map<string, THREE.Vector3>, camera: THREE.PerspectiveCamera, t: number): void {
  // Travel is flat through a hold, so a non-zero hold weight is exactly "the camera has arrived".
  const settled = holdWeight(t) > 0;
  const active = sections.find((s) => s.hasAttribute('data-active'));
  if (!active) return;
  for (const el of active.querySelectorAll<HTMLElement>('[data-anchor]')) {
    const a = anchors.get(el.dataset.anchor ?? '');
    // The stage that registers this anchor may still be streaming. Park the panel out of sight
    // rather than at the default 50vw/50vh, which would drop it over the middle of the room.
    if (!a) { el.toggleAttribute('data-offscreen', true); continue; }
    el.toggleAttribute('data-settled', settled);
    v.copy(a).project(camera);
    const behind = v.z > 1;
    el.toggleAttribute('data-offscreen', behind || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2);
    el.style.setProperty('--ax', `${((v.x + 1) / 2) * window.innerWidth}px`);
    el.style.setProperty('--ay', `${((1 - v.y) / 2) * window.innerHeight}px`);
  }
}
