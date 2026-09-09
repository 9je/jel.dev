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

const OWNABLE_MAPS = ['map', 'normalMap', 'aoMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'] as const;

/** Disposes geometry and materials on every mesh/points in the hierarchy. A map is disposed only when
 *  `userData.owned === true` — clones made for this instance (see `surface()`) — never a texture the
 *  AssetStore still owns and will dispose itself. */
export function disposeObject(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) && !(o instanceof THREE.Points)) return;
    o.geometry.dispose();
    for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
      for (const key of OWNABLE_MAPS) {
        const tex = (mat as THREE.MeshStandardMaterial)[key];
        if (tex?.userData?.owned === true) tex.dispose();
      }
      mat.dispose();
    }
  });
}
