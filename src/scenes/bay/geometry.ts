import * as THREE from 'three';
import { WINGS, HANGAR, BOOTH, BANK_Z, COLORS, type WingId } from './constants';
import { makeFloorTexture, makeHazardTexture, makeNoiseTexture, makeBoardTexture } from './textures';

export type Quality = 'high' | 'low';
export interface Gate { id: WingId; frame: THREE.MeshStandardMaterial; board: THREE.MeshStandardMaterial; light: THREE.PointLight }
export interface Hangar {
  root: THREE.Group;
  strips: THREE.MeshStandardMaterial[][];
  cubeInterior: THREE.MeshStandardMaterial;
  cubeLight: THREE.PointLight;
  gates: Gate[];
}

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

export function buildHangar(quality: Quality): Hangar {
  const root = new THREE.Group();
  const zc = (HANGAR.zFront + HANGAR.zBack) / 2;
  const noise = makeNoiseTexture();

  // shell, seen from inside
  const wallMat = new THREE.MeshStandardMaterial({ color: COLORS.wall, roughness: 0.95, metalness: 0.05, roughnessMap: noise, side: THREE.BackSide });
  root.add(box(HANGAR.width, HANGAR.height, HANGAR.length, wallMat, 0, HANGAR.height / 2, zc));

  // floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HANGAR.width, HANGAR.length), new THREE.MeshStandardMaterial({ map: makeFloorTexture(), roughness: 0.85, metalness: 0.1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.01, zc);
  root.add(floor);

  // ducts and cable tray
  const ductMat = new THREE.MeshStandardMaterial({ color: 0x232f3a, roughness: 0.6, metalness: 0.6 });
  for (const x of [-8, 0, 8]) root.add(box(0.9, 0.9, HANGAR.length - 4, ductMat, x, HANGAR.height - 0.8, zc));
  root.add(box(0.5, 0.15, HANGAR.length - 4, ductMat, 4, HANGAR.height - 0.4, zc));

  // strip lights: four banks of three
  const strips: THREE.MeshStandardMaterial[][] = [];
  for (const z of BANK_Z) {
    const bank: THREE.MeshStandardMaterial[] = [];
    for (const x of [-12, 0, 12]) {
      const m = new THREE.MeshStandardMaterial({ color: 0x0a0f14, emissive: COLORS.panelWhite, emissiveIntensity: 0 });
      root.add(box(3, 0.12, 0.5, m, x, HANGAR.height - 0.3, z));
      bank.push(m);
    }
    strips.push(bank);
  }

  // clean-room cube
  const cubeMat: THREE.Material = quality === 'high'
    ? new THREE.MeshPhysicalMaterial({ color: 0xcfe6ee, transmission: 0.92, roughness: 0.35, thickness: 0.6, ior: 1.45, metalness: 0 })
    : new THREE.MeshStandardMaterial({ color: 0xcfe6ee, transparent: true, opacity: 0.22, roughness: 0.4 });
  root.add(box(10, 4, 8, cubeMat, 0, 2, -5));
  const cubeInterior = new THREE.MeshStandardMaterial({ color: 0xe8f2f5, emissive: 0xffffff, emissiveIntensity: 0, side: THREE.BackSide });
  root.add(box(9.6, 3.7, 7.6, cubeInterior, 0, 2, -5));
  const benchMat = new THREE.MeshStandardMaterial({ color: 0xb9c7cf, roughness: 0.5 });
  root.add(box(3, 0.9, 1, benchMat, -2.5, 0.45, -5));
  root.add(box(3, 0.9, 1, benchMat, 2.5, 0.45, -6.5));
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x9aa7ae, metalness: 0.8, roughness: 0.3 });
  const cubeEdges: [number, number][] = [[-5, -1], [5, -1], [-5, -9], [5, -9]];
  for (const [x, z] of cubeEdges) root.add(box(0.15, 4, 0.15, edgeMat, x, 2, z));
  const cubeLight = new THREE.PointLight(0xffffff, 0, 30, 1.5);
  cubeLight.position.set(0, 3.5, -5);
  root.add(cubeLight);

  // columns with hazard bands
  const colMat = new THREE.MeshStandardMaterial({ color: 0x1f2a34, roughness: 0.9 });
  const hazMat = new THREE.MeshStandardMaterial({ map: makeHazardTexture(), roughness: 0.7 });
  const columns: [number, number][] = [[-14, 8], [14, 8], [-14, -22], [14, -22]];
  for (const [x, z] of columns) {
    root.add(box(0.8, HANGAR.height, 0.8, colMat, x, HANGAR.height / 2, z));
    root.add(box(0.86, 1.2, 0.86, hazMat, x, 1.6, z));
  }

  // crates
  const crateMat = new THREE.MeshStandardMaterial({ color: COLORS.crate, roughness: 0.8 });
  const steelMat = new THREE.MeshStandardMaterial({ color: COLORS.steel, roughness: 0.7, metalness: 0.3 });
  const crates: [number, number, number, number, number, THREE.Material][] = [
    [1.2, 1.0, 1.2, -9, 4, crateMat],
    [1.4, 0.9, 1.4, -10.5, 0.5, steelMat],
    [1.0, 1.0, 1.0, 11, -3, crateMat],
    [1.6, 1.1, 1.2, 12.5, -6.5, steelMat],
    [1.2, 0.8, 1.2, 10, -10, steelMat],
    [0.9, 0.9, 0.9, -12, -13.5, steelMat],
  ];
  for (const [w, h, d, x, z, m] of crates) root.add(box(w, h, d, m, x, h / 2, z));

  // gates on the far wall
  const gates: Gate[] = [];
  const innerMat = new THREE.MeshStandardMaterial({ color: 0x05090c, roughness: 1 });
  for (const w of WINGS) {
    const color = new THREE.Color(w.light);
    const frame = new THREE.MeshStandardMaterial({ color: 0x0b1117, emissive: color, emissiveIntensity: 0 });
    root.add(box(5.4, 6.4, 0.15, frame, w.gateX, 3.2, HANGAR.zBack + 0.1));
    root.add(box(5, 6, 0.3, innerMat, w.gateX, 3, HANGAR.zBack + 0.35));
    const boardTex = makeBoardTexture(w.name, w.light);
    const board = new THREE.MeshStandardMaterial({ map: boardTex, emissive: color, emissiveMap: boardTex, emissiveIntensity: 0 });
    root.add(box(4, 1, 0.1, board, w.gateX, 7.1, HANGAR.zBack + 0.3));
    const light = new THREE.PointLight(color, 0, 18, 1.8);
    light.position.set(w.gateX, 3, HANGAR.zBack + 3);
    root.add(light);
    gates.push({ id: w.id, frame, board, light });
  }

  // booth: glass, mullions, console top
  const glassMat: THREE.Material = quality === 'high'
    ? new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.97, roughness: 0.05, thickness: 0.05, ior: 1.5 })
    : new THREE.MeshStandardMaterial({ color: 0xcfe6ee, transparent: true, opacity: 0.08 });
  root.add(box(7, 3.2, 0.04, glassMat, 0, 2.1, BOOTH.glassZ));
  const mullionMat = new THREE.MeshStandardMaterial({ color: 0x1b242c, roughness: 0.5, metalness: 0.7 });
  for (const x of [-3.5, 0, 3.5]) root.add(box(0.12, 3.3, 0.12, mullionMat, x, 2.1, BOOTH.glassZ));
  for (const y of [0.5, 3.7]) root.add(box(7.1, 0.12, 0.12, mullionMat, 0, y, BOOTH.glassZ));
  root.add(box(7, 0.5, 1.6, new THREE.MeshStandardMaterial({ color: 0x3a4650, roughness: 0.6 }), 0, 0.55, BOOTH.consoleZ));

  return { root, strips, cubeInterior, cubeLight, gates };
}
