# ta3lom_store_web

Storefront, customer account and staff admin of the ta3lom store — Angular 22, static output, served at
https://store.ta3lom.sa. Start with [CLAUDE.md](CLAUDE.md) and [docs/store-web-plan.md](docs/store-web-plan.md).

**Payments are on** (R5-Payments): checkout leaves for Moyasar's hosted page (mada, Visa, Mastercard, Apple Pay,
STC Pay); the order page never trusts the return URL and polls the API until the order is paid, needs a retry, expired,
is in payment review or was refunded. Finance refunds and reviews payments in the admin. Runbook:
[deploy/README.md](deploy/README.md); before the first production release the Apple Pay domain file from the Moyasar
dashboard replaces the placeholder in `deploy/well-known/`.
