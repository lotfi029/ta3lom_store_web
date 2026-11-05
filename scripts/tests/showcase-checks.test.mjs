// SW-5: the deploy-output rules of showcase mode (scripts/lib/showcase-checks.mjs, used by check-deploy-output.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOTE, applePayVerdict, showcaseProblems } from '../lib/showcase-checks.mjs';

const prod = { envName: 'production', deployable: true, dryRun: false };

test('Apple Pay placeholder: a live production build fails', () =>
  assert.ok(applePayVerdict({ ...prod, placeholder: true, showcase: false }).problem));
test('Apple Pay placeholder: a showcase production build only warns', () => {
  const v = applePayVerdict({ ...prod, placeholder: true, showcase: true });
  assert.equal(v.problem, undefined);
  assert.ok(v.warning);
});
test('Apple Pay placeholder: staging and a production dry run warn, local/ci say nothing', () => {
  assert.ok(applePayVerdict({ envName: 'staging', deployable: true, dryRun: false, placeholder: true, showcase: true }).warning);
  assert.ok(applePayVerdict({ ...prod, dryRun: true, placeholder: true, showcase: false }).warning);
  assert.deepEqual(applePayVerdict({ envName: 'ci', deployable: false, dryRun: false, placeholder: true, showcase: false }), {});
});
test("Apple Pay: Moyasar's real file passes everywhere", () =>
  assert.deepEqual(applePayVerdict({ ...prod, placeholder: false, showcase: false }), {}));

const sitemap = '<urlset><url><loc>https://store.ta3lom.sa/ar/</loc></url><url><loc>https://store.ta3lom.sa/en/p/wells</loc></url></urlset>';
const pages = [
  { path: 'ar/index.html', html: `<main>${NOTE.ar}</main>` },
  { path: 'en/index.html', html: `<main>${NOTE.en}</main>` },
  { path: 'ar/p/wells/index.html', html: `<aside>${NOTE.ar}</aside>` },
];

test('showcase: a clean output passes', () => assert.deepEqual(showcaseProblems({ showcase: true, sitemap, pages }), []));
test('showcase: a donor-only route in the sitemap fails', () => {
  for (const route of ['cart', 'checkout', 'orders/T3-26-000001', 'login', 'account/donations'])
    assert.equal(
      showcaseProblems({ showcase: true, sitemap: sitemap.replace('/en/p/wells', `/en/${route}`), pages }).length,
      1,
      route,
    );
});
test('showcase: a prerendered home or project page without the note fails', () => {
  const missing = pages.map((p, i) => (i === 2 ? { ...p, html: '<aside>تبرع</aside>' } : p));
  assert.match(showcaseProblems({ showcase: true, sitemap, pages: missing })[0], /ar\/p\/wells/);
});
test('live: the note must not be on a prerendered page', () => {
  assert.equal(showcaseProblems({ showcase: false, sitemap, pages }).length, 3);
  assert.deepEqual(showcaseProblems({ showcase: false, sitemap, pages: pages.map((p) => ({ ...p, html: '<main></main>' })) }), []);
});
