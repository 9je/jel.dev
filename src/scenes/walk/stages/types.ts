import type { Object3D, Scene, Vector3 } from 'three';
import type { Tier } from '../quality';
import type { AssetStore } from '../assets';
import type { StopId } from '../path';
import type { Placement } from '../rig';

export type GreyboxSpace = 'booth' | 'hangar' | 'corridor' | 'lab' | 'hall' | 'bay' | 'office';

export interface StageContext { scene: Scene; tier: Tier; anchors: Map<string, Vector3>; store: AssetStore; pace(): Promise<void> }
export interface Stage { id: string; root: Object3D; lights?: Placement[]; update(t: number, dt: number): void; dispose(): void }
export interface StageDef { id: string; stop: StopId; groups: string[]; near: StopId[]; replaces?: GreyboxSpace; build(ctx: StageContext): Promise<Stage> | Stage }
