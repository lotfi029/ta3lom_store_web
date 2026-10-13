# Store Web — prompts for the cloud session

**Plan:** [store-web-plan.md](store-web-plan.md) · **Environment:** [cloud/store-web-cloud-environment.md](cloud/store-web-cloud-environment.md)

---

## 0. Before you paste (checklist)

- [ ] The API r4 session is merged, and so is the API change in plan §3.2 (CORS, `WebBaseUrl`).
- [ ] The repo `lotfi029/ta3lom_store_web` is bootstrapped and pushed (plan §3.3). Everything is under `docs/` (plan, prompts, specs, `docs/cloud/`, `docs/design/`, `docs/openapi/`, `docs/reference/`) and on `main`.
- [ ] The cloud environment has:
  - the variables and setup script from `store-web-cloud-environment.md`;
  - both repos (web with push, API with read);
  - network: npm, GitHub, NuGet, Ubuntu mirrors;
  - auto-accept.
- [ ] A new session is started **on `ta3lom_store_web`**.

---

## 1. Start prompt (paste as the first message)

```text
You are building the ta3lom store web app (storefront + customer account + staff admin) in this repo,
lotfi029/ta3lom_store_web, in one continuous session. Do not stop until docs/W-report.md is pushed and all
session PRs are merged.

READ FIRST, in this order:
1. docs/store-web-plan.md — THIS RUN'S PLAN. It overrides everything else on how to work.
2. docs/cloud/store-web-cloud-environment.md — environment, ports, commands.
3. docs/adr/ADR-S09-store-web-separate-app.md — separate app at store.ta3lom.sa, no /store prefix, admin inside.
4. docs/scope-change-r4-no-giving.md — courses and books only. Never build any giving UI.
5. docs/10-frontend-angular.md — screens and behaviour (read "/store/…" as "/…"; skip everything giving).
6. docs/11-api-contract.md §12 + docs/openapi/store-api.v1.json — the contract; types are generated, never hand-written.
7. docs/03-business-rules.md, docs/04-functional-requirements.md.
8. docs/design/ta3lom-store-prototype.html + docs/design/ta3lom-prototype.html — approved look; do not redesign;
   strip giving per plan §2.6.
9. docs/reference/ta3lom-web/CLAUDE.md — the conventions and non-negotiables to adopt (logical CSS, Arabic first,
   pick(), SEO per route, one h1, alt from assets, 44 px targets, reduced motion, token in a signal, budgets,
   no bypassSecurityTrust*, semantic tokens only, hash-only CSP).
Precedence when docs disagree: scope-change r4 > 03 > 11 + OpenAPI > 10 (with ADR-S09 and plan §2) > prototype.

STEP 0 — environment:
- If the setup script did not run, run `bash docs/cloud/store-web-setup.sh`. It must end with READY or
  READY-WITH-WARNINGS; fix what you can yourself and log the rest in DECISIONS.md.
- Check: node >= 24.15, npm 11, dotnet 10, PostgreSQL running, ../ta3lom_store_api present.
- Start the store API: (cd ../ta3lom_store_api && dotnet run --project src/Ta3lom.Store.Api &) and wait for
  curl -s localhost:5080/health/ready. If the API repo is not accessible, log it and use the stub API (plan §4).
- Create PROGRESS.md and DECISIONS.md (template below). Then go straight on — do not wait for me.

BUILD, in this order, without stopping between sessions (plan §5):
W-00 Bootstrap and tooling → W-01 Core → W-02 Layout → W-03 Catalogue → W-04 Sign-in → W-05 Cart →
W-06 Checkout and thanks → W-07 Account → W-08 Admin shell and platform → W-09 Admin catalogue →
W-10 Admin operations → W-11 Hardening and release prep (incl. close-out, plan §7).
Stack: Angular 22.2.x (latest stable), Node 24 LTS, TypeScript ~6.0, standalone, zoneless, signals,
httpResource, Signal Forms, Angular Aria, @angular/localize (ar source + en), @angular/ssr static output
(prerender public pages, client-render cart/checkout/account/admin). Dependencies only as in plan §2.1.

RULES (absolute):
1. Never end your turn to report, summarise, ask or wait. Your reports are commits, PROGRESS.md and DECISIONS.md.
   Only after W-11 is merged and docs/W-report.md is pushed, write the final summary.
2. Every session closes plan §4.1 before the next starts: typecheck, lint (ESLint + Stylelint + contrast),
   unit tests, build of both locales within budgets (150 KB initial JS, 400 KB page) + CSP check, e2e for the
   session's journeys against the REAL API (mocks only for states the API can't produce), axe on its routes in
   ar/en × light/dark, RTL checked first, no horizontal scroll at 320 px, keyboard + visible focus,
   SeoService.set() on every route, i18n ids @@store.<area>.<element>, English XLF filled.
3. Git: one branch per session (feat/w-03-catalogue), commits "W-03 — …", push after each step, one PR per
   session titled "W-03 — Catalogue"; squash-merge when CI is green. If you can't merge, stack the next branch
   on it and continue.
4. Code: types only from the generated store-api.types.ts; money as decimal strings, arithmetic in halalas,
   never floats; access tokens in signals, never in storage; credentials and bearer only for the store API
   origin; logical CSS properties only; semantic tokens only; no colour literals in components; never raise
   a budget; never bypassSecurityTrust*.
5. Payments: no gateway code. Checkout ends at "Awaiting payment"; the dev-only "Simulate payment" calls
   POST /dev/orders/{ref}/confirm-payment and is OFF in the production environment (unit-tested). No refund or
   payment-review screens.
6. When docs disagree or something is undecided: choose by the precedence above, log it in DECISIONS.md
   (mark REVIEW if it touches money, auth or personal data), and continue.
7. Blocked after 3 honest attempts: revert that change set, mark the session "blocked" in PROGRESS.md with the
   error, continue with the next session whose dependencies are done, and retry blocked sessions in W-11.
8. If your context is compacted: re-read PROGRESS.md, DECISIONS.md and plan §4, then continue from the
   "Next:" line. Never redo a done session.
LIMITS: never edit the API repo; no deploy, VPS or DNS work; no secrets; no force-push; no giving UI.

PROGRESS.md template:
# Store web progress
Next: <W-nn — step>
| Session | Status (todo/doing/done/blocked) | PR | Screens | Endpoints # | Tests (unit/e2e/a11y) | Notes |
## Checklist
- [ ] W-00 … W-11 done and merged
- [ ] Every r4 web endpoint of plan §1 used by a screen and covered by an e2e test
- [ ] axe clean on every route, ar/en, light/dark
- [ ] Budgets met; Lighthouse: LCP <= 2.0 s, INP <= 200 ms, CLS <= 0.05 (home, a course, a book)
- [ ] Prototype screenshots compared (docs/screenshots, ar/en, 1440 + 375 px)
- [ ] docs/reference/ removed; docs/W-report.md pushed

DECISIONS.md: | Date | Session | Topic | Docs | Choice | Reason | REVIEW? |

Start now with STEP 0.
```

---

## 2. Resume prompt (if the session ends before W-11)

Open a new session on the same environment and repo, and paste:

```text
Resume the ta3lom store web run and do not stop until the whole plan is finished.
1. Environment: run `bash docs/cloud/store-web-setup.sh` if node 24 / dotnet 10 / PostgreSQL are missing;
   start the store API (cd ../ta3lom_store_api && dotnet run --project src/Ta3lom.Store.Api &) and wait for
   /health/ready (or use the stub API if the API repo is not accessible).
2. Read CLAUDE.md, docs/store-web-plan.md §4 and §5, PROGRESS.md and DECISIONS.md on main — or on the newest
   feat/w-* branch if work is unmerged.
3. Continue from the "Next:" line of PROGRESS.md with exactly the same rules and limits as the start prompt
   (docs/store-web-prompts.md §1): never stop to ask, every session closes plan §4.1, one PR per session,
   no gateway code, no giving UI. Don't redo done sessions.
```

---

## 3. Correction prompt (when you overrule something mid-run)

```text
Correction from the owner — apply it now and keep going without stopping:
<what to change, e.g. "Use the prototype's 3-column product grid on the catalogue at ≥ 1100 px, not 4">
Log it in DECISIONS.md as an owner decision, update any finished session it affects in a follow-up commit
("W-nn fix — …"), and continue from the "Next:" line.
```

---

## 4. Single-session prompt (to run or redo one session only)

```text
Run only session <W-nn — title> of docs/store-web-plan.md §5 in lotfi029/ta3lom_store_web.
Read CLAUDE.md, docs/store-web-plan.md §2, §4 and the W-nn row, PROGRESS.md and DECISIONS.md first.
Environment and API as in docs/cloud/store-web-cloud-environment.md §4.
Close plan §4.1 completely (typecheck, lint, tests, build within budgets, e2e on the real API, axe ar/en ×
light/dark, RTL first, 320 px, keyboard, SEO, i18n), open the PR "W-nn — title", merge when CI is green,
update PROGRESS.md and DECISIONS.md, then stop and give me: what was built, tests added, and any REVIEW items.
```

---

## 5. Review prompt (after the run, in a new session)

```text
Review the finished store web app in lotfi029/ta3lom_store_web against docs/store-web-plan.md. Don't change
code; write docs/W-review.md with:
1. Plan coverage: each §1 screen and endpoint → file → e2e test (gaps flagged).
2. Non-negotiables check (docs/reference/ta3lom-web/CLAUDE.md rules 1–15 + plan §4 "Never"): grep-based evidence.
3. Security: token handling, interceptors' origin scoping, idempotency keys, dev trigger off in production, CSP.
4. Money and forms: no floats, halala arithmetic, mobile and National Address validation.
5. Accessibility and RTL: axe results, 320 px, focus order, ICU plurals.
6. Performance: bundle sizes vs budgets, Lighthouse numbers.
7. Differences from the prototype (screenshots in docs/screenshots) with severity.
8. A prioritised fix list.
Run every check yourself (build, tests, e2e on the real API, a11y) and paste the numbers.
```
