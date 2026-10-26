#!/usr/bin/env bash
# Starts the real R5 store API on :5080 (Development: /dev/sms, /dev/mail, /dev/jobs, OpenAPI, seed). Idempotent: if
# /health/ready already answers, it does nothing. Never edits the API repo; it only builds and runs it.
#   1. PostgreSQL 18 (docker postgres:18 on $PGPORT; a local cluster on $PGPORT is used when Docker is unavailable)
#   2. migrations: dotnet ef database update --connection (the API never calls Database.Migrate(); DECISIONS: E-6)
#   3. the DLL is run directly (no launch profile, so ASPNETCORE_URLS applies); the Development seed runs on start-up
#      (3 categories, 6 projects with options)
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=dev-env.sh
. "$HERE/dev-env.sh"
LOG_DIR="$HERE/../.api"; mkdir -p "$LOG_DIR"
ready() { curl -sf http://localhost:5080/health/ready >/dev/null; }

if ready; then echo "api-up: already running on :5080"; exit 0; fi
[ -f "$STORE_API_DIR/Ta3lom.Store.slnx" ] || { echo "api-up: $STORE_API_DIR is not the R5 store API — use the stub API (npm run stub-api)"; exit 1; }

pg_up() { pg_isready -q -h localhost -p "$PGPORT"; }
if ! pg_up; then
  if docker info >/dev/null 2>&1 || { (dockerd >"$LOG_DIR/dockerd.log" 2>&1 &); sleep 5; docker info >/dev/null 2>&1; }; then
    docker start "$STORE_PG_CONTAINER" >/dev/null 2>&1 \
      || docker run -d --name "$STORE_PG_CONTAINER" -e POSTGRES_PASSWORD=postgres -p "$PGPORT:5432" "$STORE_PG_IMAGE" >/dev/null
  fi
  for _ in $(seq 1 30); do pg_up && break; sleep 1; done
fi
pg_up || { echo "api-up: PostgreSQL is not running on :$PGPORT"; exit 1; }
psql -qAtd postgres -c "SELECT 1 FROM pg_database WHERE datname='$PGDATABASE'" | grep -q 1 || psql -qd postgres -c "CREATE DATABASE $PGDATABASE"

DLL="$STORE_API_DIR/src/Ta3lom.Store.Api/bin/Debug/net10.0/Ta3lom.Store.Api.dll"
if [ ! -f "$DLL" ] || [ -n "$(find "$STORE_API_DIR/src" -name '*.cs' -newer "$DLL" -print -quit)" ]; then
  (cd "$STORE_API_DIR" && dotnet build Ta3lom.Store.slnx -v q -nologo) || { echo "api-up: dotnet build failed"; exit 1; }
fi
(cd "$STORE_API_DIR" && dotnet tool restore >/dev/null && dotnet ef database update --no-build \
  -p src/Ta3lom.Store.Infrastructure -s src/Ta3lom.Store.Infrastructure --connection "$ConnectionStrings__Store" >"$LOG_DIR/migrate.log" 2>&1) \
  || { echo "api-up: migration failed — see .api/migrate.log"; tail -20 "$LOG_DIR/migrate.log"; exit 1; }

for pid in $(pgrep -f "Store[.]Api[.]dll|Store[.]Api/bin|run --project src/Ta3lom"); do [ "$pid" != "$$" ] && kill "$pid" 2>/dev/null; done; sleep 1
env Serilog__MinimumLevel__Default=Information Serilog__MinimumLevel__Override__Microsoft=Warning \
  "Serilog__MinimumLevel__Override__Microsoft.EntityFrameworkCore=Warning" Serilog__MinimumLevel__Override__System=Warning \
  setsid nohup dotnet "$DLL" --contentRoot "$STORE_API_DIR/src/Ta3lom.Store.Api" > "$LOG_DIR/api.log" 2>&1 < /dev/null &
for _ in $(seq 1 90); do ready && break; sleep 1; done
if ready; then echo "api-up: store API ready on http://localhost:5080 (log: .api/api.log)"; else echo "api-up: API did not become ready — see .api/api.log"; tail -20 "$LOG_DIR/api.log"; exit 1; fi
