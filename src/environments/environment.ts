/**
 * Development (`ng serve` on :4200 / :4201) against the local store API started by `npm run api:up` (:5080).
 * The API allows these origins with credentials (scripts/dev-env.sh, Store:Cors:Origins).
 */
export const environment = {
  production: false,
  envName: 'development' as 'development' | 'local' | 'ci' | 'fullstack' | 'staging' | 'production',
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
  /** http allowed for the payment page (the local fake gateway); never on staging/production. */
  paymentAllowHttp: true,
  /** Option C trust row (owner M-3, REVIEW: move to the API config later): hidden while zakat is off / no updates. */
  trust: { showZakat: false, showUpdates: false },
  /** Client error reporter endpoint (P5, REVIEW); empty = off. Its origin must be in the CSP connect-src (gen-csp). */
  errorReportUrl: '',
};
