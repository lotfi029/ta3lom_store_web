#!/usr/bin/env node
/**
 * Keeps src/locales/messages.en.xlf in step with the extracted Arabic source (src/locales/messages.xlf).
 *   node scripts/i18n-merge.mjs           merge: new ids get <target state="needs-translation"> (the Arabic copied in),
 *                                          ids no longer in the source are dropped, existing English is kept
 *   node scripts/i18n-merge.mjs --check   fail when any id is missing, untranslated, or not named @@store.<area>.<element>
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
    target = map[id];
    state = 'translated';
  }
  if (state !== 'translated' && state !== 'final') problems.push(`${id}: ${state} — "${source.replace(/<[^>]+>/g, '…').slice(0, 60)}"`);
  const notes = body.match(/<context-group[\s\S]*?<\/context-group>|<note[\s\S]*?<\/note>/g)?.join('\n        ') ?? '';
  out.push(
    `      <trans-unit id="${id}" datatype="html">\n        <source>${source}</source>\n        <target state="${state}">${target}</target>${notes ? `\n        ${notes}` : ''}\n      </trans-unit>`,
  );
}

if (!check) {
  const xml = `<?xml version="1.0" encoding="UTF-8" ?>\n<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n  <file source-language="ar" target-language="en" datatype="plaintext" original="ng2.template">\n    <body>\n${out.join('\n')}\n    </body>\n  </file>\n</xliff>\n`;
  writeFileSync(EN, xml);
  console.log(`i18n-merge: ${src.size} units → ${EN}${problems.length ? ` (${problems.length} to translate/review)` : ''}`);
}
for (const id of Object.keys(map)) if (!src.has(id)) problems.push(`${MAP} has "${id}", which no template uses — remove it`);
if (problems.length) {
  for (const p of problems) console[check ? 'error' : 'log'](`  - ${p}`);
  if (check) {
    console.error(`i18n-merge --check: ${problems.length} problem(s)`);
    process.exit(1);
  }
} else if (check) console.log(`i18n-merge --check: ${src.size} units, all ids valid and translated`);
