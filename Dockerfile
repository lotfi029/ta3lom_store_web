# Store web image — ONE image per environment (owner brief P2): CONFIG=staging | production (| ci for the CI check).
# A production image is never re-tagged from a staging one: each runs its own build (environment, CSP, robots, sitemap).
#   docker build --build-arg CONFIG=staging --build-arg PRERENDER_API_URL=https://store-api-staging.ta3lom.sa/v1 \
#                --build-arg VERSION=$(git describe --tags --always) --build-arg GIT_SHA=$(git rev-parse HEAD) -t web .
# No secret is needed or accepted: the app is public static files.

ARG NODE_IMAGE=node:24-alpine
ARG CADDY_IMAGE=caddy:2-alpine

FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NG_CLI_ANALYTICS=false NG_FORCE_TTY=false CI=1
COPY package.json package-lock.json ./
# Optional build secret `build_ca`: an extra CA bundle for networks that inspect TLS (never set in CI; not kept in any
# layer): docker build --secret id=build_ca,src=/path/ca.pem …
RUN --mount=type=secret,id=build_ca,required=false \
    if [ -s /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi \
 && npm ci --no-audit --no-fund --ignore-scripts
COPY . .
ARG CONFIG=staging
# Where the prerender reads the catalogue at build time (C-1); the runtime API is compiled in from the environment.
ARG PRERENDER_API_URL=
ARG VERSION=dev
ARG GIT_SHA=unknown
RUN case "$CONFIG" in staging|production|ci) ;; *) echo "CONFIG must be staging, production or ci" >&2; exit 1 ;; esac \
 && if [ -z "$PRERENDER_API_URL" ]; then unset PRERENDER_API_URL; fi \
 && SCRIPT="build:$CONFIG" && if [ "$CONFIG" = production ]; then SCRIPT=build:prod; fi \
 && BUILD_VERSION="$VERSION" BUILD_SHA="$GIT_SHA" npm run "$SCRIPT"

FROM ${CADDY_IMAGE} AS runtime
ARG CONFIG=staging
ARG VERSION=dev
ARG GIT_SHA=unknown
LABEL org.opencontainers.image.title="ta3lom-store-web" \
      org.opencontainers.image.description="ta3lom store web (static, Caddy) — ${CONFIG}" \
      org.opencontainers.image.source="https://github.com/lotfi029/ta3lom_store_web" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.licenses="UNLICENSED" \
      sa.ta3lom.store-web.config="${CONFIG}"
# Non-root, read-only root filesystem compatible: Caddy's own state goes to /tmp (a tmpfs in compose).
# The upstream binary carries the cap_net_bind_service FILE capability, which cannot be exec'd with cap_drop ALL +
# no-new-privileges; we listen on 8080, so a plain copy (no xattrs) replaces it.
RUN addgroup -S -g 10001 web && adduser -S -D -H -u 10001 -G web web \
 && cp /usr/bin/caddy /tmp/caddy && mv /tmp/caddy /usr/bin/caddy && chmod 0755 /usr/bin/caddy
ENV XDG_CONFIG_HOME=/tmp/caddy-config XDG_DATA_HOME=/tmp/caddy-data TLS_MODE=edge
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY deploy/caddy-headers.conf /etc/caddy/headers.conf
COPY --from=build /app/dist/store-web/caddy/ /etc/caddy/
COPY --from=build /app/dist/store-web/browser/ /srv/site/
USER web
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
