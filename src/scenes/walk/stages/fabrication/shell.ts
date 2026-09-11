import * as THREE from 'three';
import type { StageContext } from '../types';
import { surface, prepareAO } from '../../materials';
import { hazardTexture, stencilTexture } from '../../textures';
import { instances, merged, place, type Spot } from '../../merge';
import { cableTray } from '../../labs/props';
import { X0, X1, Z0, Z1, H, W, D, XC, ZC, EXIT_X0, EXIT_X1, EXIT_H, EXIT_LINE_Z, COLUMNS, AISLE, AISLE_HALF, CLAD_Y, GIRTS, PAINT, SAFETY, AISLE_PAINT, BLOCK_TINT, CLAD_TINT, GIRT_TINT, FLOOR_TINT } from './layout';

export interface Shell { planes: Set<THREE.Object3D> }

/** A plain steel material from the sheet set with the rusted colour map dropped: the corrugation
 *  in the normal and the wear in the ARM map are worth keeping, the red brown paint is not. */
export function steel(set: ReturnType<StageContext['store']['texture']>, w: number, h: number, tile: number, color: number): THREE.MeshStandardMaterial {
  const m = surface(set, w, h, tile);
  m.map?.dispose(); m.map = null; m.color.setHex(color); return m;
}

/** One batch for bars of different lengths: a unit box stretched along its own x. `instances()`
 *  carries a uniform scale only, and a girt is a different length on every wall of the bay. */
function bars(geometry: THREE.BufferGeometry, material: THREE.Material, runs: [number, number, number, number, number][]): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, runs.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  runs.forEach(([len, x, y, z, ry], i) => mesh.setMatrixAt(i, m.compose(p.set(x, y, z), q.setFromEuler(e.set(0, ry, 0)), s.set(len, 1, 1))));
  mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
  return mesh;
}

/** A strip of floor paint along a polyline, at a lateral offset, as one geometry. */
function stripe(points: [number, number][], offset: number, width: number): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i], [bx, bz] = points[i + 1];
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
    const nx = -dz / len, nz = dx / len;
    const g = new THREE.PlaneGeometry(len + width, width);
    g.rotateX(-Math.PI / 2); g.rotateY(Math.atan2(-dz, dx));
    g.translate((ax + bx) / 2 + nx * offset, 0.012, (az + bz) / 2 + nz * offset);
    out.push(g);
  }
  return out;
}

/** Floor, ceiling, the two wall courses and their girts, dado, aisle paint, columns, the exit
 *  header, the trunk ducts and the cable run. */
export function buildShell({ store }: StageContext, root: THREE.Group): Shell {
  const concreteF = store.texture('concrete_floor'), concreteW = store.texture('concrete_wall'), sheet = store.texture('metal_sheet');
  const planes = new Set<THREE.Object3D>();
  const plane = (w: number, h: number, mat: THREE.Material) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); prepareAO(m.geometry); m.receiveShadow = true; planes.add(m); root.add(m); return m; };

  // The concrete diffuse averages 120/110/91, which is warm. Tinting both maps toward neutral makes
  // the shell cold concrete, so a sodium pool on it reads as an island rather than as the floor.
  // Six metre tiles: at three the stains repeated visibly down a 52 m floor.
  const floorMat = surface(concreteF, W, D, 6); floorMat.color.setHex(FLOOR_TINT);
  const floor = plane(W, D, floorMat); floor.rotation.x = -Math.PI / 2; floor.position.set(XC, 0, ZC);
  const ceil = plane(W, D, steel(sheet, W, D, 2, 0x59636b)); ceil.rotation.x = Math.PI / 2; ceil.position.set(XC, H, ZC);

  // A bay wall is built in two courses and the flat plane Jordan saw had neither: painted blockwork
  // to 4 m, where the trucks and the pallets hit it, and profiled steel cladding for the 8 m above.
  // The join sits at eye level plus a storey, which gives the wall a horizon, and the girts that
  // hold the cladding give it three more. Materials are cached by size: two courses on five wall
  // runs is ten `surface()` calls and each one clones three maps.
  const mats = new Map<string, THREE.MeshStandardMaterial>();
  const cached = (key: string, make: () => THREE.MeshStandardMaterial) => { const hit = mats.get(key); if (hit) return hit; const m = make(); mats.set(key, m); return m; };
  const block = (w: number, h: number) => cached(`b${w}x${h}`, () => { const m = surface(concreteW, w, h, 2); m.color.setHex(BLOCK_TINT); return m; });
  const clad = (w: number, h: number) => cached(`c${w}x${h}`, () => { const m = steel(sheet, w, h, 1.5, CLAD_TINT); m.metalness = 0.6; m.roughness = 0.55; return m; });

  const girts: [number, number, number, number, number][] = [];
  /** A wall run from `base` to `top`, in its courses, with the girts it is tall enough to carry.
   *  A plane's normal points into the room, so the girts stand proud of it along that normal. */
  const run = (len: number, x: number, z: number, ry: number, base = 0, top = H) => {
    if (base < CLAD_Y) { const h = Math.min(CLAD_Y, top) - base; const m = plane(len, h, block(len, h)); m.rotation.y = ry; m.position.set(x, base + h / 2, z); }
    if (top > CLAD_Y) { const b = Math.max(CLAD_Y, base), h = top - b; const m = plane(len, h, clad(len, h)); m.rotation.y = ry; m.position.set(x, b + h / 2, z); }
    const nx = Math.sin(ry) * 0.06, nz = Math.cos(ry) * 0.06;
    for (const y of GIRTS) if (y >= base && y <= top) girts.push([len, x + nx, y, z + nz, ry]);
  };
  run(D, X0, ZC, Math.PI / 2); run(D, X1, ZC, -Math.PI / 2);
  // The far wall stops short of the left corner: that gap is the exit the spline turns through.
  run(X1 - EXIT_X1, (EXIT_X1 + X1) / 2, Z0, 0);
  // Above the corridor opening the wall closes again, so the exit reads as a doorway into the next
  // wing rather than as the hall ending in the dark.
  run(EXIT_X1 - EXIT_X0, (EXIT_X0 + EXIT_X1) / 2, Z0, 0, EXIT_H);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.4), new THREE.MeshBasicMaterial({ map: stencilTexture('RECREATION', { width: 1024, height: 256, color: '#C3D6DE', font: '400 150px Michroma, system-ui, sans-serif', alpha: 0.5 }), transparent: true, depthWrite: false }));
  sign.position.set((EXIT_X0 + EXIT_X1) / 2, EXIT_H + 1.3, Z0 + 0.03); root.add(sign);
  // Front wall either side of the booth door and the header above it. The door is the booth's.
  for (const [x, w] of [[(X0 - 4) / 2, -4 - X0], [(X1 + 4) / 2, X1 - 4]] as [number, number][]) run(w, x, Z1 - 0.01, Math.PI);
  run(8, 0, Z1 - 0.01, Math.PI, 4);
  root.add(bars(new THREE.BoxGeometry(1, 0.12, 0.08), new THREE.MeshStandardMaterial({ color: GIRT_TINT, roughness: 0.6, metalness: 0.5 }), girts));

  // Dado: a band of dark machinery paint to 1.2 m with a safety line on top, along every wall. It
  // breaks the tile repeat at eye level and is the first thing that says "shop" rather than "box".
  const dado: THREE.BufferGeometry[] = [], line: THREE.BufferGeometry[] = [];
  const band = (len: number, x: number, z: number, ry: number) => {
    const b = new THREE.BoxGeometry(len, 1.2, 0.03); b.rotateY(ry); b.translate(x, 0.6, z); dado.push(b);
    const l = new THREE.BoxGeometry(len, 0.07, 0.035); l.rotateY(ry); l.translate(x, 1.25, z); line.push(l);
  };
  band(D, X0 + 0.02, ZC, Math.PI / 2); band(D, X1 - 0.02, ZC, -Math.PI / 2);
  band(X1 - EXIT_X1, (EXIT_X1 + X1) / 2, Z0 + 0.02, 0);
  band(-4 - X0, (X0 - 4) / 2, Z1 - 0.03, 0); band(X1 - 4, (X1 + 4) / 2, Z1 - 0.03, 0);
  root.add(merged(dado, new THREE.MeshStandardMaterial({ color: PAINT, roughness: 0.85 })));
  root.add(merged(line, new THREE.MeshStandardMaterial({ color: SAFETY, roughness: 0.6 })));

  // The painted aisle. Two worn lines either side of the walked path, and nothing is ever placed
  // between them: an empty middle reads as a working floor only when the paint says it is kept clear.
  const aisleMat = new THREE.MeshBasicMaterial({ color: AISLE_PAINT, transparent: true, opacity: 0.55, depthWrite: false });
  root.add(merged([...stripe(AISLE, AISLE_HALF, 0.14), ...stripe(AISLE, -AISLE_HALF, 0.14), ...stripe([[EXIT_X0 + 0.4, EXIT_LINE_Z], [EXIT_X1 - 0.4, EXIT_LINE_Z]], 0, 0.14)], aisleMat));

  // Columns, banded with hazard tape at knee height, numbered on the face toward the aisle.
  const colMat = new THREE.MeshStandardMaterial({ color: 0x1f2a34, roughness: 0.9 });
  const haz = hazardTexture(); haz.repeat.set(2, 1);
  root.add(instances(new THREE.BoxGeometry(0.9, H, 0.9), colMat, COLUMNS.map(([x, z]) => [x, H / 2, z] as Spot)));
  root.add(instances(new THREE.BoxGeometry(0.96, 1.2, 0.96), new THREE.MeshStandardMaterial({ map: haz, roughness: 0.7 }), COLUMNS.map(([x, z]) => [x, 1.6, z] as Spot)));
  COLUMNS.forEach(([x, z], i) => {
    const n = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: stencilTexture(String(i + 1), { width: 128, height: 128, color: '#C3D6DE', font: '400 96px Michroma, system-ui, sans-serif', alpha: 0.55 }), transparent: true, depthWrite: false }));
    const toward = x < XC ? 1 : -1;
    n.position.set(x + toward * 0.46, 3.1, z); n.rotation.y = toward > 0 ? Math.PI / 2 : -Math.PI / 2; root.add(n);
  });

  // Two plain trunk ducts run the length of the ceiling on hangers. The detailed junction models
  // used to hang off them and read as black boxes floating in the dark, so they are gone.
  const ductMat = steel(sheet, 2, D, 2, 0x6c757c); ductMat.metalness = 1; ductMat.roughness = 0.55;
  const hangers: Spot[] = [];
  for (const x of [-9, 6]) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, D - 4, 14, 1, true), ductMat);
    prepareAO(trunk.geometry); trunk.rotation.x = Math.PI / 2; trunk.position.set(x, H - 1.15, ZC); root.add(trunk);
    for (let z = -26; z <= 16; z += 6) hangers.push([x, H - 0.6, z]);
  }
  root.add(instances(new THREE.BoxGeometry(0.06, 1.1, 0.06), ductMat, hangers));
  // The bundled cable model used to be repeated three times down the right wall. Clipped flat to a
  // flat wall and lit from above it read as a splat of grey paint rather than as wire, and the same
  // splat three times over is what Jordan saw. A tray the length of the hall with conduit dropping
  // out of it every 8 m is the run that was meant: it is continuous, it is structure, and it ties
  // the cladding to the dado instead of decorating it.
  for (const [x, ry] of [[X0 + 0.25, Math.PI / 2], [X1 - 0.25, -Math.PI / 2]] as [number, number][]) root.add(place(cableTray(D - 4), x, 5.2, ZC, ry));
  const drops: Spot[] = [];
  for (const x of [X0 + 0.25, X1 - 0.25]) for (let z = Z0 + 4; z <= Z1 - 4; z += 8) drops.push([x, 2.6, z]);
  root.add(instances(new THREE.CylinderGeometry(0.03, 0.03, 5.2, 8), new THREE.MeshStandardMaterial({ color: 0x8b949b, roughness: 0.5, metalness: 0.7 }), drops));
  return { planes };
}
