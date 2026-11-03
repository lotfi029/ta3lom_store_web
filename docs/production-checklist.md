# Store web — production go-live checklist

Runbook: [deploy/README.md](../deploy/README.md). Decisions: [DECISIONS.md](../DECISIONS.md) (session HC). Tick each box
with the date and who checked it. **[done]** = delivered by the PR "Store web — Option C home + production readiness";
everything else is for the owner (or a later session).

## Blockers

- [ ] **Payments on (R5-Payments).** `paymentsEnabled: true` in `src/environments/environment.production.ts` with the
      gateway flow; until then `build:prod`, the production image and the tag deploy fail on purpose (D-W2).
- [ ] **Staging API hosted** at `https://store-api-staging.ta3lom.sa` (the staging deploy is skipped until it answers, H-1).
- [ ] **API CORS** = `https://store.ta3lom.sa` only on production (staging: its own origin); refresh cookies for that site.
- [ ] **API repo deploy** proxies `store.ta3lom.sa` to this container (it no longer serves the files or imports
      `caddy-headers.conf` for the CSP — the CSP is generated per image).

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

- [ ] DNS for `store.ta3lom.sa` and `store-staging.ta3lom.sa`; edge proxy with TLS + HSTS (TLS_MODE=edge).
- [ ] VPS folders, `.env` (ports), deploy user, GHCR `read:packages` token logged in on the VPS (H-4).
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
