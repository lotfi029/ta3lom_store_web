# Store home page — Option C "المتجر أولاً" (spec)

**Date:** 3 Nov 2026 · **Decided by:** Lotfi · **Status:** chosen, ready for a store_web session
**Design:** canvas "Ta3lom Store Landing Options", artboard **C** (updated 3 Nov to match the R5-Core API)
**Replaces:** the home layout from W-M1 ([14-web-sync-plan](../r5-web/14-web-sync-plan.md)). Routes, card behaviour (D-W5) and API stay the same.
**API:** [15-api-contract-r5-core](../r5-web/15-api-contract-r5-core.md) (main @ cd26a80). **No API change is needed.**

---

## 1. Decision

The home page `/{ar,en}/` is **catalogue first** (like store.kafeef.sa). It shows search, the category bar and the project grid above the fold, and the campaign banner and quick donate sit beside them. Donations are **general**: water, food, orphans, health, housing, education, mosques, relief and the general fund. Categories come from the API, not from code.

The identity doesn't change: the `tokens.css` semantic layer (`--c-*`), Readex Pro, the logo, the radii and the dark surfaces. No new colours.

## 2. What the mockup shows vs what the API supports

| Mockup element | R5-Core | Decision |
|---|---|---|
| Goal / progress bar | ❌ no goal progress | **Removed** from the card (D-W5) |
| "يقبل الزكاة فقط" filter | ❌ zakat dormant | **Removed.** Add it back when zakat is on |
| "قارب على الاكتمال" filter / sort | ❌ | **Removed** |
| Sort | `featured \| newest \| title` | Labels: المميزة / الأحدث / الاسم |
| Badge | `new \| urgent` | جديد / عاجل on the image |
| Option chips + stepper + open amount | ✅ `ProjectCard.options`, `allowOpenAmount`, `minAmount` | As D-W5 |
| Cart total in the header | ✅ `GET /v1/cart/summary` | "السلة · {totalAmount}" |
| Banner campaign | ✅ `HomeResponse.featured` | First `urgent` card, else the first featured card |
| Quick donate (general fund) | ✅ `{categoryId, amount}`, `amountPresets` | Categories with `acceptsGeneralGifts` |
| Licence no., trust text | static | `[رقم الترخيص]` from the association (Q-11) |

## 3. Page structure (top to bottom)

| # | Section | Content | Data | Component |
|---|---|---|---|---|
| 1 | **Utility bar** (`--c-surface-dark`) | "جميع التبرعات موثّقة بإيصال رسمي · ترخيص رقم […]", links: الموقع الرئيسي, lang switch | static + i18n | `layout/header` (new top row) |
| 2 | **Header** | Logo + "جمعية التعلم الإلكتروني / متجر التبرعات", **big search** (2 px `--c-brand` border, pill, submit button), حسابي / دخول, cart button with the total, theme toggle | `CartSummary` | `layout/header` |
| 3 | **Category tab bar** | "كل المشاريع" + every active category (horizontal scroll on mobile). The active tab has a 3 px `--c-accent` underline. A tab sets `?category={slug}` | `GET /v1/catalog/categories` | new `category-tabs` (in `layout/header` or `features/store/home`) |
| 4 | **Banner + quick donate** | Start side (2/3): campaign banner on `--c-surface-indigo` with a brand glow: label, title, summary, "تبرع" CTA → `/p/{slug}`, dots if there's more than one urgent card (auto-rotate off; buttons only). End side (1/3): **quick donate card**: "تبرع سريع للصندوق العام", preset buttons, custom amount, تبرع الآن | `GET /v1/catalog/home` (`featured`, `amountPresets`) | new `home-banner`; `quick-donate` inline variant |
| 5 | **Filter bar** | "{total} مشروعًا", sort select. Search and category stay in the URL | `PagedResult.total` | `features/store/home` |
| 6 | **Project grid** | `repeat(auto-fill, minmax(260px, 1fr))`: 4 columns on desktop, 2 on tablet, 1 on phone. 20 per page | `GET /v1/catalog/projects?q&category&sort&page&pageSize=20` | `project-card` (restyled, §4) |
| 7 | **Pagination** | numbers + التالي / السابق, `aria-current="page"`. Changes `?page=` and scrolls to the filter bar | same | `listing.ts` |
| 8 | **Trust row** | 4 items: جمعية مرخّصة, إيصال فوري, زكاة مستقلة (**hide while zakat is off**), تحديثات التنفيذ (**hide until updates exist**) | static, flags from config | new `trust-row` |
| 9 | **Footer** | as today | — | `layout/footer` |

Empty states: no projects in a category ("لا توجد مشاريع في هذا التصنيف حاليًا" + link to all) and no search results (show the query + clear button). Errors and loading go through `resource-state`, with skeleton cards in the grid.

## 4. Project card (compact, D-W5)

Order inside the card:

1. Image (`ta-image`, ratio 3:2, lazy) with the badge at the top start corner (`--c-gold` fill, `--c-on-gold` text).
2. Category name (`--c-link`, 13 px, from `categorySlug` → the categories list).
3. Title (16 px, 700, links to `/p/{slug}`), summary (14 px, `--c-muted`, 2-line clamp).
4. **Option chips** (`option-picker`): one chip per `options[]` ("{label} · {amount}"), plus "تبرع مفتوح" when `allowOpenAmount`.
5. One field below the chips: **`qty-stepper`** when an option is picked, **`amount-input`** when "تبرع مفتوح" is picked. Presets come from the config, and the minimum is `minAmount`.
6. Buttons: **تبرع** (primary `--c-brand-strong`; add, then go to `/checkout`) and **اضافة** (secondary with the cart icon; add, then a toast and the badge bump).

Card states (unchanged): options only → chips + stepper; open amount only → amount field, no chips; both → chips with "تبرع مفتوح" last.
The share bar moves to the project page only (it was too heavy on a compact card). **Confirm with Lotfi**, or keep it as an icon button.

## 5. Behaviour

| Item | Rule |
|---|---|
| URL state | `q`, `category`, `sort`, `page` live in the query string. Back/forward restore them. The home page with no query is prerendered |
| Search | The header search on any page goes to `/{locale}/?q=…`. Empty `q` is dropped |
| Category tab | Resets `page` to 1 and keeps `q` and `sort` |
| Quick donate (inline) | `POST /v1/cart/lines {categoryId, amount}` → `/checkout`. Category = the general-fund category (the first with `acceptsGeneralGifts`), or a select when there are several. The header and floating quick-donate modal stays |
| Cart total | `CartSummary.totalAmount` via `<ta-money>`; hidden when `lineCount = 0` |
| Banner | No banner when there's no featured card; then the quick-donate card takes the full width |
| SEO | One `<h1>` = the banner title, or a visually hidden "متجر التبرعات" when there's no banner. JSON-LD `NGO` + `ItemList` of the first page. `noindex` on `?q=` |
| RTL / a11y | RTL first. Tabs are links (not `role=tab`) because they navigate. Tap targets ≥ 44 px. No horizontal page scroll at 320 px (only the tab bar scrolls). Contrast via `contrast-check` |

## 6. Files to change in `store_web`

| File | Change |
|---|---|
| `src/app/layout/header/header.{html,css,ts}` | Utility row, big search, cart total, category tab bar slot |
| `src/app/features/store/home/home.page.{html,css,ts}` | New layout (§3): banner + quick donate, filter bar, grid, pagination, trust row |
| `src/app/features/store/home/home.data.ts` | `home` + `categories` + `projects` resources from the URL query |
| `src/app/features/store/home/listing.ts` | Query-string ↔ state, page size 20 |
| `src/app/features/store/home/project-card.ts` | Compact card (§4); share bar removed (or icon only) |
| `src/app/features/store/quick-donate/quick-donate.ts` | `inline` input (card, not modal) |
| new `features/store/home/home-banner.ts`, `category-tabs.ts`, `trust-row.ts` | — |
| `src/styles/store.css` | Grid, filter bar and tab bar rules, tokens only |
| `src/locales/*` | New ids `@@store.home.*`, `@@store.layout.utility-*`; run `i18n-merge --check` |
| specs + e2e | Home with a category tab, search, sort and paging; option add; open-amount add; inline quick donate → checkout; empty category; ar + en, light + dark a11y |

## 7. Out of scope (later)

- Goal bars, "near target" and zakat filters (they need the goal and zakat API).
- Delivery updates on the home page.
- A banner managed from the admin (for now it uses featured projects and the `badge`).

## 8. Open points

| # | Question |
|---|---|
| C-1 | Keep the share bar on the card as an icon, or only on the project page? (recommended: project page only) |
| C-2 | Licence number and trust text for the utility bar (Q-11) |
| C-3 | Which category is the "general fund" for the inline quick donate if several accept general gifts? (recommended: a setting later; for now the first by `sort`) |
