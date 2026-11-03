#!/usr/bin/env node
/**
 * Post-deploy smoke check (deploy.yml; also the runbook's manual check):
 *   node scripts/smoke-deploy.mjs https://store-staging.ta3lom.sa [expected-commit-sha] [--env staging|production]
 * /healthz 200 "ok"; /ar/ and /en/ 200 with the build stamp; /version.json's commit = the expected sha (when given)
 * and its env; staging answers X-Robots-Tag noindex. Retries for up to ~2 minutes while the container starts.
 */
const [base, sha] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const envIdx = process.argv.indexOf('--env');
const env = envIdx > 0 ? process.argv[envIdx + 1] : null;
if (!base) {
  console.error('usage: node scripts/smoke-deploy.mjs <base-url> [sha] [--env staging|production]');
  process.exit(2);
}
const url = (p) => `${base.replace(/\/$/, '')}${p}`;

async function once() {
  const problems = [];
  const h = await fetch(url('/healthz'));
  if (h.status !== 200 || (await h.text()).trim() !== 'ok') problems.push(`/healthz → ${h.status}`);
  for (const p of ['/ar/', '/en/']) {
    const r = await fetch(url(p));
    const html = await r.text();
    if (r.status !== 200) problems.push(`${p} → ${r.status}`);
    if (!html.includes('<meta name="build"')) problems.push(`${p} lacks the build stamp`);
    if (env === 'staging' && r.headers.get('x-robots-tag') !== 'noindex, nofollow') problems.push(`${p} is not X-Robots-Tag noindex on staging`);
  }
  const v = await fetch(url('/version.json'), { cache: 'no-store' }).then((r) => r.json());
  if (sha && v.commit !== sha) problems.push(`/version.json commit ${v.commit} ≠ ${sha}`);
  if (env && v.env !== env) problems.push(`/version.json env ${v.env} ≠ ${env}`);
  return { problems, v };
}

let last;
for (let i = 0; i < 24; i++) {
  try {
    last = await once();
    if (!last.problems.length) {
      console.log(`smoke-deploy: ${base} OK — ${last.v.version} (${String(last.v.commit).slice(0, 12)}, ${last.v.env})`);
      process.exit(0);
    }
  } catch (e) {
    last = { problems: [String(e.message ?? e)] };
  }
  await new Promise((r) => setTimeout(r, 5000));
}
console.error(`smoke-deploy: ${base} FAILED:\n  - ${last.problems.join('\n  - ')}`);
process.exit(1);
