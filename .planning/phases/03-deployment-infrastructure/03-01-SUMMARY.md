---
phase: 03-deployment-infrastructure
plan: 01
subsystem: infra
tags: [docker, nginx, node, ssl, websocket, certbot, lets-encrypt]

requires:
  - phase: 02-architecture-shared-core
    provides: relay server code (server/src/) with /health endpoint and graceful shutdown

provides:
  - server/Dockerfile — production relay container image using node:20-slim
  - nginx/dissolve.conf — nginx reverse proxy config with SSL termination, WebSocket proxying, and SPA fallback

affects:
  - 03-02 (docker-compose.yml references server/Dockerfile and nginx/dissolve.conf)
  - 03-03 (SELF_HOSTING.md references nginx/dissolve.conf and server/Dockerfile)

tech-stack:
  added: [node:20-slim, nginx, certbot/lets-encrypt]
  patterns:
    - node -e healthcheck pattern (avoids curl dependency in slim images)
    - nginx WebSocket map block (official docs pattern, no hand-rolled if/else)
    - HTTP-to-HTTPS redirect with ACME challenge exception
    - API proxy regex consolidating all relay routes into one location block

key-files:
  created:
    - server/Dockerfile
    - nginx/dissolve.conf
  modified: []

key-decisions:
  - "node:20-slim chosen over node:20-alpine — avoids musl glibc compatibility issues with native modules in production"
  - "HEALTHCHECK uses node -e (not curl) — curl not guaranteed in slim; node -e is always available"
  - "CMD [node, src/index.js] directly — avoids npm start overhead (~70ms) and ensures correct SIGTERM delivery"
  - "relay port 3001 not host-mapped in Dockerfile — compose uses internal network only"
  - "WebSocket upgrade handled via nginx map block from official nginx.org docs — no hand-rolled conditional logic"
  - "proxy_http_version 1.1 on /ws location — required for WebSocket upgrade; HTTP/1.0 default silently fails"
  - "3600s read/send timeouts on /ws — prevents nginx from closing idle WebSocket connections after 60s default"
  - "ACME challenge location on HTTP server block — Certbot webroot method requires plain HTTP access to /.well-known/acme-challenge/"
  - "API proxy regex covers requestCaps, requests, block paths — added vs research pattern to match all routes.js endpoints"

patterns-established:
  - "node -e healthcheck: require('http').get pattern for slim/distroless containers"
  - "nginx WebSocket proxy: map $http_upgrade + proxy_http_version 1.1 + 3600s timeouts"
  - "ACME challenge exception: location /.well-known/acme-challenge/ before redirect on HTTP block"

requirements-completed: [DEPLOY-03, DEPLOY-04]

duration: 2min
completed: 2026-03-02
---

# Phase 3 Plan 01: Relay Dockerfile and nginx Proxy Config Summary

**node:20-slim relay Dockerfile with node -e healthcheck plus nginx config with SSL termination, WebSocket proxying at /ws, and Certbot ACME exception**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-02T05:48:55Z
- **Completed:** 2026-03-02T05:50:55Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Production relay Dockerfile using node:20-slim, npm ci --omit=dev, HEALTHCHECK polling /health via node -e, and direct node invocation
- nginx reverse proxy config with HTTP-to-HTTPS redirect, ACME challenge exception, HTTPS server with SSL termination, consolidated API proxy regex for all relay routes, /ws WebSocket location with required HTTP/1.1 and 3600s timeouts, and React SPA fallback

## Task Commits

1. **Task 1: Write server/Dockerfile** - `f5893a7` (feat)
2. **Task 2: Write nginx/dissolve.conf** - `1a35a41` (feat)

## Files Created/Modified

- `server/Dockerfile` — Production relay container: node:20-slim base, npm ci --omit=dev, EXPOSE 3001 (docs only), HEALTHCHECK using node -e on /health endpoint, CMD node src/index.js
- `nginx/dissolve.conf` — Complete nginx config: upstream relay:3001, WebSocket upgrade map, HTTP->HTTPS redirect with ACME exception, HTTPS server with SSL cert paths and modern TLS, API proxy regex for all relay paths, /ws WebSocket block with proxy_http_version 1.1 and 3600s timeouts, SPA try_files fallback

## Decisions Made

- Used `node:20-slim` (Debian-based) over `node:20-alpine` (musl) per research recommendation — safer for production Node.js with native modules
- HEALTHCHECK uses `node -e` rather than `curl` — curl is not guaranteed in slim images; node binary is always present
- CMD uses direct `node src/index.js` — avoids npm start's 70ms overhead, extra process, and SIGTERM misrouting
- API proxy regex expanded to include `requestCaps`, `requests`, and `block` paths beyond the research pattern — matched against all actual routes.js endpoints per plan specification

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. The nginx/dissolve.conf requires users to replace `YOUR_DOMAIN` placeholder before use (documented with instructions at the top of the file).

## Next Phase Readiness

- server/Dockerfile ready for use as `build: ./server` in docker-compose.yml (03-02)
- nginx/dissolve.conf ready for volume mount in nginx service (03-02) and reference in SELF_HOSTING.md (03-03)
- Both files satisfy DEPLOY-03 (nginx config exists) and DEPLOY-04 (Dockerfile HEALTHCHECK polls /health)

---
*Phase: 03-deployment-infrastructure*
*Completed: 2026-03-02*
