#!/usr/bin/env bash
# =============================================================================
#  ta3lom STORE WEB — cloud session setup script (store_web + store API)   v2
#  Paste into the cloud environment's "Setup script" field, or run: bash store-web-setup.sh
#  Re-runnable. NEVER fails the container start: every problem becomes a warning
#  in the Summary (a failed setup script blocks the whole session).
#
#  common : Node >= 24.15 (Angular 22) from registry.npmjs.org (nodejs.org is blocked)
#  api    : .NET 10 SDK, PostgreSQL 16 + dev DB, clone of ta3lom_store_api (if the
#           setup phase has GitHub access; otherwise the session clones it in STEP 0),
#           build + migrations
#  web    : npm ci (once package-lock.json exists — W-00 creates it), Playwright shim
#  Parts: STORE_WEB_SETUP=api | web | all (default all)
#
#  v2 fixes: runs as root (no "sudo -u" when sudo is unused), no prompt on git clone,
#  no `set -e` (one failing step no longer aborts the script), apt non-interactive.
# =============================================================================
set -uo pipefail

PARTS="${STORE_WEB_SETUP:-all}"
GH_OWNER="${STORE_GH_OWNER:-lotfi029}"
API_REPO="${STORE_API_REPO:-ta3lom_store_api}"
WEB_REPO="${STORE_WEB_REPO:-ta3lom_store_web}"
NODE_MIN="${STORE_NODE_MIN:-24.15.0}"
NODE_HOME="${STORE_NODE_HOME:-/opt/node24}"
PGDB="${PGDATABASE:-ta3lom_store_dev}"
PGPW="${PGPASSWORD:-postgres}"
export DEBIAN_FRONTEND=noninteractive GIT_TERMINAL_PROMPT=0

log()  { printf '\n\033[1;34m[setup]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m  ✔\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m  !\033[0m %s\n' "$*"; WARNINGS+=("$*"); }
WARNINGS=()
want() { [[ "$PARTS" == all || ",$PARTS," == *",$1,"* ]]; }
version_ge() { [[ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -1)" == "$2" ]]; }

# Root or not: run privileged commands and "as postgres" commands correctly in both cases.
if [[ "$(id -u)" -eq 0 ]]; then
  priv() { "$@"; }
  as_pg() { runuser -u postgres -- "$@" 2>/dev/null || su -s /bin/bash postgres -c "$(printf '%q ' "$@")"; }
else
  priv() { sudo -E "$@"; }
  as_pg() { sudo -u postgres "$@"; }
fi
apt_install() { priv env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq -o Dpkg::Use-Pty=0 "$@" >/dev/null 2>&1; }
APT_UPDATED=0
apt_update() { [[ $APT_UPDATED == 1 ]] || { priv apt-get update -qq >/dev/null 2>&1; APT_UPDATED=1; }; }

persist() {
  local line="$1" f
  for f in "$HOME/.bashrc" "$HOME/.profile"; do touch "$f"; grep -qxF "$line" "$f" || echo "$line" >> "$f"; done
  [[ -n "${CLAUDE_ENV_FILE:-}" ]] && echo "$line" >> "$CLAUDE_ENV_FILE"
  return 0
}

# --- workspace: the two repos are siblings ----------------------------------------
find_repo() {
  local name="$1" d top; top="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  [[ -n "$top" && "$(basename "$top")" == "$name" ]] && { echo "$top"; return; }
  for d in "${STORE_WORKSPACE:-}" "${top:+$(dirname "$top")}" "$PWD" "$HOME" /home/user /workspace; do
    [[ -n "$d" && -d "$d/$name/.git" ]] && { echo "$d/$name"; return; }
  done
  echo ""
}
WEB_DIR="$(find_repo "$WEB_REPO")"; [[ -z "$WEB_DIR" ]] && WEB_DIR="$(find_repo store_web)"
API_DIR="$(find_repo "$API_REPO")"
WORKSPACE="${STORE_WORKSPACE:-$(dirname "${WEB_DIR:-${API_DIR:-$HOME/x}}")}"

clone_api() {
  if [[ -n "$API_DIR" ]]; then ok "$API_REPO at $API_DIR"; (cd "$API_DIR" && git pull --ff-only -q 2>/dev/null) || true; return; fi
  log "Cloning $API_REPO into $WORKSPACE"
  # Try the plain URL, then the GitHub CLI (both non-interactive).
  if git clone -q "https://github.com/$GH_OWNER/$API_REPO.git" "$WORKSPACE/$API_REPO" 2>/dev/null \
     || { command -v gh >/dev/null && gh repo clone "$GH_OWNER/$API_REPO" "$WORKSPACE/$API_REPO" -- -q 2>/dev/null; }; then
    API_DIR="$WORKSPACE/$API_REPO"; ok "cloned $API_REPO"
  else
    rm -rf "$WORKSPACE/$API_REPO"
    warn "API repo not cloned during setup (no GitHub credentials in the setup phase). STEP 0 of the session clones it: git clone https://github.com/$GH_OWNER/$API_REPO.git ../$API_REPO && STORE_WEB_SETUP=api bash docs/cloud/store-web-setup.sh"
  fi
}

# --- Node 24 ----------------------------------------------------------------------
setup_node() {
  log "Node.js (need >= $NODE_MIN)"
  local cur; cur="$(node -v 2>/dev/null | tr -d v || echo 0)"
  if version_ge "${cur:-0}" "$NODE_MIN"; then ok "node $cur"; return; fi
  if [[ ! -x "$NODE_HOME/bin/node" ]]; then
    local tmp; tmp="$(mktemp -d)"
    if npm install --prefix "$tmp" node@24 --no-audit --no-fund --loglevel=error --no-update-notifier >/dev/null 2>&1; then
      priv mkdir -p "$NODE_HOME/bin" && priv cp -L "$tmp/node_modules/node/bin/node" "$NODE_HOME/bin/node"
    else
      warn "could not download node@24 from registry.npmjs.org — allowlist it"; rm -rf "$tmp"; return
    fi
    rm -rf "$tmp"
  fi
  export PATH="$NODE_HOME/bin:$PATH"; persist "export PATH=\"$NODE_HOME/bin:\$PATH\""
  echo "export PATH=\"$NODE_HOME/bin:\$PATH\"" | priv tee /etc/profile.d/store-node.sh >/dev/null 2>&1 || true
  ok "node $(node -v) (npm $(npm -v 2>/dev/null))"
}

# --- .NET 10 ----------------------------------------------------------------------
setup_dotnet() {
  log ".NET 10 SDK"
  if dotnet --list-sdks 2>/dev/null | grep -q '^10\.'; then ok "dotnet $(dotnet --version)"; return; fi
  apt_update
  if apt_install dotnet-sdk-10.0; then ok "dotnet $(dotnet --version 2>/dev/null)"; return; fi
  # Fallback: Microsoft's install script into ~/.dotnet (needs builds.dotnet.microsoft.com / dotnetcli.azureedge.net).
  if curl -fsSL https://dot.net/v1/dotnet-install.sh -o /tmp/dotnet-install.sh 2>/dev/null \
     && bash /tmp/dotnet-install.sh --channel 10.0 --install-dir "$HOME/.dotnet" >/dev/null 2>&1; then
    export DOTNET_ROOT="$HOME/.dotnet" PATH="$HOME/.dotnet:$PATH"
    persist "export DOTNET_ROOT=\"$HOME/.dotnet\""; persist "export PATH=\"$HOME/.dotnet:\$PATH\""
    ok "dotnet $(dotnet --version 2>/dev/null) (install script)"
  else
    warn ".NET 10 SDK not installed (apt package and install script both unavailable) — allowlist the Ubuntu mirrors or dot.net"
  fi
}

# --- PostgreSQL 16 ----------------------------------------------------------------
setup_pg() {
  log "PostgreSQL"
  if ! command -v pg_ctlcluster >/dev/null && ! command -v psql >/dev/null; then
    apt_update
    apt_install postgresql || { warn "apt install postgresql failed — allowlist the Ubuntu mirrors"; return; }
  fi
  local ver; ver="$(ls /usr/lib/postgresql 2>/dev/null | sort -V | tail -1)"
  if ! pg_isready -q -h localhost 2>/dev/null; then
    priv pg_ctlcluster "${ver:-16}" main start >/dev/null 2>&1 || priv service postgresql start >/dev/null 2>&1 || true
    for _ in $(seq 1 30); do pg_isready -q -h localhost 2>/dev/null && break; sleep 1; done
  fi
  pg_isready -q -h localhost 2>/dev/null || { warn "PostgreSQL did not start (pg_ctlcluster ${ver:-16} main start)"; return; }
  as_pg psql -qc "ALTER USER postgres PASSWORD '$PGPW';" >/dev/null 2>&1 || warn "could not set the postgres password"
  if ! PGPASSWORD="$PGPW" psql -h localhost -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$PGDB'" 2>/dev/null | grep -q 1; then
    PGPASSWORD="$PGPW" psql -h localhost -U postgres -qc "CREATE DATABASE $PGDB;" >/dev/null 2>&1 || warn "could not create database $PGDB"
  fi
  # PostgreSQL < 18 has no uuidv7(): same shim the API's own tests use (production runs PG 18).
  PGPASSWORD="$PGPW" psql -h localhost -U postgres -d "$PGDB" -qc \
    "CREATE OR REPLACE FUNCTION public.uuidv7() RETURNS uuid LANGUAGE sql AS \$\$ SELECT gen_random_uuid() \$\$;" >/dev/null 2>&1 || true
  ok "PostgreSQL ${ver:-?} running — database $PGDB (postgres/$PGPW on localhost)"
}

setup_api() {
  [[ -n "$API_DIR" ]] || return 0
  command -v dotnet >/dev/null || { warn "no dotnet — API build skipped"; return; }
  log "store API at $API_DIR"
  if ( cd "$API_DIR" && dotnet build Ta3lom.Store.slnx -v q -nologo >/dev/null 2>&1 ); then ok "dotnet build"; else warn "API build failed — run: cd $API_DIR && dotnet build Ta3lom.Store.slnx"; return; fi
  if [[ -f "$API_DIR/tools/scripts/dev-db-migrate.sh" ]]; then
    ( cd "$API_DIR" && bash tools/scripts/dev-db-migrate.sh >/dev/null 2>&1 ) && ok "migrations applied" || warn "migrations failed — run: cd $API_DIR && bash tools/scripts/dev-db-migrate.sh"
  else
    warn "tools/scripts/dev-db-migrate.sh not found in the API repo — apply migrations with its documented command"
  fi
}

# --- web ------------------------------------------------------------------------------
setup_playwright_shim() {
  local core="$WEB_DIR/node_modules/playwright-core/browsers.json" pre="${PREINSTALLED_PW:-/opt/pw-browsers}" dest="$HOME/.cache/store-web/pw-browsers"
  [[ -f "$core" ]] || { ok "Playwright not installed yet (W-00 adds it; then re-run with STORE_WEB_SETUP=web)"; return; }
  local rev src_full src_shell
  rev="$(node -p "require('$core').browsers.find(b=>b.name==='chromium').revision" 2>/dev/null)"
  src_full="$(ls -d "$pre"/chromium-*/chrome-linux* 2>/dev/null | head -1)"
  src_shell="$(ls -d "$pre"/chromium_headless_shell-*/chrome-linux* 2>/dev/null | head -1)"
  if [[ -n "$rev" && -d "$pre/chromium-$rev" ]]; then dest="$pre"; ok "Playwright chromium-$rev preinstalled"
  elif [[ -n "$rev" && -n "$src_full" && -n "$src_shell" ]]; then
    rm -rf "$dest"; mkdir -p "$dest/chromium-$rev" "$dest/chromium_headless_shell-$rev"
    ln -s "$src_full" "$dest/chromium-$rev/chrome-linux64"
    cp -as "$src_shell" "$dest/chromium_headless_shell-$rev/chrome-headless-shell-linux64"
    local exe="$dest/chromium_headless_shell-$rev/chrome-headless-shell-linux64"
    [[ -e "$exe/chrome-headless-shell" ]] || ln -s headless_shell "$exe/chrome-headless-shell"
    touch "$dest/chromium-$rev/INSTALLATION_COMPLETE" "$dest/chromium_headless_shell-$rev/INSTALLATION_COMPLETE"
    ok "Playwright chromium-$rev mapped to the preinstalled Chromium"
  elif ( cd "$WEB_DIR" && npx playwright install chromium >/dev/null 2>&1 ); then ok "Playwright chromium downloaded"; return
  else warn "no Chromium for Playwright — e2e / a11y cannot run here"; return; fi
  export PLAYWRIGHT_BROWSERS_PATH="$dest"; persist "export PLAYWRIGHT_BROWSERS_PATH=\"$dest\""
}

setup_web() {
  [[ -n "$WEB_DIR" ]] || { warn "store_web repo not found — start the session on $GH_OWNER/$WEB_REPO"; return; }
  log "store web at $WEB_DIR"
  if [[ -f "$WEB_DIR/package-lock.json" ]]; then
    ( cd "$WEB_DIR" && npm ci --no-audit --no-fund --loglevel=error --no-update-notifier >/dev/null 2>&1 ) && ok "npm ci" || warn "npm ci failed — run it in the session to see the error"
    setup_playwright_shim
  else
    ok "no package-lock.json yet — W-00 scaffolds the Angular app"
  fi
}

main() {
  log "store web cloud setup v2 — parts: $PARTS (user $(id -un))"
  command -v git >/dev/null || warn "git missing"
  setup_node
  if want api; then clone_api; setup_dotnet; setup_pg; setup_api; fi
  want web && setup_web
  log "Summary"
  echo "  workspace : $WORKSPACE"
  echo "  node      : $(node -v 2>/dev/null)"
  echo "  dotnet    : $(dotnet --version 2>/dev/null || echo missing)"
  echo "  postgres  : $(pg_isready -h localhost 2>/dev/null || echo 'not running')"
  want api && echo "  api       : ${API_DIR:-not cloned yet → STEP 0 clones it}"
  want web && echo "  web       : ${WEB_DIR:-missing}"
  if ((${#WARNINGS[@]})); then echo; echo "  Warnings:"; printf '   - %s\n' "${WARNINGS[@]}"; echo; echo "READY-WITH-WARNINGS"; else echo; echo "READY"; fi
  exit 0   # never block the session start
}
main "$@"
