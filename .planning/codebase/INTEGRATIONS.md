# External Integrations

**Analysis Date:** 2026-02-27

## APIs & External Services

**None detected.**

DissolveChat is designed as a self-contained protocol with no external API dependencies. All functionality is implemented within the client-relay architecture.

## Data Storage

**In-Memory Storage (Server):**
- Implementation: `server/src/store.js`
- No persistent database (SQLite, PostgreSQL, MongoDB, etc.)
- All data (inboxes, capabilities, directory) exists in memory only
- Survives server restart: No - intentional by design ("everything is in-memory")
- Message TTL: 24 hours with periodic cleanup every 5 minutes

**Client Storage:**
- Implementation: `client/src/utils/storage.js`
- Browser localStorage - identity keys, conversation history, contact list
- File-based: Desktop app uses local filesystem via Tauri for keyfile storage
- No sync to cloud or external service

**Optional Directory Persistence:**
- File: `directory.json` (configurable via `DIRECTORY_FILE` env var)
- Purpose: Stores published directory entries (handle → profile mappings)
- Format: JSON, loaded at server startup
- Survives restart: Yes (file-persisted, not in-memory)

**File Storage:**
- Local filesystem only (no S3, cloud storage, or CDN)
- Desktop app stores identity keyfiles locally via Tauri

**Caching:**
- None - no Redis or external cache layer

## Authentication & Identity

**Auth Provider:**
- Custom implementation - No external OAuth, SAML, or third-party auth service

**Implementation Approach:**
- User identity is a cryptographic keypair (ECDSA P-256 for signing, ECDH P-256 for encryption)
- Identity file format: Encrypted JSON (`.usbkey.json`), passphrase-protected
- Server-side: Signature verification on every mutating request, no session tokens
- WebSocket auth: Nonce challenge-response with signed credentials (see `client/src/protocol/relay.js`)

**Authentication Flow (WebSocket):**
1. Client GETs `/ws-challenge` endpoint → receives nonce
2. Client signs `{ nonce, authPub }` with private key
3. Client opens WebSocket, sends auth message with signed nonce
4. Server verifies signature, binds socket to identity ID
5. Server broadcasts notifications on authenticated channel

**Signature Verification:**
- Algorithm: ECDSA P-256 (via WebCrypto)
- All endpoints require `authPub` (public key) and `sig` (signature)
- Implementation: `server/src/crypto.js` - `verifySignature()` function

## Monitoring & Observability

**Error Tracking:**
- None - no Sentry, Rollbar, or external error reporting

**Logging:**
- Implementation: `server/src/logger.js`
- Format: Structured JSON lines (production) or pretty-printed (development)
- Output: stdout (console)
- Sensitive data: Never logged (passwords, capabilities, private keys, full IPs)
- Truncated: Identity IDs logged as first 12 characters only
- Log events: envelope delivery, inbox drain, rate limits, WebSocket auth, directory operations, signature failures

## CI/CD & Deployment

**Hosting:**
- Self-hosted only
- Deployment: Manual (no GitHub Actions, GitLab CI, or deployment platform detected)
- Server runs as standalone Node.js process

**CI Pipeline:**
- None detected
- Manual testing via `server/test-flow.js` integration test script
- Security validation via `SECURITY_TEST_RESULTS.md`

## Environment Configuration

**Required env vars (Server):**
- `NODE_ENV` - "production" or "development" (controls CORS, CSP headers, logging)
- `ALLOWED_ORIGIN` - CORS origin to allow (required in production, default "*" in dev)
- `DIRECTORY_FILE` - Path to directory.json (default: "./directory.json")

**Required env vars (Client):**
- `VITE_API_URL` - HTTP(S) URL of relay server (default: "http://localhost:3001")
- `VITE_WS_URL` - WebSocket URL of relay server (default: "ws://localhost:3001/ws")

**Secrets location:**
- No `.env` file committed
- `client/.env.example` provided as template
- User identity keys: Stored as encrypted file on device, not in environment

## Webhooks & Callbacks

**Incoming Webhooks:**
- None - relay does not accept external webhooks

**Outgoing Webhooks:**
- None - relay does not send webhooks to external services

## Protocol Endpoints (HTTP)

**Message Delivery:**
- `POST /send` - Send encrypted message to recipient

**Capability Management:**
- `PUT /caps/:toId` - Register inbox capability tokens
- `PUT /requestCaps/:toId` - Register request inbox capability tokens

**Inbox Operations:**
- `POST /inbox/:toId` - Drain authenticated inbox (pull messages)
- `POST /requests/inbox/:toId` - Drain authenticated request inbox

**Directory:**
- `GET /directory/available?handle={handle}` - Check handle availability
- `PUT /directory/:handle` - Publish profile to directory
- `GET /directory/:handle` - Lookup profile by handle

**Access Control:**
- `POST /block/:toId` - Block sender identity
- `POST /revoke/:toId` - Revoke capability

**WebSocket:**
- `GET /ws-challenge` - Fetch nonce for WebSocket authentication
- `WebSocket /ws` - Authenticated WebSocket connection for push notifications

## Security Headers

**Content Security Policy (CSP):**
- Server implements strict CSP on all responses
- Default-src: 'none'
- Script-src: 'self' (web) or 'self' (desktop)
- Connect-src: 'self', ws:, wss: (server); additional HTTPS/WSS in desktop Tauri config
- No unsafe-eval, no unsafe-inline scripts

**Additional Headers:**
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy: no-referrer
- Permissions-Policy: camera, microphone, geolocation disabled

## Rate Limiting

**Implementation:** `server/src/ratelimit.js`

**Two-layer approach:**
1. IP-based rate limiting - Per-sender IP address
2. Identity-based rate limiting - Per-identity (computed from authPub)

**Configured limits:**
- Envelope send: 100 per 60 seconds
- Inbox drain: 50 per 60 seconds
- Directory publish: 10 per hour
- Block/revoke: 100 per 60 seconds
- WebSocket auth nonce creation: 30 per 60 seconds

**Enforcement:**
- Returns HTTP 429 (Too Many Requests) when limit exceeded
- Includes Retry-After header
- Logged via structured logger (layer, endpoint only - no sensitive data)

---

*Integration audit: 2026-02-27*
