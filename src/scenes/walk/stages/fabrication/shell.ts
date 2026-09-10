import * as THREE from 'three';
import type { StageContext } from '../types';
import { surface, prepareAO } from '../../materials';
import { hazardTexture, stencilTexture } from '../../textures';
import { instances, merged, repeat, type Spot } from '../../merge';
import { X0, X1, Z0, Z1, H, W, D, XC, ZC, EXIT_X0, EXIT_X1, EXIT_H, EXIT_LINE_Z, COLUMNS, AISLE, AISLE_HALF, PAINT, SAFETY, AISLE_PAINT, CONCRETE_TINT, FLOOR_TINT } from './layout';

export interface Shell { planes: Set<THREE.Object3D> }

/** A plain steel material from the sheet set with the rusted colour map dropped: the corrugation
 *  in the normal and the wear in the ARM map are worth keeping, the red brown paint is not. */
export function steel(set: ReturnType<StageContext['store']['texture']>, w: number, h: number, tile: number, color: number): THREE.MeshStandardMaterial {
  const m = surface(set, w, h, tile);
  m.map?.dispose(); m.map = null; m.color.setHex(color); return m;
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

/** Floor, ceiling, walls, dado, aisle paint, columns and the exit header. */
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

  const wall = (w: number, h: number) => { const m = surface(concreteW, w, h, 3); m.color.setHex(CONCRETE_TINT); return m; };
  for (const [x, ry] of [[X0, Math.PI / 2], [X1, -Math.PI / 2]] as [number, number][]) {
    const m = plane(D, H, wall(D, H)); m.rotation.y = ry; m.position.set(x, H / 2, ZC);
  }
  // The far wall stops short of the left corner: that gap is the exit the spline turns through.
  const far = plane(X1 - EXIT_X1, H, wall(X1 - EXIT_X1, H)); far.position.set((EXIT_X1 + X1) / 2, H / 2, Z0);
  // Above the corridor opening the wall closes again, so the exit reads as a doorway into the next
  // wing rather than as the hall ending in the dark.
  const header = plane(EXIT_X1 - EXIT_X0, H - EXIT_H, wall(EXIT_X1 - EXIT_X0, H - EXIT_H)); header.position.set((EXIT_X0 + EXIT_X1) / 2, EXIT_H + (H - EXIT_H) / 2, Z0);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.4), new THREE.MeshBasicMaterial({ map: stencilTexture('RECREATION', { width: 1024, height: 256, color: '#C3D6DE', font: '400 150px Michroma, system-ui, sans-serif', alpha: 0.5 }), transparent: true, depthWrite: false }));
  sign.position.set((EXIT_X0 + EXIT_X1) / 2, EXIT_H + 1.3, Z0 + 0.03); root.add(sign);
  // Front wall either side of the booth door and the header above it. The door is the booth's.
  const frontMat = wall(W, H);
  for (const [x, w] of [[(X0 - 4) / 2, -4 - X0], [(X1 + 4) / 2, X1 - 4]] as [number, number][]) {
    const m = plane(w, H, frontMat); m.rotation.y = Math.PI; m.position.set(x, H / 2, Z1 - 0.01);
  }
  const lintel = plane(8, H - 4, frontMat); lintel.rotation.y = Math.PI; lintel.position.set(0, 4 + (H - 4) / 2, Z1 - 0.01);

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
  // Cable runs along the right wall, clipped to the wall face.
  root.add(repeat(store.model('cables'), [[X1 - 0.2, 6.4, -20, -Math.PI / 2, 1.6], [X1 - 0.2, 6.4, -8, -Math.PI / 2, 1.6], [X1 - 0.2, 6.4, 6, -Math.PI / 2, 1.6]]));
  return { planes };
}
