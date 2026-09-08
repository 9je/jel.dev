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

## Hosting

- The VPS runs the Docker Compose stack; container `jel-dev` listens on `127.0.0.1:8005`.
- 1Panel reverse-proxy site `jel.dev` (+ `www`) → `http://127.0.0.1:8005`, HTTP redirects to HTTPS.
- Deploys: push to `main` → GitHub Actions builds `ghcr.io/9je/jel.dev` → SSH forced command runs `deploy.sh` on the VPS.

### Certificate
Let's Encrypt via 1Panel, DNS-01 through the linked Porkbun account, auto-renew on. If renewal fails, 1Panel → Websites → Certificates shows the error; re-apply from there.
