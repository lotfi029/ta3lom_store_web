#!/usr/bin/env node
/**
 * Keeps src/locales/messages.en.xlf in step with the extracted Arabic source (src/locales/messages.xlf).
 *   node scripts/i18n-merge.mjs           merge: new ids get <target state="needs-translation"> (the Arabic copied in),
 *                                          ids no longer in the source are dropped, existing English is kept
 *   node scripts/i18n-merge.mjs --check   fail when any id is missing, untranslated, or not named @@store.<area>.<element>
 *   node scripts/i18n-merge.mjs --prune   also drop en.json entries whose id is no longer in the source (R5 clean-up)
 * Plan §4.1: every string has an id `@@store.<area>.<element>` and the English XLF is filled.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const SRC = 'src/locales/messages.xlf';
const EN = 'src/locales/messages.en.xlf';
/** English texts are authored here, one entry per id (ICU and placeholders written as in the XLF target). */
const MAP = 'src/locales/en.json';
const check = process.argv.includes('--check');
const ID = /^store\.[a-z0-9-]+(\.[a-zA-Z0-9-]+)+$/;

const units = (xml) => {
  const map = new Map();
  for (const m of xml.matchAll(/<trans-unit id="([^"]+)"[^>]*>([\s\S]*?)<\/trans-unit>/g)) map.set(m[1], m[2]);
  return map;
};
const part = (body, tag) => body.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`))?.[1];

const src = units(readFileSync(SRC, 'utf8'));
const en = existsSync(EN) ? units(readFileSync(EN, 'utf8')) : new Map();
const map = existsSync(MAP) ? JSON.parse(readFileSync(MAP, 'utf8')) : {};
const problems = [];
const out = [];

for (const [id, body] of src) {
  if (!ID.test(id)) problems.push(`id "${id}" is not @@store.<area>.<element>`);
  const source = part(body, 'source') ?? '';
  const prev = en.get(id);
  const prevSource = prev && part(prev, 'source');
  let target = prev && part(prev, 'target');
  let state = prev?.match(/<target state="([^"]+)"/)?.[1] ?? 'translated';
  if (!prev || target === undefined) {
    target = source;
    state = 'needs-translation';
  } else if (prevSource !== source && state !== 'needs-translation') {
    state = 'needs-review';
  }
  if (typeof map[id] === 'string') {
    // `{$name}` in en.json → the source's own placeholder element (<x id="name" …/>), matched case-insensitively.
    const xs = new Map([...source.matchAll(/<x id="([^"]+)"[^>]*\/>/g)].map((m) => [m[1].toLowerCase(), m[0]]));
    target = map[id].replace(/\{\$([A-Za-z0-9_]+)\}/g, (all, name) => {
      const x = xs.get(name.toLowerCase());
      if (!x) problems.push(`${id}: placeholder {$${name}} is not in the source`);
      return x ?? all;
    });
    for (const [name] of xs) if (!target.includes(`id="${[...source.matchAll(/<x id="([^"]+)"/g)].find((m) => m[1].toLowerCase() === name)?.[1]}"`)) problems.push(`${id}: English text drops the placeholder ${name}`);
    state = 'translated';
  }
  if (state !== 'translated' && state !== 'final') problems.push(`${id}: ${state} — "${source.replace(/<[^>]+>/g, '…').slice(0, 60)}"`);
  const notes = body.match(/<context-group[\s\S]*?<\/context-group>|<note[\s\S]*?<\/note>/g)?.join('\n        ') ?? '';
  out.push(
    `      <trans-unit id="${id}" datatype="html">\n        <source>${source}</source>\n        <target state="${state}">${target}</target>${notes ? `\n        ${notes}` : ''}\n      </trans-unit>`,
  );
}

const xml = `<?xml version="1.0" encoding="UTF-8" ?>\n<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n  <file source-language="ar" target-language="en" datatype="plaintext" original="ng2.template">\n    <body>\n${out.join('\n')}\n    </body>\n  </file>\n</xliff>\n`;
// The build reads messages.en.xlf, not en.json: a stale file ships untranslated English.
if (check && (!existsSync(EN) || readFileSync(EN, 'utf8') !== xml))
  problems.push(`${EN} is stale — run node scripts/i18n-merge.mjs`);
if (!check) {
  writeFileSync(EN, xml);
  console.log(`i18n-merge: ${src.size} units → ${EN}${problems.length ? ` (${problems.length} to translate/review)` : ''}`);
}
// Ids authored ahead of the code that uses them (e.g. problem messages before their first screen) are only reported.
const unused = Object.keys(map).filter((id) => !src.has(id));
if (process.argv.includes('--prune') && !check && unused.length) {
  for (const id of unused) delete map[id];
  writeFileSync(MAP, `${JSON.stringify(map, null, 2)}\n`);
  console.log(`i18n-merge: pruned ${unused.length} unused id(s) from ${MAP}`);
  unused.length = 0;
}
if (unused.length && !check) console.log(`i18n-merge: ${unused.length} id(s) in ${MAP} not used yet (kept): ${unused.slice(0, 5).join(', ')}${unused.length > 5 ? ' …' : ''}`);
if (problems.length) {
  for (const p of problems) console[check ? 'error' : 'log'](`  - ${p}`);
  if (check) {
    console.error(`i18n-merge --check: ${problems.length} problem(s)`);
    process.exit(1);
  }
} else if (check) console.log(`i18n-merge --check: ${src.size} units, all ids valid and translated`);
