import { CatmullRomCurve3, Matrix4, Quaternion, Vector3 } from 'three';
import type { Wing } from '../../content/schema';

export type StopId = 'booth' | 'fabrication' | 'recreation' | 'operations' | 'credentials' | 'containment' | 'file';
/** `enter` is the t at which the camera crosses into the stop's room (the doorway, or the hold's
 *  start where the camera holds on the threshold looking in). The light rig switches rooms on it.
 *  Switching on the nearest stop, halfway between holds, dropped a room's lights while the camera
 *  was still ten metres inside it. */
/** `pan` is for a narrow frame. A portrait phone sees about 40 degrees across where a desktop sees
 *  85, so a stop whose subject is a row (three exhibits, three cabinets, two walls of plates) shows
 *  one piece of it. On a narrow frame the hold sweeps its aim from the first point to the second
 *  as the reader scrolls through it, and the turn in and out lands on those ends. */
export interface Stop { id: StopId; t: number; enter: number; hold: [number, number]; lookAt: [number, number, number]; pan?: [[number, number, number], [number, number, number]]; wideAim?: [number, number, number]; wing?: Wing; light: string }

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
  // On a very wide frame the lens closes vertically (framing.ts) and the neon over the shutter
  // left the top of the frame, so the aim lifts to keep the sign in.
  { id: 'booth', t: 0.0, enter: 0.0, hold: [0.0, 0.09], lookAt: [0, 3.2, 8], wideAim: [0, 6.2, 8], light: '#6EC1D6' },
  // The fabrication hold is inside the dispatch office. The camera turns west to the three exhibits
  // along its glass.
  // On a phone the hold pans the row from conch to earworm, plinth tops at 1.2 m.
  { id: 'fabrication', t: 0.2, enter: 0.105, hold: [0.17, 0.25], lookAt: [-7, 1.5, -11], pan: [[-6.5, 1.25, -8.3], [-6.5, 1.25, -12.9]], wing: 'fabrication', light: '#E0813A' },
  // The break room hold turns south to the arcade row rather than west down the corridor. The
  // camera parks at (-28.09, -31.05) for the whole hold and the row is built about that x, so this
  // aim is square to the four cabinets: "pan the camera to it dont tilt the cabs".
  { id: 'recreation', t: 0.4, enter: 0.332, hold: [0.37, 0.44], lookAt: [-28.1, 1.45, -34.6], pan: [[-29.1, 1.5, -34.6], [-27.1, 1.5, -34.6]], wing: 'recreation', light: '#3D7BE0' },
  { id: 'operations', t: 0.56, enter: 0.52, hold: [0.53, 0.6], lookAt: [-72, 1.6, -33], wing: 'operations', light: '#CFE6EE' },
  // The credentials hold stands inside the glass lab and looks north up it, so the three plates on
  // each side of the aisle are both in frame. Looking west put one wall in shot and the other three
  // plates behind the camera, which is what Jordan saw. The aim sits a little east of the hold's
  // own x: the spline parks at -79.83 and the lab runs on -79, so a straight north aim leans the
  // frame toward the west row and crowds the east one against the edge.
  // On a phone it pans from the west wall's plates, up the aisle, to the east wall's.
  { id: 'credentials', t: 0.7, enter: 0.643, hold: [0.67, 0.74], lookAt: [-79.2, 1.75, -12], pan: [[-82.2, 1.8, -14.8], [-75.8, 1.8, -14.8]], light: '#D9E8EE' },
  // The containment hold stands short of the room, in the credentials hall, and looks north
  // through the CONTAINMENT doorway. The aim is the table halfway up the aisle rather than the
  // far wall: the lamp over the redacted page is what the room is about, and aiming past it put
  // the one warm thing in a cold room down at the bottom edge of the frame.
  { id: 'containment', t: 0.84, enter: 0.81, hold: [0.81, 0.88], lookAt: [-80.6, 1.3, 12], wing: 'containment', light: '#D7383A' },
  { id: 'file', t: 1.0, enter: 0.936, hold: [0.96, 1.0], lookAt: [-68, 1.1, 31], light: '#D9E8EE' },
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

/**
 * The doorways the walk passes through between holds, as the plane each one stands in: the room
 * beyond it, the axis the plane is square to, and where on that axis it stands. The shutter is not
 * here: the booth's hold lifts it, and the camera never walks through it at speed.
 */
export const DOORS: { room: StopId; axis: 'x' | 'z'; at: number; span: [number, number] }[] = [
  { room: 'recreation', axis: 'x', at: -20, span: [-34, -28] },
  { room: 'operations', axis: 'x', at: -58, span: [-34, -28] },
  { room: 'credentials', axis: 'x', at: -75, span: [-30, -27] },
  { room: 'containment', axis: 'z', at: 6, span: [-81, -77] },
  { room: 'file', axis: 'z', at: 26, span: [-77.5, -73.5] },
];

/** Where the walk crosses a doorway: the transit it happens in (the index of the stop it leaves),
 *  how far through that transit's scroll it happens (0 to 1), and the scroll itself. */
export interface Crossing { room: StopId; transit: number; x: number; u: number }

/** The inverse of smoothstep on 0..1, by bisection: pure and only ever run at module load. */
function unsmooth(y: number): number {
  let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (smoothstep(mid) < y) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

/** How hard the walk slows through a doorway (the speed there is 1 - THRESHOLD_SLOW of what it would
 *  be) and over how much of the transit, as the Gaussian's width. The speed is made up either side,
 *  so every crossing still happens at the scroll it always did and the rig's `enter` still holds. */
export const THRESHOLD_SLOW = 0.55, THRESHOLD_WIDTH = 0.09;
// Tapered to nothing at both ends of the transit, so the walk still leaves one hold and reaches the
// next exactly where it did.
const threshold = (x: number, at: number) => (x - at) * THRESHOLD_SLOW * Math.exp(-(((x - at) / THRESHOLD_WIDTH) ** 2)) * 16 * x * x * (1 - x) * (1 - x);

/** Scroll progress to spline parameter. Flat through each hold, eased between holds so the camera
 *  slows into a stop and pulls away from it rather than hitting the hold edge at full speed, and
 *  slowed again through every doorway, a beat on the threshold before the room opens up. */
export function travelParam(t: number): number {
  const u = clamp01(t);
  for (let i = 0; i < STOPS.length; i++) {
    const s = STOPS[i];
    if (u >= s.hold[0] && u <= s.hold[1]) return s.t;
    const next = STOPS[i + 1];
    if (next && u > s.hold[1] && u < next.hold[0]) {
      let x = (u - s.hold[1]) / (next.hold[0] - s.hold[1]);
      for (const c of CROSSINGS) if (c.transit === i) x -= threshold(x, c.x);
      const k = smoothstep(x);
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
const _tangent = new Vector3();
const _m = new Matrix4();
const _qAhead = new Quaternion();
const UP = new Vector3(0, 1, 0);
const FORWARD = new Vector3(0, 0, -1);

/**
 * A stop's line of sight, measured from where the camera parks for that stop rather than from
 * wherever it currently stands, so it is a constant for the whole turn in and out of the hold.
 *
 * Measured live it is not. The walk leaves the credentials lab straight through its own aim point:
 * at t 0.771 the camera stands 0.21 m from it, and a point the camera passes through swings its
 * bearing 180 degrees inside one step. Even at the 2 percent look weight left in the release that
 * threw a 1.2 degree jolt into a frame turning at 0.5, which is the unnatural movement leaving the
 * credentials room. Every other stop parks its aim within a few metres of the path and had a
 * smaller version of the same kick on the way past. From the parked position the turn out of a
 * hold is a plain blend between two fixed headings.
 */
const _stopQuats = new Map<string, Quaternion>();
function aimQuat(stop: Stop, key: string, aim: [number, number, number]): Quaternion {
  let q = _stopQuats.get(key);
  if (!q) {
    const parked = curve.getPointAt(stop.t, new Vector3());
    q = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(parked, new Vector3(aim[0], aim[1], aim[2]), UP));
    _stopQuats.set(key, q);
  }
  return q;
}

let narrow = false, wide = false;
/** Set from the scene's resize: `narrow` while the frame is too narrow to hold a stop's whole row,
 *  `wide` while it is so wide the lens has closed vertically. */
export function setFrame(f: { narrow: boolean; wide: boolean }) { narrow = f.narrow; wide = f.wide; }

/** How far through its pan a stop is at scroll `u`: 0 up to the first fifth of the hold, 1 from the
 *  last fifth, eased between, so the turn in lands on one end and the turn out leaves from the other. */
export function panProgress(stop: Stop, u: number): number {
  const [a, b] = stop.hold;
  const edge = (b - a) * 0.2;
  return smoothstep((u - a - edge) / (b - a - 2 * edge));
}

const _qPan = new Quaternion();
function lookQuat(stop: Stop, u: number): Quaternion {
  if (wide && stop.wideAim) return aimQuat(stop, `${stop.id}:wide`, stop.wideAim);
  if (!narrow || !stop.pan) return aimQuat(stop, stop.id, stop.lookAt);
  return _qPan.slerpQuaternions(aimQuat(stop, `${stop.id}:0`, stop.pan[0]), aimQuat(stop, `${stop.id}:1`, stop.pan[1]), panProgress(stop, u));
}

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
  _qAhead.setFromRotationMatrix(_m.lookAt(out.position, _ahead, UP));
  _qAhead.slerp(lookQuat(stop, u), weight);
  out.target.copy(FORWARD).applyQuaternion(_qAhead).add(out.position);
  return out;
}

/** The room the camera is physically in: the last stop whose `enter` it has passed. */
export function roomAt(t: number): Stop {
  let room = STOPS[0];
  for (const s of STOPS) if (t >= s.enter) room = s;
  return room;
}

/** Every doorway crossing, found once by walking the unslowed mapping (the slowing leaves each
 *  crossing where it was, so the result is the same either way). */
export const CROSSINGS: Crossing[] = (() => {
  const out: Crossing[] = [];
  const v = new Vector3();
  for (let i = 0; i < STOPS.length - 1; i++) {
    const s = STOPS[i], next = STOPS[i + 1];
    for (const d of DOORS) {
      const side = (p: number) => { curve.getPointAt(p, v); return (d.axis === 'x' ? v.x : v.z) - d.at; };
      const a0 = side(s.t), b0 = side(next.t);
      if (Math.sign(a0) === Math.sign(b0)) continue;
      let lo = s.t, hi = next.t;
      for (let k = 0; k < 50; k++) { const mid = (lo + hi) / 2; if (Math.sign(side(mid)) === Math.sign(a0)) lo = mid; else hi = mid; }
      curve.getPointAt((lo + hi) / 2, v);
      const across = d.axis === 'x' ? v.z : v.x;
      if (across < d.span[0] || across > d.span[1]) continue;
      const x = unsmooth(((lo + hi) / 2 - s.t) / (next.t - s.t));
      out.push({ room: d.room, transit: i, x, u: s.hold[1] + x * (next.hold[0] - s.hold[1]) });
    }
  }
  return out;
})();

/** 1 in a doorway's vestibule, falling to 0 a little way either side: the exposure dips on the
 *  threshold and opens as the room does. Centred a touch before the plane, in the vestibule. */
export function thresholdDip(t: number): number {
  let d = 0;
  for (const c of CROSSINGS) d = Math.max(d, Math.exp(-(((t - c.u + 0.002) / 0.009) ** 2)));
  return d;
}
