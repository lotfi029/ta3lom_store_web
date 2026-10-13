# store_web — project docs

Everything the store web project (`lotfi029/ta3lom_store_web`, https://store.ta3lom.sa) needs, in one place.
**Start here:** [store-web-plan.md](store-web-plan.md) → [store-web-prompts.md](store-web-prompts.md) → [cloud/](cloud/store-web-cloud-environment.md).

| Path | What | Source of truth |
|---|---|---|
| [store-web-plan.md](store-web-plan.md) | Implementation plan (sessions W-00…W-11, DoD, tests) | `Docs\store\web\` |
| [store-web-prompts.md](store-web-prompts.md) | Start, resume, correction, single-session, review prompts | `Docs\store\web\` |
| [cloud/](cloud/store-web-cloud-environment.md) | Cloud env variables + `store-web-setup.sh` (v2) | `Docs\store\web\cloud\` |
| [adr/ADR-S09](adr/ADR-S09-store-web-separate-app.md) | Separate app at store.ta3lom.sa | `Docs\store\adr\` |
| [adr/ADR-S04](adr/ADR-S04-otp-customer-identity.md), [ADR-S05](adr/ADR-S05-hosted-payments-webhook-truth.md) | OTP identity, hosted payments | `Docs\store\adr\` |
| [scope-change-r4-no-giving.md](scope-change-r4-no-giving.md) | r4: courses and books only | `Docs\store\` |
| [03](03-business-rules.md) · [04](04-functional-requirements.md) · [05](05-user-stories.md) · [06](06-non-functional-requirements.md) | Rules, FRs, stories, NFRs | `Docs\store\` |
| [10-frontend-angular.md](10-frontend-angular.md) | Screens and behaviour (read `/store/…` as `/…`; skip giving) | `Docs\store\` |
| [11-api-contract.md](11-api-contract.md) + [openapi/store-api.v1.json](openapi/store-api.v1.json) | API contract; types generated from the JSON | API repo `store/11`, `openapi/v1.json` |
| [database/00](database/00-store-database-design.md) | Database design v2 (33 tables) | `Docs\store\database\` |
| [store-prototype.md](store-prototype.md) + [design/](design/) | Approved prototypes (strip giving, plan §2.6) | `D:\Freelance\ELAMS\design\` |
| [reference/ta3lom-web/](reference/ta3lom-web/CLAUDE.md) | Reference kit from ta3lom-web: tokens, fonts, logo, layout, core helpers, shared UI, scripts, configs, conventions | `repos\ta3lom-web` (copied 14 Oct) |

**Refresh before the first session:** copy `..\StoreApi\openapi\v1.json` over `openapi/store-api.v1.json` after the API r4 session is merged (today's copy still lists the giving endpoints).
**Copies, not masters:** edit specs in `D:\Freelance\ELAMS\Docs\store\` (or the API repo) and re-copy; the session never edits them except `11` deviations it logs.
