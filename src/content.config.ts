import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { projectSchema, certSchema } from './content/schema';

export const collections = {
  projects: defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
    schema: ({ image }) => projectSchema.extend({ image: image().optional() }),
  }),
  certs: defineCollection({
    loader: file('./src/content/certs.json'),
    schema: certSchema,
  }),
};
