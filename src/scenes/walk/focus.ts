import { Quaternion, Vector3 } from 'three';

/**
 * What the camera does on top of the walk: a few degrees of head drift toward the pointer while it
 * is parked, and the lean toward an exhibit while its project is open. Both are laid over the pose
 * the path gives, after it, and both are zero whenever the walk is moving, so the scroll never sees
 * a turn it did not make. Pure arithmetic on a position and a look point, so it can be read in a
 * unit test.
 */

/** The most the head turns after the pointer, each way. */
export const DRIFT_MAX = (2 * Math.PI) / 180;
/** How much of the drift is left while a project is open: the frame is being read, not explored. */
export const DRIFT_OPEN = 0.4;
/** Seconds to lean in, and to come back. */
export const LEAN_IN = 0.6, LEAN_OUT = 0.45;
/** The furthest the camera steps toward an exhibit, in metres, and the share of the way it goes. */
export const DOLLY_MAX = 0.6, DOLLY_SHARE = 0.12;
/** How far the lens closes on an exhibit. */
export const FOV_CLOSE = 0.04;

const UP = new Vector3(0, 1, 0);
const smooth = (x: number) => x * x * (3 - 2 * x);
const damp = (a: number, b: number, lambda: number, dt: number) => a + (b - a) * (1 - Math.exp(-lambda * dt));
const clamp = (v: number) => Math.min(1, Math.max(-1, v));

/** The furthest exhibit the camera leans to, in metres, and the most it turns to one, in radians. */
export const LEAN_REACH = 10.5, LEAN_TURN = 0.85;

/**
 * What the lean is aimed at. The exhibit, when it is close and in front: the lean is a few degrees
 * onto a thing already in the frame, never a swing across a room. Otherwise a point straight down
 * the way the camera already looks, so the room is dropped and the camera is left where it is.
 *
 * It used to fall back to the stop's own subject, which is the same thing only on the stop's hold.
 * Picked from the far end of a room it was behind the camera, and the lean turned to face it.
 */
export function leanTarget(exhibit: Vector3 | null, pose: { position: Vector3; target: Vector3 }, reach = LEAN_REACH, turn = LEAN_TURN): { at: Vector3; exhibit: boolean } {
  const look = new Vector3().subVectors(pose.target, pose.position);
  if (exhibit) {
    const to = new Vector3().subVectors(exhibit, pose.position);
    if (to.length() <= reach && to.angleTo(look) <= turn) return { at: exhibit.clone(), exhibit: true };
  }
  return { at: look.normalize().multiplyScalar(4).add(pose.position), exhibit: false };
}

export class Focus {
  /** 0 with nothing open, 1 leaned all the way in. Linear in time; `dim` is the eased reading. */
  level = 0;
  /** Where the lean is aimed. It keeps its last value on the way back out. */
  readonly aim = new Vector3();
  /** The drift as it stands, in radians. */
  readonly drift = { yaw: 0, pitch: 0 };
  /** How far to the right of the exhibit the camera looks, in radians, so the exhibit sits in the
   *  part of the frame the panel leaves clear. */
  offset = 0;

  private readonly goal = new Vector3();
  private on = false;
  private px = 0; private py = 0;
  private readonly dir = new Vector3(); private readonly to = new Vector3(); private readonly right = new Vector3();
  private readonly q = new Quaternion(); private readonly qi = new Quaternion();

  /** Leans toward a point, or lets go with null. A new point while leaned in is turned to, not
   *  leaned out of and back in. */
  setTarget(v: Vector3 | null): void {
    this.on = !!v;
    if (!v) return;
    this.goal.copy(v);
    if (this.level === 0) this.aim.copy(v);
  }

  /** The pointer in the -1..1 square the camera projects into, +x right and +y up. */
  setPointer(nx: number, ny: number): void { this.px = clamp(nx); this.py = clamp(ny); }

  /** `parked` is how held the walk is, 0 in transit and 1 on a hold. */
  update(dt: number, parked: number): void {
    this.level = this.on ? Math.min(1, this.level + dt / LEAN_IN) : Math.max(0, this.level - dt / LEAN_OUT);
    if (this.on) this.aim.set(damp(this.aim.x, this.goal.x, 7, dt), damp(this.aim.y, this.goal.y, 7, dt), damp(this.aim.z, this.goal.z, 7, dt));
    const w = parked * (1 - (1 - DRIFT_OPEN) * smooth(this.level));
    this.drift.yaw = damp(this.drift.yaw, this.px * DRIFT_MAX * w, 8, dt);
    this.drift.pitch = damp(this.drift.pitch, this.py * DRIFT_MAX * 0.6 * w, 8, dt);
  }

  /** The eased lean, 0..1: how far the room is dropped and the lens closed. */
  get dim(): number { return smooth(this.level); }
  /** What the lens's field of view is multiplied by. */
  get fov(): number { return 1 - FOV_CLOSE * this.dim; }

  /** Lays the lean and the drift over a pose, in place. */
  apply(cam: { position: Vector3; target: Vector3 }): void {
    const e = this.dim;
    if (e === 0 && this.drift.yaw === 0 && this.drift.pitch === 0) return;
    const dir = this.dir.subVectors(cam.target, cam.position);
    const reach = dir.length();
    dir.divideScalar(reach);
    if (e > 0) {
      // A step toward it along the floor, then the look turned onto it.
      const to = this.to.subVectors(this.aim, cam.position); to.y = 0;
      const d = to.length();
      if (d > 1e-6) cam.position.addScaledVector(to.divideScalar(d), Math.min(DOLLY_MAX, d * DOLLY_SHARE) * e);
      to.subVectors(this.aim, cam.position).normalize().applyAxisAngle(UP, -this.offset);
      dir.applyQuaternion(this.qi.identity().slerp(this.q.setFromUnitVectors(dir, to), e));
    }
    // Right of centre turns the head right, which about +y is a negative angle.
    dir.applyAxisAngle(UP, -this.drift.yaw);
    this.right.crossVectors(dir, UP).normalize();
    dir.applyAxisAngle(this.right, this.drift.pitch);
    cam.target.copy(cam.position).addScaledVector(dir, reach);
  }
}
