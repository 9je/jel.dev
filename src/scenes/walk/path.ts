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
  [-79, EYE, -26], [-79, EYE, -12], [-79, EYE, 4], [-79, EYE, 18], [-76.4, EYE, 24.4], [-74.6, EYE, 28.2], [-70, EYE, 30],
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
  { id: 'credentials', t: 0.7, enter: 0.637, hold: [0.67, 0.74], lookAt: [-79.2, 1.75, -12], pan: [[-82.2, 1.8, -14.8], [-75.8, 1.8, -14.8]], light: '#D9E8EE' },
  // The containment hold stands short of the room, in the credentials hall, and looks north
  // through the CONTAINMENT doorway. The aim is the table halfway up the aisle rather than the
  // far wall: the lamp over the redacted page is what the room is about, and aiming past it put
  // the one warm thing in a cold room down at the bottom edge of the frame.
  { id: 'containment', t: 0.84, enter: 0.81, hold: [0.81, 0.88], lookAt: [-80.6, 1.3, 12], wing: 'containment', light: '#D7383A' },
  { id: 'file', t: 1.0, enter: 0.931, hold: [0.96, 1.0], lookAt: [-68, 1.1, 31], light: '#D9E8EE' },
];

// The shutter starts rolling on the first pixel of scroll and finishes at 0.075, while the camera
// is still parked in the booth hold, which runs to 0.09. The first gesture has to move something
// or the page reads as stuck, and the reveal is still watched from a standstill.
export const DOOR_RANGE: [number, number] = [0, 0.075];

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

/**
 * How the scroll between two holds becomes distance along the spline. It is a speed profile,
 * integrated: the walk eases off the hold over the first EASE of the transit, cruises at one speed
 * through the middle, and eases into the next hold over the last EASE. At every doorway it slows to
 * 1 - THRESHOLD_SLOW of that speed for a beat on the threshold, over a Gaussian THRESHOLD_WIDTH of
 * the transit wide.
 *
 * The time lost on a threshold is made up by the whole transit cruising a little faster, not by the
 * stretch either side of the door. It used to be paid back locally, which kept every crossing at the
 * scroll it had before the slowing and put a surge on both sides of each door: leaving the break room
 * for the lab the walk went from 6.9 to 3.4 to 5.6 metres per 100 px inside 150 px of scroll, and a
 * smoothstep with no cruise peaked at 1.5 times its own average in the middle of every corridor.
 * That was the "spots between rooms move a little quicker". Now the crossings move to wherever the
 * profile puts them, and CROSSINGS finds them on the mapping the walk actually uses.
 */
export const EASE = 0.28;
export const THRESHOLD_SLOW = 0.45, THRESHOLD_WIDTH = 0.08;
/** And it slows into a bend, the way someone carrying a camera does: the speed is divided by
 *  1 + CORNER times the bend in radians a metre, so the frame never swings faster than the walk can
 *  turn it. Entering the lab the spline turns a right angle through the doorway, and at cruise that
 *  was the fastest swing on the path. */
export const CORNER = 11, BEND_REACH = 3;
const TABLE = 512;
const LENGTH = curve.getLength();
const _t0 = new Vector3(), _t1 = new Vector3(), _t2 = new Vector3();
/** The heading the walk looks down at `p`: toward the point LOOK_AHEAD of the spline further on,
 *  across the floor. cameraAt aims the same way, so a corner turns the frame this far early. */
export const LOOK_AHEAD = 0.02;
function heading(p: number, out: Vector3): Vector3 {
  curve.getPointAt(p, _t2);
  const q = p + LOOK_AHEAD;
  if (q <= 1) curve.getPointAt(q, out); else { curve.getPointAt(1, out); out.addScaledVector(curve.getTangentAt(1, _t0), (q - 1) * LENGTH); }
  return out.sub(_t2).setY(0).normalize();
}
/** The heading the walk looks down at scroll `t`, before any stop or beat turns it. */
export function headingAt(t: number): Vector3 { return heading(travelParam(t), new Vector3()); }

/**
 * How fast the heading swings, in radians a metre, sampled every BEND_STEP metres of the path and
 * averaged over BEND_REACH either side, so the walk starts to slow before the corner. It is the
 * heading and not the spline's own tangent, because the look runs ahead of the path: slowing where
 * the spline bends slowed the walk six metres after the frame had already swung. One table for the
 * whole path, built once: sampled inside the fitting below it cost a second of load.
 */
const BEND_STEP = 0.25;
const BENDS: Float64Array = (() => {
  const n = Math.ceil(LENGTH / BEND_STEP) + 1;
  const raw = new Float64Array(n), out = new Float64Array(n);
  const a = new Vector3(), b = new Vector3();
  heading(0, a);
  for (let i = 1; i < n; i++) {
    heading(Math.min(1, (i * BEND_STEP) / LENGTH), b);
    raw[i] = a.angleTo(b) / BEND_STEP;
    a.copy(b);
  }
  raw[0] = raw[1];
  const reach = Math.round(BEND_REACH / BEND_STEP);
  let sum = 0;
  for (let i = -reach; i <= reach; i++) sum += raw[Math.min(n - 1, Math.max(0, i))];
  for (let i = 0; i < n; i++) {
    out[i] = sum / (2 * reach + 1);
    sum += raw[Math.min(n - 1, i + reach + 1)] - raw[Math.max(0, i - reach)];
  }
  return out;
})();
function bend(p: number): number {
  const f = (clamp01(p) * LENGTH) / BEND_STEP, i = Math.min(BENDS.length - 2, Math.floor(f));
  return BENDS[i] + (BENDS[i + 1] - BENDS[i]) * (f - i);
}

/** A transit's spline parameter at each end, the doors it passes through, and the running share of
 *  its distance at TABLE + 1 even steps of its scroll. */
interface Transit { p0: number; p1: number; cum: Float64Array; doors: { room: StopId; p: number }[] }

function speed(x: number, dips: number[], bends: Float64Array): number {
  let v = smoothstep(x / EASE) * smoothstep((1 - x) / EASE);
  for (const c of dips) v *= 1 - THRESHOLD_SLOW * Math.exp(-(((x - c) / THRESHOLD_WIDTH) ** 2));
  return v / (1 + CORNER * bends[Math.round(x * TABLE)]);
}

function integrate(cum: Float64Array, dips: number[], bends: Float64Array) {
  cum[0] = 0;
  let prev = speed(0, dips, bends);
  for (let i = 1; i <= TABLE; i++) { const v = speed(i / TABLE, dips, bends); cum[i] = cum[i - 1] + (prev + v) / 2; prev = v; }
  const total = cum[TABLE];
  for (let i = 0; i <= TABLE; i++) cum[i] /= total;
}

/** The share of a transit's distance covered at `x` of its scroll. */
function shareAt(tr: Transit, x: number): number {
  const f = clamp01(x) * TABLE, i = Math.min(TABLE - 1, Math.floor(f));
  return tr.cum[i] + (tr.cum[i + 1] - tr.cum[i]) * (f - i);
}

/** The scroll share at which a transit has covered `share` of its distance. */
function scrollAt(tr: Transit, share: number): number {
  let lo = 0, hi = TABLE;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (tr.cum[mid] < share) lo = mid; else hi = mid; }
  const span = tr.cum[hi] - tr.cum[lo];
  return (lo + (span > 0 ? (share - tr.cum[lo]) / span : 0)) / TABLE;
}

const TRANSITS: Transit[] = STOPS.slice(0, -1).map((s, i) => {
  const next = STOPS[i + 1];
  const v = new Vector3();
  const doors: { room: StopId; p: number }[] = [];
  for (const d of DOORS) {
    const side = (p: number) => { curve.getPointAt(p, v); return (d.axis === 'x' ? v.x : v.z) - d.at; };
    const a0 = side(s.t), b0 = side(next.t);
    if (Math.sign(a0) === Math.sign(b0)) continue;
    let lo = s.t, hi = next.t;
    for (let k = 0; k < 50; k++) { const mid = (lo + hi) / 2; if (Math.sign(side(mid)) === Math.sign(a0)) lo = mid; else hi = mid; }
    curve.getPointAt((lo + hi) / 2, v);
    const across = d.axis === 'x' ? v.z : v.x;
    if (across >= d.span[0] && across <= d.span[1]) doors.push({ room: d.room, p: (lo + hi) / 2 });
  }
  const tr: Transit = { p0: s.t, p1: next.t, cum: new Float64Array(TABLE + 1), doors };
  // Each dip is centred on the scroll at which the camera reaches its door, which depends on the
  // dips themselves: a few rounds settle it well inside a table step.
  // The bends are read at the spline parameter each step of scroll reaches, which moves as well.
  let dips: number[] = [];
  const bends = new Float64Array(TABLE + 1);
  for (let round = 0; round < 4; round++) {
    integrate(tr.cum, dips, bends);
    dips = doors.map((d) => scrollAt(tr, (d.p - s.t) / (next.t - s.t)));
    for (let i = 0; i <= TABLE; i++) bends[i] = bend(s.t + (next.t - s.t) * tr.cum[i]);
  }
  integrate(tr.cum, dips, bends);
  return tr;
});

/** Scroll progress to spline parameter. Flat through each hold, and between holds the speed profile
 *  above: eased off one hold, a steady cruise with a beat on each threshold, eased into the next. */
export function travelParam(t: number): number {
  const u = clamp01(t);
  for (let i = 0; i < STOPS.length; i++) {
    const s = STOPS[i];
    if (u >= s.hold[0] && u <= s.hold[1]) return s.t;
    const next = STOPS[i + 1];
    if (next && u > s.hold[1] && u < next.hold[0]) {
      return s.t + (next.t - s.t) * shareAt(TRANSITS[i], (u - s.hold[1]) / (next.hold[0] - s.hold[1]));
    }
  }
  return u;
}

/**
 * The turn into a stop runs over the approach and finishes on the scroll the camera parks, and the
 * turn out starts on the scroll it pulls away. So a head that is turning is a head that is moving,
 * and it settles as the walk slows into the hold. The turns used to run on into the hold, where the
 * camera stands still: leaving the break room it swung a quarter turn toward the corridor before it
 * took a step, and the office did the same, which read as a pan that started on its own once the
 * reader scrolled, at some rooms and not others.
 *
 * How much of the transit a turn takes grows with how far the stop's aim is off the direction of
 * travel, TURN_SPAN_PER_DEG of the transit a degree between TURN_SPAN_MIN and TURN_SPAN_MAX, so a
 * quarter turn is spread over the whole slow down and a glance over its last stretch.
 */
export const TURN_SPAN_PER_DEG = 0.0055, TURN_SPAN_MIN = 0.22, TURN_SPAN_MAX = 0.65;

/** How far each stop's aim is off the direction of travel where it parks, in degrees. */
const TURN_DEG: number[] = STOPS.map((s) => {
  const at = curve.getPointAt(s.t), heading = curve.getTangentAt(Math.min(s.t, 0.999)).setY(0).normalize();
  const aim = new Vector3(s.lookAt[0], at.y, s.lookAt[2]).sub(at).normalize();
  return (heading.angleTo(aim) * 180) / Math.PI;
});
/** Each stop's turn, as a share of the transit either side of its hold. */
const TURN_SPAN: number[] = TURN_DEG.map((deg) => Math.min(TURN_SPAN_MAX, Math.max(TURN_SPAN_MIN, deg * TURN_SPAN_PER_DEG)));

/** The transit scroll `u` is in, as the index of the stop it leaves, or -1 inside a hold. */
function transitAt(u: number): number {
  for (let i = 0; i < STOPS.length - 1; i++) if (u > STOPS[i].hold[1] && u < STOPS[i + 1].hold[0]) return i;
  return -1;
}

/** How far stop `i`'s turn has got at scroll `u`: 1 on its hold, easing to 0 its span into the
 *  transit either side. */
function turnWeight(i: number, u: number): number {
  const s = STOPS[i];
  if (u >= s.hold[0] && u <= s.hold[1]) return 1;
  const before = u < s.hold[0];
  const other = STOPS[before ? i - 1 : i + 1];
  if (!other) return 1;
  const x = before ? (s.hold[0] - u) / (s.hold[0] - other.hold[1]) : (u - s.hold[1]) / (other.hold[0] - s.hold[1]);
  return smoothstep(1 - x / TURN_SPAN[i]);
}

/** The stop the camera is turned toward at scroll `t`, and how far. Inside a hold that is its own
 *  stop, all the way; between holds it is whichever neighbour's turn has more weight. Distinct from
 *  `holdWeight`, which is the "camera has arrived" signal the overlays use. */
export function lookWeight(t: number): { stop: Stop; weight: number } {
  const u = clamp01(t);
  const k = transitAt(u);
  if (k < 0) return { stop: stopAt(u), weight: 1 };
  const wa = turnWeight(k, u), wb = turnWeight(k + 1, u);
  return wb > wa ? { stop: STOPS[k + 1], weight: wb } : { stop: STOPS[k], weight: wa };
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
 * What the walk looks at on the way between holds. Left to itself the camera stares down the path,
 * and a corridor with its one lit thing off to the side reads as a plain wall going by. Each beat
 * is a point worth a look and the scroll over which the walk gives it one: the camera turns to it,
 * follows it, and lets it go as it passes. The release is by angle, not scroll: the weight fades as
 * the point swings past 35 degrees off the heading and is gone by 75, so the head never wrenches
 * round after something beside it, and the turn back runs at the rate the thing itself goes by.
 */
export const BEATS: { at: [number, number, number]; from: number; to: number }[] = [
  // Leaving the office, the rust container against the west wall. The turn out of the office aim
  // already sweeps across it, so the eye rests on it for a few metres on the way back to the path.
  // It was the sodium pool under the first dock lamp, across the bay to the right, which asked the
  // head to swing from the exhibits on the left to the far right while the office still held it.
  { at: [-17.4, 1.3, -22], from: 0.268, to: 0.285 },
  // Leaving the arcade, the eye runs on down the row to the snack machine before the corridor.
  { at: [-33, 1.3, -34.3], from: 0.454, to: 0.46 },
  // The last cage of racks on the south side, before the turn into the lab.
  { at: [-70, 1.4, -37], from: 0.6, to: 0.6 },
  // The containment table had a beat of its own, its lamp, to keep the eye on it on the way out. The
  // hold already aims at that table and its turn out keeps it, and the beat's release by angle three
  // metres from the lamp was the fastest swing left on the path.
  // The desk lamp, from the moment the file door shows it: the eye is on the door's edge as the
  // desk comes round it. The hold's own turn in aims from where the camera parks, and blended from
  // the door that swept a blank wall for a second before the desk.
  { at: [-68, 1.0, 31], from: 0.932, to: 0.955 },
];
export const BEAT_RAMP = 0.025, BEAT_RELEASE = 0.96;
const _dir = new Vector3();
const _qBeat = new Quaternion();

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
  const aheadP = p + LOOK_AHEAD;
  if (aheadP <= 1) curve.getPointAt(aheadP, _ahead);
  else { curve.getPointAt(1, _ahead); curve.getTangentAt(1, _tangent); _ahead.addScaledVector(_tangent, (aheadP - 1) * curve.getLength()); }
  _qAhead.setFromRotationMatrix(_m.lookAt(out.position, _ahead, UP));
  // The stop behind and the stop ahead, each by its own turn. On a short transit both have weight at
  // once, and the second blend carries the first.
  const k = transitAt(u);
  if (k < 0) _qAhead.copy(lookQuat(stopAt(u), u));
  else {
    _qAhead.slerp(lookQuat(STOPS[k], u), turnWeight(k, u));
    _qAhead.slerp(lookQuat(STOPS[k + 1], u), turnWeight(k + 1, u));
  }
  // A beat is something passed on the walk, so it only has the look the stops are not using: none on
  // a hold, and as a stop's turn lets go the beat takes over at the same rate. Given its own ramp it
  // pulled the office's aim half way round to the bay while the stop still held it on the exhibits.
  const clear = k < 0 ? 0 : 1 - Math.max(turnWeight(k, u), turnWeight(k + 1, u));
  for (const b of BEATS) {
    if (clear <= 0 || u < b.from - BEAT_RAMP || u > b.to + BEAT_RAMP) continue;
    _dir.set(b.at[0], b.at[1], b.at[2]).sub(out.position);
    const off = _dir.angleTo(_tangent.subVectors(_ahead, out.position));
    const w = clear * Math.min(smoothstep((u - b.from) / BEAT_RAMP + 1), 1 - smoothstep((u - b.to) / BEAT_RAMP)) * (1 - smoothstep((off - 0.44) / BEAT_RELEASE));
    if (w > 0) _qAhead.slerp(_qBeat.setFromRotationMatrix(_m.lookAt(out.position, _dir.add(out.position), UP)), w);
  }
  out.target.copy(FORWARD).applyQuaternion(_qAhead).add(out.position);
  return out;
}

/** The room the camera is physically in: the last stop whose `enter` it has passed. */
export function roomAt(t: number): Stop {
  let room = STOPS[0];
  for (const s of STOPS) if (t >= s.enter) room = s;
  return room;
}

/** Every doorway crossing, read off the transits: the scroll at which the camera reaches each door. */
export const CROSSINGS: Crossing[] = TRANSITS.flatMap((tr, i) => tr.doors.map((d) => {
  const x = scrollAt(tr, (d.p - tr.p0) / (tr.p1 - tr.p0));
  return { room: d.room, transit: i, x, u: STOPS[i].hold[1] + x * (STOPS[i + 1].hold[0] - STOPS[i].hold[1]) };
}));

/** 1 in a doorway's vestibule, falling to 0 a little way either side: the exposure dips on the
 *  threshold and opens as the room does. Centred a touch before the plane, in the vestibule. */
export function thresholdDip(t: number): number {
  let d = 0;
  for (const c of CROSSINGS) d = Math.max(d, Math.exp(-(((t - c.u + 0.002) / 0.009) ** 2)));
  return d;
}

/**
 * The room the camera is physically standing in, by the doorways it has actually walked through.
 * Not the same as `roomAt`, which switches a room's lights and copy on where the hold that looks
 * into it starts: containment's hold stands in the credentials hall looking through the door, and
 * graded as containment that hall went black around the camera. The grade follows this.
 */
export function standingIn(t: number): StopId {
  let room: StopId | null = null;
  for (const c of CROSSINGS) if (t >= c.u) room = c.room;
  return room ?? roomAt(t).id;
}

/**
 * The page and the walk. Everything above is written in the walk's own scroll, where each stop's
 * hold sits at the numbers in STOPS. The page lays those out again: every hold keeps its length in
 * the page, and each transit gets page in proportion to the walk it covers, its metres with each
 * bend counted CORNER times over, as the speed profile slows for it, and TURN_M metres for every
 * degree the head turns into the next stop and out of the last. In the walk's own scroll every
 * transit had a fixed share whatever its length, so the booth to the office ran at 4.7 metres per
 * 100 px on average and the office to the break room at 3.1: some rooms apart moved half as fast
 * again as others.
 */
const DESIGN_VH = 1120;
/** Page per metre of transit, in vh: about 3.4 m per 100 px of scroll on a 900 px window. */
export const VH_PER_M = 2.6, TURN_M = 0.15;
const _pa = new Vector3(), _pb = new Vector3();
const effort = STOPS.slice(0, -1).map((s, i) => {
  const next = STOPS[i + 1];
  let e = 0;
  curve.getPointAt(s.t, _pa);
  for (let k = 1; k <= 400; k++) {
    const p = s.t + ((next.t - s.t) * k) / 400;
    curve.getPointAt(p, _pb);
    e += _pa.distanceTo(_pb) * (1 + CORNER * bend(p));
    _pa.copy(_pb);
  }
  return e + (TURN_DEG[i] + TURN_DEG[i + 1]) * TURN_M;
});
/** Page and walk scroll at every hold edge, in order, as [page vh, walk scroll] pairs. */
const KNOTS: [number, number][] = (() => {
  const out: [number, number][] = [];
  let vh = 0;
  STOPS.forEach((s, i) => {
    out.push([vh, s.hold[0]]);
    vh += (s.hold[1] - s.hold[0]) * DESIGN_VH;
    out.push([vh, s.hold[1]]);
    if (i < effort.length) vh += effort[i] * VH_PER_M;
  });
  return out;
})();
/** How long the page is, in viewport heights. */
export const SCROLL_LENGTH_VH = Math.round(KNOTS[KNOTS.length - 1][0]);

function between(v: number, from: 0 | 1): number {
  const to = from === 0 ? 1 : 0;
  const total = KNOTS[KNOTS.length - 1][from];
  const x = clamp01(v) * total;
  for (let i = 1; i < KNOTS.length; i++) {
    const a = KNOTS[i - 1], b = KNOTS[i];
    if (x <= b[from] || i === KNOTS.length - 1) {
      const span = b[from] - a[from];
      const k = span > 0 ? (x - a[from]) / span : 0;
      const y = a[to] + (b[to] - a[to]) * clamp01(k);
      return to === 0 ? y / KNOTS[KNOTS.length - 1][0] : y;
    }
  }
  return v;
}
/** The walk's scroll at a share of the page scrolled. */
export function walkAt(page: number): number { return between(page, 0); }
/** The share of the page at which the walk reaches scroll `t`. */
export function pageAt(t: number): number { return between(t, 1); }
