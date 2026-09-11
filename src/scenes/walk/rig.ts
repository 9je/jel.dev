import * as THREE from 'three';
import { STOPS, roomAt, type StopId } from './path';
import type { Tier } from './quality';

export interface SpotPlacement { kind: 'spot'; position: [number, number, number]; target: [number, number, number]; color: number; intensity: number; distance: number; angle: number; penumbra: number; decay?: number; shadow?: boolean }
export interface PointPlacement { kind: 'point'; position: [number, number, number]; color: number; intensity: number; distance: number; decay?: number }
export type Placement = SpotPlacement | PointPlacement;
export interface RigSize { spots: number; points: number }

/** What one room may declare. The rig holds the current room, the next and the previous, in that
 *  order of priority, so a room that spends its whole budget still leaves the next room half lit
 *  on desktop (ten lights, spec 8) and is alone on phones (six). */
export const ROOM_BUDGET: RigSize = { spots: 4, points: 2 };
export const RIG_DESKTOP: RigSize = { spots: 6, points: 4 };
export const RIG_PHONE: RigSize = { spots: 4, points: 2 };

export function rigSizeFor(_tier: Tier, coarse: boolean): RigSize { return coarse ? RIG_PHONE : RIG_DESKTOP; }

export function checkBudget(lights: Placement[]): void {
  const spots = lights.filter((l) => l.kind === 'spot').length, points = lights.filter((l) => l.kind === 'point').length;
  if (spots > ROOM_BUDGET.spots) throw new Error(`a room may declare ${ROOM_BUDGET.spots} spots, this one declares ${spots}`);
  if (points > ROOM_BUDGET.points) throw new Error(`a room may declare ${ROOM_BUDGET.points} points, this one declares ${points}`);
}

const isCaster = (p: Placement): boolean => p.kind === 'spot' && !!p.shadow;

/** Placements that matter at a stop: the current room's, then the room ahead, then the one behind.
 *  Shadow casters lead within a room, so the set opens with the current room's casters and
 *  `assignSlots` can read that leading run off the front without knowing about rooms. */
export function composeSet(rooms: Map<StopId, Placement[]>, stop: StopId): Placement[] {
  const i = STOPS.findIndex((s) => s.id === stop);
  const order = [STOPS[i]?.id, STOPS[i + 1]?.id, STOPS[i - 1]?.id].filter(Boolean) as StopId[];
  const out: Placement[] = [];
  for (const id of order) {
    const lights = rooms.get(id); if (!lights) continue;
    out.push(...lights.filter(isCaster), ...lights.filter((l) => !isCaster(l)));
  }
  return out;
}

/** Slot array, spots first then points. Priority is `wanted` order, which composeSet has already put
 *  in room order, and whatever fits the rig's per-type capacity in that order is selected.
 *  Shadow slots go to the leading run of casters in `wanted`, which is the current room's casters,
 *  and only when the rig casts shadows at all. Ranking every caster in the composed set ahead of
 *  everything else put a room the camera had already left in front of the room it is standing in,
 *  and it did so even with shadows off, where a caster is just another spot.
 *  Those casters pack into the lowest spot slots, in priority order, bypassing retention: a shadow
 *  map must never sit idle on a caster far from the camera while a nearer one waits in a plain slot,
 *  and the fade (a slot's level drops to 0 before it jumps) hides a caster hopping down when
 *  priority reorders it.
 *  A selected non-caster keeps the slot it already holds; free slots fill in priority order; the
 *  rest is dropped. Retention is scoped to the selected non-casters, or a room evicted by a
 *  higher-priority room would squat on its slot forever because its placement is still technically
 *  `wanted` (composeSet keeps the previous room around at low priority so a step back still finds it
 *  lit). */
export function assignSlots(previous: (Placement | null)[], wanted: Placement[], size: RigSize, shadows: boolean): (Placement | null)[] {
  const out: (Placement | null)[] = new Array(size.spots + size.points).fill(null);
  const isSpotSlot = (i: number) => i < size.spots;
  const lead: Placement[] = [];
  if (shadows) for (const p of wanted) { if (!isCaster(p)) break; lead.push(p); }
  let spotsLeft = size.spots, pointsLeft = size.points;
  const selected: Placement[] = [];
  for (const p of wanted) {
    if (p.kind === 'spot') { if (spotsLeft > 0) { selected.push(p); spotsLeft--; } }
    else if (pointsLeft > 0) { selected.push(p); pointsLeft--; }
  }
  const selectedCasters = selected.filter((p) => lead.includes(p));
  selectedCasters.forEach((p, i) => { out[i] = p; });
  const rest = new Set(selected.filter((p) => !selectedCasters.includes(p)));
  previous.forEach((p, i) => { if (p && rest.has(p) && i < out.length && out[i] === null) out[i] = p; });
  const placed = new Set(out.filter(Boolean) as Placement[]);
  for (const p of selected) {
    if (placed.has(p)) continue;
    const slot = out.findIndex((s, i) => s === null && isSpotSlot(i) === (p.kind === 'spot'));
    if (slot === -1) continue;
    out[slot] = p; placed.add(p);
  }
  return out;
}

const damp = (a: number, b: number, lambda: number, dt: number) => a + (b - a) * (1 - Math.exp(-lambda * dt));

interface Slot { light: THREE.SpotLight | THREE.PointLight; current: Placement | null; target: Placement | null; level: number }

/**
 * The scene's lights. Fixed in number for the whole session: three rebuilds every lit material's
 * program when the count of visible lights changes, so rooms declare placements and the rig moves
 * these lights between them. A slot whose placement changes fades to black, jumps, and fades up.
 */
export class LightRig {
  private slots: Slot[] = [];
  private rooms = new Map<StopId, Placement[]>();
  private hemi: THREE.HemisphereLight;
  private group = new THREE.Group();
  private stop: StopId | null = null;
  readonly lightCount: number;

  constructor(private scene: THREE.Scene, private size: RigSize, private readonly shadows: boolean) {
    this.group.name = 'rig'; scene.add(this.group);
    for (let i = 0; i < size.spots; i++) {
      const l = new THREE.SpotLight(0xffffff, 0, 1, Math.PI / 4, 0.5, 2);
      // Shadow casting is part of the program key, so it is fixed per slot for the session: the first
      // two spot slots cast on the shadow tier, nothing else ever does.
      l.castShadow = shadows && i < 2; l.shadow.mapSize.set(1024, 1024); l.shadow.bias = -0.0008;
      this.group.add(l, l.target); this.slots.push({ light: l, current: null, target: null, level: 0 });
    }
    for (let i = 0; i < size.points; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 1, 2);
      this.group.add(l); this.slots.push({ light: l, current: null, target: null, level: 0 });
    }
    // Ambient fill for every room. Scene-wide and unshadowed, low enough that a lit room still reads
    // as its own lit room.
    this.hemi = new THREE.HemisphereLight(0x6d7f8f, 0x1a2530, 1.3); this.group.add(this.hemi);
    this.lightCount = size.spots + size.points + 1;
  }

  register(stop: StopId, lights: Placement[]): void { checkBudget(lights); this.rooms.set(stop, lights); this.stop = null; }
  unregister(stop: StopId): void { this.rooms.delete(stop); this.stop = null; }

  update(t: number, dt: number): void {
    const stop = roomAt(t).id;
    if (stop !== this.stop) {
      this.stop = stop;
      const assigned = assignSlots(this.slots.map((s) => s.target), composeSet(this.rooms, stop), this.size, this.shadows);
      this.slots.forEach((s, i) => { s.target = assigned[i]; });
    }
    for (const s of this.slots) {
      // Fade out toward a change, snap, fade in. A slot with nothing to show fades to black and stays.
      if (s.current !== s.target) {
        s.level = damp(s.level, 0, 8, dt);
        if (s.level < 0.02 || s.current === null) { s.level = s.current === null ? 0 : s.level; s.current = s.target; this.snap(s); }
      } else if (s.current) s.level = damp(s.level, 1, 6, dt);
      this.apply(s);
    }
  }

  private snap(s: Slot): void {
    const p = s.current; if (!p) return;
    s.light.position.set(p.position[0], p.position[1], p.position[2]);
    if (p.kind === 'spot' && s.light instanceof THREE.SpotLight) s.light.target.position.set(p.target[0], p.target[1], p.target[2]);
  }

  private apply(s: Slot): void {
    const p = s.current;
    if (!p) { s.light.intensity = 0; return; }
    s.light.color.setHex(p.color);
    s.light.intensity = p.intensity * s.level;
    s.light.distance = p.distance;
    s.light.decay = p.decay ?? 2;
    if (p.kind === 'spot' && s.light instanceof THREE.SpotLight) { s.light.angle = p.angle; s.light.penumbra = p.penumbra; }
  }

  dispose(): void { this.scene.remove(this.group); for (const s of this.slots) if (s.light instanceof THREE.SpotLight) s.light.shadow.dispose(); }
}
