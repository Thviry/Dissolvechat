# Self-Hosting DissolveChat

This guide takes you from a fresh VPS with a domain to a running DissolveChat relay with SSL termination. Estimated time: under 30 minutes.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [DNS Setup](#2-dns-setup)
3. [Firewall Configuration (UFW)](#3-firewall-configuration-ufw)
4. [Clone Repo and Configure](#4-clone-repo-and-configure)
5. [SSL Certificate (Certbot — First Run)](#5-ssl-certificate-certbot--first-run)
6. [First Run](#6-first-run)
7. [First-Run Verification](#7-first-run-verification)
8. [Environment Variable Reference](#8-environment-variable-reference)
9. [Monitoring Setup (UptimeRobot)](#9-monitoring-setup-uptimerobot)
10. [Upgrading](#10-upgrading)
11. [Optional: Tor Hidden Service](#11-optional-tor-hidden-service)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Prerequisites

Before you start, confirm you have:

- **A VPS running Ubuntu 22.04+ or Debian 12+** with a public IP address and at least 1 GB RAM
- **A domain name** with DNS control (you need to create an A record)
- **Docker Engine 24+ and Docker Compose v2** installed on the server
  - Installation guide: https://docs.docker.com/engine/install/ubuntu/
  - Verify both are present:
    ```bash
    docker --version
    docker compose version
    ```
- **Root or sudo access** to the server

> **Note:** You do NOT need Node.js, pnpm, or any build tools installed. Docker builds everything inside containers.

---

## 2. DNS Setup

1. Log in to your domain registrar or DNS provider.
2. Create an **A record** pointing your domain to your server's public IP address:
   ```
   Type:  A
   Name:  yourdomain.com   (or @ for apex, or a subdomain like relay)
   Value: YOUR_SERVER_IP
   TTL:   300
   ```
3. Wait 5–15 minutes for DNS propagation.
4. Verify propagation before proceeding to the SSL step — the certificate will fail if DNS has not propagated:
   ```bash
   dig +short yourdomain.com
   # Expected: your server's public IP address
   ```
   Or:
   ```bash
   nslookup yourdomain.com
   ```

> **Warning:** Do NOT proceed to Section 5 (SSL) until `dig` returns your server IP. Certbot will fail silently if DNS hasn't propagated.

---

## 3. Firewall Configuration (UFW)

Run these commands in order on your server:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 3001/tcp
sudo ufw enable
```

Confirm the rules:

```bash
sudo ufw status
```

Expected output:

```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
3001/tcp                   DENY        Anywhere
```

> **Note:** `ufw deny 3001` is belt-and-suspenders security. The relay's port 3001 is already internal-only in docker-compose.yml (no host port mapping), but the UFW rule blocks it at the OS level in case of misconfiguration.

---

## 4. Clone Repo and Configure

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/dissolve-chat.git
   cd dissolve-chat
   ```

2. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` with your domain:
   ```bash
   nano .env
   ```
   Set these two required values:
   ```
   ALLOWED_ORIGIN=https://yourdomain.com
   VITE_API_URL=https://yourdomain.com
   ```
   Leave all other values at their defaults for now.

   > **Build-time warning:** `VITE_API_URL` is baked into the React client bundle at Docker build time. If you change this value later, you must rebuild: `docker compose up --build`.

4. Edit `nginx/dissolve.conf` — replace both occurrences of `YOUR_DOMAIN` with your actual domain:
   ```bash
   nano nginx/dissolve.conf
   ```
   Find and replace `YOUR_DOMAIN` in these two lines:
   ```nginx
   server_name YOUR_DOMAIN;
   ssl_certificate     /etc/letsencrypt/live/YOUR_DOMAIN/fullchain.pem;
   ssl_certificate_key /etc/letsencrypt/live/YOUR_DOMAIN/privkey.pem;
   ```
   After editing:
   ```nginx
   server_name yourdomain.com;
   ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
   ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
   ```

---

## 5. SSL Certificate (Certbot — First Run)

> **The chicken-and-egg problem:** nginx needs SSL certificates to start on port 443, but Certbot needs port 80 to be served by nginx to issue those certificates. This section resolves that with a two-phase approach.

### Phase A — Start nginx in HTTP-only mode

Temporarily comment out the SSL directives so nginx can start without certificates:

1. Open `nginx/dissolve.conf`:
   ```bash
   nano nginx/dissolve.conf
   ```

2. In the `server { listen 443 ssl; ... }` block, comment out these four lines and change `listen 443 ssl;` to `listen 443;`:

   ```nginx
   # Before (SSL enabled — won't start without certs):
   listen 443 ssl;
   ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
   ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
   ssl_protocols TLSv1.2 TLSv1.3;
   ssl_prefer_server_ciphers off;

   # After (HTTP-only for ACME bootstrap):
   listen 443;
   # ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
   # ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
   # ssl_protocols TLSv1.2 TLSv1.3;
   # ssl_prefer_server_ciphers off;
   ```

3. Start only the nginx service:
   ```bash
   docker compose up -d nginx
   ```

   Wait a few seconds, then confirm nginx is running:
   ```bash
   docker compose ps
   ```

### Phase B — Obtain the certificate

```bash
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email your@email.com \
  --agree-tos \
  --no-eff-email \
  -d yourdomain.com
```

Replace `your@email.com` with your email and `yourdomain.com` with your domain.

Expected success output:
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/yourdomain.com/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

### Phase C — Re-enable SSL

1. Open `nginx/dissolve.conf` and restore the SSL lines:
   ```nginx
   listen 443 ssl;
   ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
   ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
   ssl_protocols TLSv1.2 TLSv1.3;
   ssl_prefer_server_ciphers off;
   ```

2. Stop the temporary nginx:
   ```bash
   docker compose down
   ```

3. Continue to Section 6.

---

## 6. First Run

Build all images and start the full stack in one command:

```bash
docker compose up -d --build
```

This builds:
- The relay image from `server/Dockerfile`
- The React client image from `Dockerfile.client` (bakes `VITE_API_URL` from `.env` into the bundle)

And starts:
- `relay` — Node.js relay server on the internal Docker network
- `nginx` — reverse proxy on ports 80/443, serving static files and proxying relay routes
- `certbot` — automatic certificate renewal loop (runs every 12 hours)

Watch startup logs:

```bash
docker compose logs -f
```

Wait for these indicators before verifying:
- Relay: `relay healthcheck: healthy` (the relay has a 20-second start period)
- nginx: `[notice] nginx is ready` — nginx will not start until the relay healthcheck passes

Stop following logs with `Ctrl+C` when everything is running.

---

## 7. First-Run Verification

### Check the relay health endpoint

```bash
curl -s https://yourdomain.com/health | python3 -m json.tool
```

Expected response:

```json
{
    "ok": true,
    "protocol": "DissolveChat/1.0",
    "version": "...",
    "persistence": true,
    "uptime": {
        "ms": 12345,
        "human": "12s"
    },
    "store": {
        "handles": 0,
        "caps": 0,
        "inboxes": 0
    },
    "wsClients": 0
}
```

`"ok": true` confirms the relay is running. `"persistence": true` confirms the relay-data volume is working.

### Verify the web client

1. Open `https://yourdomain.com` in a browser.
2. Confirm the DissolveChat UI loads over HTTPS (padlock icon in browser address bar).
3. Click **Enroll** and create a test identity to confirm end-to-end functionality — this exercises the relay API, WebSocket connection, and client-side cryptography.

---

## 8. Environment Variable Reference

See `.env.example` in the repo root for the full template with inline documentation. Prose explanation of each variable:

| Variable | Required | Default | Description |
|---|---|---|---|
| `ALLOWED_ORIGIN` | Yes | — | CORS origin — set to your HTTPS domain (e.g. `https://yourdomain.com`). If unset in production, the relay accepts requests from any origin, which is unsafe. |
| `VITE_API_URL` | Yes (build-time) | — | Relay HTTP base URL baked into the React client at Docker build time. Must be your public HTTPS domain with no trailing slash. Changing this requires `docker compose up --build`. |
| `PORT` | No | `3001` | Internal port the relay listens on inside the Docker network. Do not expose this port to the internet — nginx proxies it via the internal network. |
| `NODE_ENV` | No | `production` (set by docker-compose.yml) | Must be `production`. If set to anything else, the `/debug/state` endpoint is exposed, revealing all registered handles, capabilities, and inbox contents publicly. |
| `DIRECTORY_FILE` | No | `/data/directory.json` | Path inside the relay container where the handle directory is stored. The `relay-data` Docker volume is mounted at `/data` for persistence across container restarts. |

> **Note:** `VITE_WS_URL` is not listed because it is not a separate variable — the client derives it at runtime from `VITE_API_URL` by replacing `http` with `ws` and appending `/ws`.

---

## 9. Monitoring Setup (UptimeRobot)

Set up free uptime monitoring in 5 minutes:

1. Create a free account at https://uptimerobot.com
2. Click **Add New Monitor**
3. Configure the monitor:
   - **Monitor Type:** HTTP(S)
   - **Friendly Name:** DissolveChat Relay
   - **URL:** `https://yourdomain.com/health`
   - **Monitoring Interval:** 5 minutes
4. Enable alert contacts (email and/or SMS) for downtime notifications
5. Click **Create Monitor**

The monitor polls `/health` and expects HTTP 200. Any non-200 response triggers an alert. The free UptimeRobot tier supports up to 50 monitors and 5-minute intervals — sufficient for a self-hosted relay.

---

## 10. Upgrading

```bash
git pull
docker compose up -d --build
curl -s https://yourdomain.com/health | python3 -m json.tool
```

What each command does:
- `git pull` — fetches the latest relay and client code
- `docker compose up -d --build` — rebuilds both the relay and client images with new code, then restarts affected services
- The final `curl` confirms `"ok": true` after the upgrade

Data stored in the `relay-data` volume (handles, capabilities, inboxes) is preserved across upgrades — volumes are not removed by `docker compose up --build`.

---

## 11. Optional: Tor Hidden Service

For maximum operator privacy, expose the relay as a Tor v3 .onion address. Users connecting via Tor Browser get end-to-end anonymity with no IP exposure.

### Step 1: Create the Tor configuration file

```bash
mkdir -p tor
```

Create `tor/torrc`:

```
HiddenServiceDir /var/lib/tor/hidden_service/
HiddenServicePort 443 nginx:443
```

### Step 2: Enable the Tor service in docker-compose.yml

Open `docker-compose.yml` and uncomment the Tor service block and the `tor-keys` volume:

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

Also uncomment the volume declaration at the bottom of the file:

```yaml
volumes:
  relay-data:
  tor-keys:
```

### Step 3: Start the Tor service

```bash
docker compose up -d tor
```

### Step 4: Get your .onion address

```bash
docker compose exec tor cat /var/lib/tor/hidden_service/hostname
```

This prints your `.onion` address (e.g. `abcdef1234567890.onion`). Share this address with users who want to connect via Tor.

> **Note:** Verify the `torproject/tor:latest` image is available at https://hub.docker.com/r/torproject/tor before using it. This is the official Tor Project image but availability may change. Allow 60–90 seconds after starting for the hidden service to register with the Tor network before the .onion address becomes reachable.

---

## 12. Troubleshooting

### Common issues

| Symptom | Likely Cause | Fix |
|---|---|---|
| nginx exits immediately with "cannot load certificate" | SSL cert paths don't exist yet | Follow Section 5 SSL bootstrap — comment out the SSL lines, start nginx, obtain cert, re-enable SSL lines |
| Client connects to `localhost` or shows wrong relay URL | `VITE_API_URL` not set correctly in `.env` | Edit `.env`, then run `docker compose up --build` to bake the correct URL into the client bundle |
| WebSocket disconnects every ~60 seconds | Missing `proxy_read_timeout` in nginx config | Verify `nginx/dissolve.conf` has `proxy_read_timeout 3600s;` and `proxy_send_timeout 3600s;` in the `/ws` location block |
| `docker compose up` fails: "workspace not found" or pnpm build error | Build context is wrong | Verify nginx service in `docker-compose.yml` has `context: .` (repo root), not `context: ./client` — pnpm workspace requires access to the whole monorepo |
| `/debug/state` returns relay internal state from the internet | `NODE_ENV` not set to `production` | Verify `NODE_ENV: production` in the relay service `environment:` section of `docker-compose.yml` |
| `curl http://YOURIP:3001/health` returns 200 from the internet | Port 3001 accidentally exposed to host | Remove any `ports: ["3001:3001"]` from the relay service in `docker-compose.yml`, run `sudo ufw deny 3001/tcp` |
| Certbot renewal fails with "challenge failed" | Certbot `conf` volume not mounted in nginx | Verify `docker-compose.yml` has `- ./certbot/conf:/etc/letsencrypt:ro` in the nginx volumes section |
| nginx returns 502 Bad Gateway | Relay is not healthy yet | Run `docker compose ps` — wait for the relay healthcheck to pass (up to 20 seconds after startup) before nginx starts |

### Check logs

```bash
# Relay logs
docker compose logs relay

# nginx logs
docker compose logs nginx

# Certbot logs
docker compose logs certbot

# Follow all logs in real time
docker compose logs -f
```

### Check service health

```bash
docker compose ps
```

All services should show `Up` and `(healthy)` for the relay.

### Reset and start over

If something is fundamentally broken and you want to start fresh (warning: this removes the relay data volume):

```bash
docker compose down -v
docker compose up -d --build
```

---

> **Caddy alternative:** If you prefer a simpler setup, Caddy provides automatic HTTPS with minimal configuration. This guide covers nginx only, but Caddy's official documentation at https://caddyserver.com covers an equivalent setup.
