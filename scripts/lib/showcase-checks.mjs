/**
 * Deploy-output rules of showcase mode (SW-5), pure so scripts/tests can cover them; check-deploy-output.mjs applies
 * them to dist/.
 *   - Apple Pay placeholder: FAILS a real production build only when showcase is off (payments live); with showcase on
 *     (no payments) it is a warning, like staging and a production dry run.
 *   - showcase on: no donor-only route (cart, checkout, orders, login, account) in the sitemap, and every prerendered
 *     home and project page carries the «قريبًا» note — so a showcase build can never send a donor towards a payment.
 *   - showcase off: the note is on no prerendered page (a live build must not say "soon").
 */

/** The note as prerendered (Arabic source, English from src/locales/en.json `store.showcase.note`). */
export const NOTE = { ar: 'التبرع الإلكتروني قريبًا', en: 'Online donations open soon' };

const DONOR_ONLY = /\/(ar|en)\/(cart|checkout|orders|login|account)(\/|<|$)/;

/** @returns {{ problem?: string, warning?: string }} */
export function applePayVerdict({ envName, deployable, dryRun, placeholder, showcase }) {
  if (!placeholder) return {};
  const message =
    "the Apple Pay domain file is still the placeholder — put Moyasar's file in deploy/well-known/ (deploy/README.md, \"Apple Pay\")";
  if (envName === 'production' && !dryRun && !showcase) return { problem: message };
  if (deployable || (envName === 'production' && dryRun)) return { warning: `${message}${showcase ? ' (showcase: no payments yet)' : ''}` };
  return {};
}

/**
 * @param {{ showcase: boolean, sitemap: string | null, pages: { path: string, html: string }[] }} output
 *   `pages`: the prerendered home and project pages (`ar/index.html`, `en/p/<slug>/index.html`, …).
 * @returns {string[]} problems
 */
export function showcaseProblems({ showcase, sitemap, pages }) {
  const problems = [];
  if (showcase) {
    for (const loc of sitemap?.match(/<loc>[^<]*<\/loc>/g) ?? [])
      if (DONOR_ONLY.test(loc)) problems.push(`showcase: the sitemap lists a donor-only route ${loc.replace(/<\/?loc>/g, '')}`);
    for (const p of pages) {
      const note = p.path.startsWith('en/') ? NOTE.en : NOTE.ar;
      if (!p.html.includes(note)) problems.push(`showcase: ${p.path} lacks the note «${note}»`);
    }
  } else {
    for (const p of pages)
      if (p.html.includes(NOTE.ar) || p.html.includes(NOTE.en)) problems.push(`live build: ${p.path} shows the showcase note`);
  }
  return problems;
}
