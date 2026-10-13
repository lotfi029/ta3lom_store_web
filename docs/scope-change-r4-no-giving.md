# Scope change r4 — giving removed

**Date:** 13 October 2026 · **Decided by:** Lotfi · **Status:** approved
**Applies to:** plans [12](12-implementation-plan.md), [14](14-backend-implementation-plan.md), [Cloud-build-plan](sessions/Cloud-build-plan.md), database design [00](database/00-store-database-design.md) v2

## 1. Decision

The store drops the **giving** feature completely. It sells **courses and books (print and digital) only**.

**Removed:**

- **Sponsorship:** buying seats or copies for others, with offers, units, pooling, a beneficiary register, allocation, lapse and the sponsor digest.
- **Donation causes:** cause products, goal bars and counters, quick give, donor feed and delivery updates.
- **Zakat and sadaqa:** intent, the zakat ledger and disbursement vouchers.
- **Dedication cards:** the إهداء form, SMS cards and the public card page.
- **Donation receipts:** the DR and DRC series. The invoice becomes the only financial document.
- **Anonymous giving:** "فاعل خير".

**Kept as is:** courses, books, cart, OTP sign-in, checkout, settlement core, invoices, enrolment/LMS, downloads, shipments and stock, account, reports, admin, the payment-service hand-off and hosting.

## 2. What changes

| Area | Before (r2/r3) | After (r4) |
|---|---|---|
| Product types | course, book, cause | **course, book** |
| Line kinds | buy, sponsor, donate (units / amount) | **buy only** (course, or book format × quantity) |
| Tables / views | 49 / 4 | **33 / 1** |
| Endpoints (store API) | 130 | **95** |
| Business rules | RUL-01…63 | **40 rules**: 23 removed |
| Scheduled jobs | 12 + dispatcher | **8 + dispatcher** |
| Outbox message types | 18 | **8** (+ `RefundProcessed` in the payment service) |
| Settlement effects | 5 line effects + gift counters | **3** (course, digital, print) |
| Documents | INV, CN, DR, DRC, packing slip | **INV, CN, packing slip** |
| Staff roles | admin, store_manager, finance, allocation_officer, fulfilment, viewer | **admin, store_manager, finance, fulfilment, viewer** |
| Backend effort (plan 14, no payments) | ≈ 56 dev-days / 14 weeks | **≈ 41 dev-days / 10 weeks** |
| Full plan (12, both repos) | ≈ 104 dev-days / 26 weeks | **≈ 78 dev-days / 20 weeks** |

## 3. Removed items

### 3.1 Sessions

| Session | Repo | Title | Est removed |
|---|---|---|---|
| S-23 | store-api | Sponsored units and pooling | 1.5 |
| S-24 | store-api | Beneficiary register | 1.5 |
| S-25 | store-api | Allocation | 2.75 |
| S-26 | store-api | Dedication cards and cause updates | 1.5 |
| S-42 | store-api | Close campaigns, pool sweep, goal corrections | 1.0 |
| S-43 | store-api | Zakat ledger and vouchers | 0.75 |
| S-45 | store-api | Sponsor digest | 1.0 |
| S-27 | ta3lom-web | Admin beneficiaries, allocation console, cause updates, zakat | 3.0 |
| S-28 | ta3lom-web | Public card page, dedication previews, cause timeline | 1.0 |
| S-44 | ta3lom-web | Zakat voucher, goal adjustment, sweep history | 0.5 |
| | | **Total** | **14.5** |

**Trimmed (−7.75 d in plan 12):**

| Session | Change | Est |
|---|---|---|
| S-08 | No goals, gift feed or cause updates | 2.0 → 1.5 |
| S-09 | No causes, offers or goal seed | 2.5 → 1.75 |
| S-10 | No goal bar or quick give | 2.0 → 1.75 |
| S-11 | No cause pages | 2.0 → 1.5 |
| S-12 | No admin screens for causes or offers | 2.5 → 2.0 |
| S-13 | Buy lines only | 1.5 → 1.0 |
| S-14 | Course and book buy boxes, one cart group, no dedication | 2.5 → 1.5 |
| S-15 | No gift totals or dedications | 2.25 → 2.0 |
| S-16 | No gift counters or zakat-in | −0.25 |
| S-17 | No donation receipt | −0.5 |
| S-18 | No anonymity option or card previews | 2.0 → 1.75 |
| S-31 | No `/me/giving` | 2.0 → 1.5 |
| S-32 | No giving tab | 2.5 → 2.0 |
| S-33 | Reports: sales-vat and shipments only | 1.5 → 1.25 |
| S-34 | Smaller dashboard and reports | 3.0 → 2.5 |
| S-36 | No `/donate` redirect | 1.0 → 0.75 |
| S-38 | No opening goal figures | 3.0 → 2.75 |
| S-40 | No sponsored-unit hook | 1.0 → 0.75 |

**New:** **S-R4 — Remove giving** (1.0 d, store-api). It removes whatever giving code the cloud run has already built (plan 14 §10).

### 3.2 Endpoints (35, from 11 §12)

#6, #7, #33, #34, #45, #63, #67, #68, #69, #70, #71, #81, #82, #83, #84, #93, #100–#116, #136, #137.
**Trimmed:**

- #1 has no giving sections.
- #5 returns price and stock only.
- #9 drops `minGiftAmount`, `giftMaxQuantity`, `dedication*`, `sponsorPresets`, `causeUnitPresets` and `amountPresets`.
- #12 accepts buy lines only.
- #53 and #117 drop the giving figures and reports.

### 3.3 Business rules (23, from 03)

| Removed | Topic |
|---|---|
| RUL-06 … 10 | Sponsorable products, causes, goal display, campaign end, goal reached |
| RUL-19 … 23 | Intent, zakat ring-fence, dedication, dedication delivery, anonymous giving |
| RUL-43 … 55 | Units, offer cap, pooling, pool at campaign end, allocation, FIFO, SLA, unit lifecycle, beneficiary register and access, cause units, delivery updates, over-target money |

**Changed:**

- RUL-01: two types.
- RUL-12: buy lines only.
- RUL-18: no gift limit wording.
- RUL-24: no campaign or offer checks.
- RUL-31: `grand_total = purchases_total + shipping_total`.
- RUL-39: course, digital and print effects only.
- RUL-40: no `funded` or `received` states.
- RUL-57/58: purchase refunds only (payment service).
- RUL-59: one document type, the invoice.
- RUL-62: no `allocation_officer`.
- RUL-63: no dedication, invite, allocation, lapse, digest or cause-update messages.

### 3.4 Business and functional requirements (from 01 and 04)

**Business requirements:** BR-S03 to BR-S06, BR-S08 and BR-S14 are withdrawn. BR-S07 becomes "one cart, one checkout, one invoice".


**Removed:**

- FR-S06: cause page.
- FR-S12 … FR-S15: sponsor mode, cause buy box, dedication form, quick give.
- FR-S25: my giving.
- FR-S50 … FR-S61: offers, units, beneficiaries, allocation, invitation, lifecycle, sweep, alerts, causes admin, delivery updates, dedication cards, zakat.
- FR-S63: donation receipt.

**Trimmed:**

- FR-S01: home without giving sections.
- FR-S02: no `/store/sponsor` or `/store/give` tabs.
- FR-S07: price and stock only.
- FR-S09: no `DonateAction`.
- FR-S10 and FR-S11: buy tab only.
- FR-S18: one cart group.
- FR-S30: no anonymity option.
- FR-S35: no card previews.
- FR-S74, FR-S75 and FR-S79: no giving figures.
- FR-S82: no `/donate` redirect.

### 3.5 Database (database/00 §14.2)

- **16 tables dropped:** `sponsorship_offer`, `cause_detail`, `goal_progress`, `goal_adjustment`, `cause_update`, `dedication`, `donation_receipt`, `beneficiary`, `allocation_batch`, `sponsored_unit`, `sponsored_unit_event`, `sponsorship_pool`, `pool_contribution`, `unit_funding`, `distribution`, `zakat_ledger`.
- **3 views dropped:** `v_goal`, `v_allocation_backlog`, `v_zakat_balance`.
- **Sequence dropped:** `beneficiary_code_seq`.
- **11 tables changed:** `document_counter`, `product`, `stock_movement`, `customer`, `otp_challenge`, `staff_user`, `cart_line`, `orders`, `order_line`, `refund_line`, `enrolment`.
- **Integrity checks:** 9 → 5.
- **Verified:** the reduced DDL runs clean on PostgreSQL 16 with a `uuidv7()` shim (33 tables, 1 view).

### 3.6 Jobs and messages

- **Jobs removed:** `CloseCampaigns`, `AllocationAlerts`, `LapseUnits`, `SponsorDigest`.
- **Outbox types removed:** `DedicationCard`, `SponsorUnitAllocated`, `AllocationAlert`, `AllocationEscalation`, `BeneficiaryInvite`, `UnitLapsed`, `SponsorUnitCompleted`, `CauseUpdatePublished`, `PoolSwept`. `LmsRevoke` stays and moves to S-19, because course refunds need it.

### 3.7 Open questions

- **Closed by r4:**
  - Q-03: zakat eligibility.
  - Q-04: beneficiary criteria.
  - Q-09: `/donate`. It stays on the main site as it is.
- **Still open:** Q-01, Q-02, Q-05, Q-06, Q-07, Q-08.

### 3.8 Main site (R3)

The main site's donation flow (FR-40…45) is **not** superseded. The `/donate` redirect and the "FR-40…44 superseded" items are dropped from R3. The nav item, cart badge, CSP, `.htaccess` and `routes.mjs` items stay.

## 4. Documents updated in r4

| Document | Change |
|---|---|
| [database/00-store-database-design.md](database/00-store-database-design.md) | **v2**: 33 tables, regenerated from the reduced DDL; §14.2 lists every drop and change |
| [14-backend-implementation-plan.md](14-backend-implementation-plan.md) | r4 note, scope, effort, milestones, sessions trimmed, Phase 5 replaced by S-R4, coverage maps |
| [12-implementation-plan.md](12-implementation-plan.md) | r4 note, phase totals, session table, critical path, open questions, R3, launch checklist |
| [sessions/Cloud-build-plan.md](sessions/Cloud-build-plan.md) | r4 banner, checklist, phases, order, dependency guard, **§6.4 r4 prompt** |
| [reviews/store-delivery-status.md](reviews/store-delivery-status.md) | Status updated for r4 |
| 01–11, 13, ADR-S06, database/01–03 | A short r4 banner at the top. **Not rewritten.** Where they disagree with this file, this file wins |

## 5. Next steps

1. **The cloud run:** the repo review (13 Oct) found the full backend, giving included, already merged on `main`. Run the r4 session in [Core-features-session-plan.md](sessions/Core-features-session-plan.md) v2. It removes giving, trims the core features and fixes the review findings.
2. **Push these docs** to the store-API repo (`store/`) so the cloud session can read them.
3. **Tell the association:** no sponsorship, causes, zakat or dedications in the store. Q-03, Q-04 and Q-09 are closed.
4. **Prototype:** the approved store prototype still shows giving. Strip those sections before the frontend sessions start (S-10, S-11, S-14, S-32), or the frontend will follow the old design.
