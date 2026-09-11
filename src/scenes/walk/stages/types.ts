import type { Object3D, Scene, Vector3 } from 'three';
import type { Font } from 'three/addons/loaders/FontLoader.js';
import type { Tier } from '../quality';
import type { AssetStore } from '../assets';
import type { StopId } from '../path';
import type { Placement } from '../rig';

export type GreyboxSpace = 'booth' | 'hangar' | 'corridor' | 'lab' | 'hall' | 'bay' | 'office';

/** `typeface` is the parsed Michroma the signage kit extrudes its letters from. It is fetched
 *  alongside the assets and can be null: a slow or failed load costs a room its extruded lettering,
 *  which falls back to a stencil plane, never the room itself. */
export interface StageContext { scene: Scene; tier: Tier; anchors: Map<string, Vector3>; store: AssetStore; typeface: Font | null; pace(): Promise<void> }
/** An exhibit the pointer can pick out of the room. `object` is raycast recursively, so it can be a
 *  whole prop group, and `stop` is the stop whose panel holds the copy it opens. */
export interface Hotspot { id: string; kind: 'project' | 'cert'; label: string; object: Object3D; stop: StopId }
export interface Stage { id: string; root: Object3D; lights?: Placement[]; hotspots?: Hotspot[]; update(t: number, dt: number): void; dispose(): void }
export interface StageDef { id: string; stop: StopId; groups: string[]; near: StopId[]; replaces?: GreyboxSpace; build(ctx: StageContext): Promise<Stage> | Stage }
