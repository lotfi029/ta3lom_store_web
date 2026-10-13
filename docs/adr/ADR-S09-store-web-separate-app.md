# ADR-S09 — The store web is a separate Angular app at `store.ta3lom.sa`

**Status:** Accepted · **Date:** 13 October 2026 · **Supersedes:** [ADR-S07](ADR-S07-store-inside-ta3lom-web.md) (store inside ta3lom-web)
**Deciders:** Lotfi

## Context

ADR-S07 placed the store UI inside `ta3lom-web` as a lazy feature. Since then:

- The store is reduced to courses and books (r4).
- The store backend is a separate .NET service with its own release cycle (PR #8, plus r4).
- The main site is moving to Docker on a VPS, and the store API will run on that VPS too.

Lotfi wants the store web as its own project: `repos\Store\store_web`, repo `lotfi029/ta3lom_store_web`.

## Decision

1. **Separate Angular workspace.** Angular 22.2 (latest stable, 8 Oct 2026): standalone, zoneless, signals, `httpResource`, Signal Forms, `@angular/localize` (`/ar`, `/en`), `@angular/ssr` in **static output** (prerender + client routes). It has the **same conventions and non-negotiables as ta3lom-web** (CLAUDE.md), the same tokens, fonts and layout look.
2. **Served at `https://store.ta3lom.sa`** (staging `store-staging.ta3lom.sa`) as static files. Routes have no `/store` prefix: `/{ar,en}/`, `/{ar,en}/courses`, `/{ar,en}/p/:slug`, ….
3. **The storefront and the staff admin are in the same app.** The admin lives at `/{ar,en}/admin/**`, client-rendered behind its own guard and role checks. Both read the store API at `https://store-api.ta3lom.sa/v1`.
4. **Main-site integration is links only.** `ta3lom-web` gets a "المتجر / Store" nav item, footer links and the header cart badge. The badge reads `GET /v1/cart/summary` with credentials from `ta3lom.sa` (same site). This is a small separate change in `ta3lom-web`.

## Consequences

| Area | Effect |
|---|---|
| Cookies | `store.ta3lom.sa`, `ta3lom.sa` and `store-api.ta3lom.sa` are **same-site** (registrable domain `ta3lom.sa`). The API's host-only `SameSite=Lax` cookies (`t3s_rt`, `t3s_srt`, `t3s_cart`) are sent on credentialed fetches. No cookie change is needed |
| CORS (API) | `Store:Cors:Origins` must include `https://store.ta3lom.sa`, `https://ta3lom.sa`, `https://www.ta3lom.sa` (badge), staging origins, and `http://localhost:4200` in Development |
| Links from the API | SMS, email, certificate and download links use `Store:WebBaseUrl = https://store.ta3lom.sa` |
| CSP | The store app's own CSP (hash-only `script-src`). `connect-src 'self' https://store-api.ta3lom.sa` |
| SEO | Canonicals on `store.ta3lom.sa`. The store has its own sitemap and robots, and the main sitemap links to it |
| Code reuse | Layout, tokens and shared UI are **copied** from ta3lom-web at bootstrap (a reference kit), not shared as a package. Drift is accepted. A shared design package can come later if both evolve |
| Bundle | The store has its own budgets (150 KB initial JS, 400 KB page transfer). The main site's bundle is unaffected |
| Deploy | Static `dist/` served by Caddy on the VPS (hosting phase). It is independent of the main site's deploy |
