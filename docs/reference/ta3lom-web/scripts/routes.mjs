#!/usr/bin/env node
/**
 * Runs before every build (see "prebuild" in package.json). Fetches every published program
 * and post slug from the API, combines them with the static route list from
 * docs/requirements/03-functional-requirements.md FR-03, and writes:
 *   - routes.txt                     one route per line, prefixed /ar/ and /en/ (ADR-002: two
 *                                    separate prerendered locale builds)
 *   - src/app/prerender-manifest.ts  THE SOURCE OF TRUTH for what app.routes.server.ts
 *                                    prerenders — see the note below
 *   - public/sitemap.xml             every route, both locales, each pointing at its
 *                                    alternate-locale counterpart via <xhtml:link rel="alternate">
 *   - public/robots.txt              allows indexing, references the sitemap
 *
 * sitemap.xml/robots.txt land in public/ so the ordinary asset copy duplicates them into both
 * dist/ta3lom/browser/ar/ and /en/ — there is no shared site root in this dual-locale static
 * layout (see ADR-002), so a root-level copy is a deployment-time concern, not a build one.
 *
 * Fails the build loudly if the API is unreachable — a silent partial prerender is worse than
 * no build at all (ADR-002).
 *
 * Part 0 (Session 2): `prerender-manifest.ts` is THIS FILE's fourth output and the fix for a
 * two-sources-of-truth bug — `app.routes.server.ts` used to independently re-fetch the same
 * three slug lists via its own getPrerenderParams(), so sitemap.xml (built here) and the
 * actually-prerendered set (built there) could drift, which
 * docs/architecture/02-routing-and-rendering.md:199 says must never happen. Now
 * app.routes.server.ts imports the generated module and fetches nothing. THIS FILE OWNS THE
 * LIST — `prerender-manifest.ts` is generated and committed (so typecheck/lint work before a
 * build has run) and must not be hand-edited; re-run `node scripts/routes.mjs` to refresh it.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const SITE_ORIGIN = process.env.SITE_ORIGIN ?? 'https://ta3lom.sa';
const LOCALES = ['ar', 'en'];

/**
 * api.ta3lom.sa sits behind Hostinger's edge (hcdn), whose bot protection answers a bare
 * `fetch()` with its own HTML `403 Forbidden` page — no app headers, so it never reaches the
 * API at all. Node sends no meaningful User-Agent by default, which is exactly what gets
 * flagged; a normal one is served fine. Reproduced directly: `curl` with its own UA got 200
 * while `node -e "fetch(...)"` got 403 against the same URL, seconds apart.
 *
 * The block is also IP-sticky once tripped, hence the retry: a build that starts while a
 * previous attempt's block is still in force would otherwise fail outright, and this script
 * failing means no build at all (ADR-002).
 *
 * The UA must NOT look like a browser. This used to be `Mozilla/5.0 (compatible; ta3lom-build…)`,
 * and with the CDN disabled the origin's own LiteSpeed answered it — from GitHub Actions runners,
 * not from a residential IP — with a `403 Bot Verification` page: a challenge meant for browsers,
 * which a script can never pass. Node's default `node` UA got the same page. A plain product
 * token like this one, or curl's own UA, went straight through: 6 of 6 runs across 3 runner IPs
 * on 2026-09-24, where the Mozilla UA failed every time.
 */
const USER_AGENT = 'ta3lom-build/1.0 (+https://ta3lom.sa)';
const RETRIES = 4;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** `HTTP 403 (Server: hcdn)` — the Server header names the layer that answered (hcdn = the CDN,
 *  LiteSpeed = the origin), which is the first thing ta3lom-api's DEPLOY.md §"403 Forbidden" asks. */
const statusLine = (res) => `HTTP ${res.status} (Server: ${res.headers.get('server') ?? 'none'})`;

async function apiFetch(path) {
  let last;

  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    const res = await fetch(`${API_URL}${path}`, { headers: { 'user-agent': USER_AGENT } });
    if (res.ok) return res;

    last = res;
    // 403 here is the host, not the API — worth waiting out. The usual cause is the previous
    // build's own burst of prerender requests from this same build server (see
    // src/app/core/prerender-http-cache.server.ts). A 404/422 is a real answer and retrying it
    // only delays a failure that is not going to change.
    if (res.status !== 403 && res.status < 500) break;
    if (attempt < RETRIES) {
      const wait = 2000 * 2 ** attempt;
      console.warn(`routes.mjs: ${path} -> ${statusLine(res)}, retrying in ${wait / 1000}s`);
      await sleep(wait);
    }
  }

  throw new Error(`${path} -> ${statusLine(last)}`);
}

const STATIC_ROUTES = [
  '/',
  '/about/identity',
  '/about/leadership',
  '/about/governance',
  '/about/reports',
  '/about/assembly',
  '/about/strategic-plan',
  '/about/operational-plan',
  '/about/project-reports',
  '/about/committees',
  '/about/committee-decisions',
  '/about/investor-decisions',
  '/about/beneficiaries',
  '/about/websites',
  '/about/licensing',
  '/programs',
  '/videos',
  '/media/news',
  '/media/articles',
  '/media/press',
  '/partners',
  '/get-involved/volunteer',
  '/get-involved/membership',
  '/donate',
  '/contact',
  '/privacy',
];

/**
 * Videos have no slug — the API identifies them by UUID, so /videos/:id is keyed on `id`.
 * Same request, different field; kept separate from fetchSlugs rather than parameterised so each
 * call site reads as what it is.
 */
async function fetchIds(path) {
  const res = await apiFetch(path);
  const body = await res.json();
  return body.items.map((item) => item.id);
}

/**
 * GET /partners answers with a GROUPED object ({ executive, donor, award }), not the paged
 * { items: [...] } envelope every other list uses, so fetchIds() cannot be pointed at it — see
 * partners.service.ts's listPublished header for why that shape exists.
 */
async function fetchPartnerIds() {
  const res = await apiFetch('/partners');
  const body = await res.json();
  return [...body.executive, ...body.donor, ...body.award].map((item) => item.id);
}

async function fetchSlugs(path) {
  const res = await apiFetch(path);
  const body = await res.json();
  return body.items.map((item) => item.slug);
}

/** Reads `.total` off the standard { items, total, page, size } envelope — used by NEVER_EMPTY
 *  below, which only cares about the count, not the items themselves. */
async function countOf(path) {
  const res = await apiFetch(path);
  const body = await res.json();
  return body.total;
}

/** GET /leadership/structure returns an array of category nodes (board, staff, ...), each with
 *  its own `members` array and nested `children` — not the paged envelope fetchIds() reads, so this
 *  walks the whole tree instead.
 *
 *  One function, two callers: the /about/leadership/:id route list AND the NEVER_EMPTY guard,
 *  which reads `.length` off the same array. It used to return only a count; a second fetch of the
 *  same endpoint for the ids would let the two disagree about what "published" meant at build
 *  time, which is the whole failure mode this file exists to prevent. */
async function fetchLeadershipMemberIds() {
  const res = await apiFetch('/leadership/structure');
  const nodes = await res.json();
  const collect = (list) => list.flatMap((node) => [...node.members.map((m) => m.id), ...collect(node.children ?? [])]);
  return collect(nodes);
}

/**
 * Collections that must never be empty on a successful build. The fetches in main() below only
 * fail on a network error or a non-OK HTTP status — a `200` with zero items is a valid response as
 * far as they're concerned, and until now nothing checked further. That is exactly how the live
 * site went empty before: a build ran while every collection legitimately returned `200` with
 * `items: []`, and every page faithfully rendered "nothing here yet" — which then got published as
 * the source of truth.
 *
 * Scoped to collections with real published content as of this writing (confirmed against the
 * live API) — news, articles, partners and press documents are still genuinely empty, so adding
 * them here today would fail every build. Add an entry once real content exists for it; this
 * array is deliberately the one place to edit, not logic scattered through the file. It is built by
 * a function rather than declared as a constant so an entry can be checked against data main() has
 * already fetched, instead of every entry needing an endpoint of its own.
 */
function neverEmptyChecks({ leaderIds }) {
  return [
    { name: 'programs', check: () => countOf('/programs?size=1') },
    { name: 'videos', check: () => countOf('/videos?size=1') },
    // Counted from the ids main() already fetched for the /about/leadership/:id routes rather than
    // re-requesting /leadership/structure — one fetch, so this guard and the route list can never
    // disagree about what was published at build time.
    { name: 'leadership members', check: async () => leaderIds.length },
    { name: 'reports documents', check: () => countOf('/documents?section=reports&size=1') },
  ];
}
const MIN_COUNT = 1;

const MANIFEST_PATH = 'src/app/prerender-manifest.ts';

/**
 * Opt-in escape hatch for "the API is unreachable but the site must still be rebuilt".
 *
 * ADR-002 makes this script fail loudly rather than prerender a partial site, and that stays the
 * default — this is deliberately off unless someone sets `ALLOW_STALE_ROUTES=1` for a specific
 * deploy, so it can never quietly become the normal path.
 *
 * Why it is not the thing ADR-002 forbids: a partial prerender is a route list assembled from a
 * half-answered API, where some collections are silently empty. This instead reuses the LAST
 * COMPLETE list, whole — `prerender-manifest.ts` is committed, and is only ever written by a run
 * that reached the API for every collection. So the result is *stale*, not partial: every page it
 * builds is a page that genuinely existed at the last successful run.
 *
 * Stale still means wrong, though, in the one direction that matters: content published since
 * that run has no route here and will not be prerendered. That is why this warns as loudly as the
 * failure it replaces, and why it refuses to rewrite the manifest — the committed file stays the
 * record of when the list was last actually verified against the API.
 */
const ALLOW_STALE_ROUTES = process.env.ALLOW_STALE_ROUTES === '1';

/** The committed manifest read back as data. It is generated with JSON.stringify, so each array
 *  literal is strict JSON and parses exactly. */
function readCommittedManifest() {
  const source = readFileSync(MANIFEST_PATH, 'utf8');
  const read = (name) => {
    const found = source.match(new RegExp(`export const ${name}: string\\[\\] = (\\[[^\\]]*\\]);`));
    if (!found) throw new Error(`${MANIFEST_PATH} has no ${name}`);
    return JSON.parse(found[1]);
  };
  return {
    programSlugs: read('PROGRAM_SLUGS'),
    newsSlugs: read('NEWS_SLUGS'),
    articleSlugs: read('ARTICLE_SLUGS'),
    videoIds: read('VIDEO_IDS'),
    partnerIds: read('PARTNER_IDS'),
    leaderIds: read('LEADER_IDS'),
  };
}

function localePath(locale, route) {
  return `/${locale}${route === '/' ? '' : route}`;
}

function writeRoutesFile(allRoutes) {
  const lines = LOCALES.flatMap((locale) => allRoutes.map((route) => localePath(locale, route)));
  writeFileSync('routes.txt', `${lines.join('\n')}\n`);
  return lines;
}

function writeSitemap(allRoutes) {
  const urlEntries = LOCALES.flatMap((locale) =>
    allRoutes.map((route) => {
      const alternates = LOCALES.map(
        (altLocale) =>
          `    <xhtml:link rel="alternate" hreflang="${altLocale}" href="${SITE_ORIGIN}${localePath(altLocale, route)}" />`,
      ).join('\n');
      return (
        `  <url>\n` +
        `    <loc>${SITE_ORIGIN}${localePath(locale, route)}</loc>\n` +
        `${alternates}\n` +
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${localePath('ar', route)}" />\n` +
        `  </url>`
      );
    }),
  );

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    `${urlEntries.join('\n')}\n` +
    `</urlset>\n`;

  writeFileSync('public/sitemap.xml', xml);
}

function writeRobots() {
  const robots = `User-agent: *\nAllow: /\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`;
  writeFileSync('public/robots.txt', robots);
}

/**
 * The single source of truth `app.routes.server.ts` imports — see the header comment above.
 * `routes` is the unprefixed route list (what STATIC_ROUTES + the dynamic slugs produce, before
 * the /ar//en/ locale prefix is applied); `scripts/a11y.mjs` prefixes it per locale itself, the
 * same way `localePath()` does here, so the a11y sweep and the prerendered set can never disagree
 * either.
 */
function writeManifest(programSlugs, newsSlugs, articleSlugs, videoIds, partnerIds, leaderIds, routes) {
  const ts =
    `// GENERATED by scripts/routes.mjs — do not hand-edit. Re-run \`node scripts/routes.mjs\`\n` +
    `// (or \`npm run build\`, which runs it as a prebuild step) to refresh this file.\n` +
    `//\n` +
    `// This is the single source of truth for prerendering: app.routes.server.ts imports the\n` +
    `// slug arrays below instead of fetching them itself, so the prerendered set can never drift\n` +
    `// from sitemap.xml/routes.txt, which this same script writes from the same data\n` +
    `// (docs/architecture/02-routing-and-rendering.md:199).\n\n` +
    `export const PROGRAM_SLUGS: string[] = ${JSON.stringify(programSlugs)};\n` +
    `export const NEWS_SLUGS: string[] = ${JSON.stringify(newsSlugs)};\n` +
    `export const ARTICLE_SLUGS: string[] = ${JSON.stringify(articleSlugs)};\n` +
    `export const VIDEO_IDS: string[] = ${JSON.stringify(videoIds)};\n` +
    `export const PARTNER_IDS: string[] = ${JSON.stringify(partnerIds)};\n` +
    `export const LEADER_IDS: string[] = ${JSON.stringify(leaderIds)};\n\n` +
    `/** Every route, unprefixed by locale — the same list writeSitemap() and writeRoutesFile() build from. */\n` +
    `export const ROUTES: string[] = ${JSON.stringify(routes)};\n`;
  writeFileSync('src/app/prerender-manifest.ts', ts);
}

async function main() {
  let programSlugs;
  let newsSlugs;
  let articleSlugs;
  let videoIds;
  let partnerIds;
  let leaderIds;
  let stale = false;

  try {
    programSlugs = await fetchSlugs('/programs?size=100');
    newsSlugs = await fetchSlugs('/posts?kind=news&size=100');
    articleSlugs = await fetchSlugs('/posts?kind=articles&size=100');
    videoIds = await fetchIds('/videos?size=100');
    partnerIds = await fetchPartnerIds();
    leaderIds = await fetchLeadershipMemberIds();
  } catch (err) {
    console.error(`routes.mjs: could not reach the API at ${API_URL} to build the route list.`);
    console.error(err instanceof Error ? err.message : err);

    if (!ALLOW_STALE_ROUTES) {
      console.error('A silent partial prerender is worse than no build — failing loudly (ADR-002).');
      console.error('To build anyway from the last verified route list, set ALLOW_STALE_ROUTES=1.');
      process.exitCode = 1;
      return;
    }

    try {
      ({ programSlugs, newsSlugs, articleSlugs, videoIds, partnerIds, leaderIds } =
        readCommittedManifest());
    } catch (fallbackErr) {
      console.error(`routes.mjs: ALLOW_STALE_ROUTES=1 but ${MANIFEST_PATH} could not be read.`);
      console.error(fallbackErr instanceof Error ? fallbackErr.message : fallbackErr);
      process.exitCode = 1;
      return;
    }

    stale = true;
    console.warn('');
    console.warn(`routes.mjs: ⚠ STALE BUILD — falling back to ${MANIFEST_PATH} (ALLOW_STALE_ROUTES=1).`);
    console.warn('routes.mjs: ⚠ this list was last verified against the API when that file was');
    console.warn('routes.mjs: ⚠ generated. Anything published since then has NO route here and');
    console.warn('routes.mjs: ⚠ will NOT be prerendered. Rebuild once the API is reachable.');
    console.warn('');
  }

  // These guards count published items via the API, so on the stale path there is nothing to ask.
  // The list being reused already passed them on the run that produced it, which is the only
  // assurance available when the API cannot be reached at all.
  try {
    for (const { name, check } of stale ? [] : neverEmptyChecks({ leaderIds })) {
      const count = await check();
      if (count < MIN_COUNT) {
        console.error(
          `routes.mjs: refusing to build — "${name}" has ${count} published item(s), minimum is ${MIN_COUNT}.`,
        );
        console.error(
          'A build that silently publishes an empty collection is worse than a failed build ' +
            '(this is literally how the live site went empty before).',
        );
        process.exitCode = 1;
        return;
      }
    }
  } catch (err) {
    console.error(`routes.mjs: could not verify published-content counts against ${API_URL}.`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
    return;
  }

  const dynamicRoutes = [
    ...programSlugs.map((slug) => `/programs/${slug}`),
    ...newsSlugs.map((slug) => `/media/news/${slug}`),
    ...articleSlugs.map((slug) => `/media/articles/${slug}`),
    ...videoIds.map((id) => `/videos/${id}`),
    ...partnerIds.map((id) => `/partners/${id}`),
    ...leaderIds.map((id) => `/about/leadership/${id}`),
  ];
  const allRoutes = [...STATIC_ROUTES, ...dynamicRoutes];

  const lines = writeRoutesFile(allRoutes);
  writeSitemap(allRoutes);
  writeRobots();
  // Never on the stale path: the manifest is the record of when this list was last actually
  // verified against the API, and rewriting it from itself would erase that — a later reader
  // could not tell a checked list from a reused one.
  if (!stale) {
    writeManifest(programSlugs, newsSlugs, articleSlugs, videoIds, partnerIds, leaderIds, allRoutes);
  }

  console.log(
    `routes.mjs: ${stale ? '⚠ STALE — ' : ''}${allRoutes.length} unique routes ` +
      `(${STATIC_ROUTES.length} static + ${dynamicRoutes.length} dynamic) ` +
      `x ${LOCALES.length} locales = ${lines.length} lines written to routes.txt, ` +
      `sitemap.xml and robots.txt regenerated` +
      `${stale ? ` — reused from ${MANIFEST_PATH}, manifest left untouched` : ''}`,
  );
}

await main();
