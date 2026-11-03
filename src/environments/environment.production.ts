/**
 * Production: https://store.ta3lom.sa reading https://store-api.ta3lom.sa/v1 (ADR-S09). `npm run build:prod` fails
 * while paymentsEnabled is false (D-W2, scripts/check-payments-flag.mjs). Must match scripts/lib/envs.mjs `production`.
 */
export const environment = {
  production: true,
  envName: 'production' as 'development' | 'local' | 'ci' | 'staging' | 'production',
  apiUrl: 'https://store-api.ta3lom.sa/v1',
  siteOrigin: 'https://store.ta3lom.sa',
  mainSiteUrl: 'https://ta3lom.sa',
  /** `noindex` = every page `noindex, nofollow` whatever the route says (staging). */
  robots: 'index' as 'index' | 'noindex',
  /** D-W2: online payment arrives with R5-Payments; until then checkout ends at the pending order. */
  paymentsEnabled: false,
  /** Option C trust row (owner M-3, REVIEW: move to the API config later): hidden while zakat is off / no updates. */
  trust: { showZakat: false, showUpdates: false },
  /** Client error reporter endpoint (P5, REVIEW); empty = off. Its origin must be in the CSP connect-src (gen-csp). */
  errorReportUrl: '',
};
