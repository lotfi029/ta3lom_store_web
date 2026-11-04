#!/usr/bin/env bash
# F10 full-stack e2e (plan §8): the store as it runs on the VPS, on one machine, then the payment journeys.
#
#   postgres:18 ── migrate image ── API image (Development: fake gateway, /dev/*)   ┐
#   web image (CONFIG=fullstack: production host names, noindex, never published)  ├─ Docker network "edge" (fixed subnet)
#   caddy:2-alpine importing deploy/edge/store.caddy UNCHANGED + `local_certs`      ┘  :443 on 127.0.0.1
#   Playwright → https://store.ta3lom.sa (e2e/payments.spec.ts, ar + en)
#
# The API is built from the API repo at STORE_API_REF (default: main; set it to the API PR branch until that merges —
# DECISIONS C-3). STORE_API_DIR is a local clone (default ../ta3lom_store_api); the ref is fetched from origin and built
# from a clean `git archive`, so the clone's working tree is never touched.
#
# Needs: Docker, Node 24 (scripts/dev-env.sh), root or a writable /etc/hosts (store.ta3lom.sa and store-api.ta3lom.sa
# → 127.0.0.1, removed again on exit), free ports 443 and 5099. Optional BUILD_CA=<pem> for networks that inspect TLS.
# Nothing here is a secret: the database password is random per run and lives only in a temp dir.
#   STORE_API_REF=final/api-payments-hosting bash scripts/full-stack-e2e.sh [extra playwright args]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"
# shellcheck source=dev-env.sh
. scripts/dev-env.sh >/dev/null
# W-6 (review 04): the API side of this branch is lotfi029/ta3lom_store_api#18 (`claude/payments-hardening`). Until it
# merges, that ref is the default; set it back to `main` right after the API PR merges (merge the API first).
STORE_API_REF="${STORE_API_REF:-claude/payments-hardening}"
API_SRC_REPO="${STORE_API_DIR:-$HERE/../ta3lom_store_api}"
P=t3s-fs                       # container/network prefix
NET="$P-edge"
SUBNET="${FS_EDGE_SUBNET:-172.31.250.0/24}"
API_PORT=5099                  # host port for the build-time prerender and the seed's create-admin only
WEB=https://store.ta3lom.sa
API=https://store-api.ta3lom.sa
WORK="$(mktemp -d)"
HOSTS_MARK="# t3s-full-stack-e2e"
log() { printf '\nfull-stack-e2e: %s\n' "$*"; }

cleanup() {
  local rc=$?
  if [ "$rc" -ne 0 ]; then
    log "FAILED (exit $rc) — last API log lines:"
    docker logs --tail 40 "$P-api" 2>&1 || true
  fi
  [ -n "${KEEP:-}" ] || docker rm -f "$P-caddy" "$P-web" "$P-api" "$P-db" >/dev/null 2>&1 || true
  [ -n "${KEEP:-}" ] || docker network rm "$NET" >/dev/null 2>&1 || true
  if [ -w /etc/hosts ] && grep -q "$HOSTS_MARK" /etc/hosts; then
    grep -v "$HOSTS_MARK" /etc/hosts > "$WORK/hosts" && cat "$WORK/hosts" > /etc/hosts
  fi
  rm -rf "$WORK"
  exit "$rc"
}
trap cleanup EXIT

BUILD_SECRET=()
[ -n "${BUILD_CA:-}" ] && BUILD_SECRET=(--secret "id=build_ca,src=$BUILD_CA")

log "API source: $API_SRC_REPO @ $STORE_API_REF"
git -C "$API_SRC_REPO" fetch -q origin "$STORE_API_REF"
mkdir -p "$WORK/api-src"
git -C "$API_SRC_REPO" archive FETCH_HEAD | tar -x -C "$WORK/api-src"
API_SHA="$(git -C "$API_SRC_REPO" rev-parse --short FETCH_HEAD)"
docker build -q "${BUILD_SECRET[@]}" --target api -t "$P-api:$API_SHA" "$WORK/api-src" >/dev/null
docker build -q "${BUILD_SECRET[@]}" --target migrate -t "$P-migrate:$API_SHA" "$WORK/api-src" >/dev/null

log "network $NET ($SUBNET), postgres:18, migrations"
docker rm -f "$P-caddy" "$P-web" "$P-api" "$P-db" >/dev/null 2>&1 || true
docker network rm "$NET" >/dev/null 2>&1 || true
docker network create --subnet "$SUBNET" "$NET" >/dev/null
DB_PASSWORD="$(head -c 18 /dev/urandom | base64 | tr -d '+/=')"
mkdir -p "$WORK/secrets" && printf '%s' "$DB_PASSWORD" > "$WORK/secrets/db_password" && chmod 644 "$WORK/secrets/db_password"
docker run -d --name "$P-db" --network "$NET" --network-alias db \
  -e POSTGRES_USER=store -e POSTGRES_DB=ta3lom_store -e POSTGRES_PASSWORD="$DB_PASSWORD" postgres:18 >/dev/null
for _ in $(seq 1 60); do docker exec "$P-db" pg_isready -q -U store -d ta3lom_store && break; sleep 1; done
docker run --rm --network "$NET" -e PGHOST=db -e PGDATABASE=ta3lom_store -e PGUSER=store \
  -v "$WORK/secrets/db_password:/run/secrets/db_password:ro" "$P-migrate:$API_SHA"

log "API (Development, fake gateway) as store-api on the edge network"
env | grep -E '^Store__(RateLimits|Otp__Development)__' > "$WORK/api.env" || true
docker run -d --name "$P-api" --network "$NET" --network-alias store-api -p "127.0.0.1:$API_PORT:8080" \
  --env-file "$WORK/api.env" \
  -e ASPNETCORE_ENVIRONMENT=Development \
  -e "ConnectionStrings__Store=Host=db;Database=ta3lom_store;Username=store;Password=$DB_PASSWORD;Search Path=store,public" \
  -e Store__Seed__RunOnStartup=true \
  -e "Store__PublicBaseUrl=$API" -e "Store__WebBaseUrl=$WEB" -e "Store__Cors__Origins__0=$WEB" \
  -e "Store__Files__PublicBaseUrl=$API/files/public" \
  -e "Store__ForwardedHeaders__KnownNetworks__0=$SUBNET" \
  -e Store__DataProtection__KeysPath=/srv/store/keys -e Store__Files__Root=/srv/store/files \
  --tmpfs /srv/store:mode=1777 --tmpfs /tmp:mode=1777 \
  "$P-api:$API_SHA" >/dev/null
for _ in $(seq 1 90); do curl -fsS "http://127.0.0.1:$API_PORT/health/ready" >/dev/null 2>&1 && break; sleep 1; done
curl -fsS "http://127.0.0.1:$API_PORT/health/ready" >/dev/null

log "edge Caddy with deploy/edge/store.caddy (unchanged) + internal TLS on 127.0.0.1:443"
mkdir -p "$WORK/caddy"
cp deploy/edge/store.caddy "$WORK/caddy/store.caddy"
printf '{\n\tlocal_certs\n\tskip_install_trust\n\tauto_https disable_redirects\n}\n\nimport /etc/caddy/conf/store.caddy\n' > "$WORK/caddy/Caddyfile"
docker run -d --name "$P-caddy" --network "$NET" -p 127.0.0.1:443:443 \
  -v "$WORK/caddy:/etc/caddy/conf:ro" -v "$WORK/caddy/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine >/dev/null
for _ in $(seq 1 30); do docker exec "$P-caddy" test -f /data/caddy/pki/authorities/local/root.crt && break; sleep 1; done
docker exec "$P-caddy" cat /data/caddy/pki/authorities/local/root.crt > "$WORK/edge-root.crt"

if ! grep -q "store-api.ta3lom.sa" /etc/hosts; then
  [ -w /etc/hosts ] || { echo "full-stack-e2e: add '127.0.0.1 store.ta3lom.sa store-api.ta3lom.sa' to /etc/hosts" >&2; exit 1; }
  printf '127.0.0.1 store.ta3lom.sa store-api.ta3lom.sa %s\n' "$HOSTS_MARK" >> /etc/hosts
fi
export NODE_EXTRA_CA_CERTS="$WORK/edge-root.crt"
# The local edge, never an outbound proxy (curl and Chromium honour these; Node's fetch ignores proxies anyway).
export NO_PROXY="store.ta3lom.sa,store-api.ta3lom.sa,127.0.0.1,localhost${NO_PROXY:+,$NO_PROXY}"
export no_proxy="$NO_PROXY"
for _ in $(seq 1 30); do curl -fsS --cacert "$WORK/edge-root.crt" "$API/health/ready" >/dev/null 2>&1 && break; sleep 1; done

log "seed (staff per role, Option C catalogue) through the edge (after the API's own Development seed)"
for _ in $(seq 1 60); do
  [ "$(curl -fsS "http://127.0.0.1:$API_PORT/v1/catalog/projects?page=1&pageSize=1" | grep -o '"total":[0-9]*' | cut -d: -f2)" -gt 0 ] 2>/dev/null && break
  sleep 1
done
export STORE_API_URL="$API/v1" E2E_ORIGIN="$WEB" STORE_API_DIR="$WORK/api-src"
export STORE_ADMIN_CLI="docker exec $P-api dotnet Ta3lom.Store.Api.dll"
mkdir -p "$WORK/api-src/src/Ta3lom.Store.Api"
cp -f e2e/.auth/staff.json "$WORK/staff.json.bak" 2>/dev/null || true
rm -f e2e/.auth/staff.json
restore_staff() { if [ -f "$WORK/staff.json.bak" ]; then cp -f "$WORK/staff.json.bak" e2e/.auth/staff.json; fi; }
node scripts/e2e-seed.mjs

log "web image CONFIG=fullstack (prerendered from the API)"
docker build --progress=plain --network host "${BUILD_SECRET[@]}" --build-arg CONFIG=fullstack \
  --build-arg "PRERENDER_API_URL=http://127.0.0.1:$API_PORT/v1" -t "$P-web:local" . >"$WORK/web-build.log" 2>&1 \
  || { tail -40 "$WORK/web-build.log"; exit 1; }
docker run -d --name "$P-web" --network "$NET" --network-alias store-web --read-only --tmpfs /tmp:mode=1777 \
  --cap-drop ALL "$P-web:local" >/dev/null
for _ in $(seq 1 30); do curl -fsS --cacert "$WORK/edge-root.crt" -o /dev/null "$WEB/ar/" 2>/dev/null && break; sleep 1; done

curl -fsS --cacert "$WORK/edge-root.crt" -o /dev/null "$WEB/ar/"
log "edge answers: $(curl -sS --cacert "$WORK/edge-root.crt" -o /dev/null -w '%{http_code}' "$WEB/ar/") on $WEB/ar/, HSTS: $(curl -sSI --cacert "$WORK/edge-root.crt" "$WEB/ar/" | grep -ci strict-transport-security)"

log "payment journeys (ar + en) on $WEB"
set +e
npx playwright test e2e/payments.spec.ts "$@"
rc=$?
set -e
restore_staff
[ "$rc" -eq 0 ] && log "PASSED — API $STORE_API_REF ($API_SHA), web $(git rev-parse --short HEAD)"
exit "$rc"
