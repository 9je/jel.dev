import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://jel.dev',
  output: 'static',
  integrations: [sitemap({ filter: (page) => new URL(page).pathname === '/' })],
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'auto' },
  vite: { build: { chunkSizeWarningLimit: 900 } },
});
