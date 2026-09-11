import { CatmullRomCurve3, Matrix4, Quaternion, Vector3 } from 'three';
import type { Wing } from '../../content/schema';

export type StopId = 'booth' | 'fabrication' | 'recreation' | 'operations' | 'credentials' | 'containment' | 'file';
export interface Stop { id: StopId; t: number; hold: [number, number]; lookAt: [number, number, number]; wing?: Wing; light: string }

export const EYE = 1.7;

/** World layout. x right, y up, z toward the booth. Booth at +z, hangar runs toward -z, then the corridor runs toward -x. */
export const CONTROL_POINTS: [number, number, number][] = [
  [0, EYE, 26], [0, EYE, 22.5], [0, EYE, 12], [-1, EYE, 0], [-3, EYE, -14], [-8, EYE, -26],
  [-16, EYE, -31], [-30, EYE, -31], [-44, EYE, -31], [-58, EYE, -31], [-70, EYE, -31],
  [-79, EYE, -26], [-79, EYE, -12], [-79, EYE, 4], [-79, EYE, 18], [-75, EYE, 27], [-70, EYE, 30],
];

export const STOPS: Stop[] = [
  // The booth looks down the hall through the door it is about to walk through. Its target sits
  // well past the door on the same sightline, so the camera is never turning toward a point it is
  // standing on while it pulls away from the hold.
  { id: 'booth', t: 0.0, hold: [0.0, 0.09], lookAt: [0, 3.2, 8], light: '#6EC1D6' },
  // The fabrication hold is inside the dispatch office. The camera turns west to the three exhibits
  // along its glass.
  { id: 'fabrication', t: 0.2, hold: [0.17, 0.25], lookAt: [-7, 1.5, -11], wing: 'fabrication', light: '#E0813A' },
  { id: 'recreation', t: 0.4, hold: [0.37, 0.44], lookAt: [-34, 2, -33.5], wing: 'recreation', light: '#3D7BE0' },
  { id: 'operations', t: 0.56, hold: [0.53, 0.6], lookAt: [-72, 1.6, -33], wing: 'operations', light: '#CFE6EE' },
  { id: 'credentials', t: 0.7, hold: [0.67, 0.74], lookAt: [-82.4, 2.2, -18], light: '#D9E8EE' },
  { id: 'containment', t: 0.84, hold: [0.81, 0.88], lookAt: [-79, 1.2, 22], wing: 'containment', light: '#D7383A' },
  { id: 'file', t: 1.0, hold: [0.96, 1.0], lookAt: [-68, 1.1, 31], light: '#D9E8EE' },
];

// The shutter starts rolling on the first pixel of scroll and finishes at 0.075, while the camera
// is still parked in the booth hold, which runs to 0.09. The first gesture has to move something
// or the page reads as stuck, and the reveal is still watched from a standstill.
export const DOOR_RANGE: [number, number] = [0, 0.075];
export const SCROLL_LENGTH_VH = 160 * STOPS.length;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (v: number) => { const x = clamp01(v); return x * x * (3 - 2 * x); };

const curve = new CatmullRomCurve3(CONTROL_POINTS.map((p) => new Vector3(...p)), false, 'centripetal', 0.5);
curve.arcLengthDivisions = 600;

export function stopAt(t: number): Stop {
  const u = clamp01(t);
  const held = STOPS.find((s) => u >= s.hold[0] && u <= s.hold[1]);
  if (held) return held;
  return STOPS.reduce((best, s) => (Math.abs(s.t - u) < Math.abs(best.t - u) ? s : best));
}

export function tForStop(id: StopId): number {
  const s = STOPS.find((x) => x.id === id);
  if (!s) throw new Error(`unknown stop ${id}`);
  return s.t;
}

/** 1 through the middle of a hold, ramping over the outer 20% of the hold on each side, 0 outside. */
export function holdWeight(t: number): number {
  const s = stopAt(t);
  const [a, b] = s.hold;
  if (t < a || t > b) return 0;
  const edge = (b - a) * 0.2;
  if (edge === 0) return 1;
  return clamp01(Math.min(t - a, b - t) / edge);
}

export function doorOpenAmount(t: number): number {
  return smoothstep((t - DOOR_RANGE[0]) / (DOOR_RANGE[1] - DOOR_RANGE[0]));
}

/** Scroll progress to spline parameter. Flat through each hold, eased between holds so the camera
 *  slows into a stop and pulls away from it rather than hitting the hold edge at full speed. */
export function travelParam(t: number): number {
  const u = clamp01(t);
  for (let i = 0; i < STOPS.length; i++) {
    const s = STOPS[i];
    if (u >= s.hold[0] && u <= s.hold[1]) return s.t;
    const next = STOPS[i + 1];
    if (next && u > s.hold[1] && u < next.hold[0]) {
      const k = smoothstep((u - s.hold[1]) / (next.hold[0] - s.hold[1]));
      return s.t + (next.t - s.t) * k;
    }
  }
  return u;
}

/** How far before a hold the camera starts turning toward the stop, and how far inside it the turn
 *  completes. Together about 300 px of scroll: three wheel notches, not one. The same window mirrored
 *  turns the camera back to its heading on the way out. */
export const TURN_LEAD = 0.035, TURN_SETTLE = 0.015;

/** 0 while travelling, 1 while looking at a stop, eased through the turn windows either side of its
 *  hold. Distinct from `holdWeight`, which is the "camera has arrived" signal the overlays use. */
export function lookWeight(t: number): { stop: Stop; weight: number } {
  const u = clamp01(t);
  for (const s of STOPS) {
    const [a, b] = s.hold;
    if (u >= a && u <= b) {
      const into = a <= 0 ? 1 : smoothstep((u - (a - TURN_LEAD)) / (TURN_LEAD + TURN_SETTLE));
      const outOf = b >= 1 ? 1 : 1 - smoothstep((u - (b - TURN_SETTLE)) / (TURN_LEAD + TURN_SETTLE));
      return { stop: s, weight: Math.min(into, outOf) };
    }
    if (u < a && u >= a - TURN_LEAD) return { stop: s, weight: smoothstep((u - (a - TURN_LEAD)) / (TURN_LEAD + TURN_SETTLE)) };
    if (u > b && u <= b + TURN_LEAD) return { stop: s, weight: 1 - smoothstep((u - (b - TURN_SETTLE)) / (TURN_LEAD + TURN_SETTLE)) };
  }
  return { stop: stopAt(u), weight: 0 };
}

export function localProgress(t: number, id: StopId): number {
  const i = STOPS.findIndex((s) => s.id === id);
  const prev = STOPS[i - 1]?.t ?? 0;
  const next = STOPS[i + 1]?.t ?? 1;
  return clamp01((t - prev) / (next - prev));
}

const _ahead = new Vector3();
const _look = new Vector3();
const _tangent = new Vector3();
const _m = new Matrix4();
const _qAhead = new Quaternion();
const _qLook = new Quaternion();
const UP = new Vector3(0, 1, 0);
const FORWARD = new Vector3(0, 0, -1);

/**
 * Position on the spline plus the point to look at. The look direction is blended as a rotation
 * between the travel heading and the stop's line of sight. Blending the two aim points in a straight
 * line used to send the aim point past the camera's own position at the fabrication hold, where the
 * stop is behind the direction of travel, and the view whipped through 160 degrees in 70 px.
 */
export function cameraAt(t: number, out = { position: new Vector3(), target: new Vector3() }) {
  const u = clamp01(t);
  const p = travelParam(u);
  curve.getPointAt(p, out.position);
  const aheadP = p + 0.02;
  if (aheadP <= 1) curve.getPointAt(aheadP, _ahead);
  else { curve.getPointAt(1, _ahead); curve.getTangentAt(1, _tangent); _ahead.addScaledVector(_tangent, (aheadP - 1) * curve.getLength()); }
  const { stop, weight } = lookWeight(u);
  _look.set(stop.lookAt[0], stop.lookAt[1], stop.lookAt[2]);
  _qAhead.setFromRotationMatrix(_m.lookAt(out.position, _ahead, UP));
  _qLook.setFromRotationMatrix(_m.lookAt(out.position, _look, UP));
  _qAhead.slerp(_qLook, weight);
  out.target.copy(FORWARD).applyQuaternion(_qAhead).add(out.position);
  return out;
}
