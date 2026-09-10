import * as THREE from 'three';
import type { AssetStore } from '../assets';
import { surface, prepareAO } from '../materials';

/** The Labs palette. Cold white panels, the Terragroup blue dado, grey tile, dark steel. */
export const LABS = { panel: 0xd9e8ee, dado: 0x2455a4, tile: 0x9fb0b8, steel: 0x2b3740, glassTint: 0xcfe6ee, cold: 0xdff0f6, warn: 0xc8322b, hazard: 0xe8b923 } as const;

/** Large grey tile, from the shared `labs` group. */
export function labFloor(store: AssetStore, w: number, d: number, tint: number = LABS.tile): THREE.MeshStandardMaterial {
  const m = surface(store.texture('lab_tile'), w, d, 2); m.color.setHex(tint); return m;
}
/** Painted panel wall, cold white by default. */
export function labWall(store: AssetStore, w: number, h: number, tint: number = LABS.panel): THREE.MeshStandardMaterial {
  const m = surface(store.texture('wall_panel'), w, h, 3); m.color.setHex(tint); return m;
}
/** A dado band to 1.2 m with a thin line on top, as two geometries already placed. Merge many. */
export function dadoBands(len: number, x: number, z: number, ry: number): { band: THREE.BufferGeometry; line: THREE.BufferGeometry } {
  const band = new THREE.BoxGeometry(len, 1.2, 0.03); band.rotateY(ry); band.translate(x, 0.6, z);
  const line = new THREE.BoxGeometry(len, 0.07, 0.035); line.rotateY(ry); line.translate(x, 1.25, z);
  return { band, line };
}
export const dadoMaterial = () => new THREE.MeshStandardMaterial({ color: LABS.dado, roughness: 0.8 });
export const dadoLineMaterial = () => new THREE.MeshStandardMaterial({ color: LABS.panel, roughness: 0.6 });
/** Clear glass: reflective, barely tinted, no depth write. Give the mesh `renderOrder = 2`. */
export function labGlass(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({ color: LABS.glassTint, transparent: true, opacity: 0.16, roughness: 0.06, metalness: 0, envMapIntensity: 1.6, depthWrite: false });
}
export function labSteel(color: number = LABS.steel): THREE.MeshStandardMaterial { return new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.35 }); }

export function gridPitch(w: number, d: number, tile: number): { cols: number; rows: number } { return { cols: Math.max(1, Math.floor(w / tile)), rows: Math.max(1, Math.floor(d / tile)) }; }

/** A suspended ceiling: tiles at a pitch with every nth tile a lit panel. One draw call for tiles,
 *  one for panels. The lit panels are emissive geometry, not lights. */
export function ceilingGrid(store: AssetStore | null, w: number, d: number, y: number, opts: { tile?: number; litEvery?: number; intensity?: number } = {}): { group: THREE.Group; panels: THREE.InstancedMesh } {
  const tile = opts.tile ?? 1.2, litEvery = opts.litEvery ?? 3;
  const { cols, rows } = gridPitch(w, d, tile);
  const group = new THREE.Group();
  // Without a store the tiles are flat paint: the dispatch office sits behind the preloader and the
  // shared labs textures do not, so it gets the grid without the tile map.
  const tileMat = store ? surface(store.texture('ceiling_tile'), w, d, tile) : new THREE.MeshStandardMaterial({ roughness: 0.9 });
  tileMat.color.setHex(0xc9d3d8);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), tileMat); prepareAO(ceil.geometry); ceil.rotation.x = Math.PI / 2; ceil.position.y = y; group.add(ceil);
  const spots: THREE.Matrix4[] = [];
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    if ((i + j) % litEvery !== 0) continue;
    spots.push(new THREE.Matrix4().makeTranslation(-w / 2 + (i + 0.5) * tile, y - 0.02, -d / 2 + (j + 0.5) * tile));
  }
  const panelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: LABS.cold, emissiveIntensity: opts.intensity ?? 1.4 });
  const panels = new THREE.InstancedMesh(new THREE.BoxGeometry(tile - 0.1, 0.04, tile * 0.5), panelMat, spots.length);
  spots.forEach((m, i) => panels.setMatrixAt(i, m)); panels.instanceMatrix.needsUpdate = true; panels.computeBoundingSphere();
  group.add(panels);
  return { group, panels };
}
