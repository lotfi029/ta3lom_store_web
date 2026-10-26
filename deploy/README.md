# Deploying the store web (static)

The store web is **static files only** — no Node server in production ([ADR-S09](../docs/adr/ADR-S09-store-web-separate-app.md),
plan §2.5). This folder holds what the host needs; hosting itself (Caddy, VPS, DNS, certificates) is a separate step
and is not done from this repo.

## Build

```bash
npm ci
PRERENDER_API_URL=https://store-api.ta3lom.sa/v1 npm run build:prod   # payments guard → routes.mjs (project slugs) → ng build → checks
```

`build:prod` uses `src/environments/environment.production.ts` (`apiUrl` = `https://store-api.ta3lom.sa/v1`).
`PRERENDER_API_URL` is where the BUILD reads the catalogue (C-1; default: the runtime `apiUrl`) — the compiled app always
talks to `apiUrl`. **Production is blocked until R5-Payments (D-W2):** `scripts/check-payments-flag.mjs` fails
`build:prod` while `paymentsEnabled` is `false`. Only the CI dry run sets `ALLOW_PAYMENTS_DISABLED=1` (it prints a
warning); the deploy workflow must never set it. The build fails unless every gate passes:

| Gate                              | What it checks                                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `scripts/check-payments-flag.mjs` | `paymentsEnabled` is true in the production environment (D-W2)                                                              |
| `scripts/check-deploy-output.mjs` | `index.html`, `sitemap.xml`, `robots.txt`, `{ar,en}/index.html`, `{ar,en}/index.csr.html` and every prerendered route exist; the fallback rules below are documented; every file world-readable; with `build:prod`: the runtime API URL is compiled in and allowed by the CSP `connect-src` |
| `scripts/check-csp.mjs`           | every inline script on every page is allowed by a hash in `caddy-headers.conf`; no unused hash; no inline handlers         |
| `scripts/check-bundle-budget.mjs` | initial JS ≤ 150 KB and initial transfer ≤ 400 KB (gzip), per locale                                                       |

Publish **`dist/store-web/browser/`** as the web root.

## Web root layout

```
/index.html            → meta refresh to /ar/ (copy of deploy/index.html); the host should also 302 / → /ar/
/robots.txt /sitemap.xml /favicon.*
/ar/…  /en/…           → one Angular build per locale (base href /ar/ and /en/)
  index.html           → prerendered home
  p/<slug>/index.html  → prerendered project pages (build-time catalogue)
  index.csr.html       → the client-rendered shell: fallback for every other path in that locale
  *.js *.css media/    → fingerprinted assets
```

## Host rules (Caddy sketch)

```caddy
store.ta3lom.sa {
	root * /srv/store-web            # dist/store-web/browser
	import /etc/caddy/store-web-headers.conf   # = deploy/caddy-headers.conf

	redir / /ar/ 302

	@ar path /ar/*
	handle @ar {
		try_files {path} {path}/index.html /ar/index.csr.html
		file_server
	}
	@en path /en/*
	handle @en {
		try_files {path} {path}/index.html /en/index.csr.html
		file_server
	}
	handle {
		file_server
	}

	# Fingerprinted assets never change; HTML must be revalidated so a deploy is visible at once.
	@assets path_regexp \.(js|css|woff2)$
	header @assets Cache-Control "public, max-age=31536000, immutable"
	@html path *.html */
	header @html Cache-Control "no-cache"
	encode zstd gzip
}
```

- **Client fallback (E-1).** A project published after the build has no prerendered page: `try_files` serves
  `/{locale}/index.csr.html` (`no-cache`, like every HTML file), which renders it in the browser. The page shows the
  real not-found page (`noindex`) only when the API answers 404 for that slug. Cart, checkout, order, account, login
  and admin are always client-rendered. Follow-up (recorded in DECISIONS): rebuild on publish, so new projects get a
  prerendered page too.
- **404s.** Unknown paths also get the shell, and the app shows its own not-found page (`noindex`).
- **Order pages (E-2).** `/{locale}/orders/*` carry a status token in the link; serve them with
  `Referrer-Policy: no-referrer` (see `caddy-headers.conf`); the page also sets it in a `<meta>` and strips the token
  from the address bar.

## Security headers

`caddy-headers.conf` is the source of truth for the Content-Security-Policy (`script-src` is hash-only; `connect-src`
and `img-src` allow `https://store-api.ta3lom.sa`), HSTS, `nosniff`, referrer and permissions policies, COOP. If the
pre-paint theme script in `src/index.html` changes, its hash must be updated here — `check-csp` fails the build until
it is (do not let a formatter touch `src/index.html`; it is in `.prettierignore`).

## The API side

The store API must allow the origin `https://store.ta3lom.sa` (CORS with credentials) and set its refresh cookies for
that site (plan §3.2). The web sends credentials and bearer tokens **only** to `https://store-api.ta3lom.sa/v1`.

## After a catalogue change

Options, amounts and availability are refreshed in the browser after every page load. Titles, descriptions and SEO text of prerendered pages
change with the next build — rebuild and publish to refresh them (the admin shows this notice).
