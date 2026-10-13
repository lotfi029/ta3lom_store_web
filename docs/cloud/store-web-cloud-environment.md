# Store Web — cloud environment variables and setup

**Date:** 13 October 2026 · **For:** the store web cloud session ([store-web-plan.md](../store-web-plan.md))
**Replaces:** store-web-plan §3.4, which used `nodesource` and the Playwright CDN. Both are blocked in the cloud container, as tested on 6 Oct; see `setup/cloud-session/README.md`.

---

## 1. Environment variables

Paste this block into the cloud environment's **Environment variables** field. These are dev values only; none of them is a secret.

```env
STORE_WEB_SETUP=all
STORE_GH_OWNER=lotfi029
STORE_API_REPO=ta3lom_store_api
STORE_WEB_REPO=ta3lom_store_web
STORE_API_URL=http://localhost:5080/v1
NG_CLI_ANALYTICS=false
NG_FORCE_TTY=false
E2E_PORT=4320
ASPNETCORE_ENVIRONMENT=Development
ASPNETCORE_URLS=http://localhost:5080
DOTNET_NOLOGO=1
DOTNET_CLI_TELEMETRY_OPTOUT=1
DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1
ConnectionStrings__Store=Host=localhost;Port=5432;Database=ta3lom_store_dev;Username=postgres;Password=postgres;Search Path=store,public
Store__Seed__RunOnStartup=true
Store__Cors__Origins__0=http://localhost:4200
Store__Cors__Origins__1=http://localhost:4320
Store__WebBaseUrl=http://localhost:4200
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=ta3lom_store_dev
```

| Variable | Used by | Why |
|---|---|---|
| `STORE_WEB_SETUP` | setup script | `all`, or only `api` / `web` when re-running one part |
| `STORE_GH_OWNER`, `STORE_API_REPO`, `STORE_WEB_REPO` | setup script | Clones the API repo next to `store_web` |
| `STORE_API_URL` | `scripts/routes.mjs` (prerender slugs), the `ci`/dev environment file, e2e | The local store API |
| `NG_CLI_ANALYTICS`, `NG_FORCE_TTY` | Angular CLI | No prompts and no TTY noise in logs |
| `E2E_PORT` | `playwright.config.ts` | Static server for e2e and a11y (`4320`) |
| `ASPNETCORE_ENVIRONMENT`, `ASPNETCORE_URLS` | store API | Development mode (`/dev/sms`, `/dev/orders/{ref}/confirm-payment`, seed) on port 5080 |
| `DOTNET_*` | .NET CLI | Quieter, faster |
| `ConnectionStrings__Store` | store API | Local PostgreSQL (`appsettings.Development.json` leaves out the password) |
| `Store__Seed__RunOnStartup` | store API | Seeds settings, templates and the sample catalogue on start |
| `Store__Cors__Origins__0/1` | store API | Allows `ng serve` (4200) and the e2e static server (4320) to call the API with credentials |
| `Store__WebBaseUrl` | store API | Links in SMS and email point at the local web app |
| `PG*` | `psql`, the setup script, the API's dev scripts | Local database |

**Don't set:**

- `CI=true`: Playwright disables `reuseExistingServer` and adds retries.
- `PLAYWRIGHT_BROWSERS_PATH`: the setup script sets it.
- Any production URL, key or token.

---

## 2. Setup script

Paste the whole of [`store-web-setup.sh`](store-web-setup.sh) into the **Setup script** field. It:

- installs **Node 24** from `registry.npmjs.org` (because `nodejs.org` is blocked);
- installs **.NET 10** and **PostgreSQL 16**, and creates `ta3lom_store_dev`;
- clones **`ta3lom_store_api`** next to `store_web`, builds it, and applies the migrations (with the `uuidv7()` shim for PostgreSQL 16);
- runs `npm ci` once `store_web` has a lockfile (W-00 creates it);
- maps Playwright to the preinstalled Chromium.

It ends with `READY` or `READY-WITH-WARNINGS`. It is re-runnable; to repeat only the web part, run `STORE_WEB_SETUP=web bash store-web-setup.sh`, for example after W-00 adds Playwright.

---

## 3. Other environment settings

| Setting | Value |
|---|---|
| Repositories | **`lotfi029/ta3lom_store_web`** (start the session on it, push access) + **`lotfi029/ta3lom_store_api`** (read). If the API repo isn't accessible, the run uses the stub API |
| Network | Custom: defaults + `registry.npmjs.org`, `github.com`, `api.nuget.org`, `globalcdn.nuget.org`, `archive.ubuntu.com`, `security.ubuntu.com`, `packages.microsoft.com` (optional, if the .NET apt package is missing). Playwright CDN optional (the shim covers it) |
| Permissions | Auto-accept edits and commands |
| Secrets | None |

---

## 4. Commands inside the session

```bash
# API (separate terminal / background)
cd ../ta3lom_store_api && dotnet run --project src/Ta3lom.Store.Api &      # http://localhost:5080, /docs, /dev/sms
curl -s localhost:5080/health/ready

# web
cd ../ta3lom_store_web
npm run types:gen                # from docs/openapi/store-api.v1.json
npm start                        # ng serve :4200 → API :5080 (environment.development.ts)
npm run typecheck && npm run lint && npm test
npm run build                    # prerender: routes.mjs reads $STORE_API_URL
npm run e2e && npm run a11y      # static server on $E2E_PORT, real API
```

---

## 5. Main site `ta3lom-web` (for comparison)

The main site already has its own cloud setup in `Docs\setup\cloud-session\` (claude.ai project: `setup/cloud-session/`):

- `env/cloud-environment.env`;
- `setup.sh`: Node 24, MySQL, `ta3lom-api` + `ta3lom-web`.

The **web-only** part of it is:

```env
NG_CLI_ANALYTICS=false
NG_FORCE_TTY=false
E2E_PORT=4320
```

ta3lom-web has no runtime environment variables: the API URL lives in `src/environments/*.ts`. Use that setup for main-site work, and the one above for the store web.
