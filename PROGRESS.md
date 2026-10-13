# Store web progress
Next: W-06 — Checkout and thanks

| Session | Status (todo/doing/done/blocked) | PR | Screens | Endpoints # | Tests (unit/e2e/a11y) | Notes |
|---|---|---|---|---|---|---|
| STEP 0 | done | — | — | — | — | setup READY (node 24.21, dotnet 10.0.112, PG 16); API cloned, built, migrated, on :5080 |
| W-00 Bootstrap and tooling | done | [#1](https://github.com/lotfi029/ta3lom_store_web/pull/1) | placeholder home | #3 (`fields=slug`, prerender) | 3 / 3 smoke / 28 routes × 2 themes | budgets 89 KB JS / 95 KB transfer (ar) |
| W-01 Core | done | [#2](https://github.com/lotfi029/ta3lom_store_web/pull/2) | — (core only) | #11, #16–#20 (auth service), #47–#51 (staff auth service) | 48 / 3 smoke / 28 × 2 | money, problem → 71 r4 messages, SEO, theme, StoreAuth/StaffAuth, store-API interceptor, guards, CartSummary; 93 KB JS |
| W-02 Layout | done | [#3](https://github.com/lotfi029/ta3lom_store_web/pull/3) | header, footer, skip link, account menu, 404, toast, resource-state | #11 (badge), #18 (session restore), #19 (sign out) | 102 / 17 (layout + smoke, ar+en, 320 px, keyboard, axe both themes) / 28 × 2 | kit layout ported to the store prototype header; store icon set; 113 KB JS |
| W-03 Catalogue | done | [#4](https://github.com/lotfi029/ta3lom_store_web/pull/4) | home, /courses, /books, /search, /p/:slug (course, book), unavailable product | #1, #2, #3, #4, #5, #9 | 114 / 32 (15 catalogue ar+en: API-driven chips/filter/sort, search, course + book pages, JSON-LD, share, related, 320 px, axe both themes; no-JS prerender smoke) / 28 × 2 | 26 pages prerendered; buy box presentational (cart in W-05); 121 KB JS |
| W-04 Sign-in | done | [#5](https://github.com/lotfi029/ta3lom_store_web/pull/5) | /login, `<ta-otp-sign-in>` (reused at checkout), account menu sign out / sign out everywhere | #16, #17, #18, #19, #20 (+ #129, #131, #132 as test tooling) | 122 / 42 (10 sign-in ar+en: OTP from /dev/sms, wrong number, attempts left, session restore, sign out, sign out everywhere, rate limit (mock), blocked customer (real)) / 32 × 2 | Signal Forms; auto-submit on 6 digits; Arabic-Indic digits; 125 KB JS |
| W-05 Cart | done | #6 | buy boxes (course / book formats, print stepper, stock state, sticky bar), add / buy now, /cart (one group, qty, remove, totals, shipping note, notices, price-changed banner, line issues) | #10, #11, #12, #13, #14, #40 (quote, price check) (+ #57, #61 admin as e2e tooling) | 131 / 54 (12 cart ar+en: add course + print ×2, qty, totals, remove, empty; duplicate course RUL-13; guest cart kept after sign-in RUL-17; price changed RUL-15; out of stock RUL-30; mobile sticky bar; axe both themes) / 34 × 2 | `CartStore` optimistic + queued + rollback; 125 KB JS |
| W-06 Checkout and thanks | todo | | | | | |
| W-07 Account | todo | | | | | |
| W-08 Admin shell and platform | todo | | | | | |
| W-09 Admin catalogue | todo | | | | | |
| W-10 Admin operations | todo | | | | | |
| W-11 Hardening and release prep | todo | | | | | |

## Checklist
- [ ] W-00 … W-11 done and merged
- [ ] Every r4 web endpoint of plan §1 used by a screen and covered by an e2e test
- [ ] axe clean on every route, ar/en, light/dark
- [ ] Budgets met; Lighthouse: LCP <= 2.0 s, INP <= 200 ms, CLS <= 0.05 (home, a course, a book)
- [ ] Prototype screenshots compared (docs/screenshots, ar/en, 1440 + 375 px)
- [ ] reference/ removed; docs/W-report.md pushed

## Environment (resume notes)
- `. scripts/dev-env.sh && npm run api:up && npm run api:seed` — API on :5080, staff in `.e2e/staff.json` (git-ignored).
- PostgreSQL may need `pg_ctlcluster 16 main start` after a container restart (`api:up` does it).
- Never `pkill -f` with a pattern that appears in your own command line; stop servers by port (`fuser -k 4320/tcp`).
