# Store Admin Redesign — Implementation Plan (store_web)

**Date:** 2026-11-16
**Repo:** `D:\Freelance\ELAMS\repos\Store\store_web` → `lotfi029/ta3lom_store_web`
**API:** `D:\Freelance\ELAMS\repos\Store\store_api` → `lotfi029/ta3lom_store_api`. **No API change in this plan.**
**Read §13 first:** what the code check (W-A0) changed in this plan.
**Design:** `docs/admin-redesign/02-store-admin-design-spec.md` + `docs/admin-redesign/mockups/*.html` (exported from the canvas)
**Scope:** only the staff admin (`src/app/features/admin/**`). Storefront, account, checkout and payments are untouched.

---

## 0. Rules for this work

1. **Everything in `store_web/CLAUDE.md` still applies.** In particular:
   - logical CSS
   - Arabic first
   - `pick()`
   - `SeoService.set()` with noindex on admin
   - one `h1`
   - alt from the API
   - 44px targets
   - reduced motion
   - tokens in signals
   - budgets
   - no `bypassSecurityTrust*`
   - semantic `--c-*` tokens only
   - generated types only
   - money as decimal strings with `<ta-money>`, no `parseFloat`
   - **R5 donations only**: `check-no-commerce` forbids `course|book|shipping|stock|enrol|giving` anywhere in `src/`, so don't name icons, classes or ids with these words
   - **payments off**: the flag is `StoreConfig.paymentsEnabled()` (`GET /v1/catalog/config`), not `environment` (§13); no gateway code
2. **The redesign is approved.** `CLAUDE.md` gains one line (Phase A0) saying the admin follows `docs/admin-redesign/`; the storefront look is unchanged.
3. **Behaviour parity.** Every current admin capability stays, with the same API calls (list in §8). This is a re-layout, not a rewrite: move the existing component logic, keep the existing `*.data.ts` services, and extend rather than replace.
4. **i18n:**
   - Every new string uses `$localize` with an id `@@store.admin.<area>.<element>`, then `npm run i18n:extract`, with English in `src/locales/en.json`.
   - `lint` fails on missing or stale English.
5. **Working method** (repo convention):
   - One phase = one branch `feat/w-a<N>-<slug>` = one PR "W-A<N> — Title", squash-merged when CI is green.
   - Update `PROGRESS.md` (new table "Admin redesign") and `DECISIONS.md` (one row per choice; `REVIEW` when it touches money, auth or personal data).
6. **DoD order** (every phase, from CLAUDE.md):
   - `api:up` → `api:seed` → `types:check` → `typecheck` → `lint` → `test` → `build` → `e2e` → `a11y`
   - then manual checks: 320 px / keyboard / one `h1` / i18n
   - plus screenshots at **1440 / 834 / 390** in `/ar` light, `/ar` dark and `/en` light, saved to `docs/screenshots/admin-redesign/w-a<N>/`

---

## 1. Target structure (additions in bold)

```
src/app/features/admin/
  shell/                 admin-shell (rebuilt), admin-nav.ts (sections + icons + badges)
  **menu/**              phone "More" page (/admin/menu)
  ops/                   dashboard.page (redesigned), orders.page + order.page (list + detail split), donors.page, donor.page
  catalog/               projects.page (index template), project-editor.page (editor layout), options-editor,
                         categories.page, media.page (+ detail panel), media-picker, media-upload
  **settings-home/**     settings index page (/admin/settings becomes the index; typed settings move to /admin/settings/store)
  staff/ settings/ templates/ audit/ login/ password/   restyled, same behaviour
  ui/                    conflict-dialog, requires (unchanged API)
  **ui/index-page/**     admin-only presentational pieces: view-tabs, bulk-bar, summary-cards, filter-pills
  **ui/edit-layout/**    save-bar + two-column layout
  admin-common.css       extended with the admin layout utilities
src/app/shared/ui/
  data-table/            extended: selectable rows, phone card template, .no-tab columns (backward compatible)
  status-pill/           extended: 6 badge kinds mapped from status-labels.ts
  icon/icon.data.ts      add missing admin icons (names must pass check-no-commerce)
src/styles/tokens.css    admin semantic tokens (light + dark)
```

Admin-only UI lives under `features/admin/ui/`, not `shared/ui`, so the storefront bundle never pulls it. `shared/ui` changes stay generic and presentational.

---

## 2. Phase W-A0 — Groundwork

| # | Task |
|---|---|
| A0.1 | `CLAUDE.md`: add "Admin redesign: `docs/admin-redesign/` (spec, plan, mockups) is the approved admin look". |
| A0.2 | Commit `docs/admin-redesign/**` if not already there: spec, plan and mockups. |
| A0.3 | **Tokens:** add the admin semantic tokens from spec §5, light and dark. If `scripts/` has a contrast check, add the pairs; otherwise add a Vitest that computes the WCAG ratio of each text/background pair in both themes (≥ 4.5:1). |
| A0.4 | **Icons:** add the ones that are missing (home, inbox, heart, image, users, tag, globe, mail, shield, settings, search, bell, menu, plus, upload, eye, edit, check, alert, arrow, refresh, logout, calendar, info). Check `icon.data.ts` first; `book` is not allowed. |
| A0.5 | **Breakpoint utilities** in `admin-common.css` (loaded by the admin shell only): `.no-tab` (≤1100px hidden), `.no-ph` / `.only-ph` (≤640px). Document 1100/640 in the `tokens.css` breakpoint comment. |
| A0.6 | `status-labels.ts` gains a `badgeKind(status)` map for the 6 kinds (spec §5) covering every `ProjectStatus`, `OrderStatusValue` and `CustomerStatus`. Unit test: every wire value is mapped. |

Done when lint and contrast checks are green and nothing visible has changed.

---

## 3. Phase W-A1 — Shell

Reference: all mockups, plus `P-Menu`.

- **`admin-nav.ts` → sections** (spec §2): `{ key, icon, labelId, path?, children?, policy, badge? }`, with policies exactly as today. The active section comes from the URL.
- **Top bar:**
  - logo, "متجر تعلّم"
  - global search: the command palette below
  - notifications popover with pending-today count, payment-review count and failed items (if any API exposes them; otherwise only counts)
  - theme + language (existing components)
  - account chip with a menu: name · role, "كلمة المرور والتحقق" → `/admin/password`, sign out, sign out everywhere (existing StaffAuth)
- **Sidebar** 240px: hidden items follow `can()` as today. At ≤1100px it becomes a 72px icon rail with `aria-label` and a tooltip per item.
- **≤640px:**
  - The top bar shows menu → `/admin/menu`, the page title from route `data`, a search icon and the bell.
  - **Bottom tab bar** (sticky, safe-area): Home · Projects · **+** · Donations · More.
  - **+** → `/admin/projects/new`, disabled with a `<ta-requires>` reason when `staff:catalogue` is missing.
- **`/admin/menu`** (phone only; wider screens redirect to `/admin`): account card, payments notice, all sections, sign out.
- **Live counts** (`AdminShellData`, provided in the shell; refresh on navigation, throttled to 30 s):
  - pending today = `dashboard.pendingOrdersToday`
  - payment review = `GET /v1/admin/orders?status=payment_review&pageSize=1` → total
- **Command palette** (Ctrl/⌘ K, Angular Aria listbox in the existing dialog):
  1. Navigation and actions, filtered client-side.
  2. If the query looks like a reference (`T3-…`), go straight to `/admin/orders/:ref`.
  3. If it's a Saudi mobile, open `/admin/orders?mobile=…`.
  4. Otherwise search projects with `GET /v1/admin/projects?q=…&pageSize=5`.
  - Never fetch whole lists.
- **Routes:** keep every existing path. Add `menu`, `orders?status=` deep links, and `data: { titleId }` on each child for the phone title.
- `/admin/login` and `/admin/password` stay outside the shell.

**Tests:**
- nav filtering per role (admin, store_manager, finance, viewer)
- rail aria-labels
- bottom bar visible at 390 (e2e)
- palette routing for reference, mobile and text
- existing guards unchanged (pwd_change → `/admin/password`)

---

## 4. Phase W-A2 — Index template + Projects list

Reference: `D-Projects`, `T-Projects`, `P-Projects`.

- **`ui/index-page`:**
  - `view-tabs`: الكل · منشور · مسودة · مؤرشف, with counts from `GET /v1/admin/projects?status=…&pageSize=1`, using the paged total.
  - `summary-cards`: published, drafts, archived, and "تنقصها متطلبات النشر". The last card is shown **only** if it can be counted without N detail calls. Otherwise drop it and note the gap in DECISIONS.
  - `filter-pills`: category (`GET /v1/admin/categories`); search `q` is in the header or toolbar.
- **`data-table` extended** (backward compatible):
  - `selectable` input; tri-state header checkbox; row checkboxes with an `aria-label`.
  - Columns can carry `.no-tab`.
  - A `#card` template renders the phone card list (`<ul>` with `aria-label`); the table keeps its caption.
- **Bulk bar** (staff:catalogue): Publish / Archive.
  - Implemented as sequential per-item calls (`POST …/{id}/publish` | `…/archive`, concurrency 2).
  - A per-item 422 `missing[]` shows the API's labels in a result toast/dialog ("نُشر 3 من 4 — مشروع X: صورة الغلاف").
  - Reload once at the end. Viewer and finance see it disabled with the `<ta-requires>` reason.
- **Columns:**
  - select
  - cover (`<ta-image>`, alt from the API)
  - title (link to the editor)
  - status badge (+ the "جديد/عاجل" badge)
  - category (`.no-tab`)
  - options (`activeOptionCount` + "مبلغ مفتوح" from `allowOpenAmount`)
  - updated
- Keep the existing filters (`status`, `category` id, `q`), 20 per page, and URL query sync if it exists today.

**Tests:** selection (page-scoped; cleared on page or filter change), bulk partial failure, tab counts, phone card list (e2e 390), axe.

---

## 5. Phase W-A3 — Project editor

Reference: `D-Project`, `T-Project`, `P-Project`.

- **`ui/edit-layout`:**
  - **Save bar** above the header, naming the dirty section ("تغييرات غير محفوظة في «التفاصيل»"), with Discard / Save for that section.
  - Ctrl/⌘ S saves the focused section.
  - Two columns: main `flex 999 1 520px`, aside `flex 1 1 290px`.
- **Main column**, existing logic moved, not rewritten:
  1. **Details:** عربي/English segmented switch (Angular Aria tabs) over title, summary and body (Markdown, existing editor). Saved with `PUT …/{id}` + `version`. A 409 opens the existing conflict dialog.
  2. **Cover:** the media picker, plus AR/EN alt status from the asset.
  3. **Donation options** (existing `options-editor`):
     - rows with drag handle, label, amount (decimal string), active, delete
     - "allow open amount" + min amount
     - its own **Save options** button (`PUT …/options`)
     - phone shows read-only rows plus an edit dialog
  4. **SEO:** `seoTitleAr/En`, `seoDescAr/En` with a search-result preview (`store.ta3lom.sa › ar › p › {slug}`).
- **Side column:**
  - **Status:** badge + publish / archive / republish (existing rules: publish disabled while any section is dirty) + "معاينة البطاقة" (existing preview dialog).
  - **Publish requirements:** `missingForPublish` as ✓ / ⚠ labels. A 422 `missing[]` after publish updates this card.
  - **Organisation:** category, badge (`new|urgent|none`), slug + `oldSlugs` ("روابط سابقة تُحوَّل").
  - **Info:** created, updated, version.
- `/admin/projects/new` creates as draft (existing); the `unsavedChangesGuard` stays.

**Tests:** existing editor specs ported first, then: section dirty tracking, save bar per section, publish blocked while dirty, 422 missing labels, conflict dialog, phone layout (e2e 390).

---

## 6. Phase W-A4 — Donations (orders) list + detail

Reference: `D-Orders`, `P-Orders`.

- **Payments notice** while `paymentsEnabled === false` (same text as the storefront notice; no new claims).
- **Tabs:** الكل · بانتظار الدفع · قيد المراجعة · مدفوع · ملغى · منتهي → `status`. Counts on pending and review only (`pageSize=1`).
- **Toolbar:** a search field that takes a reference or a mobile (decided by pattern → `reference` / `mobile`), a date range (`from`/`to`), and CSV export.
  - Export is client-side for **the current filtered page**, labelled so.
  - A finance CSV endpoint exists only in the API payments branch; don't use it unless it's in the generated types.
- **Table:** reference (mono, links to the detail), donor, mobile (`.no-tab`), lines (`.no-tab`), total (`<ta-money>`), status badge, created.
- **Detail:**
  - Side panel on desktop when a row is selected (`/admin/orders?ref=…` keeps it deep-linkable); `/admin/orders/:ref` stays the full page (tablet and phone).
  - Content: donor block (link to `/admin/donors/:id`), lines (project + option × qty or category gift, amounts), total, created, payment due, cancelled-by/at.
  - **Cancel** with a reason (existing flow, staff:orders); disabled with a reason for others.
  - **Refund** is hidden while `paymentsEnabled` is false.

**Tests:** search routing (reference vs mobile), tabs → status param, panel open/close + deep link, cancel permissions per role, e2e on the real API (existing admin-ops spec updated).

---

## 7. Phase W-A5 — Dashboard

Reference: `D-Home`, `T-Home`, `P-Home`. Data: `GET /v1/admin/dashboard` only, plus counts already in the shell.

| Block | Data |
|---|---|
| Greeting + date | staff name (StaffAuth) |
| Payments notice | `paymentsEnabled === false` |
| Metrics strip (4) | pending today, pending this week, published projects (+ "في N تصنيفات" from `activeCategories`), active donors |
| أعلى المشاريع بالمبالغ المعلّقة | `topProjectsByPendingAmount` → bars, width relative to the max `pendingAmount` (halalas math via `core/money`), linking to the project editor |
| جاهزية المتجر (checklist) | drafts > 0 → "أكمل المشاريع"; payments flag off → "اربط بوابة الدفع"; staff count (admin only: `GET /v1/admin/staff`); categories > 0. Only real, computable checks. |
| مهام اليوم | pending today → orders?status=pending_payment; payment review count; drafts count → projects?status=draft |
| آخر النشاط | `GET /v1/admin/audit?pageSize=3` for `staff:admin` only; hidden for others |

No chart and no invented numbers.

---

## 8. Phase W-A6 — Media, Settings & team, Login, other screens

- **Media** (`D-Media`):
  - tabs: all images · missing English alt (client-side flag on the loaded page, labelled so)
  - grid
  - detail side panel (≤1100px: dialog) with preview, size and date, `altAr`/`altEn` edit (existing endpoint), copy URL
  - upload keeps mandatory Arabic alt and the MIME/size checks
- **Settings & team** (`D-Settings`):
  - `/admin/settings` becomes an index of cards: الفريق والصلاحيات (`/admin/staff`), إعدادات المتجر (current typed settings page, moved to `/admin/settings/store`), قوالب الرسائل (`/admin/templates`), سجل التدقيق (`/admin/audit`), كلمة المرور والتحقق (`/admin/password`). Each card is shown or disabled by policy.
  - Staff table with role badges and a 2FA column; actions as today (create with one-time password, edit roles/active, reset password, reset TOTP, unlock).
  - A roles explainer card (text from the policy table).
- **Login** (`D-Login`):
  - restyle only: brand band, centered card, "الخطوة 1 من 2" password, "الخطوة 2 من 2" TOTP (6 boxes; auto-submit on 6 digits as today), and the first-time **setup** step (setup key / QR) in the same card style
  - errors, lockout and return URL unchanged
  - `/admin/password` restyled in the same card
- **Restyle only** (index pattern, phone card lists, same behaviour): categories (reorder + dialog), donors list + detail (block/unblock), templates (edit / preview / test send), audit (filters + diff), typed settings.

---

## 9. Behaviour parity checklist (must stay green)

| Area | Behaviour | Where after redesign |
|---|---|---|
| Auth | password → TOTP verify / setup; forced password change (`pwd_change`) → `/admin/password`; `/admin/me` refresh once per visit; sign out / everywhere | Login, account menu |
| Policies | nav hidden without the read policy; actions disabled with a `<ta-requires>` reason; `staff:admin` routes guarded | Shell, every page |
| Projects | list filters, editor two sections, options editor, publish/archive/republish, missing list, preview, old slugs, conflict 409, unsaved guard | W-A2, W-A3 |
| Categories | reorder (drag + up/down), edit dialog, image, general gifts, active | W-A6 |
| Media | upload with mandatory alt, MIME/size checks, alt edit | W-A6 |
| Donations | search (reference, mobile, status, dates), detail, cancel with reason (admin + finance) | W-A4 |
| Donors | list, detail, block/unblock | W-A6 |
| Staff | create (one-time password), edit roles/active, reset password, reset TOTP, unlock | W-A6 |
| Settings / templates / audit | typed save; preview + test send; filters + diff | W-A6 |

## 10. Out of scope (API backlog, separate store_api session)

| Need | Unlocks |
|---|---|
| Dashboard time series (pending/paid per day) | metrics chart |
| `missingForPublish` (or a flag) on `AdminProjectRow` | the "تنقصها متطلبات النشر" card and tab |
| Bulk publish/archive endpoint | replaces the sequential bulk runner |
| `altEn` missing filter on `GET /admin/media` | the real "missing English alt" tab |
| Finance views, refunds, CSV (already in the API payments branch) | refund button and full CSV once `paymentsEnabled` and the web types include them |

## 11. Order and stop points

| Phase | Scope | Size |
|---|---|---|
| W-A0 | Groundwork | S |
| W-A1 | Shell, nav, palette, phone bars, menu | L |
| W-A2 | Index template + projects | M |
| W-A3 | Project editor | L |
| W-A4 | Donations list + detail | M |
| W-A5 | Dashboard | S |
| W-A6 | Media, settings & team, login, restyle of the rest | L |

Stop for review after each PR. The store isn't hosted until it's finished, so there's no partial deploy.

## 12. Risks

| Risk | Mitigation |
|---|---|
| Editor rewrite breaks two-section save / conflict / guard | Port the existing specs first and move the code; don't re-implement |
| `check-no-commerce` fails on a new name | Grep new code for the forbidden words before commit (lint does it too) |
| Admin CSS leaks into the storefront | Utilities live in `admin-common.css`, loaded by the admin shell only; storefront screenshot diff in W-A1 |
| Budgets | Admin is a lazy chunk; check the initial JS stays at its current size (~128 KB) |
| e2e flakiness on the real API | Reuse the R5 helpers (`staffSignIn`, clean-up after tests) |

---

## 13. Adaptations after the code check (W-A0, 2026-11-16)

The plan was written against an older snapshot. The rows below replace the text above where they disagree; each one is
also a DECISIONS row (session `W-A0`).

| # | The plan assumed | The code / API has | What we do |
|---|---|---|---|
| 1 | `environment.paymentsEnabled` | No such flag (`environment.spec.ts` forbids it). `environment.showcase` drives the storefront; the admin reads `StoreConfig.paymentsEnabled()` from `GET /v1/catalog/config` (dashboard since SW-6) | Every "payments off" notice and the hidden refund use `StoreConfig.paymentsEnabled() === false`. Refund, review accept/refund and receipt resend stay when payments are on |
| 2 | Payment-review count from `orders?status=payment_review&pageSize=1` | `DashboardResponse` has `inReviewOrders`, `pendingOrders`, `openOrphanPayments`, `paidToday/ThisWeek/ThisMonth` (optional) | The shell counts and the bell read the one dashboard call; optional numbers are shown only when present |
| 3 | Staff "sign out everywhere" | No staff endpoint (only `/v1/admin/auth/logout`) | Not built; API backlog (§10). It never existed for staff, so it is not a parity row |
| 4 | Extend `shared/ui/data-table` | No admin page uses it; admin tables are `.atbl` (`admin-common.css`) | `shared/ui/data-table` untouched. Admin-only pieces in `features/admin/ui/index-page/` on top of `.atbl`; phone card lists chosen with `@if` on an admin `matchMedia` signal |
| 5 | `status-pill` gets six kinds | `status-pill` is shared with the donor account | Admin-only `<ta-admin-badge>` + `badgeKind()` in `features/admin/ui/badge.ts`; `status-labels.ts` keeps the labels |
| 6 | Spec nav has no finance screens | `/admin/reports` and `/admin/payments/orphans` (`staff:finance`) exist | A "المالية" section: reports, orphan payments (badge = `openOrphanPayments`) |
| 7 | `admin-common.css` loaded by the shell | Each admin component lists it in `styleUrls` (emulated encapsulation) | Utilities are `.adm-no-tab`, `.adm-no-ph`, `.adm-only-ph` there; `features/admin/ui/**` components define their own breakpoint rules. No `ViewEncapsulation.None` |
| 8 | "تنقصها متطلبات النشر" card/tab, cover and badge columns in the projects list | `AdminProjectRow` has no `missingForPublish`, cover or badge | Dropped from the list; the row shows a decorative title initial (`aria-hidden`). API backlog |
| 9 | Bulk publish/archive may need `version` | `POST …/publish|archive` have no body; responses 200/404/422 | Sequential runner (concurrency 2); 422 → `missing` labels, any other failure → a per-item message; never retried; one reload at the end |
| 10 | Client-side CSV of the current page | `GET /v1/admin/reports/donations.csv?from&to` is in the types | The donations toolbar export calls it with the filter's dates, `staff:finance` only (REVIEW: personal data) |
| 11 | Contrast Vitest | `scripts/contrast-check.mjs` (`PAIRS`, part of `lint`) | Admin pairs added there |
| 12 | Media "missing English alt" filter | `GET /admin/media` has `kind`, `page`, `pageSize` only | Client-side on the loaded page, labelled so |
| 13 | `/v1/admin/auth/me` has 2FA state | `StaffMeResponse` has no `totpEnrolled` (the staff list has) | The 2FA column is on the staff table only |

**Merge order (owner review M1):** each phase PR targets the previous phase branch (W-A0 → `main`). After a phase is
squash-merged: `git rebase --onto main <old phase tip> feat/w-a<N+1>-…`, then the next PR is retargeted to `main`.

**DoD order (owner review M3):** `api:up` → `api:seed` → `types:check` → `i18n:extract` (+ English in `en.json`) →
`typecheck` → `lint` → `test` → `build` → `e2e` → `a11y`.

**Screenshots (owner review M7):** `npm run screenshots:admin` (`e2e/screenshots/admin-redesign.spec.ts`, its own
Playwright config, never in `npm run e2e` or CI); per phase only the touched screens, the full set in W-A6; JPEG q80.
