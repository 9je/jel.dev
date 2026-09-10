import type { StageDef } from './types';

/**
 * Every dressed room, as its own chunk. The rooms' code loads when the walk mounts, a few KB
 * each, so the first visit bundle stays the scene and the gated rooms. Their assets follow the
 * gate and the background build, not this list. Order is path order: the background build walks
 * it front to back.
 */
export const STAGE_LOADERS: (() => Promise<StageDef>)[] = [
  () => import('./booth').then((m) => m.BOOTH_DEF),
  () => import('./fabrication').then((m) => m.FABRICATION_DEF),
];
