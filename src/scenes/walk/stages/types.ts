import type { Object3D, Scene, Vector3 } from 'three';
import type { Tier } from '../quality';

export interface StageContext { scene: Scene; tier: Tier; anchors: Map<string, Vector3> }
export interface Stage { id: string; root: Object3D; update(t: number, dt: number): void; dispose(): void }
export type StageBuilder = (ctx: StageContext) => Promise<Stage> | Stage;
