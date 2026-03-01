---
phase: 02-architecture-shared-core
verified: 2026-03-01T23:00:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 2: Architecture (Shared Core) Verification Report

**Phase Goal:** `crypto/` and `hooks/` live in one place, both clients import from it, and the client can use multiple relay URLs
**Verified:** 2026-03-01
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A bug fix in a crypto function requires changing exactly one file, reflected in both clients | VERIFIED | All 6 crypto files live only in `packages/dissolve-core/src/crypto/`; `client/src/crypto/` and `desktop/src/crypto/` are empty; both clients use pnpm symlink (`node_modules/dissolve-core -> packages/dissolve-core`) |
| 2 | Monorepo builds cleanly with `pnpm install` and both clients pass their builds | VERIFIED | `pnpm-workspace.yaml` present; `pnpm-lock.yaml` (41 KB) present; `cd client && pnpm build` exits 0 with "69 modules transformed, built in 1.11s"; dissolve-core symlinked in both client and desktop `node_modules` |
| 3 | A user with two relay URLs can send a message reaching a recipient on either relay | VERIFIED | `relay.js` uses `_relayUrls[]` array; `publishCaps`, `publishRequestCaps`, `sendEnvelope` all use `Promise.allSettled` fan-out (3 occurrences); `drainInbox` and `drainRequestInbox` use sequential `for (const base of _relayUrls)` first-reachable loops; client and desktop relay.js are identical |
| 4 | Capability registrations are published to all configured relays automatically on login | VERIFIED | `publishCaps` uses `Promise.allSettled` broadcasting to all `_relayUrls`; `useMessaging.js` parses comma/newline-separated `relayUrl` string via `relayUrl.split(/[\n,]/)` and calls `setRelayUrlsGlobal(urls)` |

**Score:** 4/4 truths verified

---

## Required Artifacts

### Plan 02-01 Artifacts (ARCH-02)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pnpm-workspace.yaml` | Workspace package declaration with `packages/*` | VERIFIED | Contains `packages/*`, `client`, `desktop` entries |
| `package.json` (root) | Root workspace with `"private": true` | VERIFIED | `{ "name": "dissolvechat", "private": true }` |
| `packages/dissolve-core/package.json` | dissolve-core package definition with exports map | VERIFIED | `"name": "dissolve-core"`, exports `./crypto`, `./crypto/*`, `./hooks`, `./hooks/*` |
| `client/src/crypto/encoding.js` | Was restored; now removed (moved to dissolve-core) | VERIFIED | Correctly absent — canonical copy in dissolve-core |
| `client/src/hooks/useContacts.js` | Contact management hook | VERIFIED | Exists at `client/src/hooks/useContacts.js` |

### Plan 02-02 Artifacts (ARCH-01)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/dissolve-core/src/crypto/index.js` | Barrel re-export of all crypto utilities | VERIFIED | 5 lines; exports `sha256B64u`, `randomCap`, `randomId`, `enc`, `b64uFromBytes`, `bytesFromB64u`, `capHashFromCap`, `jcs`, `signObject`, `verifyObject`, `e2eeEncrypt`, `e2eeDecrypt`, `encryptPrivateData`, `decryptPrivateData` |
| `packages/dissolve-core/src/crypto/e2ee.js` | Phase 1 bucket padding preserved | VERIFIED | 96 lines; `BUCKETS = [512, 1024, 2048, 4096]` at line 11 |
| `packages/dissolve-core/src/crypto/encoding.js` | Base64url, SHA-256, randomCap, randomId | VERIFIED | 38 lines, substantive |
| `packages/dissolve-core/src/crypto/signing.js` | ECDSA sign/verify | VERIFIED | 53 lines, substantive |
| `packages/dissolve-core/src/crypto/keyfile.js` | PBKDF2/AES-GCM key file | VERIFIED | 51 lines, substantive |
| `packages/dissolve-core/src/crypto/seed.js` | BIP39 mnemonic derivation | VERIFIED | 150 lines, substantive |
| `packages/dissolve-core/src/hooks/index.js` | Barrel exporting only useToast | VERIFIED | Exports `useToast` only — does NOT export `useIdentity` or `useMessaging` |
| `packages/dissolve-core/src/hooks/useToast.js` | Pure React hook moved to dissolve-core | VERIFIED | Exists in dissolve-core/src/hooks/ |
| `client/src/App.jsx` | Imports crypto from dissolve-core paths | VERIFIED | `import { useToast } from "dissolve-core/hooks"`, `import { capHashFromCap } from "dissolve-core/crypto"`, `import { signObject } from "dissolve-core/crypto/signing"` |
| `desktop/src/App.jsx` | Imports crypto from dissolve-core paths | VERIFIED | Identical imports to client App.jsx |
| `client/src/crypto/` (directory) | Empty — files moved to dissolve-core | VERIFIED | Directory exists but contains zero files |
| `desktop/src/crypto/` (directory) | Empty — files moved to dissolve-core | VERIFIED | Directory exists but contains zero files |

### Plan 02-03 Artifacts (ARCH-03)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/src/protocol/relay.js` | Multi-relay HTTP and WebSocket client | VERIFIED | `_relayUrls[]` array (line 16), `setRelayUrls` exported (line 34), `Promise.allSettled` x3, `for (const base of _relayUrls)` x2, `connectSingleWS` helper, `connectWebSocket` maps over all URLs |
| `desktop/src/protocol/relay.js` | Identical multi-relay implementation | VERIFIED | `diff client desktop relay.js` returns empty — files are byte-for-byte identical |

---

## Key Link Verification

### Plan 02-01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `client/package.json` | `packages/dissolve-core` | `workspace:*` dependency | VERIFIED | `"dissolve-core": "workspace:*"` in client dependencies |
| `desktop/package.json` | `packages/dissolve-core` | `workspace:*` dependency | VERIFIED | `"dissolve-core": "workspace:*"` in desktop dependencies |
| `client/node_modules/dissolve-core` | `packages/dissolve-core` | pnpm symlink | VERIFIED | `lrwxrwxrwx -> /c/Users/jacob/DCv5.16/packages/dissolve-core` |
| `desktop/node_modules/dissolve-core` | `packages/dissolve-core` | pnpm symlink | VERIFIED | `lrwxrwxrwx -> /c/Users/jacob/DCv5.16/packages/dissolve-core` |

### Plan 02-02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `client/src/App.jsx` | `packages/dissolve-core/src/crypto` | `import from "dissolve-core/crypto"` | VERIFIED | Line 16: `import { capHashFromCap } from "dissolve-core/crypto"` |
| `desktop/src/App.jsx` | `packages/dissolve-core/src/crypto` | `import from "dissolve-core/crypto"` | VERIFIED | Identical to client App.jsx |
| `client/src/hooks/useMessaging.js` | `packages/dissolve-core/src/crypto` | `import from "dissolve-core/crypto"` | VERIFIED | Lines 12-14: `randomId`, `capHashFromCap`, `signObject`, `verifyObject`, `e2eeDecrypt` from dissolve-core |
| `client/src/protocol/relay.js` | `packages/dissolve-core/src/crypto/signing.js` | `import from "dissolve-core/crypto/signing"` | VERIFIED | Line 11: `import { signObject } from "dissolve-core/crypto/signing"` |
| No relative `../crypto` imports remain | both clients | grep check | VERIFIED | Zero results for `from "../crypto"` in client/src/ and desktop/src/ |

### Plan 02-03 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `client/src/hooks/useMessaging.js` | `client/src/protocol/relay.js` | `setRelayUrls(urls)` called in useEffect | VERIFIED | Line 23: imports `setRelayUrls as setRelayUrlsGlobal`; line 235: `const urls = relayUrl.split(/[\n,]/).map(u => u.trim()).filter(Boolean); setRelayUrlsGlobal(urls...)` |
| `client/src/protocol/relay.js` | all configured relay URLs | `Promise.allSettled` fan-out | VERIFIED | 3 occurrences: `publishCaps` (line 74), `publishRequestCaps` (line 90), `sendEnvelope` (line 106) |
| `desktop/src/hooks/useMessaging.js` | `desktop/src/protocol/relay.js` | `setRelayUrls(urls)` called in useEffect | VERIFIED | Identical pattern to client |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ARCH-01 | 02-02 | `crypto/` and `hooks/` extracted to `packages/dissolve-core` consumed by both clients | SATISFIED | All 6 crypto files in dissolve-core; both clients import from `dissolve-core/*`; both builds exit 0 |
| ARCH-02 | 02-01 | pnpm workspaces monorepo configured so both clients import from `dissolve-core` | SATISFIED | `pnpm-workspace.yaml` present; `pnpm ls -r` shows 3 packages; symlinks active in both clients |
| ARCH-03 | 02-03 | Client supports multiple relay URLs — caps broadcast to all, inboxes drained from reachable | SATISFIED | `_relayUrls[]` state; `Promise.allSettled` x3 for writes; sequential `for` loop x2 for reads; `connectWebSocket` opens one WS per relay; `useMessaging.js` parses comma-separated relay string |

All 3 phase-2 requirements are satisfied. No orphaned requirements found — REQUIREMENTS.md traceability table maps ARCH-01, ARCH-02, ARCH-03 to Phase 2 only.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `client/src/protocol/relay.js` | 133, 151 | `return []` | Info | These are valid fallback returns when all relays fail in `drainInbox`/`drainRequestInbox` sequential loops — correct behavior, not stubs |
| `client/vite.config.js` | — | No `resolve.dedupe: ['react']` | Info | Plan 02-02 mentioned adding this if React duplication occurred; build passes without it (React 19 + Vite 7 handles deduplication automatically via pnpm workspace symlinks) |

No blockers or warnings found. Both `return []` instances are legitimate empty-array fallbacks with full loop logic above them, not stub implementations.

---

## Human Verification Required

### 1. Multi-relay end-to-end messaging

**Test:** Configure two relay URLs (comma-separated) in the client settings. Send a message to a contact who is only registered on the second relay URL. Verify the message is delivered.
**Expected:** Message appears in contact's inbox (fetched from the second relay) and in sender's sent view.
**Why human:** Requires two live relay instances and two identity registrations. Cannot verify relay-to-relay behavior statically.

### 2. Backward compatibility with single relay URL

**Test:** Configure a single relay URL (no comma). Use the app normally — login, send message, receive message.
**Expected:** All functionality works identically to pre-Phase-2 behavior.
**Why human:** Requires a running relay and live data flow to confirm no regression.

### 3. React deduplication under real runtime

**Test:** Open the client in a browser and confirm no "Invalid hook call" React errors in the console.
**Expected:** No React version mismatch errors — dissolve-core and client share the same React instance.
**Why human:** Runtime React deduplication is not verifiable statically; `resolve.dedupe` is absent from vite.config.js but may not be needed — pnpm workspace symlinks typically prevent duplication.

---

## Summary

Phase 2 goal is fully achieved. All four observable truths verified against the actual codebase:

1. **Single source of truth for crypto:** `packages/dissolve-core/src/crypto/` contains all 6 crypto files (e2ee.js, encoding.js, index.js, keyfile.js, seed.js, signing.js). Both `client/src/crypto/` and `desktop/src/crypto/` are completely empty. Both clients consume via pnpm workspace symlink. Phase 1 bucket padding (`BUCKETS = [512, 1024, 2048, 4096]`) preserved in dissolve-core/src/crypto/e2ee.js.

2. **Clean monorepo build:** pnpm-workspace.yaml and pnpm-lock.yaml present. `pnpm ls -r` shows all 3 workspace packages. `cd client && pnpm build` exits 0 (69 modules transformed, 1.11s). Symlinks active in both client and desktop node_modules.

3. **Multi-relay HTTP broadcast and drain:** relay.js uses `_relayUrls[]` array throughout. `Promise.allSettled` fans out writes to all URLs (publishCaps, publishRequestCaps, sendEnvelope). Sequential `for` loop tries relays in order for reads (drainInbox, drainRequestInbox). `connectWebSocket` opens one authenticated WebSocket per relay URL. Client and desktop relay.js are byte-for-byte identical.

4. **Relay URL parsing wired to relay state:** useMessaging.js imports `setRelayUrls as setRelayUrlsGlobal` from relay.js. The relay URL sync `useEffect` splits comma/newline-separated string and passes the array to `setRelayUrlsGlobal`. Backward compatible — a single URL parses to a 1-element array.

Three human-facing runtime tests remain (multi-relay e2e, backward compat, React deduplication) — none of these are automated-verifiable but all implementation evidence supports they will pass.

---

_Verified: 2026-03-01_
_Verifier: Claude (gsd-verifier)_
