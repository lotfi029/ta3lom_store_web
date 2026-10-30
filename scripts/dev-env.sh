# Dev-only environment for the store web cloud session (docs/cloud/store-web-cloud-environment.md §1).
# None of these values is a secret: local PostgreSQL, local API, local ports. Source it:  . scripts/dev-env.sh
# R5: the API is lotfi029/ta3lom_store_api (Ta3lom.Store.slnx, src/Ta3lom.Store.Api) on PostgreSQL 18 (docker postgres:18).
# Node >= 24.15 (package.json engines): the one on PATH when it is new enough, else /opt/node24 (docs/cloud setup script).
_node_ok() { node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>24||(a===24&&b>=15)?0:1)' 2>/dev/null; }
if ! _node_ok && [ -d /opt/node24/bin ]; then
  case ":$PATH:" in *":/opt/node24/bin:"*) ;; *) export PATH="/opt/node24/bin:$PATH" ;; esac
fi
_node_ok || echo "dev-env: Node >= 24.15 is required (found $(node -v 2>/dev/null || echo none)) — install Node 24 (nvm install 24)" >&2
unset -f _node_ok
[ -d "$HOME/.cache/store-web/pw-browsers" ] && export PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/store-web/pw-browsers"
export STORE_API_URL="${STORE_API_URL:-http://localhost:5080/v1}"
export NG_CLI_ANALYTICS=false NG_FORCE_TTY=false E2E_PORT="${E2E_PORT:-4320}"
export ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS=http://localhost:5080
export DOTNET_NOLOGO=1 DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1
export PGHOST=localhost PGPORT="${STORE_PGPORT:-5440}" PGUSER=postgres PGPASSWORD=postgres PGDATABASE=ta3lom_store_dev
export STORE_PG_CONTAINER="${STORE_PG_CONTAINER:-t3s-pg}" STORE_PG_IMAGE="${STORE_PG_IMAGE:-postgres:18}"
export ConnectionStrings__Store="Host=localhost;Port=$PGPORT;Database=$PGDATABASE;Username=postgres;Password=postgres;Search Path=store,public"
export Store__Seed__RunOnStartup=true
export Store__Cors__Origins__0=http://localhost:4200 Store__Cors__Origins__1=http://localhost:4320 Store__Cors__Origins__2=http://localhost:4201
export Store__WebBaseUrl=http://localhost:4200 Store__PublicBaseUrl=http://localhost:5080
export STORE_API_DIR="${STORE_API_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/ta3lom_store_api}"
# Local e2e only: the API's per-IP HTTP limits (Store:RateLimits) assume one person per IP; the e2e suite is many "people"
# on 127.0.0.1. Raised here for the local run only — production defaults are untouched (DECISIONS: e2e limits).
for p in OtpRequest OtpVerify AuthRefresh StaffLogin Cart Checkout Me Admin TemplateTest; do
  export "Store__RateLimits__${p}__PermitLimit=5000"
done
export Store__RateLimits__Public__TokenLimit=5000 Store__RateLimits__Public__TokensPerPeriod=500
# Both OTP limits must be raised for the suite: the HTTP limiter above (OtpRequest) and the D-10 business caps (3 codes per
# mobile / 15 min, 10 per IP / hour). The caps are overridable in Development only since API cd26a80 (API-8); the API
# refuses these keys in any other environment (the host stops at start-up), so they can never reach production.
export Store__Otp__Development__MaxPerIp=10000 Store__Otp__Development__MaxPerMobile=100
