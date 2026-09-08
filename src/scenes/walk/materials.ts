import * as THREE from 'three';
import type { TextureSet } from './assets';

/** Poly Haven ARM maps pack ambient occlusion (R), roughness (G) and metalness (B), which is exactly how three reads aoMap, roughnessMap and metalnessMap. */
export function pbr(set: TextureSet, opts: { color?: number; roughness?: number; metalness?: number; envMapIntensity?: number } = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: set.map, normalMap: set.normalMap, aoMap: set.arm, roughnessMap: set.arm, metalnessMap: set.arm,
    color: opts.color ?? 0xffffff, roughness: opts.roughness ?? 1, metalness: opts.metalness ?? 1, envMapIntensity: opts.envMapIntensity ?? 0.6,
  });
}

/** Primitives carry one uv set. aoMap reads uv1, so copy uv into uv1. */
export function prepareAO(geometry: THREE.BufferGeometry): void {
  if (!geometry.getAttribute('uv1') && geometry.getAttribute('uv')) geometry.setAttribute('uv1', geometry.getAttribute('uv'));
}

/** A repeated texture set for a surface of the given world size, keeping texel density even. */
export function surface(set: TextureSet, width: number, height: number, metersPerTile = 2): THREE.MeshStandardMaterial {
  const m = pbr(set);
  const repeatX = width / metersPerTile;
  const repeatY = height / metersPerTile;
  const tile = (t: THREE.Texture) => { const c = t.clone(); c.repeat.set(repeatX, repeatY); c.needsUpdate = true; return c; };

  m.map = tile(set.map);
  m.normalMap = tile(set.normalMap);
  const arm = tile(set.arm);
  m.aoMap = arm;
  m.roughnessMap = arm;
  m.metalnessMap = arm;
  return m;
}
