#!/usr/bin/env bash
# Validates deploy/edge/store.caddy (F8 fallback) with the real Caddy binary in a container: `caddy validate` on a
# Caddyfile that imports it, exactly as the edge does. Usage: scripts/validate-caddy.sh [image] (default caddy:2-alpine).
# Needs Docker. Validation does not issue certificates or open ports.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${1:-caddy:2-alpine}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cp "$HERE/deploy/edge/store.caddy" "$WORK/store.caddy"
printf '{\n\temail ops@example.invalid\n}\n\nimport /etc/caddy/conf/store.caddy\n' > "$WORK/Caddyfile"
docker run --rm -v "$WORK:/etc/caddy/conf:ro" -v "$WORK/Caddyfile:/etc/caddy/Caddyfile:ro" "$IMAGE" \
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker run --rm -v "$WORK:/etc/caddy/conf:ro" -v "$WORK/Caddyfile:/etc/caddy/Caddyfile:ro" "$IMAGE" \
  caddy fmt --diff /etc/caddy/conf/store.caddy >/dev/null 2>&1 || {
  echo "validate-caddy: store.caddy is not caddy-fmt formatted:" >&2
  docker run --rm -v "$WORK:/etc/caddy/conf:ro" "$IMAGE" caddy fmt --diff /etc/caddy/conf/store.caddy >&2 || true
  exit 1
}
echo "validate-caddy: deploy/edge/store.caddy is valid ($IMAGE)"
