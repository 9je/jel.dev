import { describe, expect, it } from 'vitest';
import { BOOTH_DEF } from '../../src/scenes/walk/stages/booth';
import { FABRICATION_DEF } from '../../src/scenes/walk/stages/fabrication';
import { RECREATION_DEF } from '../../src/scenes/walk/stages/recreation';
import { OPERATIONS_DEF } from '../../src/scenes/walk/stages/operations';
import { CREDENTIALS_DEF } from '../../src/scenes/walk/stages/credentials';
import { CONTAINMENT_DEF } from '../../src/scenes/walk/stages/containment';
import { FILE_DEF } from '../../src/scenes/walk/stages/file';
import { STOPS } from '../../src/scenes/walk/path';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { disposeStray, markShared } from '../../src/scenes/walk/materials';

const SOURCES: Record<string, string> = {
  booth: readFileSync(new URL('../../src/scenes/walk/stages/booth.ts', import.meta.url), 'utf8'),
  fabrication: readFileSync(new URL('../../src/scenes/walk/stages/fabrication/index.ts', import.meta.url), 'utf8'),
  recreation: readFileSync(new URL('../../src/scenes/walk/stages/recreation/index.ts', import.meta.url), 'utf8'),
  operations: readFileSync(new URL('../../src/scenes/walk/stages/operations/index.ts', import.meta.url), 'utf8'),
  credentials: readFileSync(new URL('../../src/scenes/walk/stages/credentials/index.ts', import.meta.url), 'utf8'),
  containment: readFileSync(new URL('../../src/scenes/walk/stages/containment/index.ts', import.meta.url), 'utf8'),
  file: readFileSync(new URL('../../src/scenes/walk/stages/file/index.ts', import.meta.url), 'utf8'),
};

const DEFS = [BOOTH_DEF, FABRICATION_DEF, RECREATION_DEF, OPERATIONS_DEF, CREDENTIALS_DEF, CONTAINMENT_DEF, FILE_DEF];

describe('stage definitions', () => {
  it('each names a real stop and is near it', () => {
    for (const d of DEFS) {
      expect(STOPS.some((s) => s.id === d.stop)).toBe(true);
      expect(d.near).toContain(d.stop);
      expect(d.groups.length).toBeGreaterThan(0);
    }
  });
  it('stops are unique across rooms', () => {
    expect(new Set(DEFS.map((d) => d.stop)).size).toBe(DEFS.length);
  });
});

describe('a build that fails halfway', () => {
  it('names its root after its id, so the scene can find what it left behind', () => {
    // disposeStray() has nothing but the id to go on: if a stage stopped naming its root, a failed
    // build would leave a half dressed room standing over the greybox it replaces.
    for (const d of DEFS) expect(SOURCES[d.id]).toContain(`root.name = '${d.id}'`);
  });
  it('drops the partial root and frees what it had built', () => {
    const scene = new THREE.Scene();
    const root = new THREE.Group(); root.name = 'credentials'; scene.add(root);
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial();
    root.add(new THREE.Mesh(geometry, material));
    const instanced = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial(), 4);
    root.add(instanced);
    let freed = 0;
    geometry.addEventListener('dispose', () => { freed++; });
    material.addEventListener('dispose', () => { freed++; });

    disposeStray(scene, 'credentials');

    expect(scene.children.find((o) => o.name === 'credentials')).toBeUndefined();
    expect(freed).toBe(2);
  });
  it('leaves the AssetStore\'s own geometry and materials usable in the rooms that built fine', () => {
    // store.model() clones share geometry and materials with the template, so the same desk material
    // is on the failed room's mesh and on a mesh in a room that stood up. Freeing it here would blank
    // the prop everywhere it appears for the rest of the session.
    const template = new THREE.Group();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial();
    template.add(new THREE.Mesh(geometry, material));
    markShared(template);

    const scene = new THREE.Scene();
    const kept = new THREE.Group(); kept.name = 'operations'; scene.add(kept);
    kept.add(template.clone(true));
    const stray = new THREE.Group(); stray.name = 'credentials'; scene.add(stray);
    stray.add(template.clone(true));
    // The stray's own work is still its to free.
    const ownGeometry = new THREE.BoxGeometry();
    const ownMaterial = new THREE.MeshStandardMaterial();
    stray.add(new THREE.Mesh(ownGeometry, ownMaterial));

    let sharedFreed = 0; let ownFreed = 0;
    geometry.addEventListener('dispose', () => { sharedFreed++; });
    material.addEventListener('dispose', () => { sharedFreed++; });
    ownGeometry.addEventListener('dispose', () => { ownFreed++; });
    ownMaterial.addEventListener('dispose', () => { ownFreed++; });

    disposeStray(scene, 'credentials');

    expect(sharedFreed).toBe(0);
    expect(ownFreed).toBe(2);
    const live = kept.children[0].children[0] as THREE.Mesh;
    expect(live.geometry).toBe(geometry);
    expect(live.material).toBe(material);
  });
  it('leaves a room that built fine alone, and a name it does not know', () => {
    const scene = new THREE.Scene();
    const kept = new THREE.Group(); kept.name = 'operations'; scene.add(kept);
    // A prop inside a room that built fine can share a name with a stage id without being one.
    const inner = new THREE.Group(); inner.name = 'file'; kept.add(inner);
    disposeStray(scene, 'file');
    disposeStray(scene, 'containment');
    expect(scene.children).toHaveLength(1);
    expect(kept.children).toHaveLength(1);
  });
});
