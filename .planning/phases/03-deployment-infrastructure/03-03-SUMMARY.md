---
phase: 03-deployment-infrastructure
plan: 03
subsystem: infra
tags: [docker, docker-compose, nginx, certbot, websocket, ssl, relay, production]

requires:
  - phase: 03-deployment-infrastructure
    plan: 01
    provides: server/Dockerfile (relay container) and nginx/dissolve.conf (proxy config)
  - phase: 03-deployment-infrastructure
    plan: 02
    provides: Dockerfile.client (multi-stage pnpm build) and .env.example (env template)

provides:
  - docker-compose.yml: single-command production orchestration for relay + nginx + certbot

affects:
  - 03-05 (SELF_HOSTING.md references docker-compose.yml as primary deployment artifact)

tech-stack:
  added: [docker-compose v2, certbot/certbot image]
  patterns:
    - service_healthy depends_on pattern (requires HEALTHCHECK in Dockerfile)
    - certbot 12h renewal loop with double-dollar escape for Compose variable interpolation
    - relay internal-only (no host port mapping) with nginx as sole external entry point
    - Tor hidden service as commented-out optional block

key-files:
  created:
    - docker-compose.yml
  modified: []

key-decisions:
  - "relay port 3001 not exposed to host — nginx proxies via internal Docker network only; external access would bypass SSL and CORS"
  - "nginx service uses context: . (repo root) — required so Dockerfile.client can access packages/dissolve-core via pnpm workspace"
  - "healthcheck duplicated from Dockerfile into docker-compose — depends_on service_healthy evaluates Compose-level healthcheck, not Dockerfile HEALTHCHECK"
  - "certbot entrypoint uses $${!} (double dollar) — escapes Compose variable interpolation so shell receives ${!} (last background PID)"
  - "Tor service included as commented-out block — operator opt-in, not default; avoids complicating base deployment"
  - "No version: field — deprecated and ignored in Compose v2; omitted for cleanliness per research"

requirements-completed: [DEPLOY-01]

duration: 1min
completed: 2026-03-02
---

# Phase 3 Plan 03: docker-compose.yml Production Stack Summary

**docker-compose.yml orchestrating relay, nginx, and certbot services with service_healthy dependency, internal-only relay network, and 12h certbot renewal loop for single-command SSL production deployment**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-03-02T22:13:05Z
- **Completed:** 2026-03-02T22:14:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- docker-compose.yml at repo root enabling `docker compose up -d --build` production deployment
- relay service: node:20-slim from ./server, no host port mapping (internal network only), relay-data named volume at /data, Compose-level healthcheck for service_healthy orchestration
- nginx service: builds Dockerfile.client from repo root context (required for pnpm workspace), VITE_API_URL passed as build arg, depends_on relay service_healthy, mounts nginx/dissolve.conf + certbot/conf + certbot/www volumes, exposes 80/443
- certbot service: certbot/certbot image, 12h renewal loop with double-$ escape for Compose interpolation, shares certbot/conf and certbot/www volumes with nginx
- Optional Tor hidden service block included as commented-out YAML with instructions comment
- internal bridge network; relay-data named volume for DIRECTORY_FILE persistence

## Task Commits

1. **Task 1: Write docker-compose.yml (full production stack)** - `368f16a` (feat)

## Files Created/Modified

- `docker-compose.yml` — Production Compose file: relay (no host ports, healthcheck, relay-data volume), nginx (Dockerfile.client build from repo root, depends_on service_healthy, certbot volumes), certbot (12h renewal loop), commented Tor block, internal bridge network, relay-data named volume

## Decisions Made

- relay port 3001 not mapped to host — nginx is the only external entry point; direct access bypasses SSL and CORS protections
- nginx build context is `.` (repo root) not `./client` — Dockerfile.client requires access to `packages/dissolve-core` via pnpm workspace during build
- healthcheck defined at Compose level in addition to Dockerfile HEALTHCHECK — `depends_on: condition: service_healthy` reads Compose-level healthcheck, not Dockerfile's
- `$${!}` in certbot entrypoint (double dollar) — Compose would interpolate `${!}` as a variable; `$${!}` produces literal `${!}` in the shell command
- Tor service block included but commented out — operators who want Tor can uncomment; enabling by default would complicate first-run setup

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None at this step. Self-hosters must:
1. Copy `.env.example` to `.env` and fill in values
2. Follow SELF_HOSTING.md for initial Certbot certificate issuance before `docker compose up`

## Next Phase Readiness

- docker-compose.yml satisfies DEPLOY-01: single-command production deployment
- SELF_HOSTING.md (03-05) can reference `docker compose up -d --build` as the primary deployment command
- All referenced files exist: `server/Dockerfile` (03-01), `nginx/dissolve.conf` (03-01), `Dockerfile.client` (03-02), `.env.example` (03-02)

---
*Phase: 03-deployment-infrastructure*
*Completed: 2026-03-02*
