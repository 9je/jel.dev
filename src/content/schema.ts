import { z } from 'astro/zod';
import { WINGS, STATUSES } from './status';

// The wings, the statuses and their labels moved to ./status so the walk can read them without
// dragging zod into the browser bundle. Re-exported here, where every page already looks for them.
export { WINGS, STATUSES, STATUS_LABEL } from './status';
export type { Wing, Status } from './status';


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
});

export const certSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  issuer: z.string().min(1),
  badgeImage: z.string().min(1),
  verifyUrl: z.string().url().optional(),
});

export type Project = z.infer<typeof projectSchema>;
export type Cert = z.infer<typeof certSchema>;
