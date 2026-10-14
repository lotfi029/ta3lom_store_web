# Dev-only environment for the store web cloud session (docs/cloud/store-web-cloud-environment.md §1).
# None of these values is a secret: local PostgreSQL, local API, local ports. Source it:  . scripts/dev-env.sh
[ -d /opt/node24/bin ] && case ":$PATH:" in *":/opt/node24/bin:"*) ;; *) export PATH="/opt/node24/bin:$PATH" ;; esac
[ -d "$HOME/.cache/store-web/pw-browsers" ] && export PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/store-web/pw-browsers"
export STORE_API_URL="${STORE_API_URL:-http://localhost:5080/v1}"
export NG_CLI_ANALYTICS=false NG_FORCE_TTY=false E2E_PORT="${E2E_PORT:-4320}"
export ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS=http://localhost:5080
export DOTNET_NOLOGO=1 DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1
export ConnectionStrings__Store="Host=localhost;Port=5432;Database=ta3lom_store_dev;Username=postgres;Password=postgres;Search Path=store,public"
export Store__Seed__RunOnStartup=true
export Store__Cors__Origins__0=http://localhost:4200 Store__Cors__Origins__1=http://localhost:4320 Store__Cors__Origins__2=http://localhost:4201
export Store__WebBaseUrl=http://localhost:4200 Store__PublicBaseUrl=http://localhost:5080
export PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=postgres PGDATABASE=ta3lom_store_dev
export STORE_API_DIR="${STORE_API_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/ta3lom_store_api}"
# Local e2e only: the API's per-IP limits (Store:RateLimits, 09 §5.15) assume one person per IP; the e2e suite is many
# "people" on 127.0.0.1. Raised here for the local run only — production defaults are untouched (DECISIONS: e2e limits).
for p in OtpRequest OtpVerify AuthRefresh StaffLogin Cart Checkout Me Download Admin; do
  export "Store__RateLimits__${p}__PermitLimit=5000"
done
export Store__RateLimits__Public__TokenLimit=5000 Store__RateLimits__Public__TokensPerPeriod=500
