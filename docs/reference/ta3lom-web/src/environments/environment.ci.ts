/**
 * CI-only environment (see the "ci" build configuration in angular.json and the "build:ci" npm
 * script). `environment.production.ts` is hardcoded to the real https://api.ta3lom.sa, which is
 * not reachable from a CI runner (and, pre-launch, may not exist at all) — without this, `ng
 * build`'s own prerendering pass (every route's httpResource() calls, executed server-side
 * during the build) would fail or hang trying to reach it. This swaps in the same
 * scripts/stub-api.mjs the CI workflow starts before the build step, while keeping every other
 * production setting (budgets, outputHashing) untouched — see the "ci" configuration's comment
 * in angular.json for how the two configurations combine.
 */
export const environment = {
  production: true,
  apiUrl: 'http://localhost:3000',
};
