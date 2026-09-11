import * as THREE from 'three';
import type { TextureSet } from './assets';

/** Poly Haven ARM maps pack ambient occlusion (R), roughness (G) and metalness (B), which is exactly how three reads aoMap, roughnessMap and metalnessMap. */
export function pbr(set: TextureSet, opts: { color?: number; roughness?: number; metalness?: number; envMapIntensity?: number } = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: set.map, normalMap: set.normalMap, aoMap: set.arm, roughnessMap: set.arm, metalnessMap: set.arm,
    color: opts.color ?? 0xffffff, roughness: opts.roughness ?? 1, metalness: opts.metalness ?? 1, envMapIntensity: opts.envMapIntensity ?? 0.6,
  });
}

/** Primitives carry one uv set. aoMap reads uv1 (three r185 samples channel 0 by default), so copy uv into uv1 to make aoMap sampling match uv on primitives. */
export function prepareAO(geometry: THREE.BufferGeometry): void {
  if (!geometry.getAttribute('uv1') && geometry.getAttribute('uv')) geometry.setAttribute('uv1', geometry.getAttribute('uv'));
}

/** A repeated texture set for a surface of the given world size, keeping texel density even. */
export function surface(set: TextureSet, width: number, height: number, metersPerTile = 2): THREE.MeshStandardMaterial {
  const m = pbr(set);
  const repeatX = width / metersPerTile;
  const repeatY = height / metersPerTile;
  const tile = (t: THREE.Texture) => { const c = t.clone(); c.repeat.set(repeatX, repeatY); c.needsUpdate = true; c.userData.owned = true; return c; };

  m.map = tile(set.map);
  m.normalMap = tile(set.normalMap);
  const arm = tile(set.arm);
  m.aoMap = arm;
  m.roughnessMap = arm;
  m.metalnessMap = arm;
  return m;
}

const OWNABLE_MAPS = ['map', 'normalMap', 'aoMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap'] as const;

const shared = new WeakSet<THREE.BufferGeometry | THREE.Material>();

/**
 * Records the geometry and materials of a loaded model template as the AssetStore's own.
 * `store.model()` hands back `clone(true)`, which shares both with the template, so a stage that
 * disposed them would blank the same model in every other room. A clone made by a stage is a new
 * object and is not in the set, so it is still disposed normally.
 */
export function markShared(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) && !(o instanceof THREE.Points)) return;
    shared.add(o.geometry);
    for (const mat of Array.isArray(o.material) ? o.material : [o.material]) shared.add(mat);
  });
}

/**
 * Drops a room that failed halfway through its build. Every stage adds its root to the scene before
 * it dresses it and names that root after its own id, so a build that threw leaves a half dressed
 * room standing in the scene, drawn over the greybox space it was meant to replace and holding its
 * geometry and textures for the rest of the session.
 *
 * Only the scene's own children are candidates: a stage root is always added straight to the scene,
 * and a deep search could match a prop inside a room that built fine.
 */
export function disposeStray(scene: THREE.Scene, id: string): void {
  const stray = scene.children.find((o) => o.name === id);
  if (!stray) return;
  stray.traverse((o) => { if (o instanceof THREE.InstancedMesh) o.dispose(); });
  disposeObject(stray);
  scene.remove(stray);
}

/** Disposes geometry and materials on every mesh/points in the hierarchy, except the ones the
 *  AssetStore still owns (see `markShared()`), which it disposes itself. A map is disposed only when
 *  `userData.owned === true`, that is a clone made for this instance (see `surface()`). */
export function disposeObject(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) && !(o instanceof THREE.Points)) return;
    if (!shared.has(o.geometry)) o.geometry.dispose();
    for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
      if (shared.has(mat)) continue;
      for (const key of OWNABLE_MAPS) {
        const tex = (mat as THREE.MeshStandardMaterial)[key];
        if (tex?.userData?.owned === true) tex.dispose();
      }
      mat.dispose();
    }
  });
}
