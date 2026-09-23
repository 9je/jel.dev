import * as THREE from 'three';
import type { AssetStore } from '../assets';
import { surface, prepareAO } from '../materials';
import { troffer, lensMaterial, fixtureSteel } from './fixtures';
import { canvas, own, rng } from './textures';

/** The Labs palette. Cold white panels, the Terragroup blue dado, grey tile, dark steel. */
export const LABS = { panel: 0xd9e8ee, dado: 0x2455a4, tile: 0x9fb0b8, steel: 0x2b3740, glassTint: 0xcfe6ee, cold: 0xdff0f6, warn: 0xc8322b, hazard: 0xe8b923 } as const;

/** Large grey tile, from the shared `labs` group. */
export function labFloor(store: AssetStore, w: number, d: number, tint: number = LABS.tile): THREE.MeshStandardMaterial {
  const m = surface(store.texture('lab_tile'), w, d, 2); m.color.setHex(tint); m.userData.tilePitch = 2; return m;
}
/** Painted panel wall, cold white by default. */
export function labWall(store: AssetStore, w: number, h: number, tint: number = LABS.panel): THREE.MeshStandardMaterial {
  const m = surface(store.texture('wall_panel'), w, h, 3); m.color.setHex(tint); return m;
}
/**
 * How high the blue goes, everywhere in the building.
 *
 * One number, not one per room, and that is the whole point of it. It was 1.2 m, which is a skirt:
 * right in a room with a 3.4 m wall and a stripe along the floor in the credentials hall's 7 m one,
 * which is what Jordan read as the blue and the grey not making sense together. The obvious answer
 * was to make the height a share of the wall it is painted on, so that hall went to 2.3.
 *
 * That was wrong, and it took him three goes to get me to see why. Rooms in this building are not
 * looked at one at a time. Every one of them is seen through a doorway into the next, and a dado
 * that is 2.3 m on one side of an opening and 1.2 m on the other does not read as two rooms with
 * their own proportions, it reads as a wall that changed its mind. Per room heights cannot be made
 * to work here: every junction in the walk joins two rooms of different heights, so any scheme that
 * scales with the room breaks at all five of them.
 *
 * 1.6 m is the compromise, and it is a real dado height: chest high, which is where a painted lower
 * wall goes in a building that expects trolleys. In the tall hall it is still short of a third of
 * the wall, and what carries the rest of that wall is the service run and the panels on it rather
 * than more paint.
 */
export const DADO_H = 1.6;

/**
 * A dado band with a thin line on top, as two geometries already placed. Merge many.
 *
 * The run is inset two millimetres at each end of `len`, and the size of that number is the whole
 * of it. A band flush with the end of its wall puts its end cap on whatever plane closes the wall
 * there, facing the same way, and where that is a doorway's reveal the two are coplanar front faces
 * the depth buffer cannot separate: a flicker down the jamb as the camera turns through the
 * opening. So some inset there must be. It was three centimetres, which is six between two runs
 * that meet on the same line, and that is not invisible at all: the break room's west end joins
 * four runs and the blue came apart into panels with a black sliver between each. Two millimetres
 * is under a pixel at any distance the walk ever reads a wall from, and still fifteen times the
 * separation the depth buffer needs at these ranges.
 */
export function dadoBands(len: number, x: number, z: number, ry: number, h = DADO_H): { band: THREE.BufferGeometry; line: THREE.BufferGeometry } {
  const run = Math.max(0.1, len - 0.004);
  const band = new THREE.BoxGeometry(run, h, 0.03);
  // UVs in metres along the run, so the grime map keeps its scale whatever the run's length.
  const uv = band.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setX(i, (uv.getX(i) * run) / GRIME_SPAN);
  band.rotateY(ry); band.translate(x, h / 2, z);
  const line = new THREE.BoxGeometry(run, 0.07, 0.035); line.rotateY(ry); line.translate(x, h + 0.05, z);
  return { band, line };
}

/** Columns in the streak atlas: five different stains, so a wall of them does not repeat, and a
 *  sixth that is the dirt line along the top of a wall. */
const STREAKS = 5, ATLAS = STREAKS + 1;

/**
 * Water and rust stains running down a wall from the ceiling, as an alpha atlas of `STREAKS` stains
 * side by side. Each is a few runs of different widths from a common source at the very top of
 * the canvas, darkest there and thinning out as it goes, some ending in a drip. The last column is
 * the grime line where a wall meets the ceiling: dark at the top edge, soft lobes hanging off it,
 * drawn so it tiles side to side.
 */
function streakAtlas(): THREE.CanvasTexture {
  const cw = 128, h = 512;
  const [c, ctx] = canvas(cw * ATLAS, h);
  ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, cw * ATLAS, h);
  const r = rng(77);
  for (let k = 0; k < STREAKS; k++) {
    const x0 = k * cw;
    // A source stain along the top edge, where the water came through the ceiling line.
    const src = ctx.createLinearGradient(0, 0, 0, cw * 0.4);
    src.addColorStop(0, 'rgba(255,255,255,0.6)'); src.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = src; ctx.fillRect(x0 + 8, 0, cw - 16, cw * 0.4);
    const runs = 3 + Math.floor(r() * 4);
    for (let i = 0; i < runs; i++) {
      const cx = x0 + 18 + r() * (cw - 36), len = h * (0.35 + r() * 0.65), wd = 3 + r() * 10;
      const g = ctx.createLinearGradient(0, 0, 0, len);
      g.addColorStop(0, `rgba(255,255,255,${0.55 + r() * 0.3})`); g.addColorStop(0.7, `rgba(255,255,255,${0.15 + r() * 0.15})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(cx - wd / 2, 0);
      let x = cx;
      for (let y = 0; y <= len; y += 16) { x += (r() - 0.5) * 2; ctx.lineTo(x - (wd / 2) * (1 - y / len * 0.7), y); }
      for (let y = len; y >= 0; y -= 16) ctx.lineTo(x + (wd / 2) * (1 - y / len * 0.7), y);
      ctx.closePath(); ctx.fill();
      if (r() < 0.5) { ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(x, len * 0.92, wd * 0.4, wd * 0.7, 0, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  // The ceiling line. Clipped to its own column and every lobe drawn a column width either side,
  // so segment after segment of it runs along a wall without a seam.
  const x0 = STREAKS * cw;
  ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, cw, h); ctx.clip();
  const edge = ctx.createLinearGradient(0, 0, 0, h * 0.5);
  edge.addColorStop(0, 'rgba(255,255,255,0.75)'); edge.addColorStop(0.25, 'rgba(255,255,255,0.3)'); edge.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = edge; ctx.fillRect(x0, 0, cw, h * 0.5);
  for (let i = 0; i < 9; i++) {
    const lx = r() * cw, lw = 10 + r() * 26, ll = h * (0.2 + r() * 0.5), a = 0.12 + r() * 0.2;
    for (const dx of [-cw, 0, cw]) {
      const g = ctx.createLinearGradient(0, 0, 0, ll);
      g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x0 + lx + dx, 0, lw, ll, 0, 0, Math.PI); ctx.fill();
    }
  }
  ctx.restore();
  return own(c, false);
}

/** The stains' material: dark, faintly brown, lit like the wall under it, never writing depth. */
export const streakMaterial = () => new THREE.MeshStandardMaterial({
  color: 0x14110c, roughness: 0.95, alphaMap: streakAtlas(), transparent: true, opacity: 0.85, depthWrite: false,
});

/**
 * The grime on one wall piece, as placed planes to merge with the rest of the room's. The piece is
 * `w` wide, runs from `bottom` to `top`, is centred on (x, z) and turned `ry`, the same way a
 * room's wall helper turns it: its normal points into the room, and the grime stands a centimetre
 * off it on that side, so a wall the other room owns never shows it.
 *
 * `top` is where the wall meets the ceiling, and everything hangs from there. Every piece gets the
 * dirt line along its top edge, the lintels over doorways included, so it runs round a room
 * unbroken. Pieces tall enough get stains down from that line, one every few metres, never within
 * half a metre of an end and never into the blue band. They used to start at the height the
 * services cross, which from the walk was a stain beginning in the middle of clean wall.
 */
export function wallStreaks(w: number, x: number, z: number, ry: number, top: number, bottom = 0): THREE.BufferGeometry[] {
  if (w < 0.3 || top - bottom < 0.2) return [];
  const r = rng(Math.abs(Math.round(x * 97 + z * 131 + ry * 17)) + 1);
  const out: THREE.BufferGeometry[] = [];
  const place = (g: THREE.BufferGeometry, col: number, along: number, y: number, off: number) => {
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    for (let j = 0; j < uv.count; j++) uv.setX(j, (col + uv.getX(j)) / ATLAS);
    g.translate(along, y, off); g.rotateY(ry); g.translate(x, 0, z);
    out.push(g);
  };
  const lineH = Math.min(0.45, top - bottom);
  const pieces = Math.max(1, Math.round(w / 1.2));
  for (let i = 0; i < pieces; i++) {
    const pw = w / pieces;
    place(new THREE.PlaneGeometry(pw, lineH), STREAKS, -w / 2 + pw * (i + 0.5), top - lineH / 2, 0.011);
  }
  const room = top - Math.max(bottom, DADO_H + 0.1);
  if (w < 1.6 || room < 0.8) return out;
  const n = Math.max(1, Math.round((w / 3.2) * (0.6 + r() * 0.8)));
  for (let i = 0; i < n; i++) {
    const sw = 0.5 + r() * 0.6, sh = Math.min(room, 1.1 + r() * 1.6);
    const along = -w / 2 + 0.5 + sw / 2 + r() * Math.max(0, w - 1 - sw);
    place(new THREE.PlaneGeometry(sw, sh), Math.floor(r() * STREAKS), along, top - sh / 2, 0.012 + i * 0.001);
  }
  return out;
}

/**
 * Drops the faces of a placed geometry that look along `away`, and returns it. For a dado run in
 * the metre two rooms share: the credentials hall and the server hall overlap by the thickness of
 * the wall between them, so a band on one side of that wall stands inside the other room's volume.
 * Each room's wall is a one sided plane and hides from the other, but a band is a box, and its back
 * face was a blue slab floating a metre in front of the server hall's west wall. The face against
 * the wall is never seen from the band's own room, so it goes, and the other room sees nothing.
 */
export function backless(geo: THREE.BufferGeometry, away: THREE.Vector3): THREE.BufferGeometry {
  const index = geo.getIndex()!, normal = geo.getAttribute('normal'), keep: number[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    if (normal.getX(a) * away.x + normal.getY(a) * away.y + normal.getZ(a) * away.z > 0.9) continue;
    keep.push(a, index.getX(i + 1), index.getX(i + 2));
  }
  geo.setIndex(keep); geo.clearGroups();
  return geo;
}
/** How many metres of band one repeat of the grime map covers. `dadoBands` lays its UVs in metres
 *  over this, so the dirt keeps its scale on a two metre run and a twenty metre one alike. */
const GRIME_SPAN = 2.5;

/**
 * The dirt on the lower wall, as a colour map multiplied into the band's blue: one repeat covers
 * `GRIME_SPAN` metres along and the band's full height. Every wall in the building was the same
 * clean flat blue from the corner to the doorway, which is what reads as computer made up close.
 * A painted lower wall in a working building is darkest at the floor, where the mop water and the
 * dust settle, and scuffed from shin height down where trolleys and boots hit it.
 */
function dadoGrime(): THREE.CanvasTexture {
  const w = 512, h = 328; // 2.5 m by 1.6 m, near enough square pixels
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
  const r = rng(41);
  // A faint wash that is never quite even along the run.
  for (let i = 0; i < 14; i++) {
    const x = r() * w, rw = 40 + r() * 120;
    const g = ctx.createLinearGradient(x - rw, 0, x + rw, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, `rgba(20,24,30,${0.04 + r() * 0.05})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - rw, 0, rw * 2, h);
  }
  // Settled dirt at the foot, with a ragged top edge where the mop stopped. Drawn three widths over
  // so it tiles: each blob is repeated one width either side.
  const foot = ctx.createLinearGradient(0, h, 0, h - 60);
  foot.addColorStop(0, 'rgba(22,20,16,0.62)'); foot.addColorStop(0.35, 'rgba(22,20,16,0.3)'); foot.addColorStop(1, 'rgba(22,20,16,0)');
  ctx.fillStyle = foot; ctx.fillRect(0, h - 60, w, 60);
  for (let i = 0; i < 60; i++) {
    const x = r() * w, y = h - 18 - r() * 34, rx = 6 + r() * 26, ry = 3 + r() * 9, a = 0.06 + r() * 0.12;
    for (const dx of [-w, 0, w]) {
      const g = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, rx);
      g.addColorStop(0, `rgba(22,20,16,${a})`); g.addColorStop(1, 'rgba(22,20,16,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x + dx, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Scuffs: short dark smears, mostly below knee height, a few lighter where the paint is worn.
  for (let i = 0; i < 26; i++) {
    const x = r() * w, y = h - 20 - Math.pow(r(), 1.8) * 150, len = 8 + r() * 46, thick = 1 + r() * 3;
    ctx.strokeStyle = r() < 0.8 ? `rgba(10,12,14,${0.18 + r() * 0.28})` : `rgba(255,255,255,${0.12 + r() * 0.12})`;
    ctx.lineWidth = thick; ctx.lineCap = 'round';
    for (const dx of [-w, 0, w]) { ctx.beginPath(); ctx.moveTo(x + dx, y); ctx.lineTo(x + dx + len, y + (r() - 0.5) * 6); ctx.stroke(); }
  }
  const t = own(c); t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

export const dadoMaterial = () => new THREE.MeshStandardMaterial({ color: LABS.dado, roughness: 0.8, map: dadoGrime() });
export const dadoLineMaterial = () => new THREE.MeshStandardMaterial({ color: LABS.panel, roughness: 0.6 });
/**
 * Clear glass: reflective, barely tinted, no depth write. Give the mesh `renderOrder = 2`.
 *
 * Barely tinted is the point, and it was not. At 0.16 opacity in a cyan tint with the reflections
 * turned up to 1.6, one pane laid enough blue over what was behind it to turn the grey wall above a
 * dado blue, and the clean lab's panes stack two and three deep across a frame. The credentials
 * hall came out with the same wall reading in two or three different blues, with a hard step at
 * every pane edge, and Jordan read that as the wall jumping. It was not the wall: it was how much
 * of this material was sitting in front of it.
 *
 * Half the opacity, half the reflection, and a tint two thirds of the way from that cyan to white.
 * A pane is still visible by its edge, its specular and the room it mirrors, which is all a pane
 * has to do.
 */
export function labGlass(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({ color: 0xeaf2f5, transparent: true, opacity: 0.08, roughness: 0.06, metalness: 0, envMapIntensity: 0.8, depthWrite: false });
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
