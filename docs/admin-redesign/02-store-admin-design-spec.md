# Store Admin Redesign — Final Design Spec (store_web)

**Date:** 2026-11-16
**Target:** `D:\Freelance\ELAMS\repos\Store\store_web` (repo `lotfi029/ta3lom_store_web`), admin at `store.ta3lom.sa/{ar,en}/admin`
**API:** `D:\Freelance\ELAMS\repos\Store\store_api` (repo `lotfi029/ta3lom_store_api`, .NET 10, `/v1/admin/*`)
**Canvas:** https://claude.ai/artifact/2KYay5sBPGNZ9uyfXe3uM7. Pages *Store admin — Desktop / Tablet / Phone*; *Explorations* keeps options A–I.
**Style:** options ح + ط (e-commerce admin, Shopify / Salla patterns) in the ta3lom identity. Projects play the role of products, donations the role of orders, and donors the role of customers.

## 1. Screens

| Screen | Desktop | Tablet 834 | Phone 390 | Current code it replaces |
|---|---|---|---|---|
| Dashboard | `D-Home` | `T-Home` | `P-Home` | `ops/dashboard.page` |
| Projects list | `D-Projects` | `T-Projects` | `P-Projects` | `catalog/projects.page` |
| Project editor | `D-Project` | `T-Project` | `P-Project` | `catalog/project-editor.page` (+ `options-editor`) |
| Donations (orders) list + detail | `D-Orders` | (desktop layout, detail hidden) | `P-Orders` | `ops/orders.page` + `ops/order.page` |
| Media library | `D-Media` | (detail panel hidden) | (2-col grid) | `catalog/media.page` |
| Settings & team | `D-Settings` | — | — | `staff/staff.page` (+ settings, templates, audit entry points) |
| Staff login (password → TOTP) | `D-Login` | stacks | stacks | `login/admin-login.page` |
| Phone menu | — | — | `P-Menu` | new |

There's no mockup for: categories, donors list/detail, settings (typed keys), templates, audit, `/admin/password`. They take the same index or detail patterns (§2) with their current behaviour.

## 2. Layout & navigation

**Top bar** (dark): logo + "متجر تعلّم", a global search (donation reference, mobile or project), notifications, and an account chip (name · role) with password/2FA and sign out.

**Sidebar**, filtered by policy as today (`can()`):

| Section | Children | Policy (read) |
|---|---|---|
| الرئيسية Dashboard | — | staff:read |
| التبرعات Donations (badge = pending today) | all · بانتظار الدفع · قيد المراجعة · مدفوعة (status filters) | staff:read |
| المشاريع Projects | all projects · التصنيفات | staff:read |
| الوسائط Media | — | staff:read |
| المتبرعون Donors | — | staff:read |
| قنوات البيع Sales channel | store.ta3lom.sa (opens the storefront) | — |
| الإدارة Admin | قوالب الرسائل (staff:templates) · سجل التدقيق (staff:admin) · الإعدادات والفريق (staff:admin) | as noted |

**Page patterns:**
- **Index page**:
  - a header (title + primary action)
  - 4 summary cards
  - status tabs
  - filter pills
  - a bulk bar
  - a table (thumbnail, title, status badge, columns), which becomes a card list on phone
  - pagination
- **Detail / editor page**:
  - an "unsaved changes · Discard / Save" bar
  - a main column (sections)
  - a side column (status, publish requirements, organisation, info)
- **List + detail split** (donations): the detail is a side panel on desktop; on phone the list links to `/admin/orders/:ref`.

## 3. Responsive rules

| Width | Behaviour |
|---|---|
| > 1100px | Full sidebar with sub-items; two-column editor; donations list + detail panel. |
| ≤ 1100px | 72px icon rail; low-priority columns (`.no-tab`) and the donation/media detail panels are hidden (the row opens the detail page); KPI cards 2×2. |
| ≤ 640px | No sidebar; top bar = menu, logo, page title, search, bell. **Bottom tab bar**: Home · Projects · **+** (new project) · Donations · More (`/admin/menu`). Tables become card lists, everything stacks, and the bulk bar and secondary buttons are hidden. |

## 4. Store-specific content (from the real API)

- **Dashboard** (`GET /v1/admin/dashboard`):
  - metrics: `pendingOrdersToday`, `pendingOrdersThisWeek`, `publishedProjects`, `activeCategories`, `activeDonors`
  - `topProjectsByPendingAmount` shown as bars (`pendingAmount`, `pendingOrders`)
  - a payments notice while `environment.paymentsEnabled === false` (showcase mode)
  - no time-series chart: the API has none
- **Projects:**
  - status `draft | published | archived`; list filters `status`, `category`, `q`
  - the editor has two separately saved sections: details (`PUT …/{id}`, with `version`) and options (`PUT …/options`)
  - `allowOpenAmount`, `minAmount`, `badge` (`new | urgent`), SEO title/description AR/EN, `oldSlugs`
  - `missingForPublish` drives the requirements card; publish, archive and preview; 409 conflict dialog
- **Donations:**
  - status `pending_payment | paid | payment_review | cancelled | expired`
  - filters `reference`, `mobile`, `status`, `from`, `to`
  - the detail has lines (project/option or category gift), donor, total and payment due
  - **cancel** (staff:orders = admin + finance) with a reason; refund stays hidden or disabled until payments are on
- **Money:** decimal strings via `<ta-money>`; never `parseFloat`.
- **Roles:**
  - `admin`, `store_manager`, `finance`, `viewer`
  - disabled actions keep `<ta-requires>` reasons
  - nav items are hidden when the read policy is missing

## 5. Tokens

Same mapping as the ta3lom identity; add only semantic tokens to `src/styles/tokens.css` (light + dark):

| Token | Light value |
|---|---|
| `--c-admin-bg` | `#f1f3f4` |
| `--c-admin-side` | `#ebeef0` |
| `--c-admin-side-hover` | `#e0e5e7` |
| `--c-admin-topbar` | `#0f262e` (= `--c-surface-dark`) |
| `--c-admin-topbar-2` | `#1d3a45` |
| `--c-admin-row-selected` | `#f2f8fb` |
| `--c-badge-ok-bg/-text` | `#d9f2e3/#155c3b` (paid, published) |
| `--c-badge-sched-bg/-text` | `#dff0f7/#0e5770` (pending payment) |
| `--c-badge-warn-bg/-text` | `#fbecc8/#6b4708` (payment review, missing) |
| `--c-badge-err-bg/-text` | `#fbdcda/#8e2622` (cancelled, archived, blocked) |
| `--c-badge-draft-bg/-text` | `#e9eef0/#3a3d3e` (draft, expired) |
| `--c-badge-new-bg/-text` | `#e4e9fb/#2b3f8f` (badge "new", roles) |

Dark values must reach 4.5:1 (text) in both themes.
