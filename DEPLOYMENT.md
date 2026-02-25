# Dissolve Relay — Production Deployment Guide

This guide covers deploying the Dissolve relay server on a Linux host using
Docker, systemd, or PM2. All three approaches produce the same result; choose
whichever matches your infrastructure.

---

## Prerequisites

- A Linux VPS (Ubuntu 22.04+ recommended)
- A domain name with DNS pointed at the server (e.g. `relay.example.com`)
- TLS termination via nginx + Certbot (see [TLS](#tls-termination))
- Node.js 20+ **or** Docker 24+

---

## Environment variables

| Variable          | Default              | Description                                           |
|-------------------|----------------------|-------------------------------------------------------|
| `PORT`            | `3001`               | HTTP port the relay listens on                        |
| `ALLOWED_ORIGIN`  | *(none)*             | CORS allowed origin (e.g. `https://app.example.com`). Omit for same-origin |
| `NODE_ENV`        | `development`        | Set to `production` to disable the `/debug/state` endpoint and enable stricter error handling |
| `LIMIT_IP_SEND`   | `60`                 | Max sends/minute per IP                               |
| `LIMIT_ID_SEND`   | `60`                 | Max sends/minute per identity                         |
| `LIMIT_IP_DRAIN`  | `120`                | Max inbox drains/minute per IP                        |
| `LIMIT_IP_CAPS`   | `20`                 | Max caps updates/minute per IP                        |
| `LIMIT_IP_LOOKUP` | `60`                 | Max directory lookups/minute per IP                   |

---

## Option A — Docker

### 1. Build the image

```bash
cd server
docker build -t dissolve-relay .
```

If no `Dockerfile` exists yet, create one at `server/Dockerfile`:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/ ./src/
EXPOSE 3001
CMD ["node", "src/index.js"]
```

### 2. Run

```bash
docker run -d \
  --name dissolve-relay \
  --restart unless-stopped \
  -p 127.0.0.1:3001:3001 \
  -e NODE_ENV=production \
  -e ALLOWED_ORIGIN=https://app.example.com \
  dissolve-relay
```

Bind to `127.0.0.1` only — nginx handles the public TLS port.

### 3. docker-compose (optional)

```yaml
version: "3.9"
services:
  relay:
    build: ./server
    restart: unless-stopped
    ports:
      - "127.0.0.1:3001:3001"
    environment:
      NODE_ENV: production
      ALLOWED_ORIGIN: https://app.example.com
```

---

## Option B — systemd

### 1. Install dependencies

```bash
cd /opt/dissolve/server
npm ci --omit=dev
```

### 2. Create the service file

```ini
# /etc/systemd/system/dissolve-relay.service
[Unit]
Description=Dissolve Relay
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/dissolve/server
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=ALLOWED_ORIGIN=https://app.example.com

# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/opt/dissolve/server

[Install]
WantedBy=multi-user.target
```

### 3. Enable and start

```bash
systemctl daemon-reload
systemctl enable --now dissolve-relay
journalctl -u dissolve-relay -f   # follow logs
```

---

## Option C — PM2

```bash
cd server
npm ci --omit=dev

# Start
NODE_ENV=production ALLOWED_ORIGIN=https://app.example.com \
  pm2 start src/index.js --name dissolve-relay

# Persist across reboots
pm2 save
pm2 startup   # follow the printed instruction
```

---

## TLS termination

The relay speaks plain HTTP/WS. Put nginx in front of it for TLS.

### nginx config

```nginx
server {
    listen 443 ssl http2;
    server_name relay.example.com;

    ssl_certificate     /etc/letsencrypt/live/relay.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/relay.example.com/privkey.pem;

    # WebSocket upgrade
    location /ws {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_read_timeout 3600s;
    }

    location / {
        proxy_pass       http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name relay.example.com;
    return 301 https://$host$request_uri;
}
```

```bash
certbot --nginx -d relay.example.com
```

---

## Persistence note

The relay is **in-memory only**. Messages queued in the inbox are lost on
restart. This is intentional: the relay is a short-lived forwarding service,
not a message store. Clients poll/subscribe and drain the inbox promptly.

If you need longer retention (e.g. for users who are offline for extended
periods), consider running multiple relay instances behind a load balancer and
saving inbox state to Redis or a simple SQLite file. That extension is outside
the scope of this guide.

---

## Pointing clients at your relay

Users can set a custom relay URL from within the app:
**Settings → Relay URL → enter `https://relay.example.com`**

The setting is persisted locally per identity and survives page refreshes.

---

## Health check

```bash
curl https://relay.example.com/health
# → {"ok":true,"protocol":4,"version":"4.1.0-hardened",...}
```

---

## Rate limits

See [ABUSE_POLICY.md](ABUSE_POLICY.md) for the full rate limit table and abuse
handling guidance. All limits are configurable via environment variables (see
the table above).
