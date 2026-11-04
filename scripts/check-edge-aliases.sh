#!/usr/bin/env bash
# Review 04 H-1: production and staging side by side on ONE edge network, from deploy/docker-compose.store-web.yml
# unchanged — `store-web` must resolve to the production container only and `store-web-staging` to the staging one only.
# (With the service named `store-web`, Compose also gave the staging container the alias `store-web`.)
#   bash scripts/check-edge-aliases.sh <store-web image>
set -euo pipefail

IMAGE=${1:?usage: check-edge-aliases.sh <store-web image>}
BUSYBOX=${BUSYBOX_IMAGE:-busybox:1.37}
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(docker compose -f "$HERE/deploy/docker-compose.store-web.yml")
CREATED_EDGE=""

cleanup() {
  local rc=$?
  for p in t3s-alias-prod t3s-alias-staging; do
    STORE_WEB_IMAGE="$IMAGE" EDGE_ALIAS=x "${COMPOSE[@]}" -p "$p" down >/dev/null 2>&1 || true
  done
  [ -n "$CREATED_EDGE" ] && docker network rm edge >/dev/null 2>&1 || true
  exit "$rc"
}
trap cleanup EXIT

docker network inspect edge >/dev/null 2>&1 || { docker network create --subnet "${EDGE_SUBNET:-172.31.252.0/24}" edge >/dev/null; CREATED_EDGE=1; }

up() { STORE_WEB_IMAGE="$IMAGE" EDGE_ALIAS="$2" "${COMPOSE[@]}" -p "$1" up -d --wait --wait-timeout 60 >/dev/null; }
ip_of() {
  local id
  id="$(STORE_WEB_IMAGE="$IMAGE" EDGE_ALIAS=x "${COMPOSE[@]}" -p "$1" ps -q web)"
  docker inspect -f '{{(index .NetworkSettings.Networks "edge").IPAddress}}' "$id"
}
resolve() {   # every A record of a name on the edge network, sorted, one line
  docker run --rm --network edge "$BUSYBOX" nslookup -type=a "$1" 127.0.0.11 2>/dev/null \
    | awk '/^Name:/{n=1; next} n && /^Address/{print $NF}' | sort | tr '\n' ' ' | sed 's/ $//'
}

up t3s-alias-prod store-web
up t3s-alias-staging store-web-staging
prod="$(ip_of t3s-alias-prod)"
staging="$(ip_of t3s-alias-staging)"
got_prod="$(resolve store-web)"
got_staging="$(resolve store-web-staging)"
echo "check-edge-aliases: production $prod, staging $staging; store-web → [$got_prod], store-web-staging → [$got_staging]"

fail=0
[ "$got_prod" = "$prod" ] || { echo "check-edge-aliases: store-web must resolve to the production container only" >&2; fail=1; }
[ "$got_staging" = "$staging" ] || { echo "check-edge-aliases: store-web-staging must resolve to the staging container only" >&2; fail=1; }
[ "$fail" -eq 0 ] || exit 1
echo "check-edge-aliases: OK — each environment answers to its own alias only"
