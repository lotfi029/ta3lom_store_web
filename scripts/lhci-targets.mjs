#!/usr/bin/env node
/**
 * Prints the median Lighthouse results against the OWNER TARGETS (brief P4: performance ≥ 90, accessibility = 100,
 * best practices ≥ 95, SEO ≥ 95, LCP ≤ 2.5 s, CLS ≤ 0.05, TBT ≤ 200 ms) after `lhci autorun`. lighthouserc.json fails
 * the build on the targets that hold today and on measured floors for performance/LCP/TBT (DECISIONS HC P4, REVIEW);
 * this table keeps the remaining gap visible in every CI log. Never fails by itself.
 */
import { readdirSync, readFileSync } from 'node:fs';

const dir = '.lighthouseci';
const runs = {};
for (const f of readdirSync(dir).filter((n) => /^lhr-.*\.json$/.test(n))) {
  const d = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  (runs[d.finalDisplayedUrl] ??= []).push(d);
}
const median = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const T = { perf: 0.9, a11y: 1, bp: 0.95, seo: 0.95, lcp: 2500, cls: 0.05, tbt: 200 };
const mark = (ok) => (ok ? '✓' : '✗');
console.log('lhci-targets: median of runs vs owner targets (perf ≥ 90, a11y 100, BP ≥ 95, SEO ≥ 95, LCP ≤ 2.5 s, CLS ≤ 0.05, TBT ≤ 200 ms)');
for (const [url, ds] of Object.entries(runs)) {
  const c = (k) => median(ds.map((d) => d.categories[k].score));
  const a = (k) => median(ds.map((d) => d.audits[k].numericValue));
  const m = { perf: c('performance'), a11y: c('accessibility'), bp: c('best-practices'), seo: c('seo'), lcp: a('largest-contentful-paint'), cls: a('cumulative-layout-shift'), tbt: a('total-blocking-time') };
  console.log(
    `  ${new URL(url).pathname.padEnd(24)} perf ${Math.round(m.perf * 100)} ${mark(m.perf >= T.perf)}  a11y ${Math.round(m.a11y * 100)} ${mark(m.a11y >= T.a11y)}  BP ${Math.round(m.bp * 100)} ${mark(m.bp >= T.bp)}  SEO ${Math.round(m.seo * 100)} ${mark(m.seo >= T.seo)}  LCP ${Math.round(m.lcp)} ms ${mark(m.lcp <= T.lcp)}  CLS ${m.cls.toFixed(3)} ${mark(m.cls <= T.cls)}  TBT ${Math.round(m.tbt)} ms ${mark(m.tbt <= T.tbt)}`,
  );
}
