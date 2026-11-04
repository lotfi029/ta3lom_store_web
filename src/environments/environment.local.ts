/**
 * `npm run build` (configurations production + local): a production-optimised build that prerenders against and
 * talks to the LOCAL store API, so budgets, CSP, e2e and a11y run on real output in the cloud session.
 * Never deployed (scripts/lib/envs.mjs `local`, deployable: false).
 */
export const environment = {
  production: true,
  envName: 'local' as 'development' | 'local' | 'ci' | 'staging' | 'production',
  apiUrl: 'http://localhost:5080/v1',
  siteOrigin: 'https://store.ta3lom.sa',
  mainSiteUrl: 'https://ta3lom.sa',
  /** `noindex` = every page `noindex, nofollow` whatever the route says (staging). */
  robots: 'index' as 'index' | 'noindex',
  /** R5-Payments: checkout leaves for the gateway's hosted page; the order page polls until a final state. */
  paymentsEnabled: true,
  /**
   * The only hosts the web ever redirects a donor to for payment (ADR-S05; https except localhost). Moyasar's hosted
   * invoice page in staging/production; the API's own fake page (`/dev/payments/{id}`) in development, local and CI.
   */
  paymentHosts: ['localhost:5080'] as readonly string[],
  /** Option C trust row (owner M-3, REVIEW: move to the API config later): hidden while zakat is off / no updates. */
  trust: { showZakat: false, showUpdates: false },
  /** Client error reporter endpoint (P5, REVIEW); empty = off. Its origin must be in the CSP connect-src (gen-csp). */
  errorReportUrl: '',
};
