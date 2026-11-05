/**
 * The build environments, for the Node build scripts (routes, postbuild, CSP, deploy-output and container checks).
 * MUST match src/environments/environment.<name>.ts — `check-deploy-output` fails when the compiled bundle does not
 * carry this apiUrl, so the two can't drift silently. Selected with DEPLOY_ENV (default `local`).
 *   apiUrl      runtime API compiled into the app (CSP connect-src / img-src origin)
 *   site        canonical origin (SEO, sitemap)
 *   robots      `index` | `noindex` (staging: noindex everywhere — meta, X-Robots-Tag, robots.txt Disallow: /)
 *   deployable  false for builds that must never be published (local, ci)
 *   errorReportUrl  client error endpoint (P5); '' = reporter off. Its origin joins connect-src.
 *   showcase    showcase mode (no payments: no cart/checkout/sign-in routes, read-only donate boxes, the «قريبًا» note)
 */
export const ENVS = {
  local: {
    apiUrl: 'http://localhost:5080/v1',
    site: 'https://store.ta3lom.sa',
    robots: 'index',
    deployable: false,
    errorReportUrl: '',
    showcase: false,
  },
  ci: {
    apiUrl: 'http://localhost:3000/v1',
    site: 'https://store.ta3lom.sa',
    robots: 'index',
    deployable: false,
    errorReportUrl: '',
    showcase: false,
  },
  // The ci build with showcase on: the @showcase e2e on the stub (environment.ci-showcase.ts). Never published.
  'ci-showcase': {
    apiUrl: 'http://localhost:3000/v1',
    site: 'https://store.ta3lom.sa',
    robots: 'index',
    deployable: false,
    errorReportUrl: '',
    showcase: true,
  },
  // F10 full-stack e2e (scripts/full-stack-e2e.sh): production names served locally; never published.
  fullstack: {
    apiUrl: 'https://store-api.ta3lom.sa/v1',
    site: 'https://store.ta3lom.sa',
    robots: 'noindex',
    deployable: false,
    errorReportUrl: '',
    showcase: false,
  },
  staging: {
    apiUrl: 'https://store-api-staging.ta3lom.sa/v1',
    site: 'https://store-staging.ta3lom.sa',
    robots: 'noindex',
    deployable: true,
    errorReportUrl: '',
    showcase: true,
  },
  production: {
    apiUrl: 'https://store-api.ta3lom.sa/v1',
    site: 'https://store.ta3lom.sa',
    robots: 'index',
    deployable: true,
    errorReportUrl: '',
    showcase: true,
  },
};

export function deployEnv() {
  const name = process.env.DEPLOY_ENV ?? 'local';
  const env = ENVS[name];
  if (!env) throw new Error(`DEPLOY_ENV="${name}" — expected one of ${Object.keys(ENVS).join(', ')}`);
  return { name, ...env };
}
