---
phase: 03-deployment-infrastructure
plan: 02
subsystem: infra
tags: [docker, pnpm, nginx, vite, monorepo, env]

# Dependency graph
requires:
  - phase: 02-architecture-shared-core
    provides: dissolve-core workspace package that Dockerfile.client must build offline

provides:
  - Dockerfile.client: multi-stage pnpm monorepo Docker build for React client served by nginx
  - .env.example: documented environment variable template for self-hosters

affects:
  - 03-03-docker-compose (references Dockerfile.client as build target)
  - 03-04-nginx-config (nginx stage in Dockerfile.client mounts nginx/dissolve.conf)
  - 03-05-self-hosting-guide (references .env.example as config reference)

# Tech tracking
tech-stack:
  added: [nginx:alpine, node:20-slim, pnpm fetch, multi-stage Docker build]
  patterns: [pnpm offline install pattern for Docker layer caching, Vite build-time ARG injection]

key-files:
  created:
    - Dockerfile.client
    - .env.example
  modified: []

key-decisions:
  - "Only VITE_API_URL passed as build ARG (not VITE_WS_URL) — WS URL derived at runtime in relay.js via base.replace"
  - "nginx config volume-mounted by docker-compose, NOT copied into image — allows self-hoster customization without rebuilding"
  - "pnpm fetch stage uses lockfile only (no source) to maximize Docker layer cache across rebuilds"
  - "DIRECTORY_FILE defaults to /data/directory.json to align with relay-data volume mount in docker-compose"

patterns-established:
  - "pnpm monorepo Docker: fetch (lockfile only) → install --offline → build (3 stages)"
  - ".env.example format: required vars first, optional with defaults, reference-only commented out"

requirements-completed: [DEPLOY-01, DEPLOY-02]

# Metrics
duration: 1min
completed: 2026-03-02
---

# Phase 3 Plan 02: Client Dockerfile and .env.example Summary

**3-stage pnpm monorepo Dockerfile for React client (nginx:alpine) with VITE_API_URL build-time injection, and copy-paste .env.example template documenting all env vars with security notes**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-03-02T22:08:56Z
- **Completed:** 2026-03-02T22:10:05Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Dockerfile.client with 3-stage pnpm monorepo build: deps (pnpm fetch) → builder (pnpm install --offline + vite build) → client (nginx:alpine)
- VITE_API_URL baked into bundle at build time via ARG; WS URL auto-derived at runtime so VITE_WS_URL is not needed as a build arg
- .env.example documents ALLOWED_ORIGIN, VITE_API_URL, PORT, NODE_ENV, DIRECTORY_FILE with inline security notes
- Prominent warning that VITE_ vars require `docker compose up --build` after changes — the #1 self-hoster pitfall

## Task Commits

Each task was committed atomically:

1. **Task 1: Write Dockerfile.client (multi-stage pnpm monorepo build)** - `df20eab` (feat)
2. **Task 2: Write .env.example (environment variable documentation template)** - `364300c` (feat)

**Plan metadata:** committed with docs commit after SUMMARY.md

## Files Created/Modified
- `Dockerfile.client` - 3-stage multi-stage Docker build: pnpm fetch → pnpm install --offline + vite build → nginx:alpine serving dist
- `.env.example` - Self-hoster environment variable template with inline docs, security notes, and build-time vs runtime distinction

## Decisions Made
- Only `VITE_API_URL` is passed as a Docker build ARG; `VITE_WS_URL` is excluded because it is derived at runtime in relay.js via `base.replace(/^http/, "ws") + "/ws"` — passing it would be misleading
- nginx config is volume-mounted (not COPY'd into image) so self-hosters can customize domain/SSL paths without rebuilding
- `DIRECTORY_FILE` defaults to `/data/directory.json` in .env.example to align with the docker-compose relay-data volume mount anticipated in plan 03-03

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required at this step. Self-hosters will configure .env in plan 03-03/03-05.

## Next Phase Readiness
- Dockerfile.client is ready to be referenced as `build: { context: ., dockerfile: Dockerfile.client }` in docker-compose.yml (plan 03-03)
- .env.example is ready to be referenced throughout SELF_HOSTING.md (plan 03-05)
- nginx stage in Dockerfile.client expects config volume-mounted at runtime — nginx/dissolve.conf is the next artifact (plan 03-04)

---
*Phase: 03-deployment-infrastructure*
*Completed: 2026-03-02*
