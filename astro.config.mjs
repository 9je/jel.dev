import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://jel.dev',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'auto' },
  vite: { build: { chunkSizeWarningLimit: 900 } },
});
