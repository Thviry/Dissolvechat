---
phase: 03-deployment-infrastructure
plan: 04
subsystem: infra
tags: [docs, self-hosting, nginx, certbot, ssl, docker, tor, uptimerobot]

# Dependency graph
requires:
  - phase: 03-deployment-infrastructure
    plan: 01
    provides: server/Dockerfile and nginx/dissolve.conf (relay container and reverse proxy config)
  - phase: 03-deployment-infrastructure
    plan: 02
    provides: Dockerfile.client and .env.example (client multi-stage build and env template)
  - phase: 03-deployment-infrastructure
    plan: 03
    provides: docker-compose.yml (single-command production orchestration)

provides:
  - SELF_HOSTING.md: complete end-to-end guide from zero to SSL relay in under 30 minutes

affects:
  - end-users and self-hosters (primary audience for the guide)
  - README.md (future reference to SELF_HOSTING.md for deployment)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SSL bootstrap two-phase approach: start nginx HTTP-only, obtain cert via certbot --webroot, re-enable SSL
    - UptimeRobot monitoring pattern: poll /health endpoint every 5 minutes
    - Tor hidden service opt-in pattern: commented-out docker-compose block + torrc instructions

key-files:
  created:
    - SELF_HOSTING.md
  modified: []

key-decisions:
  - "SSL bootstrap uses two-phase approach (HTTP-only nginx first, then certbot --webroot) — addresses chicken-and-egg without standalone mode that stops nginx"
  - "VITE_API_URL build-time warning placed at both .env editing step AND env var reference table — the #1 self-hoster pitfall"
  - "All 12 sections from CONTEXT.md locked decision included — no sections skipped or merged"
  - "Tor section references torproject/tor:latest with verification note — low-confidence image name flagged for self-hoster to verify"
  - "Commands-first writing style throughout — code blocks before explanations, numbered steps for progress tracking"

patterns-established:
  - "SSL bootstrap two-phase: HTTP-only nginx → certbot certonly --webroot → restore SSL lines"
  - "First-run verification: curl /health | python3 -m json.tool pattern for JSON output"

requirements-completed: [DOCS-01]

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 3 Plan 04: SELF_HOSTING.md Documentation Summary

**SELF_HOSTING.md with all 12 required sections covering zero-to-SSL relay deployment in under 30 minutes, including SSL bootstrap chicken-and-egg resolution, build-time VITE_API_URL warning, UptimeRobot monitoring, and optional Tor hidden service**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-02T22:16:26Z
- **Completed:** 2026-03-02T22:18:30Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- SELF_HOSTING.md at repo root with all 12 sections from CONTEXT.md locked decision: Prerequisites, DNS Setup, Firewall (UFW), Clone+Configure, SSL/Certbot, First Run, First-Run Verification, Env Var Reference, Monitoring, Upgrading, Tor Hidden Service, Troubleshooting
- SSL bootstrap chicken-and-egg problem addressed head-on with a three-phase approach: Phase A (nginx HTTP-only), Phase B (certbot --webroot), Phase C (restore SSL)
- All commands use `docker compose` (v2, no hyphen) throughout — 24 occurrences verified
- `/health` endpoint used as primary first-run verification step and UptimeRobot monitoring target
- Troubleshooting table covers all major pitfalls identified in RESEARCH.md

## Task Commits

1. **Task 1: Write SELF_HOSTING.md (complete end-to-end self-hosting guide)** - `17c0d4d` (feat)

## Files Created/Modified

- `SELF_HOSTING.md` — 459-line self-hosting guide with 12 sections, SSL bootstrap instructions, env var reference table, UptimeRobot monitoring setup, optional Tor hidden service, troubleshooting table with 8 common issues

## Decisions Made

- SSL bootstrap uses the two-phase nginx approach (HTTP-only first, then certbot --webroot, then restore SSL) rather than certbot --standalone — avoids having to stop nginx completely, and the webroot method integrates with the certbot service already in docker-compose.yml
- VITE_API_URL build-time warning appears at two points: inline at the .env editing step and in the env var reference table — belt-and-suspenders for the most common self-hoster mistake
- Tor section references `torproject/tor:latest` and includes an explicit note to verify the image at hub.docker.com before using — research flagged this as low-confidence
- Writing style: code blocks before explanations, numbered steps within each section, explicit warnings at decision points (DNS propagation before SSL, SSL bootstrap before first run)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — SELF_HOSTING.md is documentation. Self-hosters follow the guide to configure their own servers.

## Next Phase Readiness

- SELF_HOSTING.md satisfies DOCS-01: relay deployment end-to-end guide (Docker, env vars, reverse proxy, DNS)
- Phase 03 deployment infrastructure is complete — all 4 plans delivered: relay Dockerfile, client Dockerfile + .env.example, docker-compose.yml, SELF_HOSTING.md
- Phase 04 (if planned) can reference SELF_HOSTING.md as the self-hoster deployment reference

## Self-Check: PASSED

- `SELF_HOSTING.md` exists: FOUND
- 12 section headers verified: FOUND (## 1 through ## 12)
- `docker compose` (no hyphen) throughout: FOUND (24 occurrences)
- `/health` endpoint referenced: FOUND (5 occurrences)
- `.env.example` referenced: FOUND
- `nginx/dissolve.conf` referenced: FOUND
- Tor section: FOUND (## 11 Optional: Tor Hidden Service)
- Troubleshooting section: FOUND (## 12 Troubleshooting)
- Commit `17c0d4d`: FOUND

---
*Phase: 03-deployment-infrastructure*
*Completed: 2026-03-02*
