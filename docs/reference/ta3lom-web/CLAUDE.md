# ta3lom-web

Front end for **ta3lom.sa**, the website of جمعية التعلم الإلكتروني (E-Learning Association),
a licensed non-profit in Riyadh.

Bilingual Arabic/English, **Arabic-first and right-to-left**. Public pages are prerendered to
static HTML and deployed to Hostinger; content comes from the `ta3lom-api` REST API.

---

## Stack

| | |
|---|---|
| Framework | Angular 22 — standalone components, zoneless, signals |
| Data | `httpResource()` against `api.ta3lom.sa` |
| Forms | Signal Forms (`@angular/forms/signals`) |
| Accessibility | Angular Aria primitives |
| Rendering | `@angular/ssr` in **static output mode** — prerender, not SSR |
| i18n | `@angular/localize`, two builds: `/ar` and `/en` |
| Tests | Vitest + Playwright + axe-core |
| Host | Hostinger, static files, no server process |

## Commands

```bash
npm start                # ng serve, localhost:4200
npm run build            # prebuild routes.mjs, then prerender both locales
npm run typecheck        # tsc --noEmit
npm run lint             # eslint, includes the RTL rule
npm test                 # vitest
npm run e2e              # playwright
npm run a11y             # axe-core over the built output
npm run types:pull       # copy api.types.ts from the API repo
```

---

## Specification

**Read these before implementing — do not infer the requirements.**

| Need | File |
|---|---|
| Structure, rendering, state, i18n, admin | `../../docs/architecture/02-frontend-architecture.md` |
| The API contract | `src/app/core/api.types.ts` (generated) and the API's `/docs` |
| What to build, with acceptance criteria | `../../docs/requirements/03-functional-requirements.md` |
| Measurable targets | `../../docs/requirements/04-non-functional-requirements.md` |
| Stories and their acceptance criteria | `../../docs/requirements/05-user-stories.md` |
| Why prerendering, not SSR | `../../docs/architecture/adr/ADR-002-prerendering-over-ssr.md` |
| Why bilingual columns | `../../docs/architecture/adr/ADR-003-bilingual-content-model.md` |
| Module-level detail for this repo | `docs/architecture/` |

The visual design is settled — the approved prototype defines layout, colour, type and motion.
Do not redesign. `src/styles/tokens.css` is the source of truth for every colour and spacing value
— components read its **semantic** tokens only (see Conventions).

---

## Architecture rules

### Dependency direction

```
features → shared → core
```

A feature may import from `shared` and `core`. `shared` may import from `core`.
**Nothing imports from `features`.** An ESLint boundaries rule enforces this.

- **`core/`** — singletons: API client, auth, SEO, i18n, interceptors, guards
- **`shared/ui/`** — presentational only. No HTTP, no router, no business logic.
- **`layout/`** — header, nav, footer, skip link, language switch
- **`features/`** — one folder per route group, each with its own `*.data.ts`

### Data access

Every feature that reads from the API has one `*.data.ts` service using `httpResource()`.
Components never call `HttpClient` directly.

```ts
@Injectable({ providedIn: 'root' })
export class ProgramsData {
  private readonly api = inject(API_URL);
  category = signal<Category | 'all'>('all');

  list = httpResource<Paged<Program>>(() => {
    const c = this.category();
    return `${this.api}/programs${c === 'all' ? '' : `?category=${c}`}`;
  });
}
```

Templates read `list.value()`, `list.isLoading()`, `list.error()`. No subscriptions, no `async`
pipe, no manual `unsubscribe`.

---

## Non-negotiables

**1. Logical CSS properties only.**
`margin-inline-start`, `padding-inline-end`, `inset-inline-start`. **Never** `margin-left`,
`padding-right`, `left`, `right`. A lint rule forbids them. This is what makes one stylesheet
serve both directions.

**2. Arabic is the primary language.**
Author RTL first, then check LTR. Arabic body copy uses `line-height: 1.85`; English uses `1.55`.
Numerals are Western (0123) everywhere.

**3. English falls back to Arabic.**
Never render an empty string when `titleEn` is null. Use the `pick()` helper.

```ts
export const pick = (locale: Locale, ar: string, en?: string | null) =>
  locale === 'en' ? (en?.trim() || ar) : ar;
```

**4. Every route sets its SEO tags.**
Title, meta description, canonical, Open Graph, Twitter card. A route that does not call
`SeoService.set()` fails a unit test. This closes audit findings F-14 and F-15.

**5. Exactly one `<h1>` per route.** Landmarks `<main>`, `<nav>`, `<footer>` present.
The old site had eight `<h1>` elements and no landmarks (F-16).

**6. `alt` is a required input** on the image component. The old site had 53 of 72 images with
no alt text (F-17).

**7. Minimum tap target 44 × 44 px.** The old site had 30 targets under 32 px (F-19).

**8. All motion respects `prefers-reduced-motion`.** Scroll reveals, the accordion auto-advance,
the marquee and the statistics count-up all stop.

**9. The access token lives in a signal, never `localStorage`.**
`localStorage` is readable by any XSS payload. See `ADR-006`.

**10. Budgets are not advisory.** `angular.json` fails the build past 400 KB transfer or
150 KB initial JS. Do not raise them to make a build pass — fix the cause.

**11. Never `bypassSecurityTrust*`.** ESLint bans every `bypassSecurityTrust…` call. The one
exception is `core/trusted-frame-url.ts`, the single audited `bypassSecurityTrustResourceUrl` for
iframes: https, no userinfo, an exact-origin allow-list with a path prefix per host. Every iframe
`src` goes through `TrustedFrameUrl.trust()`. The API sanitises Markdown on write and returns
`bodyArHtml`; bind that with `[innerHTML]` and let Angular sanitise again. If something you need
is being stripped, widen the allow-list **in the API**, deliberately.

**12. Alt text comes from the asset, never a hardcoded string.** Every image is a `MediaAsset`
with `altAr`/`altEn`. If an image has no alt, the fix is in the media library, not the template.

**13. Categories are API data.** Filter chips render from `GET /categories?scope=…`. A new
category added in the admin must appear on the public page after a rebuild with **no code
change**. Never hardcode a category array.

**14. Markdown renders through the `.prose` class**, styled from `tokens.css`. Headings start at
`h2` — the page owns its `h1`. Check it in RTL: list markers on the right, blockquote border on
the right, tables scrollable at 320 px.

**15. The CSP is enforced, and `script-src` stays hash-only.** `deploy/.htaccess` sends a full
Content-Security-Policy with **no `'unsafe-inline'`** for scripts. The inline theme script, the
event-dispatch contract and the (canonicalised) bootstrap are allowed by sha256 hash.
`scripts/check-csp.mjs` runs in every build and fails on:
- an inline script whose hash isn't listed;
- a listed hash no page uses;
- any inline `on*=` handler.

If you change the theme script, update its hash in `.htaccess` — the build tells you which. A new
third-party frame host goes into **both** `frame-src` and `core/trusted-frame-url.ts`. See ADR-010
and ADR-011.

---

## Conventions

- **TypeScript strict.** No `any`. API types come from `core/api.types.ts`, generated — never
  hand-written.
- **Standalone components only.** No `NgModule`.
- **Signals for state.** `input()` / `output()` functions, not decorators.
- **Control flow:** `@if`, `@for`, `@switch`, `@defer` — not `*ngIf`, `*ngFor`.
- **Naming:** files `kebab-case.ts`; one component per file; selector prefix `ta-`.
- **Styles:** component-scoped. Global styles only in `src/styles/`.
- **Tokens: semantic tokens only.** Components use the semantic layer — `--c-*` (and `--chart-*`)
  — never a palette token (`--ink`, `--brand-700`, `--gray`…) and never a colour literal (hex,
  `rgb()`, named colours). Stylelint enforces all three outside `src/styles/tokens.css`, which is
  the only file that holds colour values. This is what makes dark mode work: `tokens.css` remaps
  the semantic layer under `:root[data-theme='dark']` (ADR-011), and `npm run lint` checks every
  semantic text/surface pair for contrast in both themes (`scripts/contrast-check.mjs`).
- **Images:** `NgOptimizedImage`, with `priority` on the LCP element only.

---

## Rendering — read this before touching routing

The site is **prerendered, not server-rendered**. Hostinger lists Angular as a front-end
framework only; there is no Node process serving this app.

- `scripts/routes.mjs` runs before the build, queries the API for every slug, and writes
  `routes.txt`
- The build renders each route to static HTML for both locales, and every API response made
  during that render is embedded in the page's own `<script id="ng-state">` (Angular's HTTP
  transfer cache, on by default under `provideClientHydration()`)
- **In the browser, the app hydrates from that embedded state, then explicitly reloads every
  public resource** — `core/refresh-after-hydration.ts`. Without the reload, hydration simply
  replays the build-time snapshot forever; the transfer cache has no concept of "stale", only
  "already have an answer". A resource keeps its previous (cached) value while the reload is in
  flight, so this is invisible on a page that hasn't changed and updates in place on one that has
  — see that file's comment for the full reasoning, and Phase A of the code-review remediation for
  the incident that found it.
- **A visitor who never runs this JavaScript — a crawler, or a client with JS disabled — sees only
  the build-time snapshot.** The reload is a browser-side mechanism; it does nothing for anyone
  who doesn't execute it. That visitor's freshness bound is the same as everyone else's used to
  be: the last rebuild.
- **The admin route is excluded from prerendering** and is client-rendered behind a guard

Consequence: content published in the admin reaches an ordinary human visitor within moments of
their next page load, because of the reload above — but a crawler, and prerendered HTML in
general, still lags until the next build. The admin must say so — never imply a change is
instantly live *everywhere*. See `ADR-002`.

---

## Definition of done

- [ ] `npm run typecheck` and `npm run lint` clean
- [ ] `npm test` green
- [ ] `npm run build` passes the budgets
- [ ] `npm run a11y` clean on affected routes
- [ ] Renders correctly in **both** locales — check Arabic first
- [ ] Renders correctly in **both** themes — light and dark (`npm run a11y` checks both)
- [ ] No horizontal scroll at 320 px
- [ ] Keyboard operable with a visible focus ring
- [ ] `SeoService.set()` called on any new route
- [ ] `git diff` read by a human

---

## Working with me

- **Read the spec before implementing.** The requirements are written down.
- **Check Arabic before English.** A layout that works in LTR and breaks in RTL is a bug I will
  find at review, so find it first.
- **Use plan mode for anything touching more than three files.**
- **Ask before adding a dependency.**
- **Do not redesign.** The prototype is approved. If something seems wrong, say so — do not
  quietly change it.
