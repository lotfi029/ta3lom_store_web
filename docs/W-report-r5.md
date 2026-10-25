# Store web — R5 donations migration report (W-M0 … W-M6)

One branch / one PR ("Store web — R5 donations") moved the web from the r4 courses/books API to the R5-Core
donations API (`lotfi029/ta3lom_store_api` ≥ `792521a`), following [r5/14-web-sync-plan.md](r5/14-web-sync-plan.md),
the contract [r5/15-api-contract-r5-core.md](r5/15-api-contract-r5-core.md) and the owner's reviews (C-1…C-7, E-1…E-6,
U-1…U-4, R3-1…R3-3 — every one is a row in `DECISIONS.md`).

## 1. Phases

| Phase | Delivered |
|---|---|
| W-M0 Foundation | OpenAPI snapshot from the live API (`api:openapi`, `x-api-commit`), regenerated types + R5 aliases; `check-no-commerce` (lint = DoD grep); r4 code deleted; W-1…W-5 fixed with tests; `StoreConfig`; `paymentsEnabled=false` + production guard; R5 problem messages; stateful stub; prerender from project slugs; PRERENDER_API_URL; R5 seed |
| W-M1 Listing + card | Home = listing (hero, quick donate, category chips from the API, search, sort, paging, URL state, C-4 SEO, JSON-LD); project card (share bar, options → stepper, open amount, اضافة / تبرع); amount input, option picker, qty stepper |
| W-M2 Project page | `/p/:slug` with a strict own Markdown renderer (C-5, XSS specs), larger donate box, share sheet, old-slug redirect, real 404 only on API 404, JSON-LD DonateAction + BreadcrumbList |
| W-M3 Donate flow | Quick-donate modal (general gifts to categories), cart (three line kinds, problems with fixes, limits from config), checkout (inline OTP, contact saved to profile, quote, Idempotency-Key bound to the body, every outcome), order page (D-W2 pending state, token out of the URL, no-referrer) |
| W-M4 Donor account | Donations list + detail, profile (edit, export, sign out everywhere, delete = anonymise) |
| W-M5 Admin | `/admin/password` (forced + self), dashboard, categories (reorder, image, gifts, conflicts), projects + editor (details, options editor, publish/archive/preview, unsaved guard), media, donors (block), orders (search, cancel) |
| W-M6 Close-out | Admin e2e on the real API, a11y routes (order page), i18n staleness check, refresh-after-hydration fix, docs, `.session/` → `docs/r5/` |

## 2. Screens

| Area | Routes |
|---|---|
| Storefront (prerendered) | `/{ar,en}/` (listing), `/p/:slug` (+ client fallback for projects published after the build, E-1) |
| Storefront (client) | `/cart`, `/checkout`, `/orders/:ref`, `/login`, 404 |
| Account | `/account/donations`, `/account/donations/:ref`, `/account/profile` |
| Admin | `/admin/login`, `/admin/password`, `/admin` (dashboard), `/projects`, `/projects/:id` (`new`), `/categories`, `/media`, `/orders`, `/orders/:ref`, `/donors`, `/donors/:id`, `/staff`, `/settings`, `/templates`, `/audit` |

## 3. Tests

- Unit (Vitest): 240 tests — money and amounts, Markdown/XSS, cart queue (W-3), checkout idempotency (W-1, U-3, R3-3),
  order tokens (E-2, R3-2), staff `pwd_change` (C-6) incl. reload → `/admin/password`, options editor rules (API-3),
  admin helpers, refresh after hydration.
- e2e (Playwright, built output on :4320): `@smoke` journeys run on the stub in CI (listing, project, donate flow,
  account, layout); the full suite runs on the real local API + seed (adds sign-in, admin catalogue, operations and
  platform): option gift with quantity, open amount, category gift via quick donate, 3-line cart → pending order,
  delete account, admin category + project with options → publish → public → slug change redirect, new staff →
  TOTP setup → forced password change.
- a11y: axe ar/en × light/dark on every prerendered route + the stateless client routes, and inside the e2e specs on
  every stateful screen (account, admin) with the e2e auth state.

## 4. Known limits

- **Payments are off** (`environment.paymentsEnabled = false`): checkout ends at the pending order; `build:prod`
  fails until R5-Payments flips the flag (only the CI dry run may bypass it, with a warning).
- Projects published after a build are client-rendered until the next build (E-1 follow-up: rebuild on publish).
- The public API caches project pages for 60 s: a browser that just saw an old slug may show it for up to a minute.
- Admin journeys cannot run on the stub (it answers the staff refresh with 401); CI covers the admin with unit specs
  and the login page; the admin e2e runs against the real API.
- API follow-ups API-1…API-7 (+ API-8 optional OTP caps, API-9 card options) are open; client workarounds are in place.
  **API-4 (production CORS lists staging) blocks production on the API side.**

## 5. Screenshots

`docs/screenshots/r5/{ar,en}-{1440,375}-{1-home,2-project,3-cart,4-admin-dashboard,5-admin-project-options}.jpg`
