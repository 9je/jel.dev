# jel.dev

Jordan Eldridge Labs. Astro static site with a Three.js landing scene.

## Develop
    fnm use            # Node 22
    npm install
    npm run dev        # http://localhost:4321

## Verify
    npm run check      # astro check (types)
    npm test           # vitest unit tests
    npm run build && npm run test:e2e   # Playwright against the built site

## Content
Projects live in `src/content/projects/*.md` (frontmatter validated by `src/content/schema.ts`).
Certifications live in `src/content/certs.json`. Copy lives in `src/content/site.ts`.

## Deploy
Push to `main`. GitHub Actions builds the image and redeploys the VPS. See `docs/superpowers/plans/2026-09-08-jel-dev-deploy.md`.
