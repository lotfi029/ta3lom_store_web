/**
 * `npm run build` (configurations production + local): a production-optimised build that prerenders against and
 * talks to the LOCAL store API, so budgets, CSP, e2e and a11y run on real output in the cloud session.
 * Never deployed — `npm run build:prod` uses environment.production.ts.
 */
export const environment = {
  production: true,
  apiUrl: 'http://localhost:5080/v1',
  siteOrigin: 'https://store.ta3lom.sa',
  mainSiteUrl: 'https://ta3lom.sa',
  devPaymentTrigger: true,
};
