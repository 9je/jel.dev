import { CAMERA, HANGAR } from './constants';

export const MAX_YAW = (2 * Math.PI) / 180;
export const MAX_PITCH = (2 * Math.PI) / 180;
const WALK_FRACTION = 0.3;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** nx, ny in -1..1 (pointer position normalised across the viewport). */
export function parallaxTarget(nx: number, ny: number): { yaw: number; pitch: number } {
  return { yaw: -nx * MAX_YAW, pitch: -ny * MAX_PITCH };
}

/** Frame-rate independent exponential approach. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export function scrollCameraZ(progress: number): number {
  return CAMERA.zStart - HANGAR.length * WALK_FRACTION * clamp01(progress);
}
