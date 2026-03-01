---
phase: 02-architecture-shared-core
plan: 03
subsystem: relay
tags: [multi-relay, websocket, broadcast, networking]
dependency_graph:
  requires: [02-01, 02-02]
  provides: [multi-relay-http, multi-relay-websocket]
  affects: [client/src/protocol/relay.js, desktop/src/protocol/relay.js, client/src/hooks/useMessaging.js, desktop/src/hooks/useMessaging.js]
tech_stack:
  added: []
  patterns: [Promise.allSettled fan-out for writes, sequential first-reachable for reads, one-WS-per-relay]
key_files:
  created: []
  modified:
    - client/src/protocol/relay.js
    - desktop/src/protocol/relay.js
    - client/src/hooks/useMessaging.js
    - desktop/src/hooks/useMessaging.js
decisions:
  - Promise.allSettled for broadcast writes — need all outcomes, not just first success
  - Sequential for-loop for drain reads — avoid processing messages from multiple relays twice
  - relayUrl localStorage format unchanged — comma-separated string stored as-is for backward compat
  - setRelayUrl kept as deprecated alias wrapping setRelayUrls — callers unchanged
metrics:
  duration_seconds: 253
  completed_date: "2026-03-01"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
---

# Phase 02 Plan 03: Multi-Relay Support Summary

**One-liner:** Multi-relay HTTP broadcast (Promise.allSettled) and per-relay WebSocket connections with first-reachable inbox drain pattern.

## What Was Built

Extended `relay.js` in both client and desktop to support multiple relay URLs simultaneously. Users can now configure comma-separated relay URLs and reach contacts on any configured relay — capability registrations broadcast to all relays on login, and messages are delivered to the first reachable relay.

### relay.js changes (both clients)

- **State:** Replaced scalar `_apiUrl`/`_wsUrl` with `_relayUrls` array initialized to `[DEFAULT_API]`
- **New export:** `setRelayUrls(urls)` — accepts string array, normalizes (trim, strip trailing slash), filters empty
- **Deprecated alias:** `setRelayUrl(url)` now delegates to `setRelayUrls([url])` — backward compatible
- **Broadcast writes:** `publishCaps`, `publishRequestCaps`, `sendEnvelope` fan out to all relays via `Promise.allSettled`; return first successful response or last error
- **First-reachable reads:** `drainInbox`, `drainRequestInbox` try relays sequentially, return items from first relay that responds with 200
- **Multi-WS:** `connectWebSocket` opens one authenticated WebSocket per relay URL via `connectSingleWS` helper; any `notify` triggers the shared `onNotify` callback
- **Primary-relay ops:** `blockOnRelay`, `publishDirectoryEntry`, `lookupDirectory`, `checkHandleAvailable` use `_relayUrls[0]`
- **Signing import untouched:** `import { signObject } from "dissolve-core/crypto/signing"` preserved from 02-02

### useMessaging.js changes (both clients)

- Import `setRelayUrls` (renamed from `setRelayUrl`) as `setRelayUrlsGlobal`
- Relay URL sync `useEffect` now parses `relayUrl` string by comma/newline into array before calling `setRelayUrlsGlobal`
- Single-URL configs parse to a 1-element array — fully backward compatible

### useIdentity.js (no changes needed)

- `relayUrl` state remains a string (comma-separated for multi-relay)
- Stored in localStorage under `relay:${id}` with key `url` — unchanged format
- Users enter `https://relay1.example.com,https://relay2.example.com` in the relay URL field

## Verification Results

All plan verification checks passed:

1. `_relayUrls` array used throughout (no scalar `_apiUrl`/`_wsUrl`) — 16 occurrences
2. `Promise.allSettled` appears 3 times for the 3 broadcast functions
3. First-reachable `for (const base of _relayUrls)` loops in `drainInbox` and `drainRequestInbox`
4. `relayUrl.split(/[\n,]/)` in `useMessaging.js` URL parsing useEffect
5. `diff client/src/protocol/relay.js desktop/src/protocol/relay.js` — no differences
6. `cd client && pnpm build` exits 0 — no broken imports
7. `setRelayUrl` still exported (deprecated wrapper)
8. `import { signObject } from "dissolve-core/crypto/signing"` preserved

## Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Refactor relay.js for multi-relay (both clients) | 830e10e |
| 2 | Update useMessaging to parse comma-separated relay URLs | e123e55 |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files verified to exist:
- `client/src/protocol/relay.js` — FOUND
- `desktop/src/protocol/relay.js` — FOUND
- `client/src/hooks/useMessaging.js` — FOUND
- `desktop/src/hooks/useMessaging.js` — FOUND

Commits verified:
- 830e10e — FOUND
- e123e55 — FOUND
