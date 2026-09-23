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

/**
 * Lays every tiled floor under `root` on one grid for the whole building. A floor's material says
 * it is tiled by carrying `userData.tilePitch`, the metres one repeat of its texture covers, and its
 * UVs are rewritten here from where each vertex stands in the world, so the tile lines run straight
 * from one room through a doorway into the next.
 *
 * Every floor used to start its tiles at its own corner, at its own size, so wherever two rooms or a
 * room and a doorway met the grout lines jumped half a tile and the tile changed size. Call it once
 * the room is built and placed: it reads world positions.
 */
export function anchorTiles(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || (o as THREE.InstancedMesh).isInstancedMesh || Array.isArray(mesh.material)) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    const pitch = mat.userData.tilePitch as number | undefined;
    const pos = mesh.geometry.getAttribute('position'), uv = mesh.geometry.getAttribute('uv') as THREE.BufferAttribute | undefined;
    if (!pitch || !uv) return;
    for (let i = 0; i < uv.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      uv.setXY(i, v.x / pitch, -v.z / pitch);
    }
    uv.needsUpdate = true;
    const uv1 = mesh.geometry.getAttribute('uv1');
    if (uv1 && uv1 !== uv) mesh.geometry.setAttribute('uv1', uv);
    for (const key of ['map', 'normalMap', 'aoMap', 'roughnessMap', 'metalnessMap'] as const) {
      const t = mat[key]; if (t) { t.repeat.set(1, 1); t.offset.set(0, 0); }
    }
  });
}
