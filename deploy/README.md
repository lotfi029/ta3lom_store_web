# Deploying the store web (static)

The store web is **static files only** — no Node server in production ([ADR-S09](../docs/adr/ADR-S09-store-web-separate-app.md),
plan §2.5). This folder holds what the host needs; hosting itself (Caddy, VPS, DNS, certificates) is a separate step
and is not done from this repo.

## Build

```bash
npm ci
STORE_API_URL=https://store-api.ta3lom.sa/v1 npm run build:prod   # routes.mjs (product slugs) → ng build → checks
```

`build:prod` uses `src/environments/environment.production.ts` (`apiUrl` = `https://store-api.ta3lom.sa/v1`,
`devPaymentTrigger: false`). The build fails unless every gate passes:

| Gate                              | What it checks                                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `scripts/check-deploy-output.mjs` | `index.html`, `sitemap.xml`, `robots.txt`, `{ar,en}/index.html`, `{ar,en}/index.csr.html` exist; every file world-readable |
| `scripts/check-csp.mjs`           | every inline script on every page is allowed by a hash in `caddy-headers.conf`; no unused hash; no inline handlers         |
| `scripts/check-bundle-budget.mjs` | initial JS ≤ 150 KB and initial transfer ≤ 400 KB (gzip), per locale                                                       |

Publish **`dist/store-web/browser/`** as the web root.

## Web root layout

```
/index.html            → meta refresh to /ar/ (copy of deploy/index.html); the host should also 302 / → /ar/
/robots.txt /sitemap.xml /favicon.*
/ar/…  /en/…           → one Angular build per locale (base href /ar/ and /en/)
  index.html           → prerendered home
  courses/ books/ p/<slug>/index.html   → prerendered public pages (build-time catalogue)
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

- **Client fallback.** A product published after the build has no prerendered page: `try_files` serves
  `/{locale}/index.csr.html`, which renders it in the browser (plan §2.5). Cart, checkout, thanks, account, login,
  search and admin are always client-rendered.
- **404s.** Unknown paths also get the shell, and the app shows its own not-found page (`noindex`).

## Security headers

`caddy-headers.conf` is the source of truth for the Content-Security-Policy (`script-src` is hash-only; `connect-src`
and `img-src` allow `https://store-api.ta3lom.sa`), HSTS, `nosniff`, referrer and permissions policies, COOP. If the
pre-paint theme script in `src/index.html` changes, its hash must be updated here — `check-csp` fails the build until
it is (do not let a formatter touch `src/index.html`; it is in `.prettierignore`).

## The API side

The store API must allow the origin `https://store.ta3lom.sa` (CORS with credentials) and set its refresh cookies for
that site (plan §3.2). The web sends credentials and bearer tokens **only** to `https://store-api.ta3lom.sa/v1`.

## After a catalogue change

Prices, stock and availability are live on every page load. Titles, descriptions and SEO text of prerendered pages
change with the next build — rebuild and publish to refresh them (the admin shows this notice).
