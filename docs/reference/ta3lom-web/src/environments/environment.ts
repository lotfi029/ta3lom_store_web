/**
 * Development environment (`ng serve`). Points at the REAL API, not scripts/stub-api.mjs.
 *
 * This is the SSR half's URL — Node fetches it directly during the dev server's render pass, where
 * CORS does not apply. The browser half does not use it: core/api.token.ts swaps in `/api` in
 * development so requests go through proxy.conf.mjs and stay same-origin. Both halves are needed;
 * pointing only one at the live API is what produced a page that painted correctly and then failed
 * on the first click.
 *
 * To work against the local stub instead (offline, or exercising admin flows without touching
 * production data), set apiUrl back to `http://localhost:3000` and run `npm run stub-api`. CI is
 * unaffected either way — `build:ci` replaces this file with environment.ci.ts.
 */
export const environment = {
  production: false,
  apiUrl: 'https://api.ta3lom.sa',
};
