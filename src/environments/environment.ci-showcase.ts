/**
 * CI showcase (`npm run build:ci-showcase`): the ci build (stub API on :3000) with `showcase: true`, for the @showcase
 * e2e. Never deployed. Must match scripts/lib/envs.mjs `ci-showcase`.
 */
export const environment = {
  production: true,
  envName: 'ci' as 'development' | 'local' | 'ci' | 'fullstack' | 'staging' | 'production',
  apiUrl: 'http://localhost:3000/v1',
  siteOrigin: 'https://store.ta3lom.sa',
  mainSiteUrl: 'https://ta3lom.sa',
  /** `noindex` = every page `noindex, nofollow` whatever the route says (staging). */
  robots: 'index' as 'index' | 'noindex',
  /**
   * Showcase mode (deploy without payments): donors see categories and projects with their options and prices, read
   * only, and «التبرع الإلكتروني قريبًا»; no cart, checkout, order, donor sign-in or account (those routes go home).
   * On: the @showcase e2e runs the showcase screens against the stub.
   */
  showcase: true,
  /**
   * The only hosts the web ever redirects a donor to for payment (ADR-S05; https except localhost). Moyasar's hosted
   * invoice page in staging/production; the API's own fake page (`/dev/payments/{id}`) in development, local and CI.
   */
  paymentHosts: ['localhost:3000'] as readonly string[],
  /** http allowed for the payment page (the local fake gateway); never on staging/production. */
  paymentAllowHttp: true,
  /** Option C trust row (owner M-3, REVIEW: move to the API config later): hidden while zakat is off / no updates. */
  trust: { showZakat: false, showUpdates: false },
  /** Client error reporter endpoint (P5, REVIEW); empty = off. Its origin must be in the CSP connect-src (gen-csp). */
  errorReportUrl: '',
};
