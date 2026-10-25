# Donations MVP: requirements (based on dsenaiah.org.sa)

**Date:** 25 Oct 2026 · **Owner decision:** Lotfi
**Reference site:** <https://dsenaiah.org.sa/Association/Projects> (reviewed in the browser on 25 Oct 2026). It runs on the "نظام جود لإدارة التبرعات" platform.
**Narrows:** [scope-change-r5-donations-only.md](../scope-change-r5-donations-only.md). r5 stays the direction (donations only); this file defines the **first release** within it.

---

## 1. What the reference page does

### 1.1 Projects page (`/Association/Projects`)

- **Header:**
  - login and register links;
  - a cart, "سلة التبرعات (0)";
  - a **"تبرع سريع"** button (also floating on the side);
  - a note that Apple Pay works in Safari.
- **Filters:**
  - a **category** dropdown: الكل, مشاريع عامة, المشاريع الدعوية, مشاريع مجتمعية, الإهداءات;
  - a **search** box with a "بحث" button.
- **Grid:** 2 columns, 6 projects per page, with **pagination** (`?page=2&category=0`).
- **Each project card has:**
  1. **an image** (a poster with the prices printed on it) and a **share bar**: WhatsApp, Instagram, Facebook, X, native share;
  2. **a title** linking to `/p/{id}` and **a one-line summary**;
  3. **donation options** as chips, each with a fixed price, for example:
     - "نسخ عربي" (4 SAR) and "نسخ مترجمة" (5 SAR);
     - "تكلفة المعتمر" (150 SAR);
     - "كفالة ساعة / يوم / اسبوع / شهر".

     Picking an option shows a **quantity stepper (− 1 +)**;
  4. **"تبرع مفتوح"** (open donation): an **amount field** ("المبلغ", ﷼) where the donor types any amount;
  5. **buttons:** **"اضافة"** (add to the donation cart), **"تبرع"** (donate now, straight to payment) and a **gift icon** (إهداء).
- **Some projects have no options at all.** "زكاتك نماء لمالك" and "مشروع بلغني الإسلام", for example, are amount-only.
- **No goal, progress bar or "remaining" figure** appears on the cards or on the project page.

### 1.2 Project page (`/p/{id}`)

- The same buy box as the card: options, amount, اضافة, تبرع, and "اهداء المشروع".
- The poster image with the share bar.
- **A long description:** what the project is, the cost per unit, and the project's own bank account and IBAN.
- **Visitor questions/comments** with relative times.

### 1.3 Quick donate (تبرع سريع)

- A modal with a **category dropdown** ("أختر": مشاريع عامة / الدعوية / مجتمعية …), an **amount** and **"تبرع الآن"**.
- **This is the "donate to a general category" path:** the money goes to the category, not to a specific project.

### 1.4 Other features on the site (not in our MVP)

- Gifts (إهداء: send a card now or later), waqf certificate, recurring donations (daily, weekly or monthly, amounts 5/10/15), zakat calculator, comments.
- Inline card-entry form, user accounts with a password, governance pages, annual reports, bank accounts page.

---

## 2. Our MVP scope

> **Goal:** collect donations for **specific projects** (any amount) and for **general categories**. Nothing else in the first release; everything else in §5 comes later.

### 2.1 In scope

| # | Feature | Detail |
|---|---|---|
| M-1 | **Categories** | Staff create categories (e.g. مشاريع عامة, مشاريع دعوية, مشاريع مجتمعية) with an Arabic name, an English name, a sort order and an active flag |
| M-2 | **Projects** (donation products) | Title, summary, description (Markdown), image, category, status (draft, published, archived), sort, SEO fields. **No target or progress bar** in the MVP |
| M-3 | **Donation options per project** *(new)* | 0…n fixed-price options (label + price, e.g. "كفالة يوم — 50 ﷼"). The donor picks one and a quantity. Optional |
| M-4 | **Open amount per project** | "تبرع مفتوح": any amount ≥ a minimum (setting, default 10 ﷼). The project can turn it off when it has options |
| M-5 | **General category donation** | Quick donate: choose a category + an amount. The gift is recorded **against the category** and spent on any project in it |
| M-6 | **Project listing** | Grid, category filter, search (Arabic-aware), pagination |
| M-7 | **Project page** | Image, description, the buy box, share (WhatsApp, X, Facebook, copy link) |
| M-8 | **Donation cart + donate now** | "اضافة" adds to the cart; "تبرع" goes straight to checkout with that one line. The cart holds several projects and categories |
| M-9 | **Checkout** | OTP sign-in by mobile (no password), name, optional email, a summary, then the hosted payment page (mada, Apple Pay, Visa/Mastercard) |
| M-10 | **Donation receipt** | A gapless DR number and a PDF receipt (Arabic), sent by SMS link and email. Refunds issue a DRC |
| M-11 | **Donor account** | My donations (list + receipts), profile, sign out, delete account |
| M-12 | **Admin** | Categories, projects + options, media, donations/orders (search, details, resend receipt), donors, dashboard (today, month, by project, by category), reports (CSV export), settings, staff + roles, audit log |

### 2.2 Rules (MVP)

| Rule | Text |
|---|---|
| D-01 | A gift line is **one** of: an *option × quantity* on a project, an *open amount* on a project, or an *amount* on a category |
| D-02 | Prices and amounts are in SAR with 2 decimals. Option lines total `price × qty`. The checkout re-prices from the database (the cart is only indicative) |
| D-03 | Open amount and category amount: ≥ `min_gift_amount` (10) and ≤ 100,000 per line. Cart limit: 50 lines and 100,000 ﷼ |
| D-04 | Quantity: 1…999 per option line |
| D-05 | Only **published** projects and **active** categories accept gifts. Archived ones stay visible in donors' history |
| D-06 | A donation is counted only when the gateway **webhook** confirms capture (ADR-S05). Then: counters update, the DR receipt is issued and the receipt message is sent, all in one transaction |
| D-07 | Totals are kept **per project** and **per category**. A category's total includes its general gifts and, reported separately, the sum of its projects |
| D-08 | No VAT on donations (to confirm, Q-02). The receipt is not a tax invoice |
| D-09 | Refunds only by `finance`, through the gateway. They reverse the counters and issue a DRC |

---

## 3. What changes in the code (against r5)

r5 planned to restore every built giving feature. The MVP **keeps the code but doesn't build the UI** for the deferred features, so they can be switched on later without new backend work.

### 3.1 API (`StoreApi`)

| Item | MVP action |
|---|---|
| S-R5a remove commerce (courses, books, sponsorship…) | **As planned** (2.5 d) |
| Causes (`cause_detail`) | Keep as the project. `target_amount` becomes **optional** (NULL = no goal); `unit_amount`/`unit_label` are replaced by **options** |
| **`donation_option`** *(new table)* | `id, product_id FK, label_ar, label_en, amount numeric(12,2) > 0, sort, is_active` |
| `cart_line` / `order_line` | `kind = donate`, plus a **target**: `product_id` **or** `category_id` (exactly one, CHECK), an optional `donation_option_id`, `quantity`, `unit_price`, `amount` |
| **Category gifts** | **New:** `cart_line.category_id` and `order_line.category_id`, and a `category_total` counter (or a view over paid lines). The single "general fund" cause is replaced by **per-category** giving |
| Endpoints | **Add:** `POST /v1/cart/lines` accepts `{categoryId, amount}`; `GET /v1/catalog/categories` returns totals only to staff; admin CRUD for options (`/admin/products/{id}/options`). **Keep:** catalogue, cart, checkout, order status, `/me` (giving, orders, documents), admin. **Hidden** (still mapped, not used by the web): zakat, dedications and card page, cause updates, feed, goal seed and adjustments |
| Zakat, dedication, anonymity, delivery updates, goal bar, donor digest | **Dormant:** settings default to off (`zakat_enabled=false`, `dedication_enabled=false`…). The checkout rejects intent=zakat and dedication while they're off |
| Review fixes (CORS, `/dev` lock, R-3 guard, idempotency, C-N1/N3/N4/N6/N7, A-F4/F5/F7/F8) | As planned in S-R5b (2 d) |
| **New work for the MVP** | `donation_option` + category gifts + checkout validation (D-01…D-05) + DR receipt layout + reports by category: **≈ 1.5 d** |

### 3.2 Web (`store_web`)

| Session | Scope | Est. |
|---|---|---|
| W-M0 Clean-up | Remove the course and book UI, regenerate the types, fix W-1/W-2/W-3 | 1.5 |
| W-M1 Listing | Project grid with **cards like the reference** (image, share bar, title, summary, option chips + qty stepper, open-amount field, **اضافة / تبرع**), category dropdown, search, pagination | 2 |
| W-M2 Project page | Description (Markdown), the same buy box, share, SEO + JSON-LD (`DonateAction`) | 1.5 |
| W-M3 Quick donate + cart + checkout + thanks | **Quick-donate modal** (category + amount) in the header and floating on the side; donation cart; OTP checkout; gateway redirect; thanks page with the receipt | 2 |
| W-M4 Account | My donations + receipts, profile, delete | 1 |
| W-M5 Admin | Categories, projects + **options editor**, media, donations, donors, dashboard, reports (CSV), settings, staff | 2 |
| W-M6 Hardening | e2e ar/en (option gift, open amount, category gift, cart with 3 lines), a11y, CI, deploy workflow | 1 |
| **Total** | | **11** |

### 3.3 Effort to launch (MVP)

| Block | Days |
|---|---|
| API: remove commerce + MVP changes + fixes | 6 |
| Web | 11 |
| Payment service (donations) | 5 + its plan |
| Hosting | 3–4 |
| Main site `/donate` + nav, UAT, cutover | 3 |
| **Total** | **≈ 28–29 dev-days** (about the same as r5: less web work, but options and category giving are new) |

---

## 4. Screens (MVP)

| Public | Admin |
|---|---|
| Home = project listing (hero + quick donate + categories + grid) | Dashboard (totals today, month, by project, by category) |
| Project page `/p/{slug}` | Categories |
| Quick-donate modal | Projects (list, editor, **options**, publish/archive, preview) |
| Donation cart | Media library |
| Checkout (OTP → details → pay) | Donations (search, detail, resend receipt, refund later) |
| Thanks + receipt | Donors (search, block) |
| My donations, receipt view, profile | Reports (CSV), settings, templates, staff, audit |

The approved prototype's cause page, cart and checkout can be reused. Restyle the cards to the reference layout (option chips + amount + two buttons), and leave out the goal bar.

---

## 5. Deferred (later releases)

| Feature | Reference has it | Our code already has it |
|---|---|---|
| Gifts (إهداء cards: now or scheduled) | ✅ | ✅ dedications (send now only) |
| Zakat intent + zakat ledger + zakat calculator | ✅ calculator | ✅ ledger and vouchers |
| Recurring donations (daily, weekly, monthly) | ✅ | ❌ (needs tokenised cards; payment service) |
| Waqf certificate | ✅ | ❌ |
| Goal / progress bar / remaining | ❌ | ✅ |
| Project updates / delivery reports | ❌ | ✅ cause updates |
| Anonymous donor ("فاعل خير") | — | ✅ |
| Visitor comments/questions on projects | ✅ | ❌ |
| Bank transfer details per project | ✅ (in the text) | Can go in the description now |
| Donor digest | — | ✅ (reduce first) |
| R1-F fundraising back office (beneficiaries, disbursements) | — | ❌ proposal |

---

## 6. Questions for the association

| # | Question |
|---|---|
| Q-01 | Payment provider and merchant account (charity category, Apple Pay) |
| Q-02 | Confirm donations are outside VAT |
| Q-10 | Launch content: categories, projects, options and prices, images |
| Q-11 | Receipt wording and the details it needs (licence no., logo, signature/stamp) |
| Q-14 *(new)* | How is a **category gift** spent: on any project in the category, or kept as a fund per category? Do category totals need their own report for the board? |
| Q-15 *(new)* | Minimum gift (10 ﷼?) and whether every project allows an open amount |
| Q-08 | Hosting in KSA? |
