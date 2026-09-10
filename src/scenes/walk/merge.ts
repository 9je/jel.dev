import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** x, y, z, then an optional turn about y and a uniform scale. */
export type Spot = [number, number, number, number?, number?];

export function place<T extends THREE.Object3D>(g: T, x: number, y: number, z: number, ry = 0, s = 1): T {
  g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(s); return g;
}

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const matrixFor = (spot: Spot) => {
  const [x, y, z, ry = 0, s = 1] = spot;
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(s, s, s));
};

/** One draw call for a repeated primitive, with culling left on: an InstancedMesh has no bounding
 *  volume until it is asked for one, and without it three cannot decide whether the batch is in
 *  frame, so the usual shortcut is to switch culling off. Computing the sphere instead keeps the
 *  batch cullable. */
export function instances(geometry: THREE.BufferGeometry, material: THREE.Material, spots: Spot[]): THREE.InstancedMesh {
  const inst = new THREE.InstancedMesh(geometry, material, spots.length);
  spots.forEach((spot, i) => inst.setMatrixAt(i, matrixFor(spot)));
  inst.instanceMatrix.needsUpdate = true;
  inst.computeBoundingSphere();
  return inst;
}

/**
 * The Poly Haven props arrive as dozens of separate mesh nodes over one or two materials: an air
 * duct is 25 nodes and a cable run is 49, which is 49 draw calls for one bundle of wire. Baking each
 * node's transform into its geometry and merging by material collapses a whole prop to one draw call
 * per material, which is what makes a dressed room affordable at all.
 */
export function parts(template: THREE.Object3D): { geometry: THREE.BufferGeometry; material: THREE.Material }[] {
  template.updateMatrixWorld(true);
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const out: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = [];
  template.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    // Merging by material cannot express a mesh whose groups use several materials. None of the
    // props has one; if that ever changes, fail loudly rather than paint it all with the first.
    if (Array.isArray(o.material)) throw new Error(`${o.name || 'a mesh'} has ${o.material.length} materials, which parts() cannot merge`);
    const baked = o.geometry.clone().applyMatrix4(o.matrixWorld);
    const list = buckets.get(o.material);
    if (list) list.push(baked); else buckets.set(o.material, [baked]);
  });
  for (const [material, list] of buckets) {
    if (list.length === 1) { out.push({ geometry: list[0], material }); continue; }
    const merged = mergeGeometries(list, false);
    // Mismatched attribute sets make the merge impossible; fall back to drawing them one by one.
    if (!merged) { for (const g of list) out.push({ geometry: g, material }); continue; }
    for (const g of list) g.dispose();
    out.push({ geometry: merged, material });
  }
  return out;
}

/** A merged model placed once. */
export function once(template: THREE.Object3D, x: number, y: number, z: number, ry = 0, s = 1): THREE.Group {
  const group = new THREE.Group();
  for (const { geometry, material } of parts(template)) group.add(new THREE.Mesh(geometry, material));
  return place(group, x, y, z, ry, s);
}

/** A merged model placed many times, one draw call per material. */
export function repeat(template: THREE.Object3D, spots: Spot[]): THREE.Group {
  const group = new THREE.Group();
  for (const { geometry, material } of parts(template)) group.add(instances(geometry, material, spots));
  return group;
}

/** Several plain geometries, each already transformed into place, as one mesh. */
export function merged(geometries: THREE.BufferGeometry[], material: THREE.Material): THREE.Mesh {
  const g = mergeGeometries(geometries, false);
  if (!g) throw new Error('merged(): geometries do not share an attribute set');
  for (const x of geometries) x.dispose();
  return new THREE.Mesh(g, material);
}

/** Wraps a template so its base sits on y 0 and its footprint is centred on the origin. Several
 *  Poly Haven props are modelled metres away from their own origin, and placing those by eye is a
 *  guessing game without this. Not for things that hang: a lamp's origin is its hook. */
export function grounded(template: THREE.Object3D): THREE.Group {
  const box = new THREE.Box3().setFromObject(template);
  const g = new THREE.Group(); g.add(template);
  template.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  return g;
}
