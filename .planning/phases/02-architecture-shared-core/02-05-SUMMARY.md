---
phase: 02-architecture-shared-core
plan: "05"
subsystem: messaging/crypto
tags: [bug-fix, sendEnvelope, e2ee, useIdentity, relay]
dependency_graph:
  requires: [02-04]
  provides: [working-message-send-receive]
  affects: [client/src/protocol/relay.js, desktop/src/protocol/relay.js, client/src/hooks/useIdentity.js, desktop/src/hooks/useIdentity.js, packages/dissolve-core/src/crypto/e2ee.js]
tech_stack:
  added: []
  patterns: [synthetic-response-object, CryptoKey-guard, JWK-alias]
key_files:
  created: []
  modified:
    - client/src/protocol/relay.js
    - desktop/src/protocol/relay.js
    - client/src/hooks/useIdentity.js
    - desktop/src/hooks/useIdentity.js
    - packages/dissolve-core/src/crypto/e2ee.js
decisions:
  - sendEnvelope returns synthetic {ok:false,status:503,json:()->Promise.resolve({})} instead of raw Error when all relays reject
  - e2eePrivJwk alias added alongside e2eePrivKey in both useIdentity hooks (mirrors authPrivJwk pattern from 02-04)
  - e2eeDecrypt guards with instanceof CryptoKey before calling importEcdhPrivateKey (mirrors signObject pattern)
metrics:
  duration: "1.5 min"
  completed_date: "2026-03-02"
  tasks_completed: 2
  files_modified: 5
---

# Phase 02 Plan 05: Messaging Send/Receive Bug Fix Summary

**One-liner:** Fixed two UAT-blocking bugs — sendEnvelope returns a synthetic 503 Response object (not a raw Error) when all relays are unreachable, and e2eePrivJwk alias + CryptoKey guard close the e2ee decrypt failure path for received messages.

## What Was Built

Two targeted bug fixes closing the final UAT gap from test round 2:

**Fix A — sendEnvelope synthetic 503 (client + desktop relay.js):**
The `sendEnvelope` function previously returned `results[last].reason` when all relay fetches were rejected, which is a raw `Error` object. `useMessaging` assumes a Response-like object with `.ok`, `.status`, and `.json()`. The Error object caused `resp.ok` to be `undefined`, `resp.json()` to throw, and the logged error to display as `"undefined"`. The fix replaces the raw return with a synthetic `{ ok: false, status: 503, json: () => Promise.resolve({}) }` object so the error path in `useMessaging` behaves correctly.

**Fix B — e2eePrivJwk alias + CryptoKey guard (useIdentity + e2ee.js):**
`useMessaging` destructures `e2eePrivJwk` from the `useIdentity` return object, but `useIdentity` only exposed `e2eePrivKey`. The destructured value was `undefined`. When `e2eeDecrypt` received `undefined`, it called `importEcdhPrivateKey(undefined)` which threw, causing all incoming messages to silently fail decryption. Two changes fix this:
1. Both `useIdentity` hooks now export `e2eePrivJwk: e2eePrivKey` (matching the `authPrivJwk: authPrivKey` pattern from 02-04).
2. `e2eeDecrypt` guards with `instanceof CryptoKey` before importing, so a CryptoKey passed directly is used as-is without re-importing.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Fix sendEnvelope synthetic 503 fallback | 1329a80 | client/src/protocol/relay.js, desktop/src/protocol/relay.js |
| 2 | Add e2eePrivJwk alias + CryptoKey guard in e2eeDecrypt | 1402b4e | client/src/hooks/useIdentity.js, desktop/src/hooks/useIdentity.js, packages/dissolve-core/src/crypto/e2ee.js |

## Verification

All automated checks passed:
- `grep "status: 503" client/src/protocol/relay.js` — found synthetic fallback
- `diff client/src/protocol/relay.js desktop/src/protocol/relay.js` — empty (files identical)
- `grep "e2eePrivJwk: e2eePrivKey"` in both useIdentity files — found alias
- `grep "instanceof CryptoKey" packages/dissolve-core/src/crypto/e2ee.js` — found guard
- `pnpm build` exits 0 with no errors

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All modified files verified present on disk. Both task commits (1329a80, 1402b4e) confirmed in git log.
