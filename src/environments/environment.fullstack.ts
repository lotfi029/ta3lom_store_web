/**
 * Full-stack e2e only (`npm run build:fullstack`, image CONFIG=fullstack; scripts/full-stack-e2e.sh — F10): the real
 * production host names, served locally behind the edge Caddy (`deploy/edge/store.caddy`, internal TLS) with the API in
 * Development (fake gateway). Its payment allow-list is the API host itself (the fake page `/dev/payments/{id}`), so this
 * build is NOT deployable (scripts/lib/envs.mjs `fullstack`, check-deploy-output) and noindex. Must match envs.mjs.
 */
export const environment = {
  production: true,
  envName: 'fullstack' as 'development' | 'local' | 'ci' | 'fullstack' | 'staging' | 'production',
  apiUrl: 'https://store-api.ta3lom.sa/v1',
  siteOrigin: 'https://store.ta3lom.sa',
  mainSiteUrl: 'https://ta3lom.sa',
  /** `noindex` = every page `noindex, nofollow` whatever the route says (staging). */
  robots: 'noindex' as 'index' | 'noindex',
  /** R5-Payments: checkout leaves for the gateway's hosted page; the order page polls until a final state. */
  paymentsEnabled: true,
  /**
   * The only hosts the web ever redirects a donor to for payment (ADR-S05; https except localhost). Moyasar's hosted
   * invoice page in staging/production; the API's own fake page (`/dev/payments/{id}`) in development, local and CI.
   */
  paymentHosts: ['store-api.ta3lom.sa'] as readonly string[],
  /** http allowed for the payment page (the local fake gateway); never on staging/production. */
  paymentAllowHttp: false,
  /** Option C trust row (owner M-3, REVIEW: move to the API config later): hidden while zakat is off / no updates. */
  trust: { showZakat: false, showUpdates: false },
  /** Client error reporter endpoint (P5, REVIEW); empty = off. Its origin must be in the CSP connect-src (gen-csp). */
  errorReportUrl: '',
};
