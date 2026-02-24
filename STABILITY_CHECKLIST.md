# DissolveChat v4 — Stage 1 Stability Checklist

Status: **In Progress**

## ✅ Completed

### 1. Username/Handle Collision (Critical) — FIXED
- [x] Server rejects duplicate handles with `409 handle_taken`
- [x] Handle format enforced: 1-32 chars, lowercase alphanumeric + underscore + hyphen
- [x] Client-side input normalization (auto-lowercase, strip invalid chars)
- [x] One-handle-per-identity: changing your handle releases the old one
- [x] Lookup is case-insensitive (both sides lowercase before comparison)

### 2. Logout + Session Clarity — DOCUMENTED
- [x] Session lifecycle notice in sidebar: "Session-based — refreshing logs you out"
- [x] Identity is keyfile-based, not server-session-based
- [x] No server-side sessions exist — the relay is stateless/untrusted
- [x] Contacts persist in localStorage; messages do not
- **Note:** There are no "protected endpoints" to validate against — the relay uses
  per-request ECDSA signatures, not session tokens. If you close the tab, the signing
  keys are gone from memory and no further requests can be made. This is correct behavior.

### 3. Ephemeral Messaging UI — IMPLEMENTED
- [x] Ephemeral notice banner at top of every chat: "Messages are ephemeral — they vanish when you close or refresh this tab"
- [x] Sidebar footer repeats the lifecycle model
- [ ] **TODO:** Optional local history toggle (post-Stage 1 roadmap item)

### 4. Persistence Layer — CLARIFIED
- [x] Server startup prints: `Persistence: IN-MEMORY ONLY — all state lost on restart`
- [x] Store.js header documents the persistence model explicitly
- [x] `/health` endpoint returns `"persistence": "in-memory"`
- **Answer to the open question:** Nothing survives server restart. This is intentional.
  The relay is an untrusted intermediary. User identity lives in their encrypted `.usbkey.json`
  file. Contacts live in browser localStorage. Messages are ephemeral.

### 5. Server Hardening — IMPLEMENTED
- [x] `/health` endpoint with uptime, store stats, persistence model, WS client count
- [x] `/debug/state` endpoint (dev only, `NODE_ENV !== "production"`)
- [x] `unhandledRejection` handler (logs, does not crash)
- [x] `uncaughtException` handler (logs; exits in production for process manager restart)
- [x] Malformed JSON body returns `400 malformed_json` (not a crash)
- [x] Malformed WebSocket messages silently ignored (not a crash)
- [x] SIGTERM + SIGINT graceful shutdown
- [x] Structured request logging with timestamps
- [x] Express global error handler (4-arg middleware)
- [ ] **TODO:** Stress test (50+ rapid messages) — manual verification needed

### 6. First-Message Race Condition — FIXED (from v3 to v4 transition)
- [x] Root cause identified: replay protection collision between envelope types
- [x] Fix: `checkAndUpdateReplay` namespaced by envelope type (`Message`, `ContactRequest`, `ContactGrant`)
- [x] Server-side pending queue for messages sent before recipient registers caps
- [x] Client-side retry with backoff on `cap_not_allowed`
- [x] Protocol version accepts both v3 and v4 for backwards compatibility

### 7. Protocol Version Bump
- [x] All envelopes now use `p: 4`
- [x] Keyfile version bumped to 4
- [x] Directory profiles use `dissolveProtocol: 4, v: 4`
- [x] Incoming messages accept both `p: 3` and `p: 4` for transition period

## Remaining (Post-Stage 1)

| Item | Priority | Notes |
|------|----------|-------|
| Optional local history toggle | Medium | User opts in to persist messages in localStorage |
| Stress test validation | Medium | Send 50+ rapid messages, verify no drops or crashes |
| Abuse posture definition | Low | Rate limits exist; need formal policy doc |
| Production deployment guide | Low | Docker/systemd/PM2 setup |
| Structured protocol documentation | Low | Formal spec for the wire format |

## How to Verify

```bash
# 1. Start server
cd server && npm install && npm start

# 2. Check health
curl http://localhost:3001/health | jq .

# 3. Check debug state (dev only)
curl http://localhost:3001/debug/state | jq .

# 4. Start client
cd client && npm install && npm run dev

# 5. Test handle collision
#    - Register two identities with the same handle
#    - Second should fail with "handle_taken"

# 6. Test first-message delivery
#    - Create two identities, connect, send first message
#    - Should appear immediately (no longer lost)

# 7. Test ephemeral notice
#    - Open a chat — notice should appear at top
#    - Refresh — messages should be gone, contacts should remain
```
