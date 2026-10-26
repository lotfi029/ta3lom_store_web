# ta3lom store web

Storefront, customer account and staff admin of the ta3lom store, served as static files at
**https://store.ta3lom.sa** ([ADR-S09](docs/adr/ADR-S09-store-web-separate-app.md)). **R5: donations only** —
projects with options and open amounts, general gifts to categories (DECISIONS rows `R5`). Data comes from the store
API at `https://store-api.ta3lom.sa/v1` (repo `lotfi029/ta3lom_store_api`, R5-Core).

Bilingual Arabic/English, **Arabic-first, right-to-left**. Same conventions, tokens, fonts and look as `ta3lom-web`
(copied, not shared). R5 plan and contract: [docs/r5/](docs/r5/); report: [docs/W-report-r5.md](docs/W-report-r5.md) (r4 plan: [docs/store-web-plan.md](docs/store-web-plan.md)).

## Stack

| | |
|---|---|
| Framework | Angular 22.2 — standalone, zoneless, signals, `input()`/`output()`, `@if`/`@for`/`@defer` |
| Data | `httpResource()` in `*.data.ts` services; types generated from `docs/openapi/store-api.v1.json` (snapshot of the live API: `npm run api:openapi`) |
| Forms / a11y | Signal Forms (`@angular/forms/signals`), Angular Aria primitives |
| Rendering | `@angular/ssr` **static output**: `/` and `/p/:slug` prerendered; cart, checkout, orders, account, admin client-rendered |
| i18n | `@angular/localize`, `/ar` (source) and `/en`; ids `@@store.<area>.<element>`; English in `src/locales/en.json` |
| Tests | Vitest (unit), Playwright (e2e on the built output, real API), axe-core, Lighthouse CI |

## Commands

```bash
. scripts/dev-env.sh             # dev env (Node 24, ports, local API settings) — no secrets
npm run api:up                   # real store API on :5080 (../ta3lom_store_api, Development, postgres:18 on :5440)
npm run api:seed                 # e2e staff per role (TOTP + forced password change) — catalogue = API dev seed
npm run api:openapi              # refresh docs/openapi/store-api.v1.json from the local API + types:gen
npm start                        # ng serve /ar on :4200   (npm run start:en → /en on :4201)
npm run types:gen                # regenerate src/app/core/api/store-api.types.ts
npm run typecheck && npm run lint && npm test
npm run build                    # both locales, prerender against $PRERENDER_API_URL/$STORE_API_URL, budgets, CSP, deploy output
npm run build:prod               # BLOCKED while environment.production.paymentsEnabled is false (D-W2)
npm run e2e && npm run a11y      # built output on :4320, real API; axe ar/en × light/dark
npm run stub-api                 # :3000 stub (CI); `npm run build:ci` builds against it; `npm run stub-capture` re-records it
npm run i18n:extract             # after adding strings: XLF + en.json merge (lint fails on missing English)
```

**DoD order** (plan §4.1, every session): `api:up` → `api:seed` → `types:check` → `typecheck` → `lint` → `test` →
`build` → `e2e` → `a11y` → manual 320 px / keyboard / SEO / one `h1` / i18n.

## Architecture rules

```
features (store | account | admin) → shared → core          layout → shared, core
```

- **core/** singletons, no UI: API token + generated types, auth, interceptors, guards, cart, money, i18n, SEO, theme.
- **shared/ui/** presentational only — no HTTP, no router logic, no business rules.
- **features/** one folder per area; every API read goes through a `*.data.ts` with `httpResource()`.
  Components never inject `HttpClient` (ESLint). `features/admin` never imports `features/store` (ESLint boundaries).
- Routes have **no `/store` prefix** (`/{ar,en}/` = listing, `/p/:slug`, `/cart`, `/checkout`, `/orders/:ref`,
  `/account/…`, `/admin/…`).

## Non-negotiables

1. **Logical CSS only** (`margin-inline-start`, `inset-inline-end`…). Stylelint forbids `left/right/margin-left…`.
2. **Arabic first.** Build and check RTL first. Arabic body `line-height: 1.85`, English `1.55`. Western digits everywhere.
3. **English falls back to Arabic** through `pick()` — never an empty string.
4. **Every route calls `SeoService.set()`** (title, description, canonical on `store.ta3lom.sa`, hreflang, OG); noindex
   on cart, checkout, orders, account, admin, login, 404, listing searches (`?q=`) and pages > 1 (`noindex, follow`).
5. **Exactly one `<h1>` per route**; landmarks `<main>`, `<nav>`, `<footer>`.
6. **Images:** `alt` is a required input and comes from the API `MediaAsset` (`altAr`/`altEn`), never hardcoded.
7. **Tap targets ≥ 44 × 44 px.**
8. **`prefers-reduced-motion`** stops every animation.
9. **Access tokens live in signals, never in storage.** Refresh is the API's HttpOnly cookie (`t3s_rt`, `t3s_srt`).
   Credentials and bearer are attached **only** to requests for the store API origin.
10. **Budgets are not advisory:** 150 KB initial JS, 400 KB initial transfer (gzip). Never raise them — fix the cause.
11. **Never `bypassSecurityTrust*`** (ESLint).
12. **Categories are API data** — chips render from `GET /catalog/categories`, never a hardcoded list.
13. **CSP is hash-only for scripts** (`deploy/caddy-headers.conf`); `scripts/check-csp.mjs` gates every build.
14. **Semantic tokens only** (`--c-*`); no palette tokens, no colour literals outside `src/styles/tokens.css`.
15. **Types only from `core/api/store-api.types.ts`** (generated). No hand-written DTOs.
16. **Money is a decimal string** (`"350.00"`); arithmetic in integer halalas (`core/money`); display via `<ta-money>`.
    No `parseFloat` (ESLint). Limits and presets come from `GET /v1/catalog/config` (+ `project.minAmount`) — never
    hard-coded.
17. **R5: donations only** — no courses, books, shipping, stock or "giving" vocabulary. `scripts/check-no-commerce.mjs`
    fails the lint on `course|book|shipping|stock|enrol|giving` anywhere in `src/` (exact API tokens allow-listed).
18. **Payments:** no gateway code. `environment.paymentsEnabled` is `false`: checkout ends at the pending order
    ("تم تسجيل تبرعك — الدفع الإلكتروني قريبًا"), no polling. `build:prod` fails while production's flag is false.
19. **Idempotency-Key** on `POST /v1/checkout` is bound to the normalised body and kept across retries until a definite
    outcome (DECISIONS: W-1).

## Conventions

TypeScript strict, no `any`; standalone components, `OnPush`; selector prefix `ta-`; files `kebab-case`; pages
`*.page.ts`, data services `*.data.ts`; component-scoped styles; global styles in `src/styles/` only.

## Working method

One session = one branch `feat/w-nn-<slug>` = one PR "W-nn — Title", squash-merged when CI is green. Progress in
`PROGRESS.md`, every choice in `DECISIONS.md` (`REVIEW` when it touches money, auth or personal data).
