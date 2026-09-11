import { describe, expect, it } from 'vitest';
import { Mesh, BoxGeometry, MeshStandardMaterial, Raycaster, Vector3, Group } from 'three';
import { pickHotspot, ndc, createHover, targetFor } from '../../src/scenes/walk/interact';
import type { Hotspot } from '../../src/scenes/walk/stages/types';

const box = (x: number) => { const m = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ emissive: 0xffffff, emissiveIntensity: 1 })); m.position.set(x, 0, 0); m.updateMatrixWorld(); return m; };
const hs = (id: string, object: Mesh | Group): Hotspot => ({ id, kind: 'project', label: id, object, stop: 'fabrication' });

describe('hotspots', () => {
  it('picks the nearest hotspot under the ray', () => {
    const near = box(2), far = box(5);
    const ray = new Raycaster(new Vector3(0, 0, 0), new Vector3(1, 0, 0));
    expect(pickHotspot(ray, [hs('far', far), hs('near', near)])?.id).toBe('near');
  });
  it('returns null when nothing is hit', () => {
    const ray = new Raycaster(new Vector3(0, 0, 0), new Vector3(0, 1, 0));
    expect(pickHotspot(ray, [hs('a', box(2))])).toBeNull();
  });
  it('maps pixels to normalised device coordinates', () => {
    expect(ndc(0, 0, 200, 100)).toEqual([-1, 1]);
    expect(ndc(200, 100, 200, 100)).toEqual([1, -1]);
  });
  it('hover brightens emissive materials and restores them exactly', () => {
    const m = box(1); const mat = m.material as MeshStandardMaterial; mat.emissiveIntensity = 0.7;
    const g = new Group(); g.add(m);
    const hover = createHover();
    hover.set(hs('a', g)); hover.update(0.1);
    expect(mat.emissiveIntensity).toBeGreaterThan(0.7);
    hover.set(null);
    expect(mat.emissiveIntensity).toBe(0.7);
  });
  it('tints a material with no emissive of its own and restores it', () => {
    const m = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: 0x9aacb4 }));
    const hover = createHover();
    hover.set(hs('a', m));
    expect((m.material as MeshStandardMaterial).emissive.getHex()).toBe(0x2e4a5e);
    expect((m.material as MeshStandardMaterial).emissiveIntensity).toBe(0.35);
    hover.set(null);
    expect((m.material as MeshStandardMaterial).emissive.getHex()).toBe(0x000000);
    expect((m.material as MeshStandardMaterial).emissiveIntensity).toBe(1);
  });
  it('restores the previous hotspot when the hover moves to another', () => {
    const a = box(1), b = box(3);
    const ma = a.material as MeshStandardMaterial, mb = b.material as MeshStandardMaterial;
    ma.emissiveIntensity = 0.5; mb.emissiveIntensity = 0.5;
    const hover = createHover();
    hover.set(hs('a', a)); hover.update(0.1);
    hover.set(hs('b', b)); hover.update(0.1);
    expect(ma.emissiveIntensity).toBe(0.5);
    expect(mb.emissiveIntensity).toBeGreaterThan(0.5);
    hover.dispose();
    expect(mb.emissiveIntensity).toBe(0.5);
  });
});

/** A stand-in for the page's stop sections, so targetFor's DOM walk can be read without a browser.
 *  Only `querySelector` is exercised, and only with the four selectors the function builds. */
const page = (html: Record<string, string | null>): ParentNode => ({
  querySelector: (sel: string) => (html[sel] ?? null) as unknown as Element | null,
}) as unknown as ParentNode;

describe('the panel an exhibit opens', () => {
  it('prefers a flagship bay, then a project row, then a certification badge', () => {
    const bay = {} as HTMLElement, row = {} as HTMLElement;
    expect(targetFor('torn-bet', 'project', page({ '[data-flagship="torn-bet"]': bay as never, '[data-project="torn-bet"]': row as never }))).toBe(bay);
    expect(targetFor('torn-bet', 'project', page({ '[data-project="torn-bet"]': row as never }))).toBe(row);
  });

  it('falls back to the body of the stop the id names', () => {
    const body = {} as HTMLElement;
    // The open file on the control desk is an exhibit with no plate of its own: what it opens is the
    // copy of the stop it stands in, matched on the stop's own id.
    expect(targetFor('file', 'project', page({ 'section[data-stop="file"] .stop-body': body as never }))).toBe(body);
    expect(targetFor('file', 'project', page({}))).toBeNull();
  });
});
