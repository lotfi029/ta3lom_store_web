#!/usr/bin/env bash
# Seeds the running local store API for e2e (staff per role, r4 catalogue, stock, digital files). Idempotent.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/dev-env.sh"
curl -sf http://localhost:5080/health/ready >/dev/null || bash "$HERE/api-up.sh"
cd "$HERE/.." && node scripts/e2e-seed.mjs
