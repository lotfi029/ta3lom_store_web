# Edge block for the store (F8 fallback)

The final session could not reach `lotfi029/ta3lom-deploy` (no repository access), so the store's edge configuration is
kept here and handed over. Everything below is an **owner step** on the VPS / in ta3lom-deploy.

## 1. Copy the block

1. Copy `deploy/edge/store.caddy` to ta3lom-deploy `edge/conf/store.caddy`.
2. Add `import conf/store.caddy` to `Caddyfile`, `Caddyfile.cutover` and `Caddyfile.staging` (the same file serves all
   three: the staging hosts are inert until their DNS points at the VPS).
3. Validate before reloading: `scripts/validate-caddy.sh` here, or on the VPS
   `docker compose exec edge caddy validate --config /etc/caddy/Caddyfile`, then `caddy reload`.

What it does: `store.ta3lom.sa` → `store-web:8080`, `store-api.ta3lom.sa` → `store-api:8080` (bodies up to 21 MB; the
payment webhook path `/v1/payments/webhooks/*` is not cached or buffered), `store-staging.ta3lom.sa` →
`store-web-staging:8080`, `store-api-staging.ta3lom.sa` → `store-api-staging:8080`. HSTS on the two production names
only; `X-Robots-Tag: noindex, nofollow` on the staging names. The containers send their own CSP and security headers.

## 2. The `edge` network needs a fixed IPv4 subnet

The store API trusts `X-Forwarded-For` / `X-Forwarded-Proto` only from the edge network
(`Store__ForwardedHeaders__KnownNetworks__0`, set from `EDGE_SUBNET` in the API's `.env.production` /
`.env.staging`). Docker picks a random subnet unless one is given, so the network must be created with a fixed one.

Check the current network:

```bash
docker network inspect edge --format '{{range .IPAM.Config}}{{.Subnet}} {{end}}'
```

If it already shows a fixed IPv4 subnet that you control (from `edge/up.sh`), use it as `EDGE_SUBNET` and skip the rest.
Otherwise recreate it (a short outage of every site behind the edge — plan a quiet hour):

```bash
# 1. Pick a private range that is free on the host (check `ip route` and `docker network ls`).
EDGE_SUBNET=172.30.0.0/24
# 2. Stop everything attached to `edge` (the edge first, then each project).
docker compose -f /srv/edge/compose.yaml down
docker network inspect edge --format '{{range .Containers}}{{.Name}} {{end}}'   # stop/detach any that remain
# 3. Recreate it with the fixed subnet (keep IPv6 if the old network had it: add --ipv6 --subnet <its v6 prefix>).
docker network rm edge
docker network create --driver bridge --subnet "$EDGE_SUBNET" edge
# 4. Start the edge, then the projects (they re-attach by name): main site, store API (prod + staging), store web.
```

Put the same command in ta3lom-deploy `edge/up.sh` so the network is always created that way, and set `EDGE_SUBNET` in
both store API env files. The API refuses to start without it.

## 3. Start order and memory

`edge` network → edge Caddy → store API (`ta3lom-store`, then `ta3lom-store-staging`) → store web (`store-web`,
`store-web-staging`). Memory limits: API 512 MB + Postgres 512 MB per environment, web 128 MB per environment.

## 4. Backups

The store API repository has its own `deploy/backup.sh` and `deploy/restore-test.sh` (PostgreSQL dumps + the receipts
and media volumes). Call it from ta3lom-deploy's `backup.sh` / `offsite.sh` with the main site's retention.
