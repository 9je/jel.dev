import type { StageContext } from './types';
import type { StageDef } from './types';

/**
 * Every dressed room, in path order: what each is, and where its code is. The rooms' code is a
 * chunk each, loaded the first time the room builds, so the mount parses the scene and nothing
 * else: with all seven parsed at mount, the later five cost the first second a hundred
 * milliseconds for code the walk would not run for another ten. The gated rooms' chunks are
 * fetched under the download (`preload`). Assets follow the gate and the background build.
 */
export const STAGE_META = {
  booth: { id: 'booth', stop: 'booth', groups: ['booth'], near: ['booth', 'fabrication'], replaces: 'booth' },
  fabrication: { id: 'fabrication', stop: 'fabrication', groups: ['fabrication', 'fabrication-extra', 'fabrication-dressing'], near: ['booth', 'fabrication', 'recreation'], replaces: 'hangar' },
  recreation: { id: 'recreation', stop: 'recreation', groups: ['labs', 'recreation'], near: ['fabrication', 'recreation', 'operations'], replaces: 'corridor' },
  operations: { id: 'operations', stop: 'operations', groups: ['labs', 'operations'], near: ['recreation', 'operations', 'credentials'], replaces: 'lab' },
  credentials: { id: 'credentials', stop: 'credentials', groups: ['labs', 'credentials'], near: ['operations', 'credentials', 'containment'], replaces: 'hall' },
  containment: { id: 'containment', stop: 'containment', groups: ['labs', 'containment'], near: ['credentials', 'containment', 'file'], replaces: 'bay' },
  file: { id: 'file', stop: 'file', groups: ['labs', 'file', 'operations'], near: ['containment', 'file'], replaces: 'office' },
} satisfies Record<string, Omit<StageDef, 'build'>>;

type Build = (ctx: StageContext) => ReturnType<StageDef['build']>;
const CODE: Record<keyof typeof STAGE_META, () => Promise<Build>> = {
  booth: () => import('./booth').then((m) => m.build),
  fabrication: () => import('./fabrication').then((m) => m.build),
  recreation: () => import('./recreation').then((m) => m.build),
  operations: () => import('./operations').then((m) => m.build),
  credentials: () => import('./credentials').then((m) => m.build),
  containment: () => import('./containment').then((m) => m.build),
  file: () => import('./file').then((m) => m.build),
};

export const STAGES: StageDef[] = (Object.keys(STAGE_META) as (keyof typeof STAGE_META)[]).map((id) => ({
  ...STAGE_META[id],
  preload: CODE[id],
  build: (ctx) => CODE[id]().then((build) => build(ctx)),
}));
