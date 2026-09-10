import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/**
 * three 0.185's DRACOLoader resolves its default decoder with `new URL(..., import.meta.url)`,
 * which makes Vite emit roughly 900 KB of decoder JavaScript and WASM into the build. We never
 * fetch any of it: the asset store calls `setDecoderPath('/draco/')` and the decoder is served
 * from `public/draco/`. Rewriting the defaults to that same public path keeps the loader working
 * and keeps the dead copies out of the bundle.
 */
const dracoFromPublic = {
  name: 'jel:draco-from-public',
  enforce: 'pre',
  transform(code, id) {
    if (!id.includes('three/examples/jsm/loaders/DRACOLoader.js')) return null;
    const out = code.replace(
      /new URL\(\s*'\.\.\/libs\/draco\/(?:gltf\/)?([\w.]+)'\s*,\s*import\.meta\.url\s*\)\.toString\(\)/g,
      (_m, file) => JSON.stringify(`/draco/${file}`),
    );
    return out === code ? null : { code: out, map: null };
  },
};

export default defineConfig({
  site: 'https://jel.dev',
  output: 'static',
  integrations: [sitemap({ filter: (page) => new URL(page).pathname === '/' })],
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'auto' },
  vite: {
    build: {
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          // Each dressed room is its own chunk, named so the bundle budget can count the rooms
          // behind the preloader with the first visit and cap every later room on its own.
          manualChunks(id) {
            const stage = /\/src\/scenes\/walk\/stages\/([a-z]+)/.exec(id)?.[1];
            if (stage && !['greybox', 'types', 'registry'].includes(stage)) return `stage-${stage}`;
            return undefined;
          },
        },
      },
    },
    plugins: [dracoFromPublic],
  },
});
