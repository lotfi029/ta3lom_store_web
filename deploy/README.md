# Store web — deploy runbook

The store web is **static files served by its own Caddy container** — no Node server in production
([ADR-S09](../docs/adr/ADR-S09-store-web-separate-app.md)). One image per environment, built by GitHub Actions and pulled
by the VPS from GHCR. Go-live checklist: [docs/production-checklist.md](../docs/production-checklist.md).

| | Staging | Production |
|---|---|---|
| Site | `https://store-staging.ta3lom.sa` | `https://store.ta3lom.sa` |
| API (runtime, compiled in) | `https://store-api-staging.ta3lom.sa/v1` | `https://store-api.ta3lom.sa/v1` |
| Image | `ghcr.io/lotfi029/ta3lom-store-web:staging-<sha>` (+ `:staging`) | `ghcr.io/lotfi029/ta3lom-store-web:<version>` (+ `:latest`) |
| Built on | push to `main`, nightly 01:23 UTC, `repository_dispatch: catalog-changed` | tag `vX.Y.Z` |
| Deployed | automatically (`staging` environment) | after the `production` environment's required reviewer approves |
| Robots | `noindex, nofollow` everywhere (meta, `X-Robots-Tag`, `robots.txt Disallow: /`, no sitemap), "نسخة تجريبية" ribbon | indexable, sitemap |
| Payments guard | not applied | **applied — production is blocked until R5-Payments** |

**What blocks production today:** `environment.production.ts` has `paymentsEnabled: false` (D-W2). `npm run build:prod`
and the production image build run `scripts/check-payments-flag.mjs` and FAIL until R5-Payments turns it on. That is
expected; a tag push today produces a failed `production-image` job and deploys nothing.

## 1. Build and image (what CI does)

```bash
npm ci
npm run build:staging      # DEPLOY_ENV=staging: routes → ng build (production,staging) → postbuild checks
npm run build:prod         # payments guard first; DEPLOY_ENV=production
```

`PRERENDER_API_URL` is where the BUILD reads the catalogue (C-1; default: the environment's own API); the compiled app
always talks to its environment's `apiUrl`. The build fails unless every gate passes:

| Gate | What it checks |
|---|---|
| `check-payments-flag.mjs` | production only: `paymentsEnabled` is true (D-W2) |
| `postbuild.mjs` | root files (robots, sitemap, favicons, `index.html`, `404.html`), font preload, build stamp (`/version.json`, `<meta name="build">`) |
| `gen-csp.mjs` | writes `dist/store-web/caddy/csp.conf` (CSP with the build's script hashes + the env's API origin) and `env.conf` — generated, never committed |
| `check-deploy-output.mjs` | per environment: API URL compiled in, CSP connect-src, canonical host, robots/sitemap, build stamp, no localhost, no source maps, no ribbon in production, every route prerendered |
| `check-csp.mjs` | hash-only `script-src` matching every inline script; no inline handlers; connect-src = 'self' + API (+ error-report origin) |
| `check-bundle-budget.mjs` | initial JS ≤ 150 KB, initial transfer ≤ 400 KB (gzip) |

Image (`Dockerfile`): `node:24-alpine` builds `CONFIG=staging|production` → `caddy:2-alpine` serves `/srv/site` on
**:8080** as uid 10001 (read-only root filesystem compatible), `HEALTHCHECK` on `/healthz`.

```bash
docker build --build-arg CONFIG=staging --build-arg PRERENDER_API_URL=https://store-api-staging.ta3lom.sa/v1 \
  --build-arg VERSION="$(git describe --tags --always)" --build-arg GIT_SHA="$(git rev-parse HEAD)" -t store-web:staging .
node scripts/check-container.mjs store-web:staging --env staging
```

`scripts/check-container.mjs` (also in CI) runs the image read-only with all capabilities dropped and checks: non-root,
`/healthz`, `/` → 302 `/ar/`, the served CSP = the image's generated `csp.conf`, frame-ancestors, nosniff,
Referrer-Policy (no-referrer on `/orders/*`), Permissions-Policy, COOP, no `Server`, HSTS only with `TLS_MODE=direct`,
X-Robots-Tag on staging, client-route fallbacks, real 404s, cache headers, compression, `/version.json`, robots.txt.

## 2. Web server behaviour (`deploy/Caddyfile`)

- `/` → `302 /ar/`. `/healthz` → `200 ok` (static, never calls the API, `no-store`).
- Prerendered pages: `/{ar,en}/` and `/{ar,en}/p/<slug>/`.
- Client-rendered routes get the locale's shell `/{ar,en}/index.csr.html` with **200**: `cart`, `checkout`, `login`,
  `orders/<ref>`, `account/**`, `admin/**`, and `/p/<slug>` published after the build (E-1).
- Any other unknown path → **404**: inside `/ar` or `/en` the client shell (the app's own not-found page, `noindex`),
  elsewhere the static `404.html`.
- Cache: `*-XXXXXXXX.{js,css,woff2,…}` `public, max-age=31536000, immutable`; HTML, `index.csr.html`, robots, sitemap
  `no-cache`; `/version.json` `no-store`. zstd/gzip.
- Headers: `deploy/caddy-headers.conf` (nosniff, Referrer-Policy, Permissions-Policy, COOP, no `Server`, no-referrer on
  orders) + the generated `csp.conf` and `env.conf`.

### TLS: two modes

- **`TLS_MODE=edge` (default, recommended).** The VPS already runs an edge Caddy (or nginx/Traefik) that terminates TLS
  for every site. The container listens on `127.0.0.1:<port>` only; the edge proxies to it and sends HSTS:

  ```caddy
  store.ta3lom.sa {
  	header Strict-Transport-Security "max-age=31536000; includeSubDomains"
  	reverse_proxy 127.0.0.1:8081
  }
  store-staging.ta3lom.sa {
  	reverse_proxy 127.0.0.1:8082
  }
  ```

  The container sends no HSTS in this mode (owner M-8). Keep the edge from adding its own CSP — the container's is
  generated for its build.
- **`TLS_MODE=direct`.** This container is the edge: set `TLS_MODE=direct` and `SITE_ADDRESS=store.ta3lom.sa`, publish
  80 and 443, and give Caddy a writable data volume (certificates) instead of the tmpfs. It then sends HSTS.

## 3. First-time VPS setup

1. **DNS.** `A`/`AAAA` records: `store.ta3lom.sa` and `store-staging.ta3lom.sa` → the VPS (same host as the API is fine).
2. **Docker** with the compose plugin. A deploy user (e.g. `deploy`) in the `docker` group, no sudo.
3. **Folders.** `/srv/store-web` (production) and `/srv/store-web-staging`; copy `deploy/docker-compose.store-web.yml`
   into each and add a `.env` next to it:

   ```bash
   # /srv/store-web-staging/.env
   STORE_WEB_PORT=8082
   TLS_MODE=edge
   ```

   (`/srv/store-web/.env`: `STORE_WEB_PORT=8081`.) The deploy sets `STORE_WEB_IMAGE` per run.
4. **GHCR pull access (owner H-4).** The package stays **private**. Create a fine-grained or classic personal access
   token with **`read:packages` only** (account settings → Developer settings → Personal access tokens), store it ONLY on
   the VPS and log the deploy user in once:

   ```bash
   echo "<token>" | docker login ghcr.io -u <github-user> --password-stdin   # as the deploy user
   ```

   The workflow never sends a registry token to the VPS. **Rotate** it before it expires: create a new token, run the
   same `docker login` again, check a pull (`docker pull ghcr.io/lotfi029/ta3lom-store-web:staging`), then revoke the
   old token.
5. **Edge proxy** routes as in §2 (TLS edge mode), reload it.
6. **API side.** CORS on the API = the site origin only (`https://store.ta3lom.sa`, staging its own), refresh cookies
   for that site. The web sends credentials and bearer tokens only to its API origin. The API repo's old Caddy block that
   served these files and imported `caddy-headers.conf` for its CSP must be replaced by the reverse proxy above (the CSP
   now comes from this container) — see the PR's "API follow-ups".

## 4. GitHub settings

- Environments **`staging`** and **`production`**; `production` with a **required reviewer** and limited to tags `v*`.
- Secrets per environment: `STAGING_SSH_HOST`, `STAGING_SSH_USER`, `STAGING_SSH_KEY` (a dedicated ed25519 private key),
  `STAGING_SSH_KNOWN_HOSTS` (`ssh-keyscan -t ed25519 <host>`, checked, then pasted); the same four with `PRODUCTION_`.
  Optional variables `STAGING_DEPLOY_DIR` / `PRODUCTION_DEPLOY_DIR` (defaults `/srv/store-web-staging`, `/srv/store-web`).
- Missing staging secrets → the staging job builds and pushes, then SKIPS the deploy with a warning and prints the
  commands it would run. An unreachable staging API → the whole staging job is skipped with a warning (H-1): staging goes
  live after the API hosting session.
- **Rotate the SSH key:** generate a new key pair, append the public key to the deploy user's `authorized_keys`, update
  the `*_SSH_KEY` secret, run a deploy (or a rollback to the current tag) to prove it, then remove the old public key.

## 5. Deploy

- **Staging:** merge to `main` (or wait for the nightly, or send `repository_dispatch` `catalog-changed` from the API
  after a catalogue change). The job builds `:staging-<sha>`, then on the VPS:

  ```bash
  cd /srv/store-web-staging
  STORE_WEB_IMAGE=ghcr.io/lotfi029/ta3lom-store-web:staging-<sha> docker compose -f docker-compose.store-web.yml -p store-web-staging pull
  STORE_WEB_IMAGE=ghcr.io/lotfi029/ta3lom-store-web:staging-<sha> docker compose -f docker-compose.store-web.yml -p store-web-staging up -d --wait
  ```

- **Production (after R5-Payments):** push a tag `vX.Y.Z` on `main`. `production-image` builds and pushes `:X.Y.Z` and
  `:latest`; `production` waits for the reviewer, then runs the same two commands in `/srv/store-web` with `-p store-web`.

## 6. Verify

```bash
node scripts/smoke-deploy.mjs https://store-staging.ta3lom.sa <commit-sha> --env staging
node scripts/smoke-deploy.mjs https://store.ta3lom.sa <commit-sha> --env production
curl -sI https://store.ta3lom.sa/ar/ | grep -iE 'content-security-policy|strict-transport|x-robots'
```

The smoke check (also run by the workflow) wants `/healthz` = `ok`, `/ar/` and `/en/` 200 with the build stamp,
`/version.json` with the expected commit and environment, and `X-Robots-Tag: noindex` on staging.

## 7. Rollback

Actions → **Deploy** → *Run workflow* → environment + an earlier image tag (`staging-<sha>` or `X.Y.Z`; list them under
the repository's Packages). The job redeploys that tag with the same compose commands and smoke-checks it (production
still needs the reviewer). By hand on the VPS: the same two commands with the older tag.

## 8. Monitoring

- **Uptime:** an external monitor (UptimeRobot, Better Stack, …) every 1–5 min on `https://store.ta3lom.sa/healthz`
  (expects `200` and `ok`) and on `https://store.ta3lom.sa/ar/` (expects `200` and the text `متجر التبرعات`); alert the
  owner. `/healthz` proves the container serves; `/ar/` proves the edge, TLS and the site.
- **Container health:** `docker compose -p store-web ps` (healthy), `docker compose -p store-web logs --tail 100`.
- **Client errors:** set `errorReportUrl` in `environment.production.ts` to an endpoint you control (its origin is added
  to the CSP automatically); reports carry route, code, a scrubbed message and the build sha — no personal data.
- **Lighthouse:** CI uploads the `lighthouse` artifact per run; repeat on the production URLs before go-live.

## 9. After a catalogue change

Options, amounts and availability refresh in the browser after every page load. Titles, descriptions, SEO text and the
sitemap of prerendered pages change with the next build: the nightly staging build picks them up; for production, tag a
release (or let the API send `catalog-changed` once that hook exists).
