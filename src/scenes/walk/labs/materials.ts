import * as THREE from 'three';
import type { AssetStore } from '../assets';
import { surface, prepareAO } from '../materials';
import { troffer, lensMaterial, fixtureSteel } from './fixtures';

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
/**
 * A dado band to 1.2 m with a thin line on top, as two geometries already placed. Merge many.
 *
 * The run is inset three centimetres at each end of `len`. A band flush with the end of its wall
 * puts its end cap on whatever plane closes the wall there, facing the same way, and where that is
 * a doorway's reveal the two are coplanar front faces the depth buffer cannot separate: a flicker
 * down the jamb as the camera turns through the opening. Three centimetres is invisible and cannot.
 */
export function dadoBands(len: number, x: number, z: number, ry: number): { band: THREE.BufferGeometry; line: THREE.BufferGeometry } {
  const run = Math.max(0.1, len - 0.06);
  const band = new THREE.BoxGeometry(run, 1.2, 0.03); band.rotateY(ry); band.translate(x, 0.6, z);
  const line = new THREE.BoxGeometry(run, 0.07, 0.035); line.rotateY(ry); line.translate(x, 1.25, z);
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

/** Index, within `ceilingGrid`'s own enumeration of lit panels, of the one nearest a local x,z
 *  position (local to the grid's own centre, before the caller offsets the returned group into the
 *  room). Pass the result as `opts.flickerIndex` to pull that panel out on its own. `opts.lit` must
 *  be the same predicate the grid itself is given, or the two enumerations disagree. */
export function nearestLitPanel(w: number, d: number, localX: number, localZ: number, opts: { tile?: number; litEvery?: number; lit?: (i: number, j: number) => boolean; panel?: [number, number] } = {}): number {
  const tile = opts.tile ?? 1.2;
  const lit = litPredicate(opts);
  const whole = panelFits(w, d, tile, opts.panel);
  const { cols, rows } = gridPitch(w, d, tile);
  const ox = -cols * tile / 2, oz = -rows * tile / 2;
  let index = 0, best = -1, bestDist = Infinity;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    if (!lit(i, j) || !whole(i, j)) continue;
    const x = ox + (i + 0.5) * tile, z = oz + (j + 0.5) * tile;
    const dist = Math.hypot(x - localX, z - localZ);
    if (dist < bestDist) { bestDist = dist; best = index; }
    index++;
  }
  return best;
}

/**
 * Whether the fitting in tile `i, j` lands whole inside the ceiling plane. A troffer is wider than
 * the tile it replaces, so the tiles along an edge carry a fitting that hangs half of itself out
 * over the wall below, through the doorway header, or into the room next door. Those tiles are left
 * dark instead. Both the grid and `nearestLitPanel` apply it, or the two enumerations disagree and a
 * room drives the wrong panel.
 */
const panelFits = (w: number, d: number, tile: number, panel?: [number, number]) => {
  const [pw, pd] = panel ?? [tile - 0.1, tile * 0.5];
  const { cols, rows } = gridPitch(w, d, tile);
  const ox = -cols * tile / 2, oz = -rows * tile / 2;
  return (i: number, j: number) => Math.abs(ox + (i + 0.5) * tile) + pw / 2 <= w / 2 + 1e-6
    && Math.abs(oz + (j + 0.5) * tile) + pd / 2 <= d / 2 + 1e-6;
};

const litPredicate = (opts: { litEvery?: number; lit?: (i: number, j: number) => boolean }) => {
  if (opts.lit) return opts.lit;
  const every = opts.litEvery ?? 3;
  return (i: number, j: number) => (i + j) % every === 0;
};

export interface CeilingGridOptions {
  tile?: number;
  /** The default pattern: every nth tile on the diagonal. */
  litEvery?: number;
  /** A pattern of the caller's own, which wins over `litEvery`. `i` runs along x, `j` along z. */
  lit?: (i: number, j: number) => boolean;
  intensity?: number;
  /** The tile's own colour. The shared ceiling map is a warm grey, which is right under a white
   *  lab's own lights and wrong in a room lit cold: a ceiling is the largest surface in a low room
   *  and it is what sets the temperature of everything under it. */
  tint?: number;
  /** How much the tile lights itself, 0.28 by default. A ceiling faces down, so nothing in the rig
   *  reaches it and this is the only thing that keeps it off black. A room with a low ceiling and a
   *  tall frame shows a lot of it and needs more than a room that shows a strip of it. */
  tileGlow?: number;
  /** Fitting size of one lit panel, `[along x, along z]`. Defaults to a panel the size of a tile.
   *  A 0.6 m tile grid hung with 1.2 m troffers is the usual suspended ceiling, and it is what
   *  stops a sparse pattern reading as a scatter of glowing postage stamps. */
  panel?: [number, number];
  /** Lit panels, by their index in the grid's own enumeration (see `nearestLitPanel`), to pull out
   *  of the shared batch so a room can drive them one at a time. */
  flickerIndex?: number | number[];
  /** Tiles left out of the ceiling entirely, as `[i, j]` in the same enumeration `lit` is given, so
   *  whatever is above the grid shows through the hole. A tile is dropped, not hidden: the two
   *  triangles that would have covered it are cut out of the ceiling's index. A missing tile is
   *  never lit, so a grid given both this and `flickerIndex` would enumerate its panels differently
   *  from `nearestLitPanel`, which knows nothing about holes. */
  missing?: [number, number][];
}

/** The ceiling plane, with the cells named in `missing` cut out of its index. A plane with the tile
 *  pitch as its segment count carries the same uv as the single quad it replaces, so the tile map
 *  lands identically and only the holes are new. */
function tiledCeiling(w: number, d: number, cols: number, rows: number, missing: [number, number][]): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(w, d, cols, rows);
  const index = g.getIndex();
  if (!index || missing.length === 0) return g;
  // The plane is built in xy and turned a quarter about x to face down, which puts its first row of
  // cells at the far end of z. `j` counts from the near end, so the rows are read back to front.
  const gone = new Set(missing.map(([i, j]) => (rows - 1 - j) * cols + i));
  const kept: number[] = [];
  for (let cell = 0; cell < cols * rows; cell++) {
    if (gone.has(cell)) continue;
    for (let k = 0; k < 6; k++) kept.push(index.getX(cell * 6 + k));
  }
  g.setIndex(kept);
  return g;
}

/** A suspended ceiling: tiles at a pitch with a pattern of them replaced by recessed troffers. One
 *  draw call for tiles, one for the troffer frames, one for the lenses, one more for each lens the
 *  caller asked to drive itself. The lit panels are emissive geometry, not lights. */
export function ceilingGrid(store: AssetStore | null, w: number, d: number, y: number, opts: CeilingGridOptions = {}): { group: THREE.Group; panels: THREE.InstancedMesh; flicker: THREE.InstancedMesh[] } {
  const tile = opts.tile ?? 1.2;
  const lit = litPredicate(opts);
  const whole = panelFits(w, d, tile, opts.panel);
  const wanted = opts.flickerIndex === undefined ? [] : [opts.flickerIndex].flat();
  const { cols, rows } = gridPitch(w, d, tile);
  const group = new THREE.Group();
  // Without a store the tiles are flat paint: the dispatch office sits behind the preloader and the
  // shared labs textures do not, so it gets the grid without the tile map.
  const tileMat = store ? surface(store.texture('ceiling_tile'), w, d, tile) : new THREE.MeshStandardMaterial({ roughness: 0.9 });
  // A ceiling faces down, so the hemisphere gives it only its dark ground colour and the spots never
  // reach it. A little emissive makes the tiles read as a lit suspended ceiling instead of a void.
  // The emissive follows the tile map rather than sitting flat over it: a flat emissive washes the
  // grid out and the ceiling reads as painted plaster instead of a suspended one.
  const tint = opts.tint ?? 0xc9d3d8;
  tileMat.color.setHex(tint); tileMat.emissive.setHex(tint); tileMat.emissiveIntensity = opts.tileGlow ?? 0.28;
  if (tileMat.map) tileMat.emissiveMap = tileMat.map;
  const missing = opts.missing ?? [];
  const ceil = new THREE.Mesh(tiledCeiling(w, d, cols, rows, missing), tileMat); prepareAO(ceil.geometry); ceil.rotation.x = Math.PI / 2; ceil.position.y = y; group.add(ceil);
  // Whole tiles only, centred, so the leftover is split between both edges.
  const ox = -cols * tile / 2, oz = -rows * tile / 2;
  const hole = new Set(missing.map(([i, j]) => `${i},${j}`));
  const spots: THREE.Matrix4[] = [];
  const driven = new Map<number, THREE.Matrix4>();
  let litIndex = 0;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    // A fitting in a tile that is on the floor is a fitting hanging in a hole.
    if (hole.has(`${i},${j}`)) continue;
    if (!lit(i, j) || !whole(i, j)) continue;
    const m = new THREE.Matrix4().makeTranslation(ox + (i + 0.5) * tile, y - 0.004, oz + (j + 0.5) * tile);
    if (wanted.includes(litIndex)) driven.set(litIndex, m); else spots.push(m);
    litIndex++;
  }
  const [pw, pd] = opts.panel ?? [tile - 0.1, tile * 0.5];
  // A fitting, not a glowing box: a steel frame recessed into the tile with the lens inside it, and
  // tubes showing through the lens. One batch of frames over every lit tile, driven ones included,
  // one batch of lenses over the ones the room does not drive, and one lens each for those it does.
  const { frame, lens: lensGeometry } = troffer(pw, pd);
  const panelMat = () => lensMaterial(pw, pd, opts.intensity ?? 1.4);
  const all = [...spots, ...driven.values()];
  const frames = new THREE.InstancedMesh(frame, fixtureSteel(), all.length);
  all.forEach((m, i) => frames.setMatrixAt(i, m)); frames.instanceMatrix.needsUpdate = true; frames.computeBoundingSphere();
  frames.name = 'frames'; group.add(frames);
  const panels = new THREE.InstancedMesh(lensGeometry, panelMat(), spots.length);
  spots.forEach((m, i) => panels.setMatrixAt(i, m)); panels.instanceMatrix.needsUpdate = true; panels.computeBoundingSphere();
  panels.name = 'panels'; group.add(panels);
  // In the order the caller asked for them, so `flicker[0]` is the panel `flickerIndex[0]` named.
  const flicker: THREE.InstancedMesh[] = [];
  for (const index of wanted) {
    const m = driven.get(index);
    if (!m) continue;
    const one = new THREE.InstancedMesh(lensGeometry, panelMat(), 1);
    one.setMatrixAt(0, m); one.instanceMatrix.needsUpdate = true; one.computeBoundingSphere();
    group.add(one); flicker.push(one);
  }
  return { group, panels, flicker };
}
