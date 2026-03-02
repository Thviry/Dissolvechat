# Phase 3: Deployment & Infrastructure - Research

**Researched:** 2026-03-02
**Domain:** Docker Compose, nginx, SSL/TLS, Tor hidden services, self-hosting documentation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Docker scope:**
- Full stack in docker-compose: relay (Node.js) + nginx (SSL terminator) + static web client (React build)
- Web client is built from source inside Docker (multi-stage build) — self-hoster needs only Docker installed, not Node.js
- nginx serves the built static files and proxies `/` API/WS traffic to the relay container
- Only ports 80 and 443 are exposed externally; the relay's port 3001 is internal-only (never directly accessible)

**Reverse proxy:**
- nginx is the required reverse proxy
- nginx config is a standalone file in the repo at `nginx/dissolve.conf` (not just inline in docs)
- Brief mention of Caddy as a simpler alternative, but full documentation is nginx only
- nginx terminates SSL (Let's Encrypt via Certbot) and proxies to the relay container

**SELF_HOSTING.md depth:**
Comprehensive guide — goal: zero to running relay with SSL in under 30 minutes for a non-expert. Sections:
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
11. Optional: Tor hidden service
12. Troubleshooting (common errors: port conflicts, cert renewal, CORS errors)

**Environment variable documentation:**
- Both .env.example (inline comments) AND prose section in SELF_HOSTING.md
- .env.example lives in repo root (alongside docker-compose.yml)
- Variables: `PORT` (default 3001), `NODE_ENV` (production/development), `ALLOWED_ORIGIN` (CORS), `DIRECTORY_FILE` (path for directory persistence, default: directory.json)
- Include valid ranges/formats and security implications

**Health endpoint:**
- No changes — existing `/health` response is sufficient
- Returns: `ok`, `protocol`, `version`, `persistence`, `uptime`, `store` stats, `wsClients`
- HTTP 200 is all monitoring tools need

### Claude's Discretion
- Docker image base (node:alpine vs node:slim for relay; nginx:alpine for proxy)
- Multi-stage Dockerfile structure (builder stage for React, nginx stage for serving)
- docker-compose healthcheck configuration
- Certbot renewal automation (cron vs certbot --deploy-hook)
- Exact Tor hidden service config syntax (follow Tor Project docs)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEPLOY-01 | Relay server ships with a `docker-compose.yml` for single-command production deployment | Multi-stage build patterns, docker-compose service structure, healthchecks |
| DEPLOY-02 | Environment variables for relay configuration are documented (ports, rate limits, TTLs, CORS) | .env.example format, existing env var inventory from server/src/index.js |
| DEPLOY-03 | An nginx reverse proxy config example is provided for SSL termination | nginx WebSocket proxy config, Certbot/Let's Encrypt integration, SSL termination patterns |
| DEPLOY-04 | Relay exposes a `/health` endpoint for monitoring | Already implemented in server/src/routes.js:109 — no code change needed |
| DOCS-01 | `SELF_HOSTING.md` covers relay deployment end-to-end (Docker, env vars, reverse proxy, DNS) | All technical areas researched; 12-section outline locked in CONTEXT.md |
</phase_requirements>

---

## Summary

This phase is purely infrastructure and documentation — no relay server code changes. The deliverables are: `docker-compose.yml` at repo root, `nginx/dissolve.conf`, `.env.example` at repo root, and `SELF_HOSTING.md`. The technical complexity is moderate: the pnpm monorepo structure requires a careful multi-stage Dockerfile that handles workspace dependencies (`dissolve-core`) consumed by `client/`. The relay's existing Dockerfile (node:20-alpine, simple `npm ci`) is already in a worktree and is a good starting point but needs updating for the pnpm workspace context.

The most critical nginx concern for this codebase is WebSocket proxying — the relay serves WebSocket connections at `/ws` and uses a nonce challenge system that requires `/ws-challenge`. nginx must pass `Upgrade` and `Connection` headers with `proxy_http_version 1.1` or WebSocket connections will silently fail. For SSL, the standard docker-compose approach (separate certbot service sharing a volume) is well-established and widely documented; the self-hoster runs Certbot once to obtain the certificate, then a cron job or systemd timer handles renewal.

For the Tor hidden service (optional section in SELF_HOSTING.md), the v3 onion address approach from Tor Project's official setup guide is authoritative. The configuration is two lines in `torrc` pointing to the nginx container's internal address. No separate nginx configuration is needed — the existing nginx setup already handles the traffic.

**Primary recommendation:** Use `node:20-slim` for the relay runtime (better glibc compatibility than alpine for production Node.js), `nginx:alpine` for the proxy (nginx itself has no native extension issues with musl), and a multi-stage Dockerfile for the client that uses `pnpm fetch` + `pnpm install --offline` to handle workspace dependencies efficiently.

---

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Docker Engine | 24+ / 25+ | Container runtime | Industry standard; single-command deployment target |
| Docker Compose | v2 (compose plugin) | Multi-service orchestration | Ships with Docker Desktop; `docker compose` (no hyphen) is current standard |
| nginx | 1.25 (alpine) | SSL termination + static file serving + reverse proxy | Proven WebSocket proxy support; official docs confirm required headers |
| Certbot | Latest (certbot/certbot image) | Let's Encrypt certificate issuance + renewal | Official EFF tool; webroot method works with nginx without stopping service |
| node:20-slim | 20.x LTS | Relay runtime image | LTS line; slim avoids musl (alpine) glibc compat issues with some native modules |
| nginx:alpine | latest-alpine | nginx image base | nginx has no glibc-sensitive native extensions; alpine saves ~20MB here safely |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| Tor (`torproject/tor`) | Latest stable | Tor v3 hidden service | Optional — operator anonymity section in SELF_HOSTING.md |
| UptimeRobot | SaaS (free tier) | External uptime monitoring | Poll `/health` endpoint; no code required, mentioned in docs only |
| UFW | OS package | Host firewall | Block external access to port 3001; documented in SELF_HOSTING.md |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| nginx | Caddy | Caddy auto-HTTPS with one line, but decision is locked: nginx required. Brief Caddy mention allowed in docs. |
| node:20-slim | node:20-alpine | Alpine is ~90MB smaller but musl libc causes subtle issues with some npm native modules; slim is safer default for production |
| certbot service in compose | JonasAlfredsson/docker-nginx-certbot all-in-one | All-in-one image is simpler but less transparent; explicit certbot service is more understandable for self-hosters |

**Installation note:** No additional npm packages needed. Docker, Docker Compose, and Certbot are all system-level tools, not npm dependencies.

---

## Architecture Patterns

### Recommended File Structure

```
/ (repo root)
├── docker-compose.yml          # Services: relay, nginx, certbot, (optional) tor
├── .env.example                # Documented env vars — copy to .env
├── nginx/
│   └── dissolve.conf           # Complete nginx config (SSL + proxy + static)
├── server/
│   ├── Dockerfile              # node:20-slim, npm ci --omit=dev
│   └── src/                    # Existing relay code — no changes
├── client/
│   └── (existing Vite app)     # Built inside Docker via multi-stage
├── packages/
│   └── dissolve-core/          # Shared package — must be available at build time
└── SELF_HOSTING.md             # End-to-end deployment guide
```

### Pattern 1: Multi-Stage Dockerfile for pnpm Monorepo Client

The client depends on `dissolve-core` via pnpm workspace. The Dockerfile must copy the full monorepo context (pnpm-lock.yaml, all package.json files, packages/), install, then build.

**What:** Three-stage build — dependency install, Vite build, nginx serve
**When to use:** Any pnpm workspace project where `client/` imports from `packages/`

```dockerfile
# Source: pnpm.io/docker + verified against project structure
# Stage 1: Install dependencies (pnpm workspace-aware)
FROM node:20-slim AS deps
RUN npm install -g pnpm
WORKDIR /app

# Copy workspace manifests first (cache layer)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/dissolve-core/package.json ./packages/dissolve-core/
COPY client/package.json ./client/

# pnpm fetch downloads all packages from registry into the store
# using only the lockfile — no source code needed yet
RUN pnpm fetch

# Stage 2: Build the React client
FROM deps AS builder
WORKDIR /app

# Copy all source (after deps are fetched/cached)
COPY packages/dissolve-core/ ./packages/dissolve-core/
COPY client/ ./client/

# Install from local store (offline, no network)
RUN pnpm install --offline

# Build with Vite — VITE_API_URL baked into bundle at build time
ARG VITE_API_BASE_URL=https://example.com
ARG VITE_WS_URL=wss://example.com/ws
RUN cd client && VITE_API_BASE_URL=$VITE_API_BASE_URL VITE_WS_URL=$VITE_WS_URL pnpm build

# Stage 3: nginx serves static files
FROM nginx:alpine AS client
COPY --from=builder /app/client/dist /usr/share/nginx/html
COPY nginx/dissolve.conf /etc/nginx/conf.d/default.conf
EXPOSE 80 443
```

**Critical:** Vite bakes `VITE_*` env vars into the bundle at build time, not runtime. Self-hosters must pass `--build-arg VITE_API_BASE_URL=https://yourdomain.com` when building, OR docker-compose.yml must define `args:` in the `build:` section using `.env` values.

### Pattern 2: Relay Dockerfile (Simple — Already Exists)

The relay has no workspace dependencies (it's CommonJS, not in the pnpm workspace). Its Dockerfile is simple:

```dockerfile
# Source: /c/Users/jacob/DCv5.16/.claude/worktrees/stupefied-volhard/server/Dockerfile (adapted)
FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src/ ./src/
EXPOSE 3001
# Healthcheck for docker-compose depends_on
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
CMD ["node", "src/index.js"]
```

**Note:** Use `node -e` for the healthcheck rather than `curl` — node:slim does not always have curl; `node -e` is always available.

### Pattern 3: docker-compose.yml Service Layout

```yaml
# Source: verified against docker-compose v2 spec and official nginx/certbot patterns
services:
  relay:
    build: ./server
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3001
      ALLOWED_ORIGIN: ${ALLOWED_ORIGIN}
      DIRECTORY_FILE: /data/directory.json
    volumes:
      - relay-data:/data
    networks:
      - internal
    # relay port 3001 NOT exposed to host — internal only

  nginx:
    build:
      context: .
      dockerfile: Dockerfile.client  # or nginx stage of client Dockerfile
      args:
        VITE_API_BASE_URL: ${VITE_API_BASE_URL}
        VITE_WS_URL: ${VITE_WS_URL}
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/dissolve.conf:/etc/nginx/conf.d/default.conf:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      relay:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - internal

  certbot:
    image: certbot/certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    # Run renewal check; restart daily via: docker compose run certbot renew
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done'"

  # Optional Tor hidden service (documented in SELF_HOSTING.md)
  # tor:
  #   image: torproject/tor
  #   volumes:
  #     - ./tor/torrc:/etc/tor/torrc:ro
  #     - tor-keys:/var/lib/tor/hidden_service
  #   networks:
  #     - internal
  #   restart: unless-stopped

networks:
  internal:
    driver: bridge

volumes:
  relay-data:
  # tor-keys:
```

### Pattern 4: nginx Configuration for This Relay

The relay exposes these paths that nginx must proxy: `/send`, `/inbox`, `/caps`, `/ws`, `/health`, `/directory/*`, `/ws-challenge`. Everything else serves the static React build.

```nginx
# Source: nginx.org/en/docs/http/websocket.html (official) + project context
# File: nginx/dissolve.conf

# Upstream relay
upstream relay {
    server relay:3001;
}

# Map for WebSocket connection upgrade
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name _;

    # Certbot webroot challenge — must be accessible over HTTP
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS — main server
server {
    listen 443 ssl;
    server_name YOUR_DOMAIN;

    ssl_certificate     /etc/letsencrypt/live/YOUR_DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/YOUR_DOMAIN/privkey.pem;

    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    # Serve static React build
    root /usr/share/nginx/html;
    index index.html;

    # API and WebSocket paths — proxy to relay
    location ~ ^/(send|inbox|caps|health|directory|ws-challenge)(/.*)?$ {
        proxy_pass http://relay;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket upgrade — CRITICAL for relay functionality
    location /ws {
        proxy_pass http://relay;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;   # Keep WS connections alive (1 hour)
        proxy_send_timeout 3600s;
    }

    # React SPA — fallback to index.html for client-side routing
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Pattern 5: Tor Hidden Service (Optional Section in SELF_HOSTING.md)

```
# torrc — minimal configuration for a v3 hidden service
# File: tor/torrc
HiddenServiceDir /var/lib/tor/hidden_service/
HiddenServicePort 443 nginx:443
```

After `docker compose up`, the .onion hostname is in the volume:
```bash
docker compose exec tor cat /var/lib/tor/hidden_service/hostname
```

**docker-compose tor service:**
```yaml
tor:
  image: torproject/tor:latest
  volumes:
    - ./tor/torrc:/etc/tor/torrc:ro
    - tor-keys:/var/lib/tor/hidden_service
  networks:
    - internal
  restart: unless-stopped
```

### Anti-Patterns to Avoid

- **Exposing relay port 3001 to host in docker-compose:** `ports: ["3001:3001"]` lets anyone bypass nginx. Use only `expose` or just the internal network — the port is accessible container-to-container via the `internal` network without host mapping.
- **Setting `ALLOWED_ORIGIN: "*"` in production:** The relay defaults to `*` in dev but the production .env must set `ALLOWED_ORIGIN=https://yourdomain.com`. Forgetting this makes the relay accept cross-origin requests from any website.
- **Skipping `--omit=dev` in relay Dockerfile:** `npm ci` without `--omit=dev` installs devDependencies into the production image. The relay has none listed but future additions would silently bloat it.
- **Using `CMD ["npm", "start"]` instead of `CMD ["node", "src/index.js"]`:** npm adds ~70ms overhead and an extra process; direct node invocation is simpler and correctly receives SIGTERM for graceful shutdown.
- **Baking SSL certificate paths into the nginx config before Certbot has run:** First-run bootstrapping requires a chicken-and-egg solution — nginx won't start without certs, Certbot needs port 80. Solution: run `certbot certonly --webroot` once from the host before first `docker compose up`, OR use a self-signed cert for the initial nginx start (documented in SELF_HOSTING.md).
- **`proxy_http_version` missing on WebSocket location:** Without `proxy_http_version 1.1`, nginx defaults to HTTP/1.0 which doesn't support WebSocket upgrades. The connection silently fails with no error message.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSL certificate issuance | Custom ACME client or self-signed setup | Certbot + Let's Encrypt | Rate limits, domain validation, renewal — all handled; self-signed certs require per-client trust installation |
| nginx WebSocket state tracking | Custom map/if logic for Upgrade header | The `map $http_upgrade $connection_upgrade` block from nginx official docs | The official pattern handles the close/upgrade state correctly; hand-rolled if/else is wrong |
| Certificate renewal | Cron script checking expiry manually | `certbot renew` (idempotent, checks expiry itself) inside the certbot container entrypoint | certbot renew only acts when < 30 days remain; running it frequently (every 12h) is safe and correct |
| Tor .onion key generation | Custom ed25519 key setup | Tor daemon auto-generates v3 keys on first start into HiddenServiceDir | Key format is specific to Tor's implementation; manual generation is error-prone |

**Key insight:** Every tool here (Docker, nginx, Certbot, Tor) has a single authoritative way to accomplish its task. Custom solutions for SSL, WebSocket proxying, and hidden services introduce subtle correctness bugs that are hard to debug.

---

## Common Pitfalls

### Pitfall 1: First-Run SSL Bootstrap (Chicken-and-Egg)
**What goes wrong:** nginx in the compose stack won't start if `ssl_certificate` paths don't exist. But Certbot needs nginx running on port 80 to complete the ACME challenge.
**Why it happens:** nginx validates cert file existence at startup; Certbot requires an HTTP server to serve challenge files.
**How to avoid:** Document a two-step first-run process in SELF_HOSTING.md:
  1. Comment out `ssl_certificate` lines in nginx config and start with HTTP only
  2. Run `docker compose run certbot certonly --webroot -w /var/www/certbot -d yourdomain.com --email you@example.com --agree-tos`
  3. Uncomment SSL lines, restart nginx
  Alternatively: use the certbot --standalone mode (stop nginx first, certbot binds port 80, restart nginx).
**Warning signs:** nginx exits immediately with "cannot load certificate" error.

### Pitfall 2: Vite Build-Time vs Runtime Env Vars
**What goes wrong:** Self-hoster sets `ALLOWED_ORIGIN` and similar env vars in `.env` but the React client still connects to the wrong URL.
**Why it happens:** Vite bakes `VITE_*` vars into the JavaScript bundle at `pnpm build` time, not at container runtime. A running nginx container cannot be reconfigured by changing `.env` — you must `docker compose build` again.
**How to avoid:** SELF_HOSTING.md must clearly state: "After changing your domain in `.env`, run `docker compose up --build` to rebuild the client bundle."
**Warning signs:** Client connects to hardcoded localhost URL or example.com instead of the configured domain.

### Pitfall 3: WebSocket Timeout Under nginx Default
**What goes wrong:** WebSocket connections to `/ws` close after 60 seconds of inactivity.
**Why it happens:** nginx's default `proxy_read_timeout` is 60 seconds. If the client doesn't send a ping within that window, nginx terminates the connection.
**How to avoid:** Set `proxy_read_timeout 3600s` and `proxy_send_timeout 3600s` on the `/ws` location block. The relay already handles SIGTERM gracefully, so this is safe.
**Warning signs:** Client WebSocket disconnects every ~60 seconds in production; works fine without nginx in dev.

### Pitfall 4: pnpm Workspace Build Context
**What goes wrong:** Docker build fails with "Cannot find module 'dissolve-core'" or "workspace:* not found."
**Why it happens:** The Docker build context must include `packages/dissolve-core/` and `pnpm-workspace.yaml` — if only `client/` is sent as build context, pnpm cannot resolve the workspace dependency.
**How to avoid:** Set `context: .` (repo root) in the docker-compose build section for the client/nginx service. The Dockerfile handles the multi-stage copy correctly from root context.
**Warning signs:** `pnpm install` fails inside Docker with workspace resolution error.

### Pitfall 5: relay Port Accessible from Host
**What goes wrong:** Self-hoster maps `3001:3001` in docker-compose `ports:`, bypassing nginx and exposing the unencrypted relay directly.
**Why it happens:** Confusion between `ports` (host-mapped) and `expose` (internal-only). `expose: [3001]` is optional decoration; the internal network makes port 3001 reachable by nginx without host mapping.
**How to avoid:** Do NOT use `ports:` for the relay service. Use only the shared `internal` docker network. Add a firewall rule (`ufw deny 3001`) as a belt-and-suspenders measure.
**Warning signs:** `curl http://YOURIP:3001/health` returns 200 from the public internet.

### Pitfall 6: NODE_ENV=production Gating /debug/state
**What goes wrong:** `/debug/state` endpoint is exposed in production because `NODE_ENV` was not set.
**Why it happens:** `server/src/routes.js` gates the endpoint with `process.env.NODE_ENV !== "production"`. If `NODE_ENV` is unset, it defaults to truthy (`undefined !== "production"` is `true`), so the endpoint is served.
**How to avoid:** Always set `NODE_ENV=production` in the relay service's environment block in docker-compose.yml. Document in .env.example.
**Warning signs:** `curl https://yourdomain.com/debug/state` returns relay internal state instead of 404.

---

## Code Examples

Verified patterns from official sources and project code:

### .env.example Format

```bash
# Dissolve Relay — Environment Variables
# Copy this file to .env and fill in values before running docker-compose up

# ── Required ──────────────────────────────────────────────────────────

# Your publicly accessible domain (must match SSL certificate)
ALLOWED_ORIGIN=https://yourdomain.com

# Vite bakes these into the client bundle at build time (docker-compose up --build)
VITE_API_BASE_URL=https://yourdomain.com
VITE_WS_URL=wss://yourdomain.com/ws

# ── Optional (defaults shown) ─────────────────────────────────────────

# Relay internal port (default: 3001; do NOT expose to host — nginx proxies it)
PORT=3001

# Node environment — MUST be "production" in production (gates /debug/state)
NODE_ENV=production

# Path inside the relay container for directory persistence
# Default: directory.json (in-container only; data persists via relay-data volume)
DIRECTORY_FILE=/data/directory.json
```

### docker-compose healthcheck for Relay

```yaml
# Source: docker-compose v2 spec + node -e pattern (avoids curl dependency)
healthcheck:
  test: ["CMD", "node", "-e",
    "require('http').get('http://localhost:3001/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 20s
```

### Certbot First-Run Command (for SELF_HOSTING.md)

```bash
# Run once before starting the full stack
# Certbot uses webroot method — nginx must serve port 80 first
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email your@email.com \
  --agree-tos \
  --no-eff-email \
  -d yourdomain.com
```

### Certbot Renewal Verification

```bash
# Test renewal without actually renewing (--dry-run)
docker compose run --rm certbot renew --dry-run
```

### UFW Firewall Setup (from SELF_HOSTING.md)

```bash
sudo ufw allow 22/tcp    # SSH — don't lock yourself out
sudo ufw allow 80/tcp    # HTTP (ACME challenge + redirect)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw deny 3001/tcp   # Block direct relay access (belt and suspenders)
sudo ufw enable
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `docker-compose` (v1 standalone binary) | `docker compose` (v2 plugin, built into Docker) | Docker Desktop 3.x, Docker Engine 20.10+ | Both work; v2 is the current default; `docker-compose` may not be installed on new systems |
| Let's Encrypt v2 ACME (short addresses) | Let's Encrypt v3 ACME (current) | 2019 | Certbot handles automatically; no user-facing difference |
| Tor v2 hidden services (16-char .onion) | Tor v3 hidden services (56-char .onion + ed25519) | Tor 0.3.2 (2017); v2 deprecated 2021 | All modern setups use v3; v2 addresses no longer work |
| `pnpm fetch` + `pnpm install --offline` | Still current best practice for Docker | 2022+ | Separates lockfile-based fetch from source-copy; best for layer caching |
| `node:alpine` for production | `node:slim` (Debian-based) preferred for production | Ongoing | musl vs glibc compatibility; alpine is fine for nginx but risky for Node.js with native modules |

**Deprecated/outdated:**
- `docker-compose.yml` version field: The `version: "3.8"` top-level key is obsolete in Docker Compose v2 — omit it (or keep it; it's ignored but not harmful).
- Tor v2 onion addresses: `.onion` addresses shorter than 56 chars are v2 and no longer work on the Tor network as of 2021.

---

## Open Questions

1. **Client Dockerfile location: one Dockerfile or two?**
   - What we know: The nginx service serves both static files (from React build) and proxies to the relay. The Dockerfile for the client needs the full monorepo context.
   - What's unclear: Whether to put the client multi-stage build in `client/Dockerfile` (with `context: .`), or in a root-level `Dockerfile.client`, or inline in the nginx image.
   - Recommendation: Use a single root-level `Dockerfile.client` with `context: .` for clarity. The planner should pick one approach and be consistent.

2. **VITE_API_BASE_URL vs VITE_RELAY_URL naming**
   - What we know: The existing client code uses `relay.js` and multi-relay URLs. The exact env var names used in the client source are not confirmed from this research.
   - What's unclear: What the actual `VITE_*` variable names are in the client source (e.g., `VITE_RELAY_URLS` as an array vs `VITE_API_BASE_URL`).
   - Recommendation: Planner should read `client/src/relay.js` or equivalent before writing the .env.example to confirm exact variable names.

3. **Certbot bootstrap: standalone vs webroot**
   - What we know: Both approaches work. Webroot requires nginx to be running on port 80; standalone requires stopping nginx temporarily.
   - What's unclear: Which approach is simpler for the "< 30 minute" self-hosting target audience.
   - Recommendation: Document webroot as primary (nginx stays running), with standalone as fallback. The first-run nginx config should serve port 80 without SSL before certs exist.

---

## Sources

### Primary (HIGH confidence)
- `nginx.org/en/docs/http/websocket.html` — Official nginx WebSocket proxying documentation; confirmed `proxy_http_version 1.1`, `Upgrade`, `Connection` header requirements
- `community.torproject.org/onion-services/setup/` — Official Tor Project hidden service setup guide; confirmed `HiddenServiceDir` and `HiddenServicePort` directives for v3
- `pnpm.io/docker` — Official pnpm Docker documentation; confirmed `pnpm fetch` + `pnpm install --offline` pattern for workspace builds
- Project source `server/src/index.js` — Confirmed env vars: `PORT`, `NODE_ENV`, `ALLOWED_ORIGIN`, `DIRECTORY_FILE`; confirmed graceful shutdown already implemented
- Project source `server/src/routes.js:109` — Confirmed `/health` endpoint already exists; returns `ok`, `protocol`, `version`, `persistence`, `uptime`, `store`, `wsClients`

### Secondary (MEDIUM confidence)
- Docker Compose v2 healthcheck syntax — WebSearch confirmed by multiple sources including docker.com official blog and docker-compose spec; node -e pattern verified as curl-independent alternative
- Certbot renewal via container entrypoint loop — Multiple blog sources agree on `sleep 12h & wait` pattern; wmnnd/nginx-certbot boilerplate on GitHub corroborates
- `node:slim` vs `node:alpine` recommendation — Snyk official blog + community forum consensus; glibc/musl compatibility is the deciding factor

### Tertiary (LOW confidence)
- `torproject/tor` as the correct Docker Hub image name — WebSearch found multiple conflicting images (goldy/tor-hidden-service, cmehay/docker-tor-hidden-service, torproject/tor); official Tor Project Docker image should be verified at hub.docker.com before using in docker-compose.yml

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Docker, nginx, Certbot, pnpm patterns all verified against official docs
- Architecture (Dockerfiles, compose): HIGH — verified against official pnpm Docker docs and nginx WebSocket docs
- nginx WebSocket config: HIGH — from official nginx.org documentation
- Tor hidden service config: HIGH (torrc syntax) / LOW (Docker image name)
- Common pitfalls: HIGH — derived from authoritative source review + project code analysis
- Env var inventory: HIGH — directly read from server/src/index.js source

**Research date:** 2026-03-02
**Valid until:** 2026-06-01 (stable ecosystem; Docker/nginx/Certbot change slowly)
