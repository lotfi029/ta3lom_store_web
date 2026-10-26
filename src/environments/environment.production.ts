/** Production: https://store.ta3lom.sa reading https://store-api.ta3lom.sa/v1 (ADR-S09). */
export const environment = {
  production: true,
  apiUrl: 'https://store-api.ta3lom.sa/v1',
  siteOrigin: 'https://store.ta3lom.sa',
  mainSiteUrl: 'https://ta3lom.sa',
  /** D-W2: online payment arrives with R5-Payments; until then checkout ends at the pending order. */
  paymentsEnabled: false,
};
