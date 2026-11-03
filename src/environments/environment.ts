/**
 * Development (`ng serve` on :4200 / :4201) against the local store API started by `npm run api:up` (:5080).
 * The API allows these origins with credentials (scripts/dev-env.sh, Store:Cors:Origins).
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5080/v1',
  siteOrigin: 'https://store.ta3lom.sa',
  mainSiteUrl: 'https://ta3lom.sa',
  /** D-W2: online payment arrives with R5-Payments; until then checkout ends at the pending order. */
  paymentsEnabled: false,
  /** Option C trust row (owner M-3, REVIEW: move to the API config later): hidden while zakat is off / no updates. */
  trust: { showZakat: false, showUpdates: false },
};
