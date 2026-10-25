# 14: Store web, review + plan to sync with the R5 donations API

**Date:** 25 Oct 2026
**Web repo:** `lotfi029/ta3lom_store_web` @ `23583b9`. Angular SSR/prerender, built for the **old** API (courses and books, r4).
**API repo:** `lotfi029/ta3lom_store_api` @ `7b2e22e` (R5-Core, donations only).

**Inputs:**

- [15-api-contract-r5-core.md](15-api-contract-r5-core.md): the full HTTP contract, read from the API code (67 endpoints under `/v1`, DTOs, error codes).
- [donations-mvp-requirements.md](../requirements/donations-mvp-requirements.md): the target UI, modelled on dsenaiah.org.sa (§4 lists the screens).
- [01 BR](01-api-business-requirements.md) (D-01…D-14).

**Method:** I read the web code file by file; nothing was built here. The web CI was last run green on 25 Oct (r4 build).

---

## 1. Review of the current frontend

### 1.1 Verdict

**About half the code can be kept.** The platform layer is strong:

- SSR and prerender;
- CSP hashes;
- i18n and RTL, dark mode;
- accessibility tooling;
- bundle budgets;
- a stub API for CI;
- the e2e harness;
- donor OTP sign-in and staff password + TOTP;
- the cart store's mutation queue;
- halala-based money maths.

The **features are built for courses and books** and must be redone for donations.

| Area | Keep | Adapt | Delete |
|---|---|---|---|
| `core/*` | 24 | 16 | 2 (`pre-r4.ts`, `address.ts`) |
| `layout/` | 10 | 6 | 0 |
| `shared/ui` + `util` | 49 | 9 | 4 (`address-fields`, `cover`) |
| `features/store` | 6 | 30 | 5 (catalogue/search pages, `related-list`) |
| `features/account` | 0 | 14 | 4 (courses, books) |
| `features/admin` | 16 | 37 | 8 (shipments, stock, formats, product models) |
| **Total (`src/app`)** | **113** | **115** | **23** |

About 35 TypeScript files need real rewriting; the rest of the "adapt" files are templates and CSS that follow them. Outside `src/app`: about 15 scripts, all 10 e2e specs, CI, the environments and the locales (1,418 strings) need updating.

### 1.2 Blocking issues

| # | Issue | Why it blocks |
|---|---|---|
| B-1 | **No API types source.** The web generates `store-api.types.ts` from `docs/openapi/store-api.v1.json`, and `types:check` is the first CI gate. The API repo no longer commits OpenAPI; it serves `/openapi/v1.json` in Development only | Can't regenerate the types; CI can't check them |
| B-2 | **The lint step bans donations.** `scripts/check-no-giving.mjs` rejects `Donat*`, `Cause` and `/me/giving` | Every new file fails lint |
| B-3 | **No payment in R5-Core.** The thanks page and the e2e flow call `/dev/orders/{ref}/confirm-payment`, which no longer exists | Checkout → thanks never reaches a final state |
| B-4 | **No forced password change in the web.** New or reset staff get a `pwd_change` token that allows only `/admin/auth/password`, and `/admin/me` returns 403 | Newly created staff can't log in to admin |
| B-5 | **Prerender needs the live API.** `routes.mjs` reads `/catalog/products?fields=slug`; the new route is `/catalog/projects?fields=slug` | Build fails until the route and the stub fixtures change |

### 1.3 Known bugs still present (all confirmed)

| # | Where | Bug |
|---|---|---|
| W-1 | `features/store/checkout/checkout.data.ts:97` | The idempotency key is rotated on **any** 4xx, including 409 `idempotency.in_progress`, so a retry can create a second order |
| W-2 | `core/auth/store-auth.ts:76-80` | After a page reload the session token is restored but `/me` is never fetched, so the name and mobile are empty |
| W-3 | `core/cart/cart-store.ts:173, 217` | `refresh()` and `clear()` bypass the mutation queue, so an in-flight add can bring cleared lines back |
| W-4 | `features/store/thanks/thanks.data.ts:91-106` | Keeps polling for 10 min on 403/404 |
| W-5 | `buy-box.ts:53`, `cart.page.ts:75`, `cart-store.ts:37,56,158,198` | Hard-coded print max 20 and shipping fee 25.00. In r5 the limits come from `/catalog/config` |

### 1.4 API follow-ups found while mapping the contract (small API PR)

| # | API issue | Effect on the web |
|---|---|---|
| API-1 | `order.cancel_not_allowed` adds a problem extension named `status`, which duplicates the RFC numeric `status` | The JSON is ambiguous. Rename it `orderStatus` |
| API-2 | `GET /v1/orders/{ref}/status` and `/v1/me/donations/{ref}` match the reference **case-sensitively** (the admin routes don't) | Links typed in lower case give 404. Upper-case it |
| API-3 | `PUT /admin/projects/{id}/options` with `options: null`, or an option with `labelAr: null`, likely returns 500 | Validator `CascadeMode.Stop` + null checks |
| API-4 | Production CORS also allows `store-staging.ta3lom.sa` | Production should list only `store.ta3lom.sa` |
| API-5 | `CartSummaryResponse.totalAmount` uses the stored amounts, while `CartResponse` re-prices | Header badge total ≠ cart total. Re-price the summary, or document it |
| API-6 | Validation messages (`errors{}`) are English only | The web must map field errors through its own i18n (already does through `problem-message.ts`) |
| API-7 | No published OpenAPI artifact (B-1) | Add a CI step to the **API** repo that runs the API in Development, saves `/openapi/v1.json` as a **build artifact** (not committed, so the repo stays code-only), and fails if the generation fails |

---

## 2. Decisions to take before the web session

| # | Decision | Recommendation |
|---|---|---|
| D-W1 | **Types source (B-1)** | The web repo keeps a **snapshot**, `docs/openapi/store-api.v1.json` (the web repo isn't code-only). A new script, `npm run api:openapi`, starts the local API (`api-up.sh`, Development), downloads `/openapi/v1.json`, sorts its keys and writes the snapshot; then `types:gen`. CI keeps `types:check` against the snapshot. Once API-7 exists, a second CI job compares the snapshot with the API's latest artifact and warns on drift |
| D-W2 | **Checkout without payment (B-3)** | Add the flag `environment.paymentsEnabled = false`. Checkout creates the `pending_payment` order, and the thanks page shows **"تم تسجيل تبرعك — الدفع الإلكتروني قريبًا"** with the reference and the amount, then stops polling. In R5-Payments, set the flag to true and add the redirect. **Production must not launch with the flag off** |
| D-W3 | **URLs** | Home `/{ar|en}/` = listing (hero + quick donate + categories + grid); project page `/{locale}/p/{slug}`; category filter `/{locale}/?category={slug}` (no prerendered category pages in the MVP); `/cart`, `/checkout`, `/orders/{ref}?t=`, `/account/{donations,profile}`, `/admin/**` |
| D-W4 | **Old r4 routes** (`/courses`, `/books`, `/search`) | Drop them. Nothing is live, so no redirects are needed |
| D-W5 | **Card design** | Follow the reference card: image + share bar, title, summary, option chips → qty stepper, open-amount field, **اضافة** / **تبرع**. No progress bar |

---

## 3. Implementation plan (one web session, ≈ 11–12 dev-days of agent work)

Rules for every session: one branch and one PR. Gates after every commit:

- `types:check`
- `typecheck`
- `lint` (ESLint, Stylelint, contrast, i18n)
- unit tests
- `build:ci` against the stub
- `@smoke` e2e
- a11y

Commit as `W-Mn — …` and push. The PR isn't merged by the session.

### W-M0: Foundation and clean-up (≈ 2 d)

1. **Types (D-W1):**
   - add `scripts/api-openapi.mjs` and a fresh snapshot from API `7b2e22e`;
   - `types:gen`;
   - rewrite `core/api/api.types.ts` with r5 aliases: `Category`, `ProjectCard`, `ProjectDetail`, `ProjectOption`, `CartLine` (a project-option, project-amount or category-amount target), `CartResponse`, `CheckoutResponse`, `OrderStatus`, `DonationSummary/Detail`, `Me`, admin DTOs;
   - delete `pre-r4.ts`.
2. **Lint guard (B-2):** delete `check-no-giving.mjs` and add `check-no-commerce.mjs`, which bans `course|book|shipping|stock|enrol` in `src/`.
3. **Delete** the course/book/fulfilment code: catalogue and search pages, `related-list`, `cover`, `address*`, account courses and books, admin shipments, stock, formats, `product-models`, `labels`, the download and LMS code, `devPaymentTrigger`.
4. **Fix the known bugs:**
   - **W-1:** keep the key on 409 `idempotency.in_progress` and on 429; rotate only after a definite outcome.
   - **W-2:** `ensureSession` and `refresh` load `/v1/me`.
   - **W-3:** `clear` and `refresh` go through the queue.
   - **W-4:** stop polling on 4xx.
   - **W-5:** limits come from `/catalog/config`.
5. **Config:** `core/api/store-config.ts` reads `/v1/catalog/config` (`minGiftAmount`, `maxLineAmount`, `cartMaxLines`, `cartMaxTotal`, `amountPresets`) and caches it with SSR transfer state.
6. **Problem messages:** map every r5 error code in `problem-message.ts` (contract §4), ar and en.
7. **Stub API:** capture r5 fixtures (`stub-capture.mjs` against the local API seeded with the Development catalogue) and update `stub-api.mjs` routes.
8. **Prerender (B-5):** `routes.mjs` reads `/catalog/projects?fields=slug`, plus the static `/`. Update `app.routes.server.ts`.
9. **i18n:** purge the course/book strings and run `i18n-merge --check`.

**Gate:** green build and CI with the screens still stubbed.

### W-M1: Listing, home and project card (≈ 2 d)

- Home and listing: hero, **quick-donate** button, category chips (from `/catalog/categories`), search box, sort (`featured|newest|title`), grid with paging (`/catalog/projects?q&category&sort&page&pageSize`), empty and error states. The category filter lives in the URL.
- **Project card (D-W5):**
  - image with lazy load and a fixed ratio;
  - share bar (WhatsApp, X, Facebook, copy link, native share);
  - title linking to `/p/{slug}` and the summary;
  - **option chips**, where picking one shows a **qty stepper** (1–999);
  - an **"تبرع مفتوح"** chip showing the **amount field** (presets from the config, minimum from the project or config);
  - **اضافة** (add to cart, toast plus header badge) and **تبرع** (add, then go to checkout).
- Card states:
  - a project with no options shows only the amount field;
  - a project with options and `allowOpenAmount = false` shows only the chips.
- Shared components (new):
  - `amount-input`: accepts Arabic digits, normalises them to Western digits on blur, and validates against the min and max;
  - `option-picker`;
  - `qty-stepper`.
- SEO: title and description per locale, `hreflang`; the home JSON-LD is `NGO` + `ItemList`.

### W-M2: Project page (≈ 1.5 d)

- `/p/{slug}`: `ProjectDetail` (cover, title, summary, **Markdown story** rendered with a safe renderer: an allow-list, no raw HTML), the same buy box as the card but larger, and the share sheet.
- A `redirectTo` response navigates to the new slug, replacing the history entry.
- A 404 shows the not-found page (noindex).
- JSON-LD `DonateAction` + `BreadcrumbList`.
- Prerendered at build time; the price and the options are refreshed after hydration.

### W-M3: Quick donate, cart, checkout, thanks (≈ 2 d)

- **Quick-donate modal** (header button and floating side button): category select (active categories that accept general gifts), amount (presets + custom), then **تبرع الآن** → `POST /cart/lines {categoryId, amount}` → checkout.
- **Cart page:**
  - lines of three kinds: option × qty (stepper), project amount (editable), category amount (editable);
  - per-line `problems[]` shown inline with a fix action;
  - the limit errors (`cart.too_many_lines`, `cart.total_exceeded`, `amount_below_minimum`…) with the values from the response;
  - remove line, clear cart.

  Uses the cart store with its mutation queue (now fixed).
- **Checkout:**
  1. OTP sign-in inline, reusing `otp-sign-in`. The guest cart is merged, and `cartNotices` are shown.
  2. Name and email, prefilled from `/me`.
  3. Summary from `/checkout/quote`.
  4. Submit `POST /checkout` with the **Idempotency-Key** kept across retries.
  5. Handle 409 in progress (retry), 422 `lines_invalid` (back to the cart with problems) and 409 `cart_empty`.
- **Thanks / order status** (`/orders/{ref}?t=`): `GET /v1/orders/{ref}/status`. With `paymentsEnabled = false`, show the "registered, payment coming soon" state and don't poll (D-W2). With the flag on (later), poll until a final state.

### W-M4: Donor account (≈ 1 d)

- `/account/donations`: paged list (`/me/donations`) and a detail page (`/me/donations/{ref}`) with the lines and status. Receipts come in R5-Payments.
- `/account/profile`: `PATCH /me` (name, email, locale, marketing opt-in), **export** (`/me/export`, download as JSON), **delete account** (typed confirmation, then `DELETE /me`, sign out, and the cart is cleared), and sign out everywhere (refresh first, then `logout-all`).
- The account menu shows the name and mobile (W-2 fixed).

### W-M5: Admin (≈ 2.5 d)

- **Auth (B-4):**
  - login → TOTP enrol/verify (keep);
  - **new change-password page**: when the token carries `pwd_change` or the API returns 403 `auth.password_change_required`, route to `/admin/password` (old + new, ≥ 12 characters, server errors mapped);
  - once the password is changed, use the new tokens.
- **Shell and nav:** roles `admin`, `store_manager`, `finance`, `viewer` (remove `fulfilment`). Update `core/auth/policies.ts` from the contract's policy table.
- **Dashboard:** counts and pending amounts (`/admin/dashboard`).
- **Categories:** list with drag reorder (`reorder-list`), create and edit (bilingual name and description, image picker, `acceptsGeneralGifts`, active), `version` → 409 conflict dialog.
- **Projects:**
  - list (filters: status, category, q; paged);
  - **editor:** general fields, cover picker, SEO, `allowOpenAmount`, `minAmount`, badge, sort;
  - **options editor** (`PUT /options`): add, rename, reorder, deactivate, with deferred unique labels so swaps work;
  - publish with the 422 `missing[]` list, archive and republish, preview;
  - **unsaved-changes guard**: dirty state per section and `canDeactivate`.
- **Media library:** images only (jpeg/png/webp ≤ 10 MB), alt text ar/en.
- **Donors:** search, detail, block/unblock.
- **Orders:** search (reference, mobile, status, date), detail, **cancel pending**.
- **Settings:** a typed form for the r5 keys (`min_gift_amount`, `max_line_amount`, `cart_max_lines`, `cart_max_total`, `payment_window_minutes`, `amount_presets`, `site_name_*`, `support_mobile`) with cross-key errors.
- **Templates:** edit with the Scriban syntax error shown; test send, with 429 handled.
- **Audit:** list with filters.
- **Staff:** list, create (shows the one-time password once), edit roles and active (last-admin error shown), reset password/TOTP, unlock.

### W-M6: Hardening and close-out (≈ 1.5 d)

- **e2e (ar/en, against the real local API + `api:seed`):**
  - option gift with qty;
  - open-amount gift;
  - category gift via quick donate;
  - a cart with 3 lines → checkout → pending-order page;
  - an old-slug redirect;
  - delete account;
  - **admin:** create a category and a project with options → publish → visible publicly; staff created → forced password change → TOTP enrol.

  Tag the key journeys `@smoke` for CI (stub).
- **a11y:** add the new routes to `a11y-client-routes.txt`; axe ar/en × light/dark.
- **CI:** keep the order `types:check → typecheck → lint → test → build:ci → smoke → a11y`. Add `build:prod` as a dry run against the stub.
- **CSP hashes:** recompute and verify with `check-csp`. Bundle budget: initial JS ≤ 150 KB gzip.
- **Docs in the web repo:** update `docs/` (screenshots, `W-report`) and `PROGRESS.md`.

---

## 4. Order with the API work

```
API small PR (API-1…API-7)  ─┐
                             ├─► W-M0 (types snapshot from the fixed API) ─► W-M1 … W-M6 ─► staging (hosting) ─► R5-Payments (API + web flag on)
Review-12 API fix PR merged ─┘
```

W-M0 can start on `7b2e22e`. Refresh the snapshot again when the API follow-up PR merges (the `api:openapi` script makes that one command).

---

## 5. Session prompt (web)

```text
You are migrating the ta3lom store web (Angular, repo lotfi029/ta3lom_store_web, main 23583b9) from the old
courses/books API to the NEW donations-only API (lotfi029/ta3lom_store_api main, R5-Core). Work autonomously in ONE
session, one branch, one PR "Store web — R5 donations", do not merge. Read CLAUDE.md, PROGRESS.md and DECISIONS.md.
The API contract is attached at .session/15-api-contract-r5-core.md and the plan at .session/14-web-sync-plan.md
(copied in by the owner); the plan's decisions D-W1…D-W5 are approved. Follow phases W-M0…W-M6 in order.

Rules: keep the platform (SSR/prerender, CSP hashes, i18n/RTL, theme, a11y tooling, budgets, stub API, e2e harness,
OTP and staff TOTP flows, cart mutation queue, halala money); delete course/book/fulfilment code; fix W-1…W-5 in W-M0;
money is always a string on the wire and halalas in memory; accept Arabic digits in inputs and normalise; never
hard-code limits (read /v1/catalog/config); keep the Idempotency-Key across retries (rotate only after a definite
outcome); paymentsEnabled=false → pending-order end state, no polling.
Types: implement scripts/api-openapi.mjs (start the local API in Development via scripts/api-up.sh, fetch
/openapi/v1.json, sort keys, write docs/openapi/store-api.v1.json), then types:gen; CI keeps types:check.
Replace scripts/check-no-giving.mjs with check-no-commerce.mjs (ban course|book|shipping|stock|enrol in src/).
Gates after every commit: types:check, typecheck, lint, unit tests, build:ci on the stub (with r5 fixtures), @smoke
e2e, a11y; commit "W-Mn — …", push; open the PR as draft after the first commit. Record decisions not covered by the
plan in DECISIONS.md marked REVIEW. At the end: update PROGRESS.md and docs, CI green on the PR head, mark ready.
If an API behaviour blocks you (see plan §1.4 API-1…API-7), work around it in the client, record it, and list it in
the PR description for the API team.
```

## 6. Owner checklist

1. Approve D-W1…D-W5, or change them.
2. Merge the review-12 API fix PR, then optionally run the small **API follow-up PR** (API-1…API-7).
3. Copy **14** and **15** into the web repo branch `.session/`, then start the web session with §5.
4. Send me the session's plan before it starts coding, as before.
