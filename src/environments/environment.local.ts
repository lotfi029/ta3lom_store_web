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
  /** D-W2: online payment arrives with R5-Payments; until then checkout ends at the pending order. */
  paymentsEnabled: false,
  /** Option C trust row (owner M-3, REVIEW: move to the API config later): hidden while zakat is off / no updates. */
  trust: { showZakat: false, showUpdates: false },
};
