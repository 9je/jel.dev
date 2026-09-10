import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Stage, StageContext, StageDef } from './types';
import { surface, prepareAO, disposeObject } from '../materials';
import { hazardTexture, stencilTexture } from '../textures';
import { createLedTicker } from '../ticker';

// The hangar. x right, z toward the booth: the path enters through the booth door at z 22 and leaves
// through the gap in the far wall at x -20..-12. The room is deliberately off centre. The camera
// hugs the left third of it, so the right wall sits at x 14 rather than mirroring x -20, which is
// what puts the right hand dressing and the LED board inside the cone the camera can actually see.
const X0 = -20, X1 = 14, Z0 = -30, Z1 = 22, H = 12;
const W = X1 - X0, D = Z1 - Z0, XC = (X0 + X1) / 2, ZC = (Z0 + Z1) / 2;

/** x, y, z, then an optional turn about y and a uniform scale. */
type Spot = [number, number, number, number?, number?];

function place(g: THREE.Object3D, x: number, y: number, z: number, ry = 0, s = 1) {
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
function instances(geometry: THREE.BufferGeometry, material: THREE.Material, spots: Spot[]): THREE.InstancedMesh {
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
function parts(template: THREE.Object3D): { geometry: THREE.BufferGeometry; material: THREE.Material }[] {
  template.updateMatrixWorld(true);
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const out: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = [];
  template.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    // Merging by material cannot express a mesh whose groups use several materials. None of the
    // hangar props has one; if that ever changes, fail loudly rather than paint it all with the first.
    if (Array.isArray(o.material)) throw new Error(`fabrication: ${o.name || 'a mesh'} has ${o.material.length} materials, which parts() cannot merge`);
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
function once(template: THREE.Object3D, x: number, y: number, z: number, ry = 0, s = 1): THREE.Group {
  const group = new THREE.Group();
  for (const { geometry, material } of parts(template)) group.add(new THREE.Mesh(geometry, material));
  return place(group, x, y, z, ry, s) as THREE.Group;
}

/** A merged model placed many times, one draw call per material. */
function repeat(template: THREE.Object3D, spots: Spot[]): THREE.Group {
  const group = new THREE.Group();
  for (const { geometry, material } of parts(template)) group.add(instances(geometry, material, spots));
  return group;
}

function build({ scene, store, anchors, tier }: StageContext): Stage {
  const root = new THREE.Group(); root.name = 'fabrication'; scene.add(root);
  const concreteF = store.texture('concrete_floor'), concreteW = store.texture('concrete_wall'), sheet = store.texture('metal_sheet');

  // The concrete diffuse averages 120/110/91, which is warm, and the fog only cools it in the
  // distance: near the camera the bare floor read as a tan wash that the orange pools disappeared
  // into. Tinting the map toward neutral makes the floor cold concrete again, so a sodium pool on it
  // reads as an island rather than as the floor colour.
  const floorMat = surface(concreteF, W, D, 3); floorMat.color.setHex(0x8fa8ba);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
  prepareAO(floor.geometry); floor.rotation.x = -Math.PI / 2; floor.position.set(XC, 0, ZC); floor.receiveShadow = true; root.add(floor);

  // The metal_sheet diffuse averages 106/38/23: it is rusted corrugated iron, and it was painting
  // the whole ceiling red brown. The corrugation in the normal and the wear in the ARM map are worth
  // keeping, so only the colour map goes, replaced by flat dark steel.
  const steel = (set: typeof sheet, w: number, h: number, tile: number, color: number) => {
    const m = surface(set, w, h, tile);
    m.map?.dispose(); m.map = null; m.color.setHex(color); return m;
  };
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), steel(sheet, W, D, 2, 0x59636b));
  prepareAO(ceil.geometry); ceil.rotation.x = Math.PI / 2; ceil.position.set(XC, H, ZC); root.add(ceil);

  for (const [x, ry] of [[X0, Math.PI / 2], [X1, -Math.PI / 2]] as [number, number][]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(D, H), surface(concreteW, D, H, 3));
    prepareAO(w.geometry); w.rotation.y = ry; w.position.set(x, H / 2, ZC); root.add(w);
  }
  // The far wall stops 8 m short of the left corner: that gap is the exit the spline turns through
  // on its way to the recreation corridor.
  const far = new THREE.Mesh(new THREE.PlaneGeometry(W - 8, H), surface(concreteW, W - 8, H, 3));
  prepareAO(far.geometry); far.position.set(XC + 4, H / 2, Z0); root.add(far);
  // Front wall either side of the booth door. The door itself belongs to the booth stage.
  const frontMat = surface(concreteW, W, H, 3);
  for (const [x, w] of [[(X0 - 4) / 2, -4 - X0], [(X1 + 4) / 2, X1 - 4]] as [number, number][]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H), frontMat); prepareAO(m.geometry);
    m.rotation.y = Math.PI; m.position.set(x, H / 2, Z1 - 0.01); root.add(m);
  }
  const header = new THREE.Mesh(new THREE.PlaneGeometry(8, H - 4), frontMat); prepareAO(header.geometry);
  header.rotation.y = Math.PI; header.position.set(0, 4 + (H - 4) / 2, Z1 - 0.01); root.add(header);

  // Columns, banded with hazard tape at knee height. Twelve boxes, two draw calls.
  const colMat = new THREE.MeshStandardMaterial({ color: 0x1f2a34, roughness: 0.9 });
  const haz = hazardTexture(); haz.repeat.set(2, 1);
  const hazMat = new THREE.MeshStandardMaterial({ map: haz, roughness: 0.7 });
  const columns: [number, number][] = [[-14, 8], [10, 8], [-14, -12], [10, -12], [-14, -24], [10, -24]];
  root.add(instances(new THREE.BoxGeometry(0.9, H, 0.9), colMat, columns.map(([x, z]) => [x, H / 2, z] as Spot)));
  root.add(instances(new THREE.BoxGeometry(0.96, 1.2, 0.96), hazMat, columns.map(([x, z]) => [x, 1.6, z] as Spot)));

  // Two plain trunk ducts run the length of the ceiling, with the detailed model dropped in at the
  // junctions. A whole run of the model would be two million triangles for something read at 10 m.
  const ductMat = steel(sheet, 2, D, 2, 0x6c757c); ductMat.metalness = 1; ductMat.roughness = 0.55;
  const hangers: Spot[] = [];
  for (const x of [-9, 6]) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, D - 4, 14, 1, true), ductMat);
    prepareAO(trunk.geometry); trunk.rotation.x = Math.PI / 2; trunk.position.set(x, H - 1.15, ZC); root.add(trunk);
    for (let z = -26; z <= 16; z += 6) hangers.push([x, H - 0.6, z]);
  }
  root.add(instances(new THREE.BoxGeometry(0.06, 1.1, 0.06), ductMat, hangers));
  root.add(repeat(store.model('airduct'), [[-9, H - 1.15, 6], [-9, H - 1.15, -14], [6, H - 1.15, -2], [6, H - 1.15, -20]]));
  root.add(repeat(store.model('cables'), [[X1 - 0.2, 6.4, -20, -Math.PI / 2, 1.6], [X1 - 0.2, 6.4, -8, -Math.PI / 2, 1.6], [X1 - 0.2, 6.4, 6, -Math.PI / 2, 1.6]]));

  // Four banks of fluorescent housings down the hall, each with its own emissive tube.
  const stripMat = new THREE.MeshStandardMaterial({ color: 0x0a0f14, emissive: 0xd9e8ee, emissiveIntensity: 2.2 });
  const banks = [16, 4, -8, -20];
  const fixtures: Spot[] = [], strips: Spot[] = [];
  for (const z of banks) for (const x of [-13, -3, 7]) {
    fixtures.push([x, H - 0.4, z, 0, 2.6]);
    strips.push([x, H - 0.52, z]);
  }
  root.add(repeat(store.model('fluorescent'), fixtures));
  root.add(instances(new THREE.BoxGeometry(2.2, 0.06, 0.16), stripMat, strips));
  // Three spots do the actual work. Every light costs every pixel in the room, and the walls here
  // are 34 m wide, so the bank count and the light count are deliberately not the same number.
  for (const z of [12, -4, -20]) {
    const l = new THREE.SpotLight(0xd9e8ee, 170, 46, Math.PI / 3, 0.8, 1.7);
    l.position.set(XC, H - 0.6, z); l.target.position.set(XC, 0, z); root.add(l, l.target);
  }

  // Sodium work lights, orange, the fabrication wing colour. A tight cone from 6.5 m throws a pool
  // the eye can find, and a faint disc on the concrete keeps that pool readable on the low tier,
  // which has no bloom to spread it.
  const hang = store.model('hanging_lamp');
  const cordMat = new THREE.MeshStandardMaterial({ color: 0x121a21, roughness: 0.9 });
  const sodium: [number, number, boolean][] = [[0, 6, true], [6, -16, true], [-13, -12, false]];
  const lamps: Spot[] = [], cords: Spot[] = [], pools: Spot[] = [];
  for (const [x, z, lamp] of sodium) {
    const y = 6.5;
    const s = new THREE.SpotLight(0xe0813a, 180, 18, Math.PI / 6, 0.5, 1.8);
    s.position.set(x, y, z); s.target.position.set(x, 0, z);
    s.castShadow = tier === 'high' && lamp; s.shadow.mapSize.set(1024, 1024); s.shadow.bias = -0.0008;
    root.add(s, s.target);
    pools.push([x, 0.02, z]);
    if (!lamp) continue;
    lamps.push([x, y, z]);
    cords.push([x, y + (H - y) / 2, z]);
  }
  root.add(repeat(hang, lamps));
  root.add(instances(new THREE.CylinderGeometry(0.02, 0.02, H - 6.5), cordMat, cords));
  const poolGeo = new THREE.CircleGeometry(1.6, 24); poolGeo.rotateX(-Math.PI / 2);
  root.add(instances(poolGeo, new THREE.MeshBasicMaterial({ color: 0xe0813a, transparent: true, opacity: 0.05, depthWrite: false }), pools));

  // Dressing. Everything is placed against one of the two frames the walk actually holds: the
  // approach down the hall, and the stop looking back at the clean room.
  root.add(repeat(store.model('crate_wood_1'), [[0.5, 0, 11, 0.2, 1.5], [0.8, 0.5, 11.1, 0.5, 1.5], [5, 0, -13, -0.4, 1.5]]));
  root.add(repeat(store.model('crate_wood_2'), [[2.1, 0, 11.6, -0.35, 1.4], [6.6, 0, -12.4, 0.25, 1.4]]));
  root.add(repeat(store.model('barrel'), [[-1, 0, 3], [-0.2, 0, 3.8], [0.1, 0, 2.3, 0.9], [9, 0, -18], [9.8, 0, -17.2, 1.2]]));
  root.add(repeat(store.model('crate_plastic'), [[7, 0, -22, 0.15, 1.6], [7, 0.42, -22, -0.1, 1.6]]));
  root.add(once(store.model('military_crate'), -13, 0, -24, 0.3, 1.4));
  root.add(once(store.model('storage_cart'), 3, 0, -8, Math.PI / 5), once(store.model('tool_cart'), -1.5, 0, 7, -0.4));
  root.add(once(store.model('metal_rack'), 8, 0, -26, Math.PI), once(store.model('power_box'), X1 - 0.08, 1.6, -18, -Math.PI / 2));
  root.add(once(store.model('fire_extinguisher'), -13.3, 0, 8.6, 1.2));

  // The clean room: a glazed box used as a product display, with one lit exhibit per project. The
  // camera stops past it and turns back, so the screens face -z, toward where it comes to rest.
  const CUBE_X = -12.5, CUBE_Z = -3, CW = 10, CH = 4, CD = 8;
  const cube = new THREE.Group(); cube.position.set(CUBE_X, 0, CUBE_Z); root.add(cube);
  const glass = tier === 'high'
    ? new THREE.MeshPhysicalMaterial({ color: 0xcfe6ee, transmission: 0.92, roughness: 0.25, thickness: 0.4, ior: 1.45 })
    : new THREE.MeshStandardMaterial({ color: 0x9fd4e2, transparent: true, opacity: 0.12, depthWrite: false });
  cube.add(place(new THREE.Mesh(new THREE.BoxGeometry(CW, CH, CD), glass), 0, CH / 2, 0));
  const inner = new THREE.Mesh(new THREE.BoxGeometry(CW - 0.3, CH - 0.2, CD - 0.3), new THREE.MeshStandardMaterial({ color: 0x7c9099, emissive: 0xcfe6ee, emissiveIntensity: 0.03, side: THREE.BackSide }));
  cube.add(place(inner, 0, CH / 2, 0));
  // Without a frame the glass reads as a grey slab, so the box gets its glazing bars: four corner
  // posts and a rail along every top and bottom edge, in three draw calls.
  const frame = new THREE.MeshStandardMaterial({ color: 0x2b3740, metalness: 0.7, roughness: 0.35 });
  const hx = CW / 2, hz = CD / 2;
  cube.add(instances(new THREE.BoxGeometry(0.14, CH, 0.14), frame, [[-hx, CH / 2, -hz], [hx, CH / 2, -hz], [-hx, CH / 2, hz], [hx, CH / 2, hz]]));
  cube.add(instances(new THREE.BoxGeometry(CW, 0.12, 0.12), frame, [[0, CH, -hz], [0, CH, hz], [0, 0.06, -hz], [0, 0.06, hz]]));
  cube.add(instances(new THREE.BoxGeometry(0.12, 0.12, CD), frame, [[-hx, CH, 0], [hx, CH, 0], [-hx, 0.06, 0], [hx, 0.06, 0]]));

  // 2.2 m apart rather than 3: at the stop the three pedestals have to fit in the strip of frame to
  // the right of the pinned panel, and 3 m put the far one past the edge of a 960 px viewport.
  const exhibits: [string, string, number][] = [['gc-bridge', 'gc-bridge', -2.2], ['conch', 'conch.gg', 0], ['ezkey', 'ezkey.io', 2.2]];
  const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x8fa1aa, roughness: 0.5 });
  const topMat = new THREE.MeshStandardMaterial({ color: 0x46525a, metalness: 0.7, roughness: 0.4 });
  const labelMat = new THREE.MeshStandardMaterial({ color: 0x101c22, emissive: 0x6ec1d6, emissiveIntensity: 0.5 });
  const pedestals: Spot[] = [], tops: Spot[] = [], labels: Spot[] = [];
  for (const [key, label, x] of exhibits) {
    pedestals.push([x, 0.5, 0]); tops.push([x, 1.02, 0]); labels.push([x, 1.4, -0.48, Math.PI]);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.6), new THREE.MeshStandardMaterial({
      color: 0x05080b, emissive: 0xffffff, emissiveIntensity: 1.2,
      emissiveMap: stencilTexture(label, { width: 512, height: 180, color: '#CFE6EE', font: '600 96px Michroma, system-ui, sans-serif' }),
    }));
    cube.add(place(screen, x, 1.4, -0.55, Math.PI));
    anchors.set(key, new THREE.Vector3(CUBE_X + x, 1.7, CUBE_Z - 1.5));
  }
  cube.add(instances(new THREE.BoxGeometry(1.6, 1.0, 1.0), pedestalMat, pedestals));
  cube.add(instances(new THREE.BoxGeometry(1.7, 0.05, 1.1), topMat, tops));
  cube.add(instances(new THREE.BoxGeometry(1.9, 0.9, 0.04), labelMat, labels));
  const cubeLight = new THREE.PointLight(0xdff0f6, 3.2, 11, 1.8); cubeLight.position.set(CUBE_X, 3.4, CUBE_Z); root.add(cubeLight);
  anchors.set('fabrication', new THREE.Vector3(0, 2, 6));

  // The LED board. The right hand wall is 15 m off the path and never enters a 55 degree cone, so
  // the board goes on the far wall instead: it faces the whole approach down the hall, and it is
  // the wall the camera is looking at through the whole fabrication hold before it turns.
  const spans = Array.from(document.querySelectorAll<HTMLElement>('[data-ticker] span'));
  const raw = spans[0]?.textContent ?? '';
  const lines = raw.split('•').map((s) => s.trim()).filter(Boolean);
  const led = createLedTicker(lines.length ? lines : ['jel labs'], { width: 2048, height: 128 });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(16, 1), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1.6, emissiveMap: led.texture, map: led.texture }));
  board.position.set(4, 8.6, Z0 + 0.12); root.add(board);
  const ledGlow = new THREE.PointLight(0xf2c230, 8, 16, 2); ledGlow.position.set(4, 8.2, Z0 + 1.4); root.add(ledGlow);

  // Drifting dust, so the light shafts have something to sit in.
  const dustGeo = new THREE.BufferGeometry(); const n = tier === 'high' ? 600 : 200; const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = X0 + Math.random() * W; pos[i * 3 + 1] = Math.random() * H; pos[i * 3 + 2] = Z0 + Math.random() * D; }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xd9e8ee, size: 0.05, transparent: true, opacity: 0.35, depthWrite: false })); root.add(dust);

  // Only the props cast. The shell planes are the room the shadows land on, and a floor or a wall
  // casting into its own neighbours buys nothing but shadow map draws.
  const shell = new Set<THREE.Object3D>([floor, ceil, far, header]);
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.material instanceof THREE.MeshPhysicalMaterial) return;
    o.castShadow = tier === 'high' && !shell.has(o) && !(o.geometry instanceof THREE.PlaneGeometry);
    o.receiveShadow = true;
  });

  return {
    id: 'fabrication', root,
    update(_t, dt) {
      led.update(dt);
      const p = dustGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < n; i++) { let y = p.getY(i) - dt * 0.08; if (y < 0) y = H; p.setY(i, y); }
      p.needsUpdate = true;
    },
    dispose() {
      led.dispose();
      root.traverse((o) => { if (o instanceof THREE.InstancedMesh) o.dispose(); });
      disposeObject(root); scene.remove(root);
    },
  };
}

export const FABRICATION_DEF: StageDef = { id: 'fabrication', groups: ['fabrication', 'fabrication-extra'], near: ['booth', 'fabrication', 'recreation'], replaces: 'hangar', build };
