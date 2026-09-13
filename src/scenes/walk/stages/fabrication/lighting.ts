import * as THREE from 'three';
import type { StageContext } from '../types';
import { radialTexture } from '../../textures';
import { createLedTicker } from '../../ticker';
import { instances, repeat, place, type Spot } from '../../merge';
import { beacon } from '../../labs/props';
import { lightShaft } from '../../labs/fixtures';
import { dust } from '../../labs/particles';
import type { Placement } from '../../rig';
import { X0, X1, Z0, Z1, H, SODIUM } from './layout';

export interface Lighting { lights: Placement[]; update(dt: number): void; dispose(): void }

/** Where the fluorescent fittings hang, x and z. Three across the aisle, one row every twelve
 *  metres down the hall. The centre of each row is over the walked line. */
export const FIXTURE_ROWS = [16, 4, -8, -20];
export const FIXTURE_X = [-7, -3, 1];
export const FIXTURES: [number, number][] = FIXTURE_ROWS.flatMap((z) => FIXTURE_X.map((x) => [x, z] as [number, number]));
/** The fitting's underside, where its spot hangs from. */
export const FIXTURE_Y = H - 0.55;

/** The two fittings that carry the working spots: the middle fitting of the second row, over the
 *  approach to the office, and the middle of the fourth, over the run to the docks. */
export const WORKING: [number, number][] = [[-3, 4], [-3, -20]];
/** Sodium lamps over the two dock shutters, x and z, hung at LAMP_Y. */
export const SODIUM_LAMPS: [number, number][] = [[2, -27], [9, -27]];
export const LAMP_Y = 6.5;

/**
 * The bay's placements as data, so a test can hold every spot to a fitting the room draws: two
 * cold white working spots under two of the fluorescent fittings, a sodium spot under each dock
 * lamp, and the ticker's glow on the far wall. Four spots and one point, and the office adds the
 * second point.
 */
export function lights(): Placement[] {
  const out: Placement[] = [];
  for (const [x, z] of WORKING) out.push({ kind: 'spot', position: [x, FIXTURE_Y, z], target: [x, 0, z], color: 0xd9e8ee, intensity: 190, distance: 50, angle: Math.PI / 2.7, penumbra: 0.8, decay: 1.7 });
  // A tight cone from 6.5 m throws a pool the eye can find.
  for (const [x, z] of SODIUM_LAMPS) out.push({ kind: 'spot', position: [x, LAMP_Y, z], target: [x, 0, z], color: SODIUM, intensity: 180, distance: 18, angle: Math.PI / 6, penumbra: 0.5, decay: 1.8, shadow: true });
  out.push({ kind: 'point', position: [4, 8.2, Z0 + 1.4], color: 0xf2c230, intensity: 8, distance: 16, decay: 2 });
  return out;
}

/** Fixtures, the working spots, the sodium lamps and their pools, the LED board, the dust. */
export function buildLighting({ store, tier }: StageContext, root: THREE.Group): Lighting {
  // Fluorescent housings in three lines over the aisle, each with its own emissive tube. Every
  // spot the room declares hangs under one of these, so where the light comes from and what it
  // appears to come from agree.
  const stripMat = new THREE.MeshStandardMaterial({ color: 0x0a0f14, emissive: 0xd9e8ee, emissiveIntensity: 2.2 });
  const fixtures: Spot[] = [], strips: Spot[] = [];
  for (const [x, z] of FIXTURES) { fixtures.push([x, H - 0.4, z, 0, 2.6]); strips.push([x, H - 0.52, z]); }
  root.add(repeat(store.model('fluorescent'), fixtures));
  root.add(instances(new THREE.BoxGeometry(2.2, 0.06, 0.16), stripMat, strips));
  // The air under the two working fittings, faintly: the bay is dark and there is dust in it, and
  // a shaft is what ties a pool on the floor to the fitting above it.
  for (const [x, z] of WORKING) root.add(place(lightShaft({ top: 1.1, bottom: 4.2, height: FIXTURE_Y - 0.3, color: 0xd9e8ee, opacity: 0.035 }), x, FIXTURE_Y, z));

  // Sodium work lights, orange, the fabrication wing colour, one over each dock shutter. The pool
  // on the concrete is a soft sprite, additive, so it reads as light rather than as a stain.
  const hang = store.model('hanging_lamp');
  const cordMat = new THREE.MeshStandardMaterial({ color: 0x121a21, roughness: 0.9 });
  const lamps: Spot[] = [], cords: Spot[] = [], pools: Spot[] = [];
  for (const [x, z] of SODIUM_LAMPS) {
    pools.push([x, 0.02, z]); lamps.push([x, LAMP_Y, z]); cords.push([x, LAMP_Y + (H - LAMP_Y) / 2, z]);
    root.add(place(lightShaft({ top: 0.2, bottom: 2.4, height: LAMP_Y - 0.1, color: SODIUM, opacity: 0.09 }), x, LAMP_Y - 0.05, z));
  }
  root.add(repeat(hang, lamps));
  root.add(instances(new THREE.CylinderGeometry(0.02, 0.02, H - LAMP_Y), cordMat, cords));
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

  // Red beacons on the trunk ducts in the roof void. Emissive only, they bloom on the high tier.
  for (const z of [14, 2, -10, -22]) root.add(place(beacon(), -9, H - 0.75, z), place(beacon(), 6, H - 0.75, z));

  // Drifting dust, so the light has something to sit in. The kit's motes fade out as they grow
  // past a couple of hundred pixels, so one drifting up to the lens is never drawn as a disc over
  // the frame, which was the single hot point Jordan saw in the middle of the hall.
  const motes = dust([X0 + 1, 0.3, Z0 + 1], [X1 - 1, H - 0.5, Z1 - 1], tier === 'high' ? 500 : 180, { size: 0.06, opacity: 0.3, amp: 0.3 });
  root.add(motes.points);

  return {
    lights: lights(),
    update(dt) { led.update(dt); motes.update(dt); },
    dispose() { led.dispose(); motes.dispose(); },
  };
}
