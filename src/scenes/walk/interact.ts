import { MeshStandardMaterial, type Intersection, type Material, type Mesh, type Object3D, type Raycaster } from 'three';
import type { Hotspot } from './stages/types';

/**
 * Picking and hover feedback for the exhibits. Everything here is pure three plus arithmetic, with
 * the single DOM function at the bottom, so the node test environment can import the module.
 */

/** The cool wash a prop with no emissive of its own gets while the pointer is on it. */
const TINT = 0x2e4a5e;
const TINT_INTENSITY = 0.35;

/** The nearest hotspot whose object (or any descendant of it) the ray crosses, else null. */
export function pickHotspot(raycaster: Raycaster, hotspots: Hotspot[]): Hotspot | null {
  let best: Hotspot | null = null;
  let nearest = Infinity;
  const hits: Intersection[] = [];
  for (const h of hotspots) {
    hits.length = 0;
    raycaster.intersectObject(h.object, true, hits);
    if (hits.length > 0 && hits[0].distance < nearest) { nearest = hits[0].distance; best = h; }
  }
  return best;
}

/** Pointer pixels, relative to the canvas, to the -1..1 square the camera projects into. */
export function ndc(x: number, y: number, w: number, h: number): [number, number] {
  return [(x / w) * 2 - 1, 1 - (y / h) * 2];
}

export interface Hover { set(h: Hotspot | null): void; update(dt: number): void; dispose(): void }

interface Base { intensity: number; emissive: number; pulse: boolean }

const materialsOf = (o: Object3D): Material[] => {
  const out: Material[] = [];
  o.traverse((n) => {
    const m = (n as Mesh).material;
    if (Array.isArray(m)) out.push(...m); else if (m) out.push(m);
  });
  return out;
};

/**
 * The hover light. Nothing is cloned: the materials under the hovered object are mutated in place
 * and put back byte for byte when the pointer leaves, so a prop that shares a material with its
 * neighbours is never left brighter than it started.
 */
export function createHover(): Hover {
  // Keyed by material, so one material reached through two meshes is stored, and restored, once.
  const touched = new Map<MeshStandardMaterial, Base>();
  let clock = 0;

  function restore() {
    for (const [mat, base] of touched) { mat.emissiveIntensity = base.intensity; mat.emissive.setHex(base.emissive); }
    touched.clear();
  }

  return {
    set(h) {
      restore();
      clock = 0;
      if (!h) return;
      for (const mat of materialsOf(h.object)) {
        // The flag rather than instanceof: a duplicated three in a test or a bundle would defeat the
        // prototype check, and MeshPhysicalMaterial has to count as well.
        if (!(mat as MeshStandardMaterial).isMeshStandardMaterial) continue;
        const std = mat as MeshStandardMaterial;
        if (touched.has(std)) continue;
        const emissive = std.emissive.getHex();
        const pulse = emissive !== 0x000000;
        touched.set(std, { intensity: std.emissiveIntensity, emissive, pulse });
        // A prop that is already lit gets brighter and breathes. A dark one gets the cool wash, flat,
        // so a grey pedestal reads as picked without pretending to be a screen.
        if (!pulse) { std.emissive.setHex(TINT); std.emissiveIntensity = TINT_INTENSITY; }
      }
    },
    update(dt) {
      if (touched.size === 0) return;
      clock += dt;
      const k = 1.45 + 0.25 * Math.sin(clock * 6);
      for (const [mat, base] of touched) if (base.pulse) mat.emissiveIntensity = base.intensity * k;
    },
    dispose() { restore(); },
  };
}

/**
 * The panel an exhibit opens: a flagship bay first, then a project row, then a certification badge,
 * and failing all three the body of the stop the id names.
 *
 * The last fallback is what the personnel file needs. Every other exhibit on the walk stands for an
 * entry in the content collections and has a plate of its own to open; the open file on the control
 * desk stands for the stop itself, and what it has to open is the copy of that stop. Matching on
 * the stop rather than on a plate keeps that case out of the content schema.
 *
 * The one DOM function in the module, and it only reads.
 */
/**
 * The copy an exhibit card carries, cloned out of the panel the walk already ships in its markup so
 * there is one source for it. A flagship hands over the text half of its bay, a project row hands
 * over its summary line and its body with the disclosure already unfolded, and anything else hands
 * over its children, which is what a certification badge is.
 *
 * Cloned, never moved: the panel it came from stays in the copy column, where the reader clicked.
 */
export function exhibitContent(el: HTMLElement, doc: Document): DocumentFragment {
  const frag = doc.createDocumentFragment();
  const copy = (from: Element | null, into: Node) => { for (const n of from?.children ?? []) into.appendChild(n.cloneNode(true)); };
  const bay = el.querySelector('.bay-text');
  if (bay) { copy(bay, frag); return frag; }
  const summary = el.querySelector('summary');
  if (summary) {
    const head = doc.createElement('div');
    head.className = 'exhibit-head';
    copy(summary, head);
    frag.appendChild(head);
    copy(el.querySelector('.row-body'), frag);
    return frag;
  }
  copy(el, frag);
  return frag;
}

export function targetFor(id: string, _kind: Hotspot['kind'], root: ParentNode): HTMLElement | null {
  // Every id here is a content slug, but a stray quote would break out of the attribute selector.
  const safe = id.replace(/["\\]/g, '\\$&');
  return root.querySelector<HTMLElement>(`[data-flagship="${safe}"]`)
    ?? root.querySelector<HTMLElement>(`[data-project="${safe}"]`)
    ?? root.querySelector<HTMLElement>(`[data-cert="${safe}"]`)
    ?? root.querySelector<HTMLElement>(`section[data-stop="${safe}"] .stop-body`);
}
