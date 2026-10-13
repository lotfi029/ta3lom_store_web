/** CI (`npm run build:ci`): production settings, API = scripts/stub-api.mjs on :3000 (no API repo token in CI). */
export const environment = {
  production: true,
  apiUrl: 'http://localhost:3000/v1',
  siteOrigin: 'https://store.ta3lom.sa',
  mainSiteUrl: 'https://ta3lom.sa',
  devPaymentTrigger: true,
};
