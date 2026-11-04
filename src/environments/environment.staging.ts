/**
 * Staging (`npm run build:staging`, image CONFIG=staging): https://store-staging.ta3lom.sa reading the staging API.
 * noindex everywhere (meta, X-Robots-Tag, robots.txt `Disallow: /`), the "نسخة تجريبية / Staging" ribbon, and NO payments
 * guard (staging may run with payments off). Must match scripts/lib/envs.mjs `staging`.
 */
export const environment = {
  production: true,
  envName: 'staging' as 'development' | 'local' | 'ci' | 'staging' | 'production',
  apiUrl: 'https://store-api-staging.ta3lom.sa/v1',
  siteOrigin: 'https://store-staging.ta3lom.sa',
  mainSiteUrl: 'https://ta3lom.sa',
  /** `noindex` = every page `noindex, nofollow` whatever the route says (staging). */
  robots: 'noindex' as 'index' | 'noindex',
  /** R5-Payments: checkout leaves for the gateway's hosted page; the order page polls until a final state. */
  paymentsEnabled: true,
  /**
   * The only hosts the web ever redirects a donor to for payment (ADR-S05; https except localhost). Moyasar's hosted
   * invoice page in staging/production; the API's own fake page (`/dev/payments/{id}`) in development, local and CI.
   */
  paymentHosts: ['checkout.moyasar.com'] as readonly string[],
  /** http allowed for the payment page (the local fake gateway); never on staging/production. */
  paymentAllowHttp: false,
  /** Option C trust row (owner M-3, REVIEW: move to the API config later): hidden while zakat is off / no updates. */
  trust: { showZakat: false, showUpdates: false },
  /** Client error reporter endpoint (P5, REVIEW); empty = off. Its origin must be in the CSP connect-src (gen-csp). */
  errorReportUrl: '',
};
