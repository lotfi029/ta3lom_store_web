# Store web — production go-live checklist

Runbook: [deploy/README.md](../deploy/README.md). Decisions: [DECISIONS.md](../DECISIONS.md) (session HC). Tick each box
with the date and who checked it. **[done]** = delivered by the PR "Store web — Option C home + production readiness";
everything else is for the owner (or a later session).

## Blockers

- [x] **Payments on (R5-Payments).** `paymentsEnabled: true` in every environment, checkout → Moyasar hosted page
      (allow-listed `paymentHosts`), order page polls the API — **[done, final session F5a]**; `build:prod` builds.
- [ ] **Moyasar dashboard (owner):** live publishable/secret keys and the webhook secret into the API's secret files
      (`ta3lom_store_api` `deploy/secrets.md`, never the repo); webhook URL
      `https://store-api.ta3lom.sa/v1/payments/webhooks/moyasar` (staging: `store-api-staging…`, test keys); payment
      methods mada, credit card, Apple Pay (domain verification for `store.ta3lom.sa`); run the API's sandbox tests once
      with a test key (`MoyasarSandboxTests`, skipped without one).
- [ ] **Staging API hosted** at `https://store-api-staging.ta3lom.sa` (the staging deploy is skipped until it answers, H-1).
- [ ] **API CORS** = `https://store.ta3lom.sa` only on production (staging: its own origin); refresh cookies for that site.
- [ ] **Edge proxy:** copy `deploy/edge/store.caddy` into ta3lom-deploy and import it (`deploy/edge/README.md`);
      the `edge` network has a fixed IPv4 subnet = the API's `EDGE_SUBNET`. This container publishes no port (F7).

## Content (owner)

- [ ] Licence number and trust texts (C-2 / Q-11): replace `[رقم الترخيص]` / `[licence number]` in
      `@@store.layout.utility-licence` and `@@store.home.trust-licensed-text` (Arabic in the templates, English in
      `src/locales/en.json`), confirm "إيصال فوري" wording.
- [ ] Real categories (one marked "accepts general gifts" for the quick donate — the first by `sort` is used, C-3),
      projects, cover images; every image with Arabic **and** English alt text.
- [ ] At least one `urgent` (or featured) project for the home banner.
- [ ] Privacy and refund pages written and linked from the footer (Q-07).
- [ ] SMS sender ID registered (Q-12).
- [ ] Main site: `/donate` redirects to `https://store.ta3lom.sa/ar/` and the main navigation links the store (Q-09).
- [ ] Zakat and delivery updates stay hidden (`environment.trust.showZakat/showUpdates = false`) until they exist (M-3).

## Infrastructure (owner)

- [ ] DNS for `store.ta3lom.sa`, `store-api.ta3lom.sa` and the two staging names; the edge terminates TLS and sends
      HSTS on the production names (`deploy/edge/store.caddy`).
- [ ] VPS folders, `.env` (`EDGE_ALIAS`), deploy user, GHCR `read:packages` token logged in on the VPS (H-4).
- [ ] GitHub environments `staging` / `production` (required reviewer, tags only), SSH secrets and known_hosts.
- [ ] First staging deploy green (workflow smoke check), then `node scripts/smoke-deploy.mjs` by hand.
- [ ] Backups of the API database (API runbook) — scheduled and a restore tested.
- [ ] Uptime monitor on `/healthz` and `/ar/` (deploy/README.md §8), alerting the owner.
- [ ] Error reporting: decide on an endpoint and set `errorReportUrl` (off by default; PII-free payload), or leave it off.

## Quality (before go-live, on the production URLs)

- [ ] Lighthouse (mobile) on `/ar/`, `/en/`, a project page: accessibility 100, best practices ≥ 95, SEO ≥ 95,
      CLS ≤ 0.05 — **[done in CI on the container]**; performance ≥ 90, LCP ≤ 2.5 s, TBT ≤ 200 ms — **not met in CI**
      (73–79 / 2.56–2.82 s / 505–857 ms, floors recorded as REVIEW): measure on production and plan the bundle work.
- [ ] **Lighthouse mobile ≥ 90 on the production URL** (`https://store.ta3lom.sa/ar/`, `/en/`, a project page) — go-live
      item (review 06 §4): the CI floors are accepted for the Option C merge; the performance pass is its own task.
- [ ] Trust row SMS wording ("برسالة نصية بعد الدفع") assumes **payments are on** (review 06 L-14): true only once
      R5-Payments is live — check the wording at go-live.
- [ ] axe clean ar/en × light/dark on production — **[done in CI on every route]**.
- [ ] Google Search Console: property for `store.ta3lom.sa`, sitemap `https://store.ta3lom.sa/sitemap.xml` submitted.
- [ ] Staging is not indexed (X-Robots-Tag, robots.txt `Disallow: /`) — **[done, checked by the build and container]**.

## Delivered in this PR

- [x] Option C home and header (catalogue first), tests and screenshots (`docs/screens/home-c/`).
- [x] Environments `development`, `ci`, `staging`, `production`; per-environment build checks.
- [x] Container image (non-root, read-only, healthcheck), Caddyfile (generated CSP, fallbacks, 404s, cache), compose.
- [x] CI (pinned actions, audit gate, container check, LHCI) and the deploy workflow (staging, production, rollback).
- [x] Retry for transient GET failures, kept prerendered data on API failure, PII-free error reporter (off).
- [x] Runbook and this checklist.
