import * as THREE from 'three';
import type { StageContext } from '../types';
import { radialTexture } from '../../textures';
import { createLedTicker } from '../../ticker';
import { instances, repeat, type Spot } from '../../merge';
import { X0, Z0, H, W, D, XC, SODIUM } from './layout';

export interface Lighting { update(dt: number): void; dispose(): void }

/** Fixtures, the working spots, the sodium lamps and their pools, the LED board, the dust. */
export function buildLighting({ store, tier }: StageContext, root: THREE.Group): Lighting {
  // Fluorescent housings in two straight rows over the aisle, each with its own emissive tube.
  const stripMat = new THREE.MeshStandardMaterial({ color: 0x0a0f14, emissive: 0xd9e8ee, emissiveIntensity: 2.2 });
  const fixtures: Spot[] = [], strips: Spot[] = [];
  for (const z of [16, 4, -8, -20]) for (const x of [-7, 1]) { fixtures.push([x, H - 0.4, z, 0, 2.6]); strips.push([x, H - 0.52, z]); }
  root.add(repeat(store.model('fluorescent'), fixtures));
  root.add(instances(new THREE.BoxGeometry(2.2, 0.06, 0.16), stripMat, strips));
  // Three spots do the actual work. Every light costs every pixel in the room, and the walls here
  // are 34 m wide, so the fixture count and the light count are deliberately not the same number.
  for (const z of [12, -4, -20]) {
    const l = new THREE.SpotLight(0xd9e8ee, 170, 46, Math.PI / 3, 0.8, 1.7);
    l.position.set(XC, H - 0.6, z); l.target.position.set(XC, 0, z); root.add(l, l.target);
  }

  // Sodium work lights, orange, the fabrication wing colour. A tight cone from 6.5 m throws a pool
  // the eye can find. The pool on the concrete is a soft sprite, additive, so it reads as light
  // rather than as a stain on the floor.
  const hang = store.model('hanging_lamp');
  const cordMat = new THREE.MeshStandardMaterial({ color: 0x121a21, roughness: 0.9 });
  const sodium: [number, number, boolean][] = [[0, 6, true], [6, -16, true], [-13, -12, false]];
  const lamps: Spot[] = [], cords: Spot[] = [], pools: Spot[] = [];
  for (const [x, z, lamp] of sodium) {
    const y = 6.5;
    const s = new THREE.SpotLight(SODIUM, 180, 18, Math.PI / 6, 0.5, 1.8);
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
  const poolGeo = new THREE.PlaneGeometry(5.5, 5.5); poolGeo.rotateX(-Math.PI / 2);
  const poolMat = new THREE.MeshBasicMaterial({ map: radialTexture(256, 0.1), color: SODIUM, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });
  root.add(instances(poolGeo, poolMat, pools));

  // The LED board on the far wall: it faces the whole approach down the hall, and it is the wall
  // the camera is looking at through the fabrication hold before it turns.
  const spans = Array.from(document.querySelectorAll<HTMLElement>('[data-ticker] span'));
  const raw = spans[0]?.textContent ?? '';
  const lines = raw.split('•').map((s) => s.trim()).filter(Boolean);
  const led = createLedTicker(lines.length ? lines : ['jel labs'], { width: 2048, height: 128 });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(16, 1), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1.6, emissiveMap: led.texture, map: led.texture }));
  board.position.set(4, 8.6, Z0 + 0.12); root.add(board);
  const ledGlow = new THREE.PointLight(0xf2c230, 8, 16, 2); ledGlow.position.set(4, 8.2, Z0 + 1.4); root.add(ledGlow);

  // Drifting dust, so the light has something to sit in. Soft round motes, not squares.
  const dustGeo = new THREE.BufferGeometry(); const n = tier === 'high' ? 500 : 180; const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = X0 + Math.random() * W; pos[i * 3 + 1] = Math.random() * H; pos[i * 3 + 2] = Z0 + Math.random() * D; }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dustMat = new THREE.PointsMaterial({ map: radialTexture(64, 0.05), color: 0xffe9c4, size: 0.065, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  root.add(new THREE.Points(dustGeo, dustMat));

  return {
    update(dt) {
      led.update(dt);
      const p = dustGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < n; i++) { let y = p.getY(i) - dt * 0.08; if (y < 0) y = H; p.setY(i, y); }
      p.needsUpdate = true;
    },
    dispose() { led.dispose(); },
  };
}
