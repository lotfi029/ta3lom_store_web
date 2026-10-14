# Store web — build report (W-00 … W-11)

The ta3lom store web app (storefront, customer account, staff admin) built in one run against the real store API,
following [store-web-plan.md](store-web-plan.md) with the owner's nine revisions. Static Angular 22.2 output for
`https://store.ta3lom.sa`, Arabic first, `/ar` and `/en`.

## 1. Sessions and pull requests

| Session | PR | Delivered |
|---|---|---|
| W-00 Bootstrap and tooling | [#1](https://github.com/lotfi029/ta3lom_store_web/pull/1) | Angular 22.2 (zoneless, standalone, static SSR output), `@angular/localize` ar/en, kit tokens/fonts, ESLint boundaries and bans, Stylelint, contrast gate, Vitest, Playwright + axe, LHCI config, budgets, CSP/deploy/budget gates, types from the OpenAPI, API scripts, stub API, CI |
| W-01 Core | [#2](https://github.com/lotfi029/ta3lom_store_web/pull/2) | Money (halalas), problem → message (71 r4 codes), SEO, theme, i18n, `StoreAuth`/`StaffAuth`, store-API interceptor, guards, `CartSummary` |
| W-02 Layout | [#3](https://github.com/lotfi029/ta3lom_store_web/pull/3) | Header (nav, search, cart badge, account menu, language, theme), footer, skip link, 404, toast, resource state |
| W-03 Catalogue | [#4](https://github.com/lotfi029/ta3lom_store_web/pull/4) | Home, courses, books, search, product pages (course, book), JSON-LD, share, related; 26 prerendered pages |
| W-04 Sign-in | [#5](https://github.com/lotfi029/ta3lom_store_web/pull/5) | `<ta-otp-sign-in>`, `/login`, sign out, sign out everywhere |
| W-05 Cart | [#6](https://github.com/lotfi029/ta3lom_store_web/pull/6) | `CartStore` (optimistic, queued, rollback), buy boxes, sticky bar, cart page, price-changed via quote |
| W-06 Checkout and thanks | [#7](https://github.com/lotfi029/ta3lom_store_web/pull/7) | Checkout (inline OTP, National Address, quote, Idempotency-Key, price change), thanks polling, dev "Simulate payment" |
| W-07 Account | [#8](https://github.com/lotfi029/ta3lom_store_web/pull/8) | Courses (launch, certificate), books (downloads, shipments), orders + invoices, profile, addresses, export, delete |
| W-08 Admin shell and platform | [#9](https://github.com/lotfi029/ta3lom_store_web/pull/9) | Staff login + TOTP, shell, team, settings, templates, audit log |
| W-09 Admin catalogue | [#10](https://github.com/lotfi029/ta3lom_store_web/pull/10) | Products, editor (course/book, curriculum, formats, stock movements, publish/archive, preview), categories, media |
| W-10 Admin operations | [#11](https://github.com/lotfi029/ta3lom_store_web/pull/11) | Dashboard, orders (cancel, resend, download reset), shipments, stock, customers, reports |
| W-11 Hardening and release prep | [#12](https://github.com/lotfi029/ta3lom_store_web/pull/12) | Lighthouse (CLS fix), coverage, screenshots, deploy README, `docs/reference/` removed, this report |

## 2. Screens

| Area | Routes |
|---|---|
| Storefront (prerendered) | `/{ar,en}/`, `/courses`, `/books`, `/p/:slug` (+ client fallback for new products) |
| Storefront (client) | `/search`, `/cart`, `/checkout`, `/orders/:ref/thanks`, `/login`, 404 |
| Account (client, signed in) | `/account/courses`, `/books`, `/orders`, `/orders/:ref`, `/profile` |
| Admin (client, staff) | `/admin/login`, `/admin` (dashboard), `/orders`, `/orders/:ref`, `/shipments`, `/stock`, `/customers`, `/reports`, `/products`, `/products/:id` (and `new`), `/categories`, `/media`, `/staff`, `/settings`, `/templates`, `/audit` |

## 3. Endpoint coverage (C.1)

Every r4 web endpoint of plan §1 is used by a screen. Data services are the `*.data.ts` files (plus the core auth and
cart services); e2e specs are in `e2e/`.

| # | Endpoint | Data service | Screen | e2e |
|---|---|---|---|---|
| 1 | `GET /catalog/home` | `store/home/home.data.ts` | Home | catalogue, bootstrap |
| 2 | `GET /catalog/categories` | `home.data`, `catalog.data` | Home chips, catalogue chips | catalogue |
| 3 | `GET /catalog/products` | `catalog.data`, `product.data` (related) | Courses, books, search, related | catalogue |
| 4 | `GET /catalog/products/{slug}` | `product.data` | Product page | catalogue, cart, checkout |
| 5 | `GET /catalog/live` | `home.data`, `catalog.data`, `product.data` | Live price and stock on cards and buy box | catalogue, cart (out of stock) |
| 9 | `GET /catalog/config` | `core/api/store-config` | Buy box limits, payment methods, VAT label | cart, checkout |
| 10 | `GET /cart` | `core/cart/cart-store` | Cart, checkout | cart |
| 11 | `GET /cart/summary` | `core/cart/cart-summary` | Header badge | layout, cart |
| 12 | `POST /cart/lines` | `cart-store` | Buy box add / buy now | cart |
| 13 | `PATCH /cart/lines/{id}` | `cart-store` | Cart quantity stepper | cart |
| 14 | `DELETE /cart/lines/{id}` | `cart-store` | Cart remove | cart |
| 15 | `DELETE /cart` | `cart-store` | Cart "Empty the cart" | cart |
| 16 | `POST /auth/otp/request` | `core/auth/store-auth` | `<ta-otp-sign-in>` (login, checkout) | sign-in, checkout |
| 17 | `POST /auth/otp/verify` | `store-auth` | `<ta-otp-sign-in>` | sign-in, checkout |
| 18 | `POST /auth/refresh` | `store-auth` | Session restore (guards, header) | sign-in |
| 19 | `POST /auth/logout` | `store-auth` | Account menu | sign-in |
| 20 | `POST /auth/logout-all` | `store-auth` | Account menu, profile | sign-in, account |
| 21–22 | `GET/PATCH /me` | `account/account.data`, `checkout.data` | Profile; checkout prefill | account, checkout |
| 23–27 | `/me/addresses` (list, add, edit, delete, default) | `account.data`, `checkout.data` | Address book; checkout saved addresses | account, checkout |
| 28 | `GET /me/enrolments` | `account.data`, `product.data` | My courses; "Go to course" on owned courses | account, cart |
| 29 | `POST /me/enrolments/{id}/launch` | `account.data` | My courses Start/Resume | account |
| 30 | `GET /me/enrolments/{id}/certificate` | — (link to its redirect target) | My courses "Certificate" | — (no completed enrolment in dev data) |
| 31 | `GET /me/books` | `account.data` | My books | account |
| 32 | `POST /me/downloads/{grantId}/link` | `account.data` | My books "Download" | account |
| 35–36 | `GET /me/orders`, `/me/orders/{ref}` | `account.data` | Orders, order detail | account |
| 37 | `GET /me/documents/{number}` | `account.data` | Invoice PDF | account |
| 38 | `GET /me/export` | `account.data` | Profile "Export my data" | account |
| 39 | `DELETE /me` | `account.data` | Profile "Delete my account" | account |
| 40 | `POST /checkout/quote` | `checkout.data`, `cart-store` | Checkout summary; cart price-changed | checkout, cart |
| 41 | `POST /checkout` | `checkout.data` | Checkout pay | checkout |
| 42 | `GET /orders/{ref}/status` | `thanks/thanks.data` | Thanks (polling) | checkout |
| 46 | `GET /downloads/{token}` | browser navigation | My books download | account |
| 47–51 | `/admin/auth/*` | `core/auth/staff-auth` | Admin login (enrol, verify), refresh, sign out | admin-platform |
| 52 | `GET /admin/me` | `staff-auth.refreshMe` | Admin shell (roles) | admin-platform |
| 53 | `GET /admin/dashboard` | `admin/ops/ops.data` | Dashboard | admin-ops |
| 54–62 | Products, course, modules, book, formats | `admin/catalog/catalog-admin.data` | Products list, product editor | admin-catalogue |
| 64–66 | Publish, archive, preview | `catalog-admin.data` | Product editor | admin-catalogue |
| 72–74 | Categories | `catalog-admin.data` | Categories | admin-catalogue |
| 75–77 | Media | `catalog-admin.data` | Media library, cover picker, book file upload | admin-catalogue |
| 78–80 | Stock, movements | `catalog-admin.data`, `ops.data` | Stock; product editor (print) | admin-ops, admin-catalogue |
| 85–86 | Orders, order | `ops.data` | Orders, order detail | admin-ops |
| 87 | Cancel | `ops.data` | Order detail | admin-ops |
| 88 | Resend documents | `ops.data` | Order detail | — (dialog; covered by axe in admin-ops, no assertion on delivery) |
| 94 | Download grant reset | `ops.data` | Order detail | admin-ops |
| 95–99 | Shipments, packing slip, ship, deliver, return | `ops.data` | Shipments | admin-ops (return not exercised) |
| 117 | Reports | `ops.data` | Reports (sales, VAT, shipments; CSV) | admin-ops |
| 118–119 | Settings | `admin/platform.data` | Settings | admin-platform |
| 120–122 | Templates, test send | `platform.data` | Templates | admin-platform |
| 123–128 | Staff (list, create, edit, reset password/TOTP, unlock) | `platform.data` | Team | admin-platform |
| 129–132 | Customers, block, unblock | `ops.data` | Customers | admin-ops |
| 133 | Audit | `platform.data` | Audit log | admin-platform |

Dev only: `POST /dev/orders/{ref}/confirm-payment` (thanks "Simulate payment", off in production) and `/dev/sms`
(e2e OTP codes).

## 4. Tests and quality

| Check | Result |
|---|---|
| Unit (Vitest) | **197** tests in 31 files — money, formats, auth (single-flight refresh, no storage), interceptors, guards, cart store, buy box, checkout form and idempotency, thanks polling, account data, admin helpers, SEO on every page, production `devPaymentTrigger === false` |
| e2e (Playwright, real API, ar + en) | **120** tests in 10 specs — bootstrap, layout, catalogue, sign-in, cart, checkout, account, admin platform, admin catalogue, admin operations |
| Accessibility | axe in every e2e journey state (both themes where it matters) + `npm run a11y`: **36 routes × light/dark, 0 violations** |
| Lighthouse (desktop, 3 runs, built output) | home LCP 0.82–0.92 s · CLS 0 · TBT ≤ 13 ms · perf 0.98–0.99; course LCP 0.89–0.91 s · CLS 0 · TBT ≤ 13 ms · perf 0.98; book LCP 0.90 s · CLS 0 · TBT 0 · perf 0.98; accessibility 100 on all |
| Budgets (gzip) | initial JS **127.8 KB** (ar) / 126.1 KB (en) of 150 KB; initial transfer 134.7 / 133.0 KB of 400 KB — never raised |
| Gates on every build | CSP hash-only (1 inline script), deploy output, budgets; lint = ESLint (boundaries, bans) + Stylelint (logical CSS, tokens) + contrast (100 pairs, light + dark) + no-giving + i18n (709 ids, all translated) |

INP has no lab value; TBT (the lab proxy) is asserted instead.

## 5. Decisions to review

All choices are in [DECISIONS.md](../DECISIONS.md). These touch money, auth or personal data (`REVIEW`):

| Session | Topic | Choice |
|---|---|---|
| STEP 0 | Pre-r4 API | Endpoints mapped by path from 11 §12 (r4 list); shapes from the pre-r4 OpenAPI; giving fields the API requires get neutral values from `core/api/pre-r4.ts` only |
| W-01 / W-10 | Cancel policy | `staff:finance` = admin + finance (11 §1.2, as the API enforces); the plan's "admin without finance can't cancel" is shown with `store_manager` instead |
| W-01 | Auth transport | Auth endpoints via `HttpBackend` with credentials; credentials + bearer only for `STORE_API_URL/…` |
| W-01 | Session restore | One silent refresh per page view; never during prerender |
| W-01 | Money display | `Intl.NumberFormat` on the decimal string, Western digits, `ر.س` / `SAR` |
| W-04 | Return URL | Same-site paths only |
| W-05 | Pre-r4 add-to-cart body | Neutral `kind/mode/amount/intent/dedication` |
| W-05 | Price changed in the cart | Cart asks for a quote and shows moved prices before checkout |
| W-06 | Idempotency-Key / expected total | Key kept on network/5xx, new after 4xx; `expectedGrandTotal` from the latest quote |
| W-06 | `isAnonymous` | Always `false` (pre-r4 field) |
| W-06 | Thanks hand-off | `/orders/{ref}/thanks?t=…`; only `t` is read (RUL-33) |
| W-07 | Invoices and export | Fetched with the bearer as blobs |
| W-07 | Delete account | Typed confirmation, then `DELETE /me {confirm:true}` |
| W-08 | TOTP without QR | Setup key + `otpauth` URI as text — a QR needs a new dependency (owner's call) |
| W-08 | One-time passwords | Shown once, not dismissible by backdrop, cleared on close |
| W-10 | Download grant reset | Staff type the grant id (no admin endpoint lists grants) |
| W-11 | Hydration transfer cache | Public GETs replayed at hydration (`includeRequestsWithCredentials`), then reloaded |

## 6. Pre-r4 deviations

The API in this run is the **pre-r4** build (its `main`, ec3365b, still serves the giving endpoints; its OpenAPI is
byte-identical to `docs/openapi/store-api.v1.json`, so W-11 had nothing to regenerate). Where the web had to bend:

| Where | Pre-r4 API | What the web does | When r4 lands |
|---|---|---|---|
| `POST /cart/lines` | requires `kind`, `mode`, `amount`, `intent`, `dedication` | sends the neutral purchase values from `core/api/pre-r4.ts` | drop `PURCHASE_LINE`'s extra fields after `types:gen` |
| Cart DTO | `purchases` + `gifts` groups, gift totals | shows `purchases` only | — |
| `POST /checkout` | requires `isAnonymous` | sends `false` | drop the field |
| Order status / detail DTOs | gift lines, dedications, receipts | lists purchase lines and invoices/credit notes only | — |
| `GET /catalog/config` | gift presets, dedication templates | ignored | — |
| Admin products | may list cause products | filtered out; type selector course/book | — |
| Admin settings / templates | giving keys | r4 allowlists | — |
| Admin dashboard | gifts, campaigns, allocation | not shown; only `outbox.dead` / `integrity.failed` alerts | — |
| Admin orders | mixed kinds | search sends `kind=buy` | — |
| Seed data | cause products published | the e2e seed archives them | — |

Nothing imports a giving type: `scripts/check-no-giving.mjs` fails the lint on giving types, routes or wording, and
only `core/api/pre-r4.ts` may name the neutral fields.

## 7. Deviations from the prototype

Screenshots: [`docs/screenshots/`](screenshots/) — `app-*` (this build) next to `proto-*` (the approved prototype) for
home, course, book, cart, checkout, thanks and account, ar/en, 1440/375 px (`npm run screenshots`).

| Screen | Deviation | Why |
|---|---|---|
| Everywhere | No giving: no "Sponsor a seat", donate CTA, causes, dedications, "My giving", zakat, campaign bars | Scope change r4 |
| Header | Search field in the header; sign-in as an icon below 600 px | Plan W-02; 320 px without overflow |
| Home | Hero copy without giving; no causes/impact blocks | r4 |
| Cards | Category + summary instead of lessons/hours/learners (course) and author (book) | The card DTO has no counts or author |
| Covers | Tinted tile with the course/book glyph when a product has no cover | The seed has no covers; prototype SVG art not ported |
| Course buy box | No "7-day refund" line | Refunds belong to the payment service |
| Checkout | One page with sections (identity → details → shipping if print → payment + terms); free-text city; mada / Apple Pay / Visa-Mastercard / STC Pay only (no Tabby, SADAD) | Prototype form; no city list in the API; 10 §7.1 |
| Thanks | "Awaiting payment" first, then paid after the (dev) payment confirmation | No gateway yet |
| Account | Tabs: courses, books, orders, profile (no giving); side menu becomes a scrolling row on mobile | r4; 10 §10 |
| Admin | Not in the prototype; built from the kit's admin components and tokens | — |

## 8. Known gaps and follow-ups

| Gap | Status / owner |
|---|---|
| Payments | No gateway code. Checkout ends at "Awaiting payment"; `redirectUrl` is followed when the payment service provides it. Retry payment (#43), payment review and refunds (#89–#92) are not built (plan §10) |
| Hosting | Static `dist/` + [deploy/README.md](../deploy/README.md) + `deploy/caddy-headers.conf`; no VPS/DNS/Caddy work was done |
| ta3lom-web integration | Nav item, footer links and cart badge in the main site — separate change in `ta3lom-web` (plan §10) |
| API: r4 | When the r4 API merges: refresh the OpenAPI, `npm run types:gen`, remove `core/api/pre-r4.ts` fields, re-run the suite |
| API: CORS for `/dev` | The dev "Simulate payment" uses a body-less `no-cors` request because `/dev/*` has no CORS policy |
| API: download grants for staff | No admin endpoint lists an order's grants; suggested: include them in `AdminOrderDetail` |
| API: dev URLs | Local runs need `Store__PublicBaseUrl=http://localhost:5080` (set in `scripts/dev-env.sh`) |
| TOTP QR | Needs a small dependency (e.g. `qrcode-generator`, MIT) — owner to approve |
| Certificate | Linked to `{mainSiteUrl}/{locale}/store/certificates/{no}` (the #30 redirect target); not exercised in e2e (no completed enrolment in dev data) |
| Shipment return, resend documents | Built and axe-checked; no e2e assertion on their outcome |

## 9. How to run

```bash
. scripts/dev-env.sh && npm run api:up && npm run api:seed
npm run types:check && npm run typecheck && npm run lint && npm test
npm run build && npm run e2e && npm run a11y
CHROME_PATH=/opt/pw-browsers/chromium npm run lhci
npm run screenshots
```
