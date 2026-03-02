# Phase 3: Deployment & Infrastructure - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the relay self-hostable by anyone with one command. Deliverables: docker-compose.yml (relay + nginx + static web client), nginx config file, .env.example, and SELF_HOSTING.md end-to-end guide. The relay server code itself is not changed in this phase (other than confirming /health is adequate — it is).

</domain>

<decisions>
## Implementation Decisions

### Docker scope
- Full stack in docker-compose: relay (Node.js) + nginx (SSL terminator) + static web client (React build)
- Rationale: anonymity and autonomy — if the web client is served from a CDN, that CDN logs user IPs and could be compromised. Everything self-hosted means users connecting to a self-hosted instance never touch a third-party server.
- Web client is built from source inside Docker (multi-stage build) — self-hoster needs only Docker installed, not Node.js
- nginx serves the built static files and proxies `/` API/WS traffic to the relay container
- Only ports 80 and 443 are exposed externally; the relay's port 3001 is internal-only (never directly accessible)

### Reverse proxy
- nginx is the required reverse proxy (specified in roadmap success criteria)
- nginx config is a standalone file in the repo at `nginx/dissolve.conf` (not just inline in docs) — self-hosters can copy it directly; SELF_HOSTING.md references it
- Brief mention of Caddy as a simpler alternative (one-liner automatic HTTPS) for those who prefer it, but full documentation is nginx only
- nginx terminates SSL (Let's Encrypt via Certbot) and proxies to the relay container

### SELF_HOSTING.md depth
- Comprehensive guide — goal: zero to running relay with SSL in under 30 minutes for a non-expert
- Sections to include:
  1. Prerequisites (VPS with domain, Docker + Docker Compose installed)
  2. DNS setup (A record pointing domain to server IP)
  3. Firewall configuration (UFW: open 80/443, block 3001 from external access)
  4. Clone repo + configure .env
  5. SSL certificate (Certbot + Let's Encrypt for nginx)
  6. `docker-compose up -d` (first run)
  7. First-run verification (curl /health, open browser, test enroll)
  8. Environment variable reference (link to .env.example, explain each var)
  9. Monitoring setup (UptimeRobot polling /health — free tier sufficient)
  10. Upgrading (git pull + docker-compose up --build, verify /health after)
  11. **Optional: Tor hidden service** — for maximum operator anonymity, add a "Tor .onion address" section showing how to run a hidden service alongside the stack
  12. Troubleshooting (common errors: port conflicts, cert renewal, CORS errors)

### Environment variable documentation
- Both .env.example (inline comments, machine-readable, copy-paste ready) AND a prose section in SELF_HOSTING.md
- .env.example lives in the repo root (alongside docker-compose.yml)
- Variables to document (already in server code): `PORT` (default 3001), `NODE_ENV` (production/development), `ALLOWED_ORIGIN` (CORS — set to the nginx-served client URL), `DIRECTORY_FILE` (path for directory persistence, default: directory.json)
- Include valid ranges/formats for each, plus the security implication of getting them wrong

### Health endpoint
- No changes — the existing `/health` response is sufficient
- Returns: `ok`, `protocol`, `version`, `persistence`, `uptime` (ms + human-readable), `store` stats, `wsClients`
- HTTP 200 is all UptimeRobot/monitoring tools need; the rich payload is bonus for operators
- SELF_HOSTING.md uses `/health` as the first-run verification step

### Claude's Discretion
- Docker image base (node:alpine vs node:slim for relay; nginx:alpine for proxy)
- Multi-stage Dockerfile structure (builder stage for React, nginx stage for serving)
- docker-compose healthcheck configuration
- Certbot renewal automation (cron vs certbot --deploy-hook)
- Exact Tor hidden service config syntax (follow Tor Project docs)

</decisions>

<specifics>
## Specific Ideas

- Privacy/anonymity is the core value driving all infrastructure decisions — when in doubt, default to more self-contained and less third-party
- Self-hosters should never need to expose the raw Node.js port (3001) to the internet — nginx is always the entry point
- The "30 minutes from zero" target from the roadmap success criteria is the benchmark for SELF_HOSTING.md usability

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/src/routes.js:109` — `/health` endpoint already exists and returns rich status payload; no changes needed
- `server/src/index.js:124-134` — SIGTERM/SIGINT graceful shutdown already implemented; Docker-compatible out of the box

### Established Patterns
- Environment variables already in use: `PORT`, `NODE_ENV`, `ALLOWED_ORIGIN`, `DIRECTORY_FILE` — these must be documented in .env.example
- `NODE_ENV !== "production"` gates the `/debug/state` endpoint — production Docker image must set `NODE_ENV=production` to suppress it
- CORS: `ALLOWED_ORIGIN` must be set to the nginx-served client URL in production (currently defaults to `*` in dev)

### Integration Points
- docker-compose services: `relay` (Node.js), `nginx` (SSL + static), optional `tor` (hidden service)
- nginx must proxy `/send`, `/inbox`, `/caps`, `/ws`, `/health`, `/directory/*`, `/ws-challenge` to the relay container
- WebSocket upgrade must be handled in nginx config (`proxy_http_version 1.1`, `Upgrade`, `Connection` headers)
- Client build needs `VITE_API_URL` and `VITE_WS_URL` set at build time (Vite bakes env vars into the bundle)

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-deployment-infrastructure*
*Context gathered: 2026-03-02*
