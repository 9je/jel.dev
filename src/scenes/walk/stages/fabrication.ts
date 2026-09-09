import * as THREE from 'three';
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

function place(g: THREE.Object3D, x: number, y: number, z: number, ry = 0, s = 1) {
  g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(s); return g;
}

/**
 * The Poly Haven props are dense: one air duct is 45 000 triangles across 25 primitives, so a run of
 * them cloned one by one costs hundreds of draw calls before anything else is in the room. Anything
 * repeated goes through here instead, which collapses the whole run to one draw call per primitive.
 */
function repeat(template: THREE.Object3D, spots: [number, number, number, number?, number?][]): THREE.Group {
  const group = new THREE.Group();
  template.updateMatrixWorld(true);
  const world = spots.map(([x, y, z, ry = 0, s = 1]) => new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, s, s)));
  const m = new THREE.Matrix4();
  template.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const inst = new THREE.InstancedMesh(o.geometry, o.material, world.length);
    for (let i = 0; i < world.length; i++) inst.setMatrixAt(i, m.multiplyMatrices(world[i], o.matrixWorld));
    inst.instanceMatrix.needsUpdate = true;
    inst.frustumCulled = false;
    group.add(inst);
  });
  return group;
}

function build({ scene, store, anchors, tier }: StageContext): Stage {
  const root = new THREE.Group(); root.name = 'fabrication'; scene.add(root);
  const concreteF = store.texture('concrete_floor'), concreteW = store.texture('concrete_wall'), sheet = store.texture('metal_sheet');

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), surface(concreteF, W, D, 3));
  prepareAO(floor.geometry); floor.rotation.x = -Math.PI / 2; floor.position.set(XC, 0, ZC); floor.receiveShadow = true; root.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), surface(sheet, W, D, 2));
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

  // Columns, banded with hazard tape at knee height.
  const colMat = new THREE.MeshStandardMaterial({ color: 0x1f2a34, roughness: 0.9 });
  const haz = hazardTexture(); haz.repeat.set(2, 1);
  const hazMat = new THREE.MeshStandardMaterial({ map: haz, roughness: 0.7 });
  for (const [x, z] of [[-14, 8], [10, 8], [-14, -12], [10, -12], [-14, -24], [10, -24]]) {
    root.add(place(new THREE.Mesh(new THREE.BoxGeometry(0.9, H, 0.9), colMat), x, H / 2, z));
    root.add(place(new THREE.Mesh(new THREE.BoxGeometry(0.96, 1.2, 0.96), hazMat), x, 1.6, z));
  }

  // Two plain trunk ducts run the length of the ceiling, with the detailed model dropped in at the
  // junctions. A whole run of the model would be two million triangles for something read at 10 m.
  const ductMat = surface(sheet, 2, D, 2); ductMat.metalness = 1; ductMat.roughness = 0.55;
  for (const x of [-9, 6]) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, D - 4, 14, 1, true), ductMat);
    prepareAO(trunk.geometry); trunk.rotation.x = Math.PI / 2; trunk.position.set(x, H - 1.15, ZC); root.add(trunk);
    for (let z = -26; z <= 16; z += 6) {
      const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 0.06), ductMat);
      hanger.position.set(x, H - 0.6, z); root.add(hanger);
    }
  }
  root.add(repeat(store.model('airduct'), [[-9, H - 1.15, 6], [-9, H - 1.15, -14], [6, H - 1.15, -2], [6, H - 1.15, -20]]));
  root.add(repeat(store.model('cables'), [[X1 - 0.2, 6.4, -20, -Math.PI / 2, 1.6], [X1 - 0.2, 6.4, -8, -Math.PI / 2, 1.6], [X1 - 0.2, 6.4, 6, -Math.PI / 2, 1.6]]));

  // Four banks of fluorescent housings down the hall, each with its own emissive tube.
  const stripMat = new THREE.MeshStandardMaterial({ color: 0x0a0f14, emissive: 0xd9e8ee, emissiveIntensity: 2.2 });
  const banks = [16, 4, -8, -20];
  const fixtures: [number, number, number, number?, number?][] = [];
  for (const z of banks) for (const x of [-13, -3, 7]) {
    fixtures.push([x, H - 0.4, z, 0, 2.6]);
    root.add(place(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.16), stripMat), x, H - 0.52, z));
  }
  root.add(repeat(store.model('fluorescent'), fixtures));
  // Three spots do the actual work. Every light costs every pixel in the room, and the walls here
  // are 34 m wide, so the bank count and the light count are deliberately not the same number.
  for (const z of [12, -4, -20]) {
    const l = new THREE.SpotLight(0xd9e8ee, 170, 46, Math.PI / 3, 0.8, 1.7);
    l.position.set(XC, H - 0.6, z); l.target.position.set(XC, 0, z); root.add(l, l.target);
  }

  // Sodium work lights, orange, the fabrication wing colour. Two of them hang off a visible lamp.
  const hang = store.model('hanging_lamp');
  const cordMat = new THREE.MeshStandardMaterial({ color: 0x121a21, roughness: 0.9 });
  const sodium: [number, number, boolean][] = [[0, 6, true], [6, -16, true], [-13, -12, false]];
  for (const [x, z, lamp] of sodium) {
    const y = lamp ? 6.5 : 8;
    const s = new THREE.SpotLight(0xe0813a, 135, 24, Math.PI / 4, 0.85, 1.8);
    s.position.set(x, y, z); s.target.position.set(x, 0, z);
    s.castShadow = tier === 'high' && lamp; s.shadow.mapSize.set(1024, 1024); s.shadow.bias = -0.0008;
    root.add(s, s.target);
    if (!lamp) continue;
    root.add(place(hang.clone(), x, y, z));
    root.add(place(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, H - y), cordMat), x, y + (H - y) / 2, z));
  }

  // Dressing. Everything is placed against one of the two frames the walk actually holds: the
  // approach down the hall, and the stop looking back at the clean room.
  root.add(place(store.model('crate_wood_1'), 0.5, 0, 11, 0.2, 1.5), place(store.model('crate_wood_2'), 2.1, 0, 11.6, -0.35, 1.4), place(store.model('crate_wood_1'), 0.8, 0.5, 11.1, 0.5, 1.5));
  root.add(place(store.model('crate_wood_1'), 5, 0, -13, -0.4, 1.5), place(store.model('crate_wood_2'), 6.6, 0, -12.4, 0.25, 1.4));
  root.add(place(store.model('barrel'), -1, 0, 3), place(store.model('barrel'), -0.2, 0, 3.8), place(store.model('barrel'), 0.1, 0, 2.3, 0.9));
  root.add(place(store.model('barrel'), 9, 0, -18), place(store.model('barrel'), 9.8, 0, -17.2, 1.2));
  root.add(place(store.model('crate_plastic'), 7, 0, -22, 0.15, 1.6), place(store.model('crate_plastic'), 7, 0.42, -22, -0.1, 1.6));
  root.add(place(store.model('military_crate'), -13, 0, -24, 0.3, 1.4));
  root.add(place(store.model('storage_cart'), 3, 0, -8, Math.PI / 5), place(store.model('tool_cart'), -1.5, 0, 7, -0.4));
  root.add(place(store.model('metal_rack'), 8, 0, -26, Math.PI), place(store.model('power_box'), X1 - 0.08, 1.6, -18, -Math.PI / 2));
  root.add(place(store.model('fire_extinguisher'), -13.3, 0, 8.6, 1.2));

  // The clean room: a glass box used as a product display, with one lit exhibit per project. The
  // camera stops past it and turns back, so the screens face -z, toward where it comes to rest.
  const cube = new THREE.Group(); cube.position.set(-8, 0, -3); root.add(cube);
  const glass = tier === 'high'
    ? new THREE.MeshPhysicalMaterial({ color: 0xcfe6ee, transmission: 0.92, roughness: 0.25, thickness: 0.4, ior: 1.45 })
    : new THREE.MeshStandardMaterial({ color: 0xcfe6ee, transparent: true, opacity: 0.18, depthWrite: false });
  cube.add(place(new THREE.Mesh(new THREE.BoxGeometry(10, 4, 8), glass), 0, 2, 0));
  const inner = new THREE.Mesh(new THREE.BoxGeometry(9.7, 3.8, 7.7), new THREE.MeshStandardMaterial({ color: 0x7c9099, emissive: 0xcfe6ee, emissiveIntensity: 0.03, side: THREE.BackSide }));
  cube.add(place(inner, 0, 2, 0));
  const edge = new THREE.MeshStandardMaterial({ color: 0x9aa7ae, metalness: 0.8, roughness: 0.3 });
  for (const [x, z] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) cube.add(place(new THREE.Mesh(new THREE.BoxGeometry(0.15, 4, 0.15), edge), x, 2, z));
  const exhibits: [string, string, number][] = [['gc-bridge', 'gc-bridge', -3], ['conch', 'conch.gg', 0], ['ezkey', 'ezkey.io', 3]];
  const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x8fa1aa, roughness: 0.5 });
  for (const [key, label, x] of exhibits) {
    cube.add(place(new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.0), pedestalMat), x, 0.5, 0));
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.5), new THREE.MeshStandardMaterial({
      color: 0x05080b, emissive: 0xffffff, emissiveIntensity: 1.2,
      emissiveMap: stencilTexture(label, { width: 512, height: 180, color: '#CFE6EE', font: '600 96px Michroma, system-ui, sans-serif' }),
    }));
    cube.add(place(screen, x, 1.35, -0.55, Math.PI));
    anchors.set(key, new THREE.Vector3(-8 + x, 1.7, -3 - 1.5));
  }
  const cubeLight = new THREE.PointLight(0xdff0f6, 3.2, 11, 1.8); cubeLight.position.set(-8, 3.4, -3); root.add(cubeLight);
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

  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.material instanceof THREE.MeshPhysicalMaterial) return;
    o.castShadow = tier === 'high' && o !== floor && o !== ceil;
    o.receiveShadow = true;
  });

  // The board redraws a 2048 px canvas and re-uploads it, so it runs at its own rate rather than at
  // the frame rate. A sign that steps 24 times a second still reads as a scrolling sign.
  let acc = 0;
  return {
    id: 'fabrication', root,
    update(_t, dt) {
      acc += dt;
      if (acc >= 1 / 24) { led.update(acc); acc = 0; }
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
