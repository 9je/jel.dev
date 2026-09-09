import * as THREE from 'three';

const v = new THREE.Vector3();

/**
 * Pins the panels of the active stop to the world anchors the stage registered, so a flagship bay
 * hangs beside the exhibit it describes. `--ax`/`--ay` are screen pixels; `data-offscreen` fades the
 * panel out when its anchor is behind the camera or well outside the frame.
 */
export function pinOverlays(sections: HTMLElement[], anchors: Map<string, THREE.Vector3>, camera: THREE.PerspectiveCamera): void {
  const active = sections.find((s) => s.hasAttribute('data-active'));
  if (!active) return;
  for (const el of active.querySelectorAll<HTMLElement>('[data-anchor]')) {
    const a = anchors.get(el.dataset.anchor ?? '');
    if (!a) continue;
    v.copy(a).project(camera);
    const behind = v.z > 1;
    el.toggleAttribute('data-offscreen', behind || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2);
    el.style.setProperty('--ax', `${((v.x + 1) / 2) * window.innerWidth}px`);
    el.style.setProperty('--ay', `${((1 - v.y) / 2) * window.innerHeight}px`);
  }
}
