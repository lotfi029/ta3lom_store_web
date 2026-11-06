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
| Payments | **off — showcase mode** (`showcase: true`) until Moyasar | **off — showcase mode** until Moyasar |
| Apple Pay file | placeholder allowed (warning) | placeholder allowed in showcase (warning); **Moyasar's real file required** once `showcase: false` — the build fails on the placeholder |

**Showcase mode** (until the association subscribes to Moyasar): staging and production are built with
`showcase: true` — section "Showcase mode" below. The payment flows (checkout → Moyasar hosted page, order page polling)
stay in the code and run in local, CI and full-stack builds (`showcase: false`).

## Showcase mode (deploy without payments)

**What donors see** (`environment.showcase = true`):

- categories and projects as before, with every option and its price **read only** (the open amount as "from <minimum>"),
  and «التبرع الإلكتروني قريبًا» / "Online donations open soon" in place of the donate controls; the same note as a banner
  under the home hero; the home slide's link says «تعرّف على المشروع» instead of «تبرع الآن»;
- no cart, sign-in/account or quick-donate entry in the header (desktop and mobile), no floating quick-donate button, no
  cart or donations link in the footer, no sticky donate bar on phones, no `DonateAction` in the project JSON-LD;
- `/cart`, `/checkout`, `/orders/:ref`, `/login`, `/account/**` go to the locale home (a guard, before the page loads);
  they were never in the sitemap. The staff admin is unchanged; its dashboard shows "وضع العرض — الدفع متوقف" when the
  API says `paymentsEnabled: false` (`GET /v1/catalog/config`); the finance screens stay reachable (empty).
- An old tab that still calls the API gets 409 `store.payments_disabled` / `store.signin_disabled`, shown in Arabic or
  English.

The API runs in showcase too (`ta3lom_store_api` `deploy/README.md` "Showcase mode": `PAYMENTS_PROVIDER=none`,
`CUSTOMER_SIGNIN=false`). `check-deploy-output` fails a showcase build whose sitemap lists a donor-only route or whose
prerendered pages lack the note, and a live build that shows the note.

**Switch payments on** (after the Moyasar subscription; the API first, then one web build):

1. API: Moyasar keys and webhook, Unifonic SMS, then `PAYMENTS_PROVIDER=moyasar`, `CUSTOMER_SIGNIN=true` (API runbook).
2. Web: `showcase: false` in `src/environments/environment.staging.ts` and `environment.production.ts` (and
   `scripts/lib/envs.mjs` `staging`/`production`; `environment.spec.ts` says which value each environment has).
3. Web: Moyasar's Apple Pay domain file in `deploy/well-known/` (section "Apple Pay" below) — a production build with
   `showcase: false` fails on the placeholder.
4. Staging (push to `main`) → a sandbox donation and its refund; then tag `vX.Y.Z` for production. No data changes.

## 1. Build and image (what CI does)

```bash
npm ci
npm run build:staging      # DEPLOY_ENV=staging: routes → ng build (production,staging) → postbuild checks
npm run build:prod         # DEPLOY_ENV=production (showcase until Moyasar)
```

`PRERENDER_API_URL` is where the BUILD reads the catalogue (C-1; default: the environment's own API); the compiled app
always talks to its environment's `apiUrl`. The build fails unless every gate passes:

| Gate | What it checks |
|---|---|
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
Referrer-Policy (no-referrer on `/orders/*`), Permissions-Policy, COOP, no `Server` (404s included), no HSTS (the edge sends it),
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

### TLS: the edge model (F7)

- The VPS runs ONE edge Caddy (repo `ta3lom-deploy`, `edge/`) on 80/443 that terminates TLS for every site. This
  container publishes **no port**: it joins the external Docker network `edge` with the alias `store-web` (production) or
  `store-web-staging` (staging), and the edge proxies to `store-web:8080` / `store-web-staging:8080`. The store block for
  the edge is `deploy/edge/store.caddy` in this repo (copy it into ta3lom-deploy — `deploy/edge/README.md`); it sends
  HSTS on the production names and `X-Robots-Tag: noindex` on the staging names.
- The container sends no HSTS (owner M-8) and the edge must not add its own CSP — the container's is generated per
  build.
- **No direct mode.** `TLS_MODE=direct` was removed (review 06 L-6): the image runs non-root, read-only, with all
  capabilities dropped and no data volume, so it cannot bind :443 or keep certificates.

## 3. First-time VPS setup

1. **DNS.** `A`/`AAAA` records: `store.ta3lom.sa` and `store-staging.ta3lom.sa` → the VPS (same host as the API is fine).
2. **Docker** with the compose plugin. A deploy user (e.g. `deploy`) in the `docker` group, no sudo.
3. **Folders.** `/srv/store-web` (production) and `/srv/store-web-staging`; copy `deploy/docker-compose.store-web.yml`
   into each and add a `.env` next to it:

   ```bash
   # /srv/store-web-staging/.env
   EDGE_ALIAS=store-web-staging
   ```

   (`/srv/store-web/.env`: `EDGE_ALIAS=store-web`.) The deploy passes `EDGE_ALIAS` and `STORE_WEB_IMAGE` per run. The
   `edge` network must exist first (ta3lom-deploy `edge/up.sh`, fixed IPv4 subnet — `deploy/edge/README.md`).
4. **GHCR pull access (owner H-4, review 06 L-7).** The package stays **private**. GHCR does **not** accept
   fine-grained tokens: create a **classic** personal access token with **`read:packages` only**, on a **dedicated machine
   user** (a GitHub account used only for pulls, given read access to the package) — a classic `read:packages` token can
   read every package its user can see, so it must not be your own account. Store it ONLY on the VPS. Log the deploy user
   in without the token touching shell history or the process list:

   ```bash
   read -rs GHCR_TOKEN && printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u <machine-user> --password-stdin; unset GHCR_TOKEN
   ```

   `docker login` keeps the token base64-encoded (not encrypted) in `~/.docker/config.json` unless a credential helper is
   configured: install `docker-credential-pass` (or `secretservice`) and set `"credsStore"` in that file first, or at
   least keep the file `0600` and owned by the deploy user. The workflow never sends a registry token to the VPS.
   **Rotate** it before it expires: create a new token, run the same login again, check a pull
   (`docker pull ghcr.io/lotfi029/ta3lom-store-web:staging`), then revoke the old token.
5. **Edge proxy:** import `store.caddy` (§2) in the edge Caddyfile(s) and reload the edge.
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

Every deploy waits for **CI to succeed on the same commit** (review 06 D-1). Staging: `deploy.yml` is triggered by the
CI workflow's completion on `main` (`workflow_run`). Production (review 04 H-3): by the **tag push itself**, so the run's
ref is the tag and the `production` environment's "`v*` tags only" rule applies; its gate requires
`refs/tags/vX.Y.Z`, the tagged commit on `main`, and waits (≤ 45 min) until CI's check run `web` on that commit
succeeded. The image is built, **checked with `check-container.mjs`** for
its environment, and only then pushed. A failed CI run deploys nothing.

- **Staging:** merge to `main` (or wait for the nightly, or send `repository_dispatch` `catalog-changed` from the API
  after a catalogue change). The job builds `:staging-<sha>`, then on the VPS:

  ```bash
  cd /srv/store-web-staging
  STORE_WEB_IMAGE=ghcr.io/lotfi029/ta3lom-store-web:staging-<sha> docker compose -f docker-compose.store-web.yml -p store-web-staging pull
  STORE_WEB_IMAGE=ghcr.io/lotfi029/ta3lom-store-web:staging-<sha> docker compose -f docker-compose.store-web.yml -p store-web-staging up -d --wait
  ```

- **Production:** push a tag `vX.Y.Z` (strict semver — a pre-release such as `v1.2.3-rc.1` is
  never deployed and never moves `:latest`, L-5) on `main`. CI runs on the tag; once it succeeded `production-image`
  builds, checks and pushes `:X.Y.Z` and `:latest` (one build at a time); `production` waits for the reviewer, then runs
  the same two commands in `/srv/store-web` with `-p store-web`.

**First deploy of an environment (empty catalogue).** Every build refuses to publish a store with no published project
(`routes.mjs`), but a new environment's database is empty and the admin that adds projects is in this image. For the
first deploy only:

1. GitHub → Settings → Secrets and variables → Actions → **Variables** → repository variable
   `ALLOW_EMPTY_CATALOGUE` = `true`.
2. Deploy as usual (re-run the main deploy for staging, push the tag for production). The build publishes the home page
   only (with the «قريبًا» banner in showcase), `check-container` accepts a home page without project links, and the
   run shows a warning.
3. Create the staff account (API runbook `create-admin`), sign in at `/admin`, add and publish the categories and
   projects. Publishing triggers a staging rebuild (`catalog-changed`); for production push a new tag.
4. **Delete the variable** as soon as each environment has a published project — every later build has the guard back.

**Edge aliases (review 04 H-1).** The compose service is called `web`, never `store-web`: Compose gives every service
its own name as a DNS alias on each network, so a staging service named `store-web` also answered to the production
alias on the shared `edge` network. Only `EDGE_ALIAS` names an environment there. CI runs both projects side by side
(`scripts/check-edge-aliases.sh`) and fails if `store-web` resolves to anything but the production container.

**Apple Pay (review 04).** Moyasar's hosted page offers Apple Pay only on a verified domain: Apple fetches
`https://store.ta3lom.sa/.well-known/apple-developer-merchantid-domain-association` (served `text/plain`, `no-cache`;
`check-container` asserts both). The repository holds a PLACEHOLDER in `deploy/well-known/`; the owner replaces it with
the file from the Moyasar dashboard (Settings → Apple Pay → domains), commits it, and verifies the domain there.
`check-deploy-output` warns on staging and in CI's production dry run, and **fails a real production build** while the
placeholder is in place — except a showcase build (no payments yet), which only warns (SW-5).

## 6. Verify

```bash
node scripts/smoke-deploy.mjs https://store-staging.ta3lom.sa <commit-sha> --env staging
node scripts/smoke-deploy.mjs https://store.ta3lom.sa <commit-sha> --env production
curl -sI https://store.ta3lom.sa/ar/ | grep -iE 'content-security-policy|strict-transport|x-robots'
```

The smoke check (also run by the workflow) wants `/healthz` = `ok`, `/ar/` and `/en/` 200 with the build stamp,
`/version.json` with the expected commit and environment, and `X-Robots-Tag: noindex` on staging.

## 7. Rollback

Actions → **Deploy** → *Run workflow*. **For production, pick "Use workflow from: <the tag>"** (e.g. `v1.2.0`), not
`main`: the `production` environment only allows `v*` refs, so a run from `main` is rejected (review 06 L-2). Then the
environment + an earlier image tag (list them under the repository's Packages):

- `production` accepts only `X.Y.Z`; `staging` accepts only `staging-<sha>` — any other pair fails (review 06 D-2);
- the image's `sa.ta3lom.store-web.config` label must equal the environment (`docker buildx imagetools inspect`), so a
  staging build (noindex, staging API, ribbon) can never be redeployed to production.

The job redeploys that tag with the same compose commands and smoke-checks it (production still needs the reviewer).
By hand on the VPS: the same two commands with the older tag (check the label first).

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
