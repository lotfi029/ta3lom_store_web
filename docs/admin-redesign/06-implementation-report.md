# Store Admin Redesign — Implementation Report (store_web)

**Date:** 2026-11-16
**Scope:** W-A0 → W-A6 of `03-store-admin-redesign-plan.md` (with §13 adaptations and the owner's review M1–M7, S1–S11).
Staff admin only (`src/app/features/admin/**`); storefront, account and checkout unchanged. **No API change.**

## 1. Phases and PRs

| Phase | PR | Base | Content |
|---|---|---|---|
| W-A0 Groundwork | [lotfi029/ta3lom_store_web#48](https://github.com/lotfi029/ta3lom_store_web/pull/48) | `main` | docs + mockups, admin tokens (+20 contrast pairs), icons, `adm-` utilities, `<ta-admin-badge>`, screenshot harness |
| W-A1 Shell | [lotfi029/ta3lom_store_web#49](https://github.com/lotfi029/ta3lom_store_web/pull/49) | W-A0 | sections nav, 72px rail ≤ 1100px, phone tab bar + More page, Ctrl/⌘ K palette, live counts, account menu |
| W-A2 Projects index | [lotfi029/ta3lom_store_web#50](https://github.com/lotfi029/ta3lom_store_web/pull/50) | W-A1 | status counts and views, search + category pills, page-scoped selection, bulk publish/archive, phone cards |
| W-A3 Project editor | [lotfi029/ta3lom_store_web#51](https://github.com/lotfi029/ta3lom_store_web/pull/51) | W-A2 | two columns, save bar, عربي/English tabs, requirements card, organisation/info, Ctrl/⌘ S |
| W-A4 Donations | [lotfi029/ta3lom_store_web#52](https://github.com/lotfi029/ta3lom_store_web/pull/52) | W-A3 | status views with counts, one search box, finance CSV, side panel (`?ref=`), shared `ta-order-detail` |
| W-A5 Dashboard | [lotfi029/ta3lom_store_web#53](https://github.com/lotfi029/ta3lom_store_web/pull/53) | W-A4 | greeting, showcase notice, 4 metrics, pending bars, readiness, tasks, recent activity |
| W-A6 The rest | [lotfi029/ta3lom_store_web#54](https://github.com/lotfi029/ta3lom_store_web/pull/54) | W-A5 | media panel, settings index + `/admin/settings/store`, staff roles/2FA, login/password card, donor badges, admin-common restyle |

**Merge strategy (review M1, DECISIONS W-A0):** each PR targets the previous phase branch. Merge in order W-A0 → W-A6.
After each squash-merge into `main`, rebase the next branch with
`git rebase --onto main <old tip of the merged branch> <next branch>` and retarget its PR to `main`. The generated
`src/locales/messages*.xlf` may conflict on a rebase: take either side and run `npm run i18n:extract` (they are
regenerated from the sources). Late fixes were propagated down the stack with merge commits (no force-push of an
open PR branch); a squash-merge flattens them. `claude/sweet-ptolemy-503mi8` holds the W-A6 tip plus this report.

## 2. Plan adaptations (03 §13) and review outcomes

| # | Plan assumed | What was done |
|---|---|---|
| 1 | `environment.paymentsEnabled` | `StoreConfig.paymentsEnabled()` (`GET /v1/catalog/config`) everywhere: notices, refund hidden when false |
| 2 | Review count from a list call | One `GET /v1/admin/dashboard` feeds the nav badges, bell and order views (`pendingOrdersToday`, `pendingOrders`, `inReviewOrders`, `openOrphanPayments`) |
| 3 | Staff "sign out everywhere" | No staff endpoint — not built (backlog) |
| 4 | Extend `shared/ui/data-table` | Untouched; admin-only `features/admin/ui/index-page/*` on `.atbl` |
| 5 | `status-pill` with six kinds | Admin-only `<ta-admin-badge>` + `badgeKind()`; `status-pill` (shared with the account) untouched |
| 6 | No finance section | «المالية»: reports, orphan payments (badge) |
| 7 | `admin-common.css` from the shell | `.adm-no-tab`, `.adm-no-ph`, `.adm-only-ph` in `admin-common.css` (every page loads it); `admin/ui` components carry their own rules; no `ViewEncapsulation.None` |
| 8 | "Missing requirements" card, cover/badge columns | Dropped (not in `AdminProjectRow`); decorative title initial |
| 9 | Bulk needs `version`? (M5) | `POST …/publish|archive` take no body: one call each, 2 at a time, no retry, 422 `missing[]` labels per project, one reload |
| 10 | Client CSV (M6) | `GET /admin/reports/donations.csv?from&to`, `staff:finance` only (REVIEW) |
| 11 | Contrast Vitest | `scripts/contrast-check.mjs` +20 pairs (both themes ≥ 4.5:1) |
| 12 | Media alt filter | Client-side on the loaded page, labelled «(هذه الصفحة)» |
| 13 | 2FA in `/admin/me` | Staff table only (`totpEnrolled`) |
| — | Angular Aria listbox / tabs | Hand-written ARIA combobox (palette) and tabs (language switch): the primitives manage their own focus, which a filter-as-you-type input cannot share |
| — | Six TOTP boxes | One `one-time-code` input (paste/autofill/screen readers, e2e helper) — REVIEW |
| — | Phone options "read-only rows + dialog" | Not built; the inline options editor wraps on phones (known issue) |

## 3. Parity (plan §9) and tests

| Area | Behaviour | Tests |
|---|---|---|
| Auth | password → TOTP setup/verify, `pwd_change` → `/admin/password`, `/admin/me` once per visit, sign out | e2e `admin-platform` (return URL, wrong password, create member → setup TOTP → forced change → reset TOTP), `admin-password.spec.ts` (7), `platform.spec.ts` |
| Policies | nav hidden without read policy; disabled actions with `<ta-requires>`; `staff:admin` routes guarded | `admin-nav.spec.ts` (4 roles), e2e viewer nav + `/admin/settings` redirect, viewer bulk disabled, viewer "+" disabled with description |
| Projects | filters, two-section editor, options, publish/archive/republish, missing list, preview, old slugs, 409, unsaved guard | e2e `admin-catalogue` (create → options → preview → publish → public page; slug change redirect; unsaved guard; status views + search; bulk partial failure; editor save bar, Ctrl+S, 422 requirements), `catalog.spec.ts`, `options-editor.spec.ts`, `project-editor.spec.ts`, `index-page.spec.ts` |
| Categories | reorder, edit dialog, image, general gifts, active | e2e `admin-catalogue` (category step), viewer read-only |
| Media | upload with alt, MIME/size, alt edit | e2e picker upload (alt required), viewer media; unit `media-upload` checks unchanged |
| Donations | search (reference, mobile, status, dates), detail, cancel; finance actions | e2e `admin-ops` (range error, lower-case reference, side panel, full page, cancel), `payments.spec.ts` (review accept, refunds on the shared detail), `order-detail.spec.ts`, `ops.spec.ts` |
| Donors | list, detail, block/unblock | e2e `admin-ops` (store manager blocks/unblocks; viewer cannot) |
| Staff | create, edit, reset password, reset TOTP, unlock | e2e `admin-platform` team flow, `staff.page.spec.ts` (409) |
| Settings / templates / audit | typed save; preview + test send; filters + diff | e2e `admin-platform` (settings via the index → `/admin/settings/store`, audit diff, templates preview/test send) |

New behaviour covered: `admin-shell.spec.ts` (rail, palette routing, phone tab bar/More), `palette-target.spec.ts`,
`badge.spec.ts`, dashboard bar widths and readiness.

## 4. Results

DoD on the stack tip (W-A6, final):

| Step | Result |
|---|---|
| `api:up`, `api:seed`, `types:check` | ✅ real API (.NET, postgres:18), types match the OpenAPI snapshot |
| `i18n:extract` | ✅ 137 new `@@store.admin.*` strings, English in `en.json`; no existing English string changed |
| `typecheck`, `lint` | ✅ contrast check 136 pairs (+20 admin), no-commerce, stylelint, i18n |
| `npm test` | ✅ 413 unit tests (+20 admin) + 16 script tests |
| `build` | ✅ initial JS **137.2 / 135.5 kB** gzip (ar/en; baseline 136.8 / 135.1, budget 150) |
| Admin lazy chunks | **137.5 kB** gzip, 33 files (baseline 100.0 kB, 26 files) — lazy, not in the initial budget |
| `e2e` (full, real API) | ✅ **111 passed, 19 skipped** (stub/showcase-only), 0 failed |
| `a11y` | ✅ 0 serious/critical across 70 routes, light and dark (plus axe inside the admin e2e: every new screen, ar/en, light/dark, 390px where relevant) |
| Storefront | `/ar/` and `/ar/p/<slug>` (1440, 390): 0 % pixel difference before/after; no `adm-` class in the global CSS |
| Manual | 320px with no horizontal scroll (e2e on menu, projects, editor, settings); keyboard (palette ↑↓ Enter Esc, language tabs ←→, Ctrl+K, Ctrl+S); one `h1` per route (e2e) |

W-A1 also ran its own full DoD (e2e 107 passed, a11y light + dark clean). W-A2…W-A5 ran typecheck, lint, the admin
unit specs and a build per branch; their e2e ran as part of the stack tip.

Issues found and fixed during verification (all with tests):
- Links on the grey admin page were under 4.5:1 → `--c-admin-link`, re-pointed by the shell; admin pages' own links use it.
- Storefront global classes collided with new admin classes (`.ph`, `.aside`, `.field`, `.b`, `.cards`, `.split`, `.lib`, `.tile`, `.empty`, `.eyebrow`, and the global `section` band padding) → renamed or reset; an audit script compared every admin template class with the global CSS.
- The side panel's scrollable tables were not keyboard reachable → focusable labelled regions.
- A reused i18n id with two Arabic texts (`store.admin.upload-image`) → its own id.

## 5. Screenshots

`docs/screenshots/admin-redesign/` — JPEG q80, `npm run screenshots:admin`:

- `storefront-before/storefront/` and `w-a1/storefront/` — `/ar/` and `/ar/p/<slug>` at 1440 and 390, before and after (0 % pixel difference).
- `w-a1/` — shell and More page from the W-A1 build.
- `w-a6/` — the full set from the final build: every admin screen × 1440 / 834 / 390 × `/ar` light, `/ar` dark, `/en` light. Phones are viewport captures (the tab bar is fixed).



## 6. API backlog (for a store_api session)

| Need | Unlocks |
|---|---|
| Dashboard time series (pending/paid per day) | a metrics chart |
| `missingForPublish` (or a flag), cover and badge on `AdminProjectRow` | the «تنقصها متطلبات النشر» card/tab, thumbnails, badge column |
| Bulk publish/archive endpoint | replaces the per-project runner |
| `altEn` missing filter on `GET /admin/media` | a real "missing English alt" view across pages |
| Staff "sign out everywhere" (`/v1/admin/auth/logout-all`) | the account menu action |
| `totpEnrolled` on `StaffMeResponse` | 2FA state in the account menu |
| Finance views / CSV filters by status | export matching the list's status view |

## 7. Known issues

- Phone options editor: inline rows (no read-only + dialog variant).
- TOTP is one input, not six boxes (REVIEW).
- The audit entries on the dashboard show raw `action` / `entity` codes (no label table exists yet).
- Screenshots for W-A2…W-A5 come from the final build (W-A6 tip), not from each intermediate build.
- Lighthouse in CI (storefront, unchanged code) occasionally exceeds its 250 ms TBT cap when several PR runs share runners; it passed on W-A0/W-A1/W-A4/W-A5 with the same storefront output.
- `docs/screenshots/admin-redesign/` is ≈ 20 MB (JPEG q80, 135 + 18 + 8 files).

