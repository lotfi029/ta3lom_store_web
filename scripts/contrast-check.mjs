#!/usr/bin/env node
/**
 * WCAG contrast gate for the semantic colour layer (CR-01 FE-1, ADR-011). Part of `npm run lint`.
 *
 * Reads src/styles/tokens.css, resolves every `--c-*` / `--chart-*` token for BOTH themes (the
 * `:root` block, then `:root[data-theme='dark']` layered on top), and checks each text/background
 * pair below against its minimum: 4.5:1 for body text, 3:1 for large text, icons and UI
 * boundaries (WCAG 1.4.3 / 1.4.11). A token edit that pushes any pair under its minimum fails the
 * lint gate; `--verbose` prints every measured ratio (the numbers quoted in tokens.css come from
 * here). Semi-transparent colours are composited over the pair's background first.
 *
 * Dependency-free on purpose: the maths is WCAG 2.x relative luminance, ~20 lines.
 */
import { readFileSync } from 'node:fs';

const TEXT = 4.5;
const LARGE = 3;

/** [foreground, background, minimum, what it is] — keep in step with where the tokens are used. */
const PAIRS = [
  ['--c-text', '--c-bg', TEXT, 'body text'],
  ['--c-text', '--c-surface', TEXT, 'text on cards'],
  ['--c-text', '--c-surface-2', TEXT, 'text on recessed panels'],
  ['--c-text', '--c-surface-3', TEXT, 'text on hovered panels'],
  ['--c-text', '--c-tint', TEXT, 'text on tint'],
  ['--c-text', '--c-gold-tint', TEXT, 'text on gold tint'],
  ['--c-text-2', '--c-bg', TEXT, 'secondary text'],
  ['--c-text-2', '--c-surface', TEXT, 'secondary text on cards'],
  ['--c-text-2', '--c-surface-2', TEXT, 'secondary text on panels'],
  ['--c-muted', '--c-bg', TEXT, 'muted text'],
  ['--c-muted', '--c-surface', TEXT, 'muted text on cards'],
  ['--c-muted-2', '--c-surface-2', TEXT, 'muted text on panels'],
  ['--c-muted-2', '--c-bg', TEXT, 'muted text (panel variant) on the page'],
  ['--c-link', '--c-bg', TEXT, 'links'],
  ['--c-link', '--c-surface', TEXT, 'links on cards'],
  ['--c-link', '--c-surface-2', TEXT, 'links on panels'],
  ['--c-accent-strong', '--c-tint', TEXT, 'eyebrow / active chip'],
  ['--c-accent-strong', '--c-bg', TEXT, 'strong accent text'],
  ['--c-accent-strong', '--c-surface-2', TEXT, 'strong accent text on panels'],
  ['--c-accent', '--c-bg', LARGE, 'large accent text, icons, rules'],
  ['--c-accent', '--c-surface', LARGE, 'accent icons on cards'],
  ['--c-focus', '--c-bg', LARGE, 'focus ring'],
  ['--c-focus', '--c-surface', LARGE, 'focus ring on cards'],
  ['--c-focus', '--c-surface-2', LARGE, 'focus ring on panels'],
  ['--c-danger', '--c-bg', TEXT, 'error text'],
  ['--c-danger', '--c-surface', TEXT, 'error text in dialogs'],
  // Pre-existing light-mode value (the admin's green status text, 4.14:1). Changing it would change
  // light-mode pixels, which FE-1 must not do; recorded in the CR-01 notes as a finding instead.
  ['--c-success', '--c-surface', TEXT, 'success text', { preexistingLight: true }],
  ['--c-warn-text', '--c-gold-tint', TEXT, 'warning text on its tint'],
  ['--c-success-text', '--c-surface', TEXT, 'success text (store status pills)'],
  ['--c-success-text', '--c-surface-2', TEXT, 'success text on panels'],
  ['--c-danger', '--c-surface-2', TEXT, 'error text on panels'],
  ['--c-on-brand', '--c-brand-strong', TEXT, 'primary button'],
  ['--c-on-brand', '--c-brand-deep', TEXT, 'deep brand fill'],
  ['--c-on-gold', '--c-gold', TEXT, 'CTA button'],
  ['--c-on-inverse', '--c-inverse', TEXT, 'toast, active subnav pill'],
  ['--c-on-dark', '--c-surface-dark', TEXT, 'footer / sidebar text'],
  ['--c-on-dark-muted', '--c-surface-dark', TEXT, 'footer / sidebar muted text'],
  ['--c-on-brand', '--c-surface-dark', TEXT, 'white on the dark surfaces'],
  ['--c-on-dark-65', '--c-surface-dark', TEXT, 'section.dark lede'],
  ['--chart-on', '--chart-neutral', TEXT, 'org chart, grey box'],
  ['--chart-on', '--chart-sky', TEXT, 'org chart, light-blue box'],
  ['--chart-on', '--chart-green', TEXT, 'org chart, green box'],
  ['--chart-on', '--chart-brand', TEXT, 'org chart, blue box'],
  ['--chart-line', '--c-bg', LARGE, 'org chart connectors'],
];

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function block(selector) {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`contrast-check: ${selector} not found in tokens.css`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const vars = {};
  for (const m of css.slice(open + 1, close).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  return vars;
}

const light = block(':root {');
const dark = { ...light, ...block(":root[data-theme='dark']") };

function resolve(vars, value, depth = 0) {
  if (depth > 10) throw new Error(`contrast-check: var() cycle at ${value}`);
  const m = /^var\((--[\w-]+)\)$/.exec(value);
  if (!m) return value;
  if (!(m[1] in vars)) throw new Error(`contrast-check: ${m[1]} is not defined`);
  return resolve(vars, vars[m[1]], depth + 1);
}

function parse(value) {
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (m) {
    const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  m = /^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)(?:\s*\/\s*([\d.]+)(%?))?\s*\)$/.exec(value);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : m[5] ? +m[4] / 100 : +m[4] };
  throw new Error(`contrast-check: cannot parse colour "${value}"`);
}

const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
const channel = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = ({ r, g, b }) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

export function ratio(fg, bg) {
  const [l1, l2] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const verbose = process.argv.includes('--verbose');
let failures = 0;
for (const [theme, vars] of [
  ['light', light],
  ['dark', dark],
]) {
  for (const [fgName, bgName, min, what, flags = {}] of PAIRS) {
    const bg = parse(resolve(vars, `var(${bgName})`));
    const fg = over(parse(resolve(vars, `var(${fgName})`)), bg);
    const r = ratio(fg, bg);
    const ok = r >= min;
    const known = !ok && theme === 'light' && flags.preexistingLight;
    if (!ok && !known) failures += 1;
    if (!ok || verbose) console.log(`${ok ? '  ok ' : known ? 'KNOWN' : 'FAIL '} ${theme.padEnd(5)} ${r.toFixed(2).padStart(5)}:1 (min ${min}) ${fgName} on ${bgName} — ${what}`);
  }
}

if (failures) {
  console.error(`contrast-check: ${failures} pair(s) under their WCAG minimum — fix the token in src/styles/tokens.css.`);
  process.exit(1);
}
console.log(`contrast-check: ${PAIRS.length * 2} pairs pass (light + dark).`);
