#!/usr/bin/env bash
# Starts the real store API on :5080 (Development: /dev/sms, /dev/orders/{ref}/confirm-payment, seed) — plan §4.
# Idempotent: if /health/ready already answers, it does nothing. Never edits the API repo; it only builds and runs it.
#   1. PostgreSQL up, dev database migrated (the API's own tools/scripts/dev-db-migrate.sh) + reference catalogue
#   2. dotnet build if the DLL is missing, then the DLL is run directly (no launch profile, so ASPNETCORE_URLS applies)
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=dev-env.sh
. "$HERE/dev-env.sh"
LOG_DIR="$HERE/../.api"; mkdir -p "$LOG_DIR"
ready() { curl -sf http://localhost:5080/health/ready >/dev/null; }

if ready; then echo "api-up: already running on :5080"; exit 0; fi
[ -d "$STORE_API_DIR/.git" ] || { echo "api-up: $STORE_API_DIR not found — use the stub API (npm run stub-api)"; exit 1; }

if ! pg_isready -q -h localhost; then
  pg_ctlcluster "$(ls /usr/lib/postgresql | sort -V | tail -1)" main start >/dev/null 2>&1 || service postgresql start >/dev/null 2>&1 || true
  for _ in $(seq 1 30); do pg_isready -q -h localhost && break; sleep 1; done
fi
pg_isready -q -h localhost || { echo "api-up: PostgreSQL is not running"; exit 1; }
psql -qAtd postgres -c "SELECT 1 FROM pg_database WHERE datname='$PGDATABASE'" | grep -q 1 || psql -qd postgres -c "CREATE DATABASE $PGDATABASE"

DLL="$STORE_API_DIR/src/Ta3lom.Store.Api/bin/Debug/net10.0/Ta3lom.Store.Api.dll"
[ -f "$DLL" ] || (cd "$STORE_API_DIR" && dotnet build Ta3lom.Store.slnx -v q -nologo) || { echo "api-up: dotnet build failed"; exit 1; }
(cd "$STORE_API_DIR" && bash tools/scripts/dev-db-migrate.sh --seed-catalogue) || { echo "api-up: migration failed"; exit 1; }

for pid in $(pgrep -f "Store[.]Api[.]dll|Store[.]Api/bin|run --project src/Ta3lom"); do [ "$pid" != "$$" ] && kill "$pid" 2>/dev/null; done; sleep 1
env Serilog__MinimumLevel__Default=Information Serilog__MinimumLevel__Override__Microsoft=Warning \
  "Serilog__MinimumLevel__Override__Microsoft.EntityFrameworkCore=Warning" Serilog__MinimumLevel__Override__System=Warning \
  setsid nohup dotnet "$DLL" --contentRoot "$STORE_API_DIR/src/Ta3lom.Store.Api" > "$LOG_DIR/api.log" 2>&1 < /dev/null &
for _ in $(seq 1 90); do ready && break; sleep 1; done
if ready; then echo "api-up: store API ready on http://localhost:5080 (log: .api/api.log)"; else echo "api-up: API did not become ready — see .api/api.log"; tail -20 "$LOG_DIR/api.log"; exit 1; fi
