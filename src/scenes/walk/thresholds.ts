import * as THREE from 'three';
import { CROSSINGS, STOPS, cameraAt } from './path';

/**
 * The light of the next room, spilling through each doorway the walk passes: a pool on the floor
 * of the approach, brightest at the threshold and falling away toward the camera, and a faint
 * curtain of lit air standing in the opening. Both in the colour of the room beyond, additive, so
 * the doorway reads as a way into somewhere lit before the camera is through it. Placed off the
 * walk's own crossings, so each lands on the line the camera actually takes. Two draw calls a door.
 */
function spillTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  // v runs from the threshold (top of the canvas) back toward the approach.
  const along = ctx.createLinearGradient(0, 0, 0, 256);
  along.addColorStop(0, 'rgba(255,255,255,1)'); along.addColorStop(0.35, 'rgba(255,255,255,0.45)'); along.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = along; ctx.fillRect(0, 0, 128, 256);
  // Soft at the sides, the width of the opening.
  ctx.globalCompositeOperation = 'destination-in';
  const across = ctx.createLinearGradient(0, 0, 128, 0);
  across.addColorStop(0, 'rgba(0,0,0,0)'); across.addColorStop(0.25, 'rgba(0,0,0,1)'); across.addColorStop(0.75, 'rgba(0,0,0,1)'); across.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = across; ctx.fillRect(0, 0, 128, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData.owned = true; return t;
}

function curtainTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const up = ctx.createLinearGradient(0, 128, 0, 0);
  up.addColorStop(0, 'rgba(255,255,255,0.9)'); up.addColorStop(0.5, 'rgba(255,255,255,0.35)'); up.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = up; ctx.fillRect(0, 0, 128, 128);
  ctx.globalCompositeOperation = 'destination-in';
  const across = ctx.createLinearGradient(0, 0, 128, 0);
  across.addColorStop(0, 'rgba(0,0,0,0)'); across.addColorStop(0.2, 'rgba(0,0,0,1)'); across.addColorStop(0.8, 'rgba(0,0,0,1)'); across.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = across; ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData.owned = true; return t;
}

export function buildThresholds(): THREE.Group {
  const g = new THREE.Group(); g.name = 'thresholds';
  const spill = spillTexture(), curtain = curtainTexture();
  const at = new THREE.Vector3(), before = new THREE.Vector3(), after = new THREE.Vector3();
  for (const c of CROSSINGS) {
    const room = STOPS.find((s) => s.id === c.room)!;
    const color = new THREE.Color(room.light);
    at.copy(cameraAt(c.u).position); before.copy(cameraAt(c.u - 0.01).position); after.copy(cameraAt(c.u + 0.01).position);
    const heading = Math.atan2(after.x - before.x, after.z - before.z);
    const door = new THREE.Group(); door.position.set(at.x, 0, at.z); door.rotation.y = heading;
    // Local +z is the way the walk goes. The pool lies on the approach, -z of the plane.
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 4.2), new THREE.MeshBasicMaterial({ map: spill, color, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    pool.rotation.x = -Math.PI / 2; pool.rotation.z = Math.PI; pool.position.set(0, 0.03, -2.1);
    door.add(pool);
    const air = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.9), new THREE.MeshBasicMaterial({ map: curtain, color, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    air.position.set(0, 1.45, 0.3);
    door.add(air);
    door.name = `threshold-${c.room}`;
    g.add(door);
  }
  return g;
}
