import { z } from 'astro/zod';
import { WINGS, STATUSES } from './status';

// The wings, the statuses and their labels moved to ./status so the walk can read them without
// dragging zod into the browser bundle. Re-exported here, where every page already looks for them.
export { WINGS, STATUSES, STATUS_LABEL } from './status';
export type { Wing, Status } from './status';


/** Where a project's panel media lives: `public/projects/<id>/`, never fetched before a panel opens. */
const projectPath = z.string().regex(/^\/projects\/[a-z0-9-]+\/[A-Za-z0-9._-]+$/);

/** One picture or loop in a project's panel. A loop is muted and needs a poster: it is what shows
 *  before the file arrives, and all that shows under reduced motion. */
export const mediaSchema = z.object({
  kind: z.enum(['image', 'video']),
  src: projectPath,
  alt: z.string().min(1),
  caption: z.string().optional(),
  poster: projectPath.optional(),
  /** A screen shown larger than it was drawn, a 240 pixel LCD for one: scaled with hard edges. */
  pixel: z.boolean().default(false),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
}).refine((m) => m.kind !== 'video' || !!m.poster, { message: 'a video needs a poster' });

export const projectSchema = z.object({
  title: z.string().min(1),
  wing: z.enum(WINGS),
  status: z.enum(STATUSES),
  flagship: z.boolean().default(false),
  summary: z.string().min(1).max(220),
  stack: z.array(z.string()).default([]),
  links: z.array(z.object({ label: z.string().min(1), href: z.string().url() })).default([]),
  started: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  order: z.number().int().default(100),
  contentWarning: z.string().optional(),
  exhibit: z.object({ anchor: z.string().min(1) }).optional(),
  unlocks: z.string().optional(),
  media: z.array(mediaSchema).default([]),
  role: z.string().min(1).optional(),
  /** The panel's figure strip. Four at most: a fifth turns a strip into a table. */
  facts: z.array(z.object({ label: z.string().min(1), value: z.string().min(1) })).max(4).default([]),
});

export const certSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  issuer: z.string().min(1),
  badgeImage: z.string().min(1),
  verifyUrl: z.string().url().optional(),
});

export type Media = z.infer<typeof mediaSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Cert = z.infer<typeof certSchema>;
