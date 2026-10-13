# Store Web — implementation plan (Angular, cloud session)

**Date:** 13 October 2026 · **Scope:** r4 (courses and books only) · **Decision:** [ADR-S09](adr/ADR-S09-store-web-separate-app.md), a separate app at `store.ta3lom.sa`
**Local path:** `D:\Freelance\ELAMS\repos\Store\store_web` · **Repo:** `lotfi029/ta3lom_store_web` (new, private) · **Runs in:** cloud Claude Code, unattended
**Contains:** storefront + customer account + staff admin · **API:** `ta3lom_store_api` (r4, 95 endpoints) · **Payments:** UI ready, no gateway (dev trigger only) · **Hosting:** out (static `dist/` only)

**Sources:**

| Need | Document |
|---|---|
| Screens, components, behaviour | [10 — Frontend Angular](10-frontend-angular.md). Written for the store-inside-ta3lom-web design: read `/store/…` as `/…`, and ignore everything giving (r4) |
| Contract | [11 — API contract](11-api-contract.md) §12 r4 + `docs/openapi/store-api.v1.json` |
| Rules | [03](03-business-rules.md) · [04](04-functional-requirements.md) · [scope-change r4](scope-change-r4-no-giving.md) |
| Look | `docs/design/ta3lom-store-prototype.html` (approved; strip giving, §2.6) + `docs/design/ta3lom-prototype.html` (header, footer, tokens) |
| Conventions | ta3lom-web `CLAUDE.md` (the non-negotiables are copied into store_web's `CLAUDE.md`) |

---

## 1. Outcome

A production-ready static Angular app. Every r4 customer and staff journey works against the real store API, in both locales and both themes, accessible and within budget.

| Area | Screens | Store API endpoints (11 §12) |
|---|---|---|
| Storefront | Home, Courses, Books, Search, Product (course, book), 404 | #1–#5, #9 |
| Cart | Header badge, buy boxes, cart page | #10–#15 |
| Sign-in | OTP page + inline OTP at checkout | #16–#20 |
| Checkout | 3 steps (details, shipping if print, payment), order placement, thanks with status polling | #40–#42 (+ dev trigger in dev/staging) |
| Account | My courses (launch, certificate), My books (downloads, shipments), Orders and invoices, Profile and addresses, Data rights, Sign out everywhere | #21–#32, #35–#39, #46 |
| Admin | Staff login + TOTP; dashboard; products (course, book, formats, curriculum, media, publish); categories; media library; stock; orders (search, detail, cancel, resend); shipments (queue, packing slip, ship, deliver, return); download reset; customers (lookup, block); staff and roles; settings; templates (test send); reports (sales & VAT, shipments; CSV); audit log | #47–#62, #64–#66, #72–#80, #85–#88, #94–#99, #117–#133 |

**Out of this plan:**

- **Payment gateway, refunds and payment review:** #43, #44, #89–#92. The UI hooks are prepared (§2.7).
- **Hosting:** Caddy, VPS, DNS, deploy.
- **ta3lom-web integration:** nav item, footer links and cart badge. That's a separate small change in `ta3lom-web` (§10).
- **API-side CORS and URL changes:** a small PR in the API repo (§3.2).

---

## 2. Architecture

### 2.1 Stack (latest stable as of 13 Oct 2026)

| | Choice |
|---|---|
| Angular | **22.2.x** (`@angular/core`, `cli`, `build`, `ssr`, `localize`, `forms`, `aria`). Angular 23 is expected around November 2026; upgrade later with `ng update` (separate task) |
| Runtime | Node **24 LTS** (≥ 24.15; Angular 22 supports 22.22+, 24.15+, 26+) · npm 11 · TypeScript ~6.0 · RxJS 7.8 |
| App model | Standalone, **zoneless**, signals, `input()`/`output()`, `@if`/`@for`/`@defer`, `httpResource()`, **Signal Forms**, Angular Aria primitives |
| Rendering | `@angular/ssr` **static output**: prerender for public pages, `RenderMode.Client` for cart, checkout, account and admin. No Node server in production |
| i18n | `@angular/localize`, two builds `/ar` (source) and `/en`; ICU plurals; Western digits |
| API types | `openapi-typescript` (dev dep) generates `src/app/core/api/store-api.types.ts` from `docs/openapi/store-api.v1.json` (`npm run types:gen`); a CI check fails if they are stale |
| Tests | Vitest (unit), Playwright (e2e), axe-core (a11y), Lighthouse CI (performance) |
| Lint | ESLint (angular-eslint, boundaries, RTL rule, ban `bypassSecurityTrust*`), Stylelint (semantic tokens only, logical properties), Prettier, contrast check |

New dependencies beyond ta3lom-web's set: `openapi-typescript` (dev) and `@lhci/cli` (dev). Anything else needs a `DECISIONS.md` entry and a reason.

### 2.2 Routes

Every path sits under `/{ar,en}`. `/` redirects to `/ar/`.

| Path | Page | Render | Guard | SEO |
|---|---|---|---|---|
| `/` | Home (featured, courses, books, categories) | Prerender | — | indexed |
| `/courses`, `/books` | Catalogue (category chips from the API, sort, paging) | Prerender | — | indexed |
| `/search?q=` | Search | Client | — | noindex |
| `/p/:slug` | Product (course or book) | Prerender (slugs from `routes.txt`) + client fallback | — | indexed, JSON-LD `Course` / `Book` |
| `/cart` | Cart | Client | — | noindex |
| `/login` | OTP sign-in | Client | `guestOnly` | noindex |
| `/checkout` | Checkout | Client | `cartNotEmpty` | noindex |
| `/orders/:ref/thanks` | Thank-you + status polling | Client | bearer or `?t=` | noindex |
| `/account/{courses,books,orders,profile}` | Account | Client | `customer` | noindex |
| `/admin/login` | Staff login + TOTP | Client | — | noindex |
| `/admin/**` | Admin (§6, W-08…W-10) | Client | `staff` + role | noindex, not in the sitemap |
| `**` | 404 | Client | — | noindex |

### 2.3 Folder structure

```
src/app/
├── core/                 singletons, no UI
│   ├── api/              STORE_API_URL token, store-api.types.ts (generated), problem → message, paged
│   ├── auth/             StoreAuth (customer: OTP, token signal, single-flight refresh), StaffAuth (password+TOTP, can(policy))
│   ├── http/             credentials, auth and refresh interceptors (store API origin only)
│   ├── guards/           customer, guestOnly, cartNotEmpty, staff, staffRole(...)
│   ├── cart/             CartSummary (badge; initial bundle), CartStore (lazy; server is the truth)
│   ├── money/            Money as string decimals (no floats), format (Intl ar-SA-u-nu-latn / en-SA, SAR)
│   ├── i18n/ seo/ theme/ refresh-after-hydration, prerender-http-cache, pick(), western-digits
├── layout/               header (store nav, search, cart badge, account menu, lang switch, theme toggle, "ta3lom.sa" link), footer, skip link
├── shared/ui/            presentational only: button, card, chip, dialog, data-table, filter-chips, icon, image, page-head,
│                         resource-state, status-pill, toast, stat, stepper, money, empty-state, admin-page-header
└── features/
    ├── store/            home, catalog, search, product (course-body, book-body, buy-box), cart, login, checkout, thanks
    ├── account/          shell, courses, books, orders, profile
    └── admin/            shell, login, dashboard, products, categories, media, stock, orders, shipments,
                          customers, staff, settings, templates, reports, audit   (each: *.page.ts + *.data.ts)
```

**Rules (ESLint boundaries):**

- `features → shared → core`; `layout → core`. Nothing imports from `features`.
- `features/admin` never imports from `features/store`.
- Every API read goes through a `*.data.ts` with `httpResource()`. Components never call `HttpClient`.

### 2.4 Auth and the API

| Concern | Implementation |
|---|---|
| Customer session | Access token in a signal (never in storage). Refresh via the `t3s_rt` HttpOnly cookie (`POST /auth/refresh`, credentials). Single-flight refresh on 401 |
| Staff session | Separate `StaffAuth`, `t3s_srt` cookie (`Path=/v1/admin/auth`). `can(policy)` uses the API's r4 policy table (`staff:read`, `catalogue`, `stock`, `fulfilment`, `finance`, `resend`, `admin`; `staff:refund` stays hidden until payments). Actions the user can't take are shown **disabled with the reason** |
| Cart | Guest cookie `t3s_cart` (API-owned). `CartStore` uses optimistic updates with server reconciliation. Merge on sign-in is done by the API (show its `cartNotices`) |
| Errors | ProblemDetails `code` → `$localize` message (`@@store.error.<code>`). Field errors map onto Signal Form fields |
| Idempotency | Checkout sends an `Idempotency-Key` (UUID per attempt; a new one after `checkout.price_changed`) |
| Money | Strings like `"350.00"` everywhere. Arithmetic in halalas (integers). Display through `<ta-money>` |
| Cross-site | `store.ta3lom.sa` ↔ `store-api.ta3lom.sa` are same-site, so cookies flow with `withCredentials`. CORS must allow the origin (§3.2) |

### 2.5 Rendering and freshness

Same model as ta3lom-web:

- `scripts/routes.mjs` (prebuild) fetches `GET /v1/catalog/products?fields=slug` (all pages) and writes `routes.txt`. **If the API is unreachable, the build fails.**
- Prerendered pages embed the transfer cache and reload public resources after hydration (`refresh-after-hydration`).
- Price and stock come from `GET /catalog/live?slugs=` in the browser only.
- New products use the client fallback until the next build. The admin shows the freshness notice ("prices and stock update on next page load; titles and SEO text after the next site rebuild").

### 2.6 Design: what to take from the prototype

**Port as is (r4):**

- header and footer (from the main prototype), store hero, featured accordion;
- course and book cards (`.pcard`, `.bookcov`, `.ribbon`, `.price`, `.cur`);
- product pages (`.kv`, `.curric`, `.hero-media`, `.person`);
- the buy box (enrol / format selector / stepper / total);
- sticky buy bar, share sheet;
- cart (**one group, "Your purchases"**);
- checkout steps and payment grid;
- thank-you and receipt;
- account library (`.lib`, `.libi`), tables, empty states.

**Strip (giving, r4):**

- donation cards, quick give, goal bars, "how sponsorship works", impact stats;
- sponsor and give tabs and catalogues;
- sponsor mode in the buy box, sadaqa/zakat selector, dedication block;
- the giving cart group, the anonymity checkbox;
- dedication card page and previews;
- the "My giving" tab and seat map;
- Tabby rule text tied to gifts;
- the "Reset demo" link.

The prototype's demo data and generated SVG art are not ported. Images are API `MediaAsset`s with alt text.

### 2.7 Payments (prepared, not wired)

- The payment step renders the methods from `GET /catalog/config`.
- `POST /checkout` returns the order and its status token, and `redirectUrl` is null today (`NullPaymentInitiator`). The app then goes straight to the thanks page, which shows **"Awaiting payment"** and polls `GET /orders/{ref}/status`: 2 s for 60 s, then 10 s, stopping after 10 minutes.
- When `redirectUrl` is present (the future payment service), the app navigates to it. The return URL is `/{locale}/orders/{ref}/thanks?t=…`. The gateway's own `status` query parameter is ignored (RUL-33).
- **Dev and staging only:** a "Simulate payment (dev)" button on the thanks page calls `POST /dev/orders/{ref}/confirm-payment`. It's controlled by the `environment.devPaymentTrigger` flag, which is false in production, and a unit test asserts that.

---

## 3. Before the session (your steps)

### 3.1 Order of work

1. **Finish the API r4 session first** ([Core-features-session-plan v2](https://github.com/lotfi029/ta3lom_store_api/blob/main/store/sessions/Core-features-session-plan.md)), so the OpenAPI file has no giving.
2. Make the API changes in §3.2. They can be added to the r4 session as one extra step.
3. Run the bootstrap (§3.3), then start the cloud session (§3.4).

### 3.2 API changes (in `ta3lom_store_api`)

| Setting / code | Value |
|---|---|
| `Store:Cors:Origins` (Production) | `https://store.ta3lom.sa`, `https://ta3lom.sa`, `https://www.ta3lom.sa` |
| `Store:Cors:Origins` (Staging) | `https://store-staging.ta3lom.sa` |
| `Store:Cors:Origins` (Development) | `http://localhost:4200` (already there) |
| `Store:WebBaseUrl` | `https://store.ta3lom.sa` (Production) — used for links in SMS and email, certificate redirects, download pages and payment return URLs |
| Link paths | Check that no API-generated link contains `/store/` (the store app has no `/store` prefix). Fix them and add a test |
| 11 + `openapi/v1.json` | Regenerated after r4, then copied into store_web (§3.3) |

Paste this into the r4 session (or a new session on the API repo) as an extra step:

```text
Extra step R4-W (after F4): the store web is a separate app at https://store.ta3lom.sa (ADR-S09,
store/adr/ADR-S09-store-web-separate-app.md). Add CORS origins https://store.ta3lom.sa, https://ta3lom.sa,
https://www.ta3lom.sa (Production) and https://store-staging.ta3lom.sa (Staging); set Store:WebBaseUrl to
https://store.ta3lom.sa in Production; make sure no API-generated link contains "/store/" (the web app has no
/store prefix) and add a test that checks the link shapes. Keep CORS tests green.
```

### 3.3 Bootstrap the repo (already prepared — just commit and push)

All files the project needs are already in `D:\Freelance\ELAMS\repos\Store\store_web\docs\` (14 Oct):

| Folder | Content |
|---|---|
| `docs/` | This plan, `store-web-prompts.md`, specs (scope change r4, 03, 04, 05, 06, 10, 11, store-prototype) |
| `docs/adr/` | ADR-S04 (OTP identity), ADR-S05 (hosted payments), ADR-S09 (separate app) |
| `docs/database/` | `00-store-database-design.md` (v2, r4) |
| `docs/cloud/` | Cloud environment variables + `store-web-setup.sh` |
| `docs/design/` | `ta3lom-store-prototype.html`, `ta3lom-prototype.html` (approved) |
| `docs/openapi/` | `store-api.v1.json` — **refresh after the API r4 session** (it still has the giving endpoints until then) |
| `docs/reference/ta3lom-web/` | Reference kit: styles + fonts, logo/favicons, layout, selected core and shared UI, scripts, configs, `CLAUDE.md` (ported by the session, deleted in W-11) |

Create an **empty private** GitHub repo `lotfi029/ta3lom_store_web` (no README), then:

```powershell
cd D:\Freelance\ELAMS\repos\Store\store_web
# after the API r4 session is merged, refresh the contract:
Copy-Item ..\StoreApi\openapi\v1.json docs\openapi\store-api.v1.json
git init -b main
git add .
git commit -m "Bootstrap: docs, design, OpenAPI, ta3lom-web reference kit"
git remote add origin https://github.com/lotfi029/ta3lom_store_web.git
git push -u origin main
```

### 3.4 Cloud environment

Use **[cloud/store-web-cloud-environment.md](cloud/store-web-cloud-environment.md)**. It contains:

- the environment variables to paste;
- the setup script `cloud/store-web-setup.sh`;
- the repositories, network and permissions settings.

It installs Node 24 from the npm registry and maps Playwright to the preinstalled Chromium, because `nodejs.org` and the Playwright CDN are blocked in the cloud container.

---

## 4. How the session works

| Rule | Detail |
|---|---|
| **No stopping** | It never ends its turn to report or ask. Its reports are commits, `PROGRESS.md` and `DECISIONS.md`. It finishes when §7 is complete |
| **Precedence** | scope-change r4 > 03 > 11 + OpenAPI > 10 (read with ADR-S09 and §2 of this plan) > prototype. Conflicts are logged in `DECISIONS.md` (`REVIEW` if money, auth or data) |
| **Do not redesign** | The prototype defines the look. Port its CSS onto the reference-kit tokens. A new semantic token is added to `tokens.css` only when no existing one fits, and only with a contrast check |
| **Git** | One branch per session (`feat/w-03-catalogue`), commits `W-03 — …`, one PR per session. Squash-merge when CI is green. If it can't merge, it stacks the next branch and continues |
| **Real API** | `scripts/api-up.sh` pulls `../ta3lom_store_api` (cloned by the setup script), applies the migration, seeds, and runs it on `:5080`. `scripts/api-seed-e2e.sh` creates test staff (one per role, via `create-admin`), publishes the sample catalogue through the admin API, and gives print stock. If the API repo isn't available, `scripts/stub-api.mjs` (built from the OpenAPI examples) serves the same routes, and that is logged |
| **Tests per session** | Each session closes its §3.1 DoD: unit tests for logic, Playwright for its journeys (real API; `page.route()` mocks only for states the API can't produce on demand), axe for its routes in ar/en × light/dark |
| **Blocked** | After 3 honest attempts: revert, mark it blocked in `PROGRESS.md`, continue with the next session whose dependencies are done, and retry at close-out |
| **Compaction** | Re-read `PROGRESS.md`, `DECISIONS.md` and §4 of this plan, then continue from `Next:` |
| **Never** | Dependencies outside §2.1 without a `DECISIONS.md` entry; `localStorage` for tokens; `bypassSecurityTrust*`; physical CSS properties; colour literals in components; raising budgets; giving UI; real secrets |

### 4.1 Definition of done (every session)

- [ ] `npm run typecheck`, `npm run lint` (ESLint + Stylelint + contrast) are clean.
- [ ] `npm test` is green.
- [ ] `npm run build` (both locales, prerender) passes the budgets (150 KB initial JS, 400 KB transfer), `check-csp` and `check-deploy-output`.
- [ ] `npm run e2e` is green for the session's journeys (real API).
- [ ] `npm run a11y` is clean on the session's routes: ar + en, light + dark.
- [ ] RTL first: checked in `/ar`, then `/en`. No horizontal scroll at 320 px. Keyboard operable with a visible focus ring. Tap targets ≥ 44 px.
- [ ] `SeoService.set()` on every new route; exactly one `<h1>`; `noindex` where §2.2 says so.
- [ ] Every string has an `i18n` id `@@store.<area>.<element>`. English XLF is filled (the prototype's English).
- [ ] Types come only from `store-api.types.ts` (no hand-written DTOs). `npm run types:check` passes.
- [ ] `PROGRESS.md` row updated (screens, endpoints used, tests added). `DECISIONS.md` gets every choice.

---

## 5. Sessions

| # | Session | Content | Depends on | Est (d) |
|---|---|---|---|---|
| **W-00** | Bootstrap and tooling | `ng new` (Angular 22.2, strict, zoneless, standalone, no SSR server: static output); `@angular/localize` with ar (source) and en, `/ar` `/en` base hrefs; port `tokens.css`, `base.css`, `fonts.css` + fonts and icons from the reference kit; ESLint (boundaries, RTL rule, bans), Stylelint, Prettier, contrast check; Vitest, Playwright, axe, Lighthouse CI config; budgets; scripts `check-csp`, `check-bundle-budget`, `check-deploy-output`, `postbuild`, `serve-dist`; `types:gen` / `types:check` (openapi-typescript); `scripts/api-up.sh`, `api-seed-e2e.sh`, `stub-api.mjs`; GitHub Actions CI (install, typecheck, lint, test, types:check, build against the stub API, e2e against the API started in CI from the API repo, or the stub if the token is missing, a11y); `CLAUDE.md` (ta3lom-web's adapted: subdomain, no `/store` prefix, r4, admin inside); `PROGRESS.md`, `DECISIONS.md` | — | 2.5 |
| **W-01** | Core | `STORE_API_URL`; generated types; `pick()`; Money + format; `StoreProblem` → messages (all 11 §1.6 r4 codes, ar/en); `SeoService` (canonical on `store.ta3lom.sa`, hreflang, OG, JSON-LD helper); `ThemeService`; i18n helpers; interceptors (credentials and bearer only for the store API origin, customer vs staff by path, 401 → single refresh → one retry); `StoreAuth` and `StaffAuth`; guards; `CartSummary`; `refresh-after-hydration` + `prerender-http-cache` | W-00 | 2.0 |
| **W-02** | Layout | Header (logo → `ta3lom.sa`, store nav Courses/Books, search box, cart badge with bump, account menu, sign-in, lang switch keeping the path, theme toggle), footer (association links, policies, contact), skip link, 404, toasts, loading states (`resource-state`) | W-01 | 1.0 |
| **W-03** | Catalogue | Home (hero, featured accordion, courses, books, categories); `/courses`, `/books` with category chips from the API, sort, pagination, query-string filters; search; product page: course body (curriculum, instructor, figures) and book body (formats, author, pages), live price and stock, share sheet, related products (`@defer on viewport`); JSON-LD `Course` / `Book` / `BreadcrumbList`; `routes.mjs` + `app.routes.server.ts` (prerender + client fallback); sitemap and robots generated at build | W-02 | 3.25 |
| **W-04** | Sign-in | `<ta-otp-sign-in>` (mobile `05…` → `+9665…`, Arabic-Indic digits normalised, code entry, resend with `retryAfterSeconds`, `attemptsLeft`, blocked account); `/login` page with return URL; logout and logout-all | W-01 | 0.75 |
| **W-05** | Cart | `CartStore` (optimistic, queued mutations, rollback, `lastProblem`, `cartNotices` after merge); buy boxes: course (enrol, owned → "Go to course"), book (format selector, print stepper 1–20, digital qty 1, stock state); add / buy now; sticky buy bar on mobile; cart page (one group, qty, remove, totals, shipping note, "price changed" banner) | W-03, W-04 | 1.5 |
| **W-06** | Checkout and thanks | 3 steps (details with inline OTP; shipping only with a print line: saved addresses or new National Address form; payment methods + terms), quote → place order with `Idempotency-Key`, price-changed flow, problem mapping per field; thanks page: polling schedule, terminal states, `cartRestored` → reload the cart, status-token mode, dev "Simulate payment" (§2.7), invoice summary | W-05 | 1.75 |
| **W-07** | Account | Shell with tabs; My courses (progress, launch #29, certificate #30); My books (download link #32 → `/downloads/{token}`, remaining count, shipments with tracking); Orders (list, detail, invoice PDF #37); Profile (name, email, locale, marketing consent), addresses CRUD + default, export JSON (#38), delete account with typed confirmation (#39), sign out everywhere | W-04 | 2.0 |
| **W-08** | Admin shell and platform | `/admin/login` (email + password → TOTP enrolment with QR, or verify); admin shell (side nav filtered by `can()`, disabled actions with reasons); staff list, create, edit roles, reset password/TOTP, unlock (#123–#128); settings editor typed per key (#118–#119); templates editor with preview and test send (#120–#122); audit log (#133) | W-01 | 2.0 |
| **W-09** | Admin catalogue | Products list, filters, create (course or book); course detail and curriculum editor (reorder); book detail and formats (print stock via movements, digital file upload, private); media library (upload with mandatory alt, MIME check, picker); categories; publish, archive and preview with the store components; freshness notice; type lock after the first order shown as read-only | W-08, W-03 | 2.0 |
| **W-10** | Admin operations | Dashboard (sales today/7/30 days, top products, low stock, alerts); orders (search, detail with lines, status history, documents, notifications; cancel with confirmation; resend documents); shipments queue (packing slip PDF, ship with carrier and tracking, deliver, return); stock (on hand, reserved, available, movements, restock/adjust with reason, low-stock threshold); download grant reset; customers (lookup by mobile, detail, block/unblock); reports (`sales-vat`, `shipments`, date range, CSV download with BOM) | W-08 | 3.5 |
| **W-11** | Hardening and release prep | Full Playwright journeys (§6) on the real API in ar and en; axe on every route in both themes; Lighthouse CI (LCP ≤ 2.0 s, INP ≤ 200 ms, CLS ≤ 0.05 on home, a course and a book); budget review; CSP and security headers template for Caddy (`deploy/caddy-headers.conf`, hash-only `script-src`, `connect-src` store API); `deploy/README.md` (static dist, `/` → `/ar/`, client fallbacks); delete `docs/reference/`; final report | all | 2.0 |
| | **Total** | | | **24.25** (+15 % contingency ≈ **28**) |

**Critical path:** W-00 → W-01 → W-02 → W-03 → W-05 → W-06 → W-11. W-04, W-07 and W-08 → W-10 run beside it. In a single session they run in the order of the table.

---

## 6. Test plan (built up per session, complete by W-11)

**Vitest:**

| Subject | Cases |
|---|---|
| Money | `times('350.00',5)='1750.00'`; `sum(['0.10','0.20'])='0.30'`; VAT display; never floating point (ESLint ban on `parseFloat` for money) |
| Format | `ar-SA-u-nu-latn` digits, SAR, Gregorian Riyadh dates, `<bdi>` for mobiles and references |
| ICU | lessons, copies and days for 0, 1, 2, 5, 11, 100, 103 (ar), and 1, 2 (en) |
| `StoreAuth` | single-flight refresh; a failed refresh clears the token; never writes to storage (spy) |
| Interceptors | credentials and bearer only for the store API; staff bearer for `/admin`, customer otherwise; 401 → refresh → one retry |
| `CartStore` | optimistic add, rollback on error, queued order, merge notices |
| Buy box | course qty 1; print 1–20; digital 1; owned course; out of stock |
| Checkout form | mobile normalisation; National Address `RRRD2929` valid, lower-case upper-cased, `RRR2929` invalid; address only with print; terms required |
| Thanks polling | 2 s × 60 s then 10 s; stops on terminal states; gives up at 10 min; bearer vs `?t=`; ignores the gateway `status` param |
| `StaffAuth.can()` | the r4 policy table; `admin` without `finance` can't cancel |
| SEO | every route calls `SeoService.set()`; canonical host `store.ta3lom.sa` |
| Dev trigger | `environment.prod.devPaymentTrigger === false` |

**Playwright (real API; mocks only where stated):**

| Journey | Checks |
|---|---|
| Buy a course | home → course → enrol → cart → checkout (OTP from `/dev/sms`) → place order → thanks "Awaiting payment" → Simulate payment → paid → My courses → launch |
| Buy books | print ×2 + digital → shipping step → National Address validation → shipping 25 SAR → paid → My books: download works (watermarked PDF), shipment "preparing" → admin ships → tracking shows |
| Guest cart merge | add as guest → sign in at checkout → cart kept, owned course dropped with a notice |
| Price changed | admin changes the price between quote and place → `checkout.price_changed` → summary updates → new Idempotency-Key |
| Out of stock | the last print copy bought in another session → line invalid in the quote |
| OTP limits | rate-limited (mock) shows the wait; wrong code shows attempts left; blocked customer message |
| Expired order | (mock status) `expired` + `cartRestored` → items back in the cart |
| Admin catalogue | store_manager creates and publishes a course and a book with media → visible in the storefront (client fallback) |
| Admin ops | fulfilment ships and delivers; finance cancels an unpaid order; viewer sees everything disabled; admin without finance sees Cancel disabled with its reason |
| Account | profile edit, address default, export downloads JSON, delete → signed out, sign-in creates a new empty account |
| RTL / keyboard / 320 px | every journey in `/ar` then `/en`; keyboard-only buy box and dialogs; no horizontal scroll |

**Accessibility:** axe on every route, ar and en, light and dark, including client states (cart with lines, each checkout step, each thanks state, account tabs, admin screens). Any violation fails the build.

---

## 7. Close-out (in W-11)

| Step | Content |
|---|---|
| C.1 Coverage | Each r4 web endpoint in §1 is used by a screen. Produce a table: endpoint → data service → screen → e2e test |
| C.2 Prototype check | Side-by-side screenshots (`scripts/screenshots.mjs`) of home, course, book, cart, checkout, thanks and account vs the prototype, ar and en, 1440 and 375 px, saved in `docs/screenshots/` |
| C.3 Report | `docs/W-report.md`: sessions and PRs; screens; endpoints; tests (unit, e2e, a11y) and Lighthouse numbers; bundle sizes; `DECISIONS.md` rows marked `REVIEW`; deviations from the prototype with reasons; known gaps (payments, hosting, ta3lom-web badge) |
| C.4 Finish | All PRs merged; CI green on `main`; `PROGRESS.md` all `done`. Then the final summary |

---

## 8. Prompts

> The ready-to-paste versions, with the pre-flight checklist and the resume, correction, single-session and review prompts, are in [store-web-prompts.md](store-web-prompts.md).

### 8.1 Start prompt

```text
You are building the ta3lom store web app (storefront + customer account + staff admin) in this repo,
lotfi029/ta3lom_store_web, in one session. Do not stop until docs/W-report.md is pushed and all PRs are merged.

READ FIRST: docs/store-web-plan.md (THIS RUN'S PLAN — it overrides everything else on how to work),
docs/adr/ADR-S09-store-web-separate-app.md, docs/scope-change-r4-no-giving.md (courses and books only — never
build giving UI), docs/10-frontend-angular.md (screens and behaviour; read "/store/…" as "/…"), docs/11-api-contract.md
§12 + docs/openapi/store-api.v1.json, docs/03-business-rules.md, docs/04-functional-requirements.md, docs/design/*.html
(approved look — do not redesign; strip giving per plan §2.6), docs/reference/ta3lom-web/CLAUDE.md (conventions and
non-negotiables to adopt). Precedence: scope-change r4 > 03 > 11/OpenAPI > 10 (+ADR-S09, plan §2) > prototype.

STEP 0: run the setup script if it did not run (docs/cloud/store-web-setup.sh; must end READY or READY-WITH-WARNINGS); check node 24, dotnet 10, PostgreSQL; the API is cloned at ../ta3lom_store_api
(if not accessible, log it in DECISIONS.md and use the stub API); start it per plan §4 (scripts come in W-00 —
start it by hand the first time). Create PROGRESS.md (template below). Go straight on.

ORDER, without stopping: W-00 → W-01 → W-02 → W-03 → W-04 → W-05 → W-06 → W-07 → W-08 → W-09 → W-10 → W-11
(plan §5). Angular 22.2.x (latest stable), Node 24 LTS, standalone, zoneless, signals, httpResource, Signal Forms,
@angular/localize ar+en, @angular/ssr static output (prerender public pages, client for the rest).

RULES (absolute):
1. Never end your turn to report, ask or wait. Reports = commits, PROGRESS.md, DECISIONS.md.
2. Each session ends with plan §4.1 ticked: typecheck, lint, tests, build within budgets, e2e for its
   journeys against the real API, axe in ar/en × light/dark, RTL first, 320 px, keyboard, SEO, i18n ids.
3. One branch + one PR per session ("W-03 — Catalogue"); squash-merge when CI is green, else stack and continue.
4. Types only from the generated store-api.types.ts. Money as strings, never floats. Tokens in signals, never storage.
   Logical CSS only, semantic tokens only, no bypassSecurityTrust*, no budget increases.
5. Dependencies only as in plan §2.1; anything else needs a DECISIONS.md entry with a reason.
6. Undecided or conflicting docs: choose by precedence, log in DECISIONS.md (REVIEW if money/auth/data), continue.
7. Blocked after 3 honest attempts: revert, mark blocked, continue with the next session whose dependencies are
   done, retry at the end. Context compacted: re-read PROGRESS.md, DECISIONS.md, plan §4; continue from "Next:".
LIMITS: no payment gateway code (dev "Simulate payment" only, off in production); no refunds/payment-review
screens; no deploy/VPS work; no secrets; no force-push; never edit the API repo.

PROGRESS.md template:
# Store web progress
Next: <W-nn — step>
| Session | Status (todo/doing/done/blocked) | PR | Screens | Endpoints # | Tests (unit/e2e/a11y) | Notes |
## Checklist
- [ ] W-00 … W-11 done
- [ ] Every r4 web endpoint of plan §1 used by a screen and covered by an e2e test
- [ ] axe clean on every route, ar/en, light/dark
- [ ] Budgets: initial JS <= 150 KB, page <= 400 KB; Lighthouse targets met
- [ ] Prototype screenshots compared (docs/screenshots)
- [ ] docs/W-report.md pushed; docs/reference/ removed

Start now with STEP 0.
```

### 8.2 Resume prompt

```text
Resume the ta3lom store web run. Check the environment (node 24, dotnet 10, PostgreSQL), start the store API with
scripts/api-up.sh (or the stub API if the API repo is not accessible), then read CLAUDE.md, docs/store-web-plan.md §4,
PROGRESS.md and DECISIONS.md on main (or the newest feat/w-* branch). Continue from the "Next:" line with the same
rules and limits as plan §8.1. Don't redo done sessions.
```

---

## 9. Your review after the session

1. `docs/W-report.md`, then every `DECISIONS.md` row marked `REVIEW`.
2. Open the screenshots in `docs/screenshots/` next to the prototype. Check Arabic first.
3. Read line by line:
   - `core/auth/*` and `core/http/*` (tokens, refresh, credentials scope);
   - `core/money/*`;
   - `features/store/checkout/*` (idempotency, price change);
   - the thanks polling;
   - `StaffAuth.can()` and the admin's disabled-action logic.
4. Locally, with the API running: `npm ci`, `npm start`, then click through a course and a print-book purchase in `/ar`.
5. Clone to `D:\Freelance\ELAMS\repos\Store\store_web` (it's already the remote of your bootstrap folder: `git pull`).

---

## 10. Follow-ups (not in this session)

| Item | Where | Est |
|---|---|---|
| **ta3lom-web integration:** "المتجر / Store" nav item → `https://store.ta3lom.sa/{locale}/`; footer links; header cart badge (`GET https://store-api.ta3lom.sa/v1/cart/summary`, credentials, after hydration only); CSP `connect-src` += store API | `ta3lom-web` | 0.75 |
| Angular 23 upgrade (`ng update`) once it is released and the ecosystem catches up | `store_web` | 0.5 |
| Hosting: Caddy site `store.ta3lom.sa` (static `dist`, headers from `deploy/caddy-headers.conf`), staging, nightly rebuild and rebuild on publish (`repository_dispatch` from the API's `CatalogChanged`) | VPS / both repos | 1.5 |
| Payment UI wiring when the payment service exists (redirect, retry #43, admin payment review and refunds #89–#92) | `store_web` | 1.5 |
