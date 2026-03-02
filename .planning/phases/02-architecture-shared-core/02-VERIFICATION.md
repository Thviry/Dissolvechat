---
phase: 02-architecture-shared-core
verified: 2026-03-02T00:00:00Z
status: human_needed
score: 6/6 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 5/6
  gaps_closed:
    - "e2eePrivJwk alias added to both useIdentity return objects (client + desktop line 369)"
    - "e2eeDecrypt now has instanceof CryptoKey guard — CryptoKey passed directly is used as-is"
    - "sendEnvelope returns synthetic {ok:false,status:503,json:()->Promise.resolve({})} instead of raw Error when all relays reject"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Message decryption works end-to-end"
    expected: "After sending a message from identity A, identity B's chat panel shows the decrypted message text — not a blank or missing entry."
    why_human: "Requires two live identities and a running relay. Decryption correctness cannot be verified statically."
  - test: "Multi-relay end-to-end messaging"
    expected: "With two relay URLs comma-separated in the relay settings field, PUT /caps and POST /send requests fire to both relays simultaneously (visible in browser network tab). A message sent reaches a contact registered on the second relay only."
    why_human: "Requires two live relay instances. Cannot verify relay-to-relay behavior statically."
  - test: "Backward compatibility with single relay URL"
    expected: "With a single relay URL configured, login, send/receive messages, and capability registration all work normally. No regression from setRelayUrl to setRelayUrls refactor."
    why_human: "Requires a running relay and live data flow to confirm no regression."
  - test: "React deduplication under real runtime"
    expected: "No 'Invalid hook call' React errors appear in the browser console. dissolve-core and client share the same React instance."
    why_human: "Runtime React deduplication is not verifiable statically. vite.config.js does not include resolve.dedupe — may not be needed given pnpm symlinks, but needs runtime confirmation."
---

# Phase 2: Architecture (Shared Core) Verification Report

**Phase Goal:** crypto/ and hooks/ live in one place, both clients import from it, and the client can use multiple relay URLs
**Verified:** 2026-03-02T00:00:00Z
**Status:** HUMAN NEEDED — 6/6 automated truths verified; 4 items require runtime confirmation
**Re-verification:** Yes — supersedes previous VERIFICATION.md (gaps_found, 5/6); closes the e2eePrivJwk gap via plan 02-05

---

## Re-verification Summary

Previous verification (2026-03-01) found one blocker gap: `e2eePrivJwk` was missing from both `useIdentity` return objects, causing all received messages to silently fail decryption. Plan 02-05 was executed and produced two commits:

- `1329a80` — `sendEnvelope` synthetic 503 fallback (both relay.js files)
- `1402b4e` — `e2eePrivJwk: e2eePrivKey` alias in both useIdentity hooks + `instanceof CryptoKey` guard in `e2eeDecrypt`

All three code changes verified present in the actual codebase. No regressions found in previously-verified truths.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A bug fix in a crypto function requires changing exactly one file, reflected in both clients | VERIFIED | 6 crypto files live exclusively in `packages/dissolve-core/src/crypto/`; both `client/src/crypto/` and `desktop/src/crypto/` are empty; both clients import via pnpm workspace symlink |
| 2 | Monorepo builds cleanly and both clients resolve dissolve-core imports | VERIFIED | `pnpm-workspace.yaml` present; both `client/node_modules/dissolve-core` and `desktop/node_modules/dissolve-core` are symlinks to `packages/dissolve-core` |
| 3 | Capability registrations are published to all configured relays automatically on login | VERIFIED | `publishCaps` and `publishRequestCaps` use `Promise.allSettled` over `_relayUrls`; `useMessaging.js` parses comma/newline-separated relay string and calls `setRelayUrlsGlobal(urls)` |
| 4 | Login succeeds without a "required JWK member kty was missing" error | VERIFIED | `useIdentity` return at line 369 has `authPrivJwk: authPrivKey` alias; `App.jsx` uses `identity.authPrivKey` in `handleBlockPeer`; no dangling `authPrivJwk` references |
| 5 | A user with two relay URLs can have messages sent to all relays | VERIFIED | `sendEnvelope` uses `Promise.allSettled` fan-out (line 106); returns real Response on success or synthetic `{ok:false,status:503}` on total failure (line 117); `useMessaging` safely checks `resp.ok`, calls `resp.json()`, and reads `resp.status` |
| 6 | Received messages can be decrypted by the recipient | VERIFIED | `useIdentity` return at line 369 now exposes `e2eePrivJwk: e2eePrivKey`; `useMessaging` destructures `e2eePrivJwk` at line 49 and passes it to `e2eeDecrypt` at line 70; `e2eeDecrypt` has `instanceof CryptoKey` guard at line 83 — CryptoKey used directly, no re-import attempted |

**Score:** 6/6 truths verified

---

## Required Artifacts

### Plan 02-01 Artifacts (ARCH-02: pnpm workspace)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pnpm-workspace.yaml` | Workspace package declaration with `packages/*`, `client`, `desktop` | VERIFIED | Contains exactly `packages/*`, `client`, `desktop` entries |
| `package.json` (root) | Root workspace with `"private": true` | VERIFIED | `{ "name": "dissolvechat", "private": true }` |
| `packages/dissolve-core/package.json` | dissolve-core package with exports map | VERIFIED | `"name": "dissolve-core"`, exports `./crypto`, `./crypto/*`, `./hooks`, `./hooks/*` |
| `client/src/hooks/useContacts.js` | Contact management hook | VERIFIED | Exists |
| `client/src/utils/storage.js` | Storage utility | VERIFIED | Exists |
| `client/src/utils/messageStore.js` | Message store utility | VERIFIED | Exists |
| `client/src/protocol/envelopes.js` | Protocol envelope builders | VERIFIED | Exists |

### Plan 02-02 Artifacts (ARCH-01: dissolve-core extraction)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/dissolve-core/src/crypto/index.js` | Barrel re-export of all crypto utilities | VERIFIED | Exports: `sha256B64u`, `randomCap`, `randomId`, `enc`, `b64uFromBytes`, `bytesFromB64u`, `capHashFromCap`, `jcs`, `signObject`, `verifyObject`, `e2eeEncrypt`, `e2eeDecrypt`, `encryptPrivateData`, `decryptPrivateData` |
| `packages/dissolve-core/src/crypto/e2ee.js` | Phase 1 bucket padding preserved; CryptoKey guard (new in 02-05) | VERIFIED | 97 lines; `BUCKETS = [512, 1024, 2048, 4096]` at line 11; `instanceof CryptoKey` guard at line 83 |
| `packages/dissolve-core/src/crypto/encoding.js` | Base64url, SHA-256, randomCap, randomId | VERIFIED | Exists, substantive |
| `packages/dissolve-core/src/crypto/signing.js` | ECDSA sign/verify with CryptoKey guard | VERIFIED | Exists, substantive |
| `packages/dissolve-core/src/crypto/keyfile.js` | PBKDF2/AES-GCM key file | VERIFIED | Exists, substantive |
| `packages/dissolve-core/src/crypto/seed.js` | BIP39 mnemonic derivation | VERIFIED | Exists, substantive |
| `packages/dissolve-core/src/hooks/index.js` | Barrel exporting only useToast | VERIFIED | Exports `useToast` only |
| `packages/dissolve-core/src/hooks/useToast.js` | Pure React hook in dissolve-core | VERIFIED | Exists |
| `client/src/crypto/` (directory) | Empty — files moved to dissolve-core | VERIFIED | Zero files |
| `desktop/src/crypto/` (directory) | Empty — files moved to dissolve-core | VERIFIED | Zero files |

### Plan 02-03 Artifacts (ARCH-03: multi-relay)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/src/protocol/relay.js` | Multi-relay HTTP and WebSocket client; synthetic 503 fallback (new in 02-05) | VERIFIED | `_relayUrls[]` array, `setRelayUrls` exported, `Promise.allSettled` x3, synthetic `{ok:false,status:503}` at line 117 |
| `desktop/src/protocol/relay.js` | Identical to client relay.js | VERIFIED | `diff client desktop relay.js` returns empty |

### Plan 02-04 Artifacts (Gap closure: authPrivJwk undefined)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/src/hooks/useIdentity.js` | `authPrivJwk: authPrivKey` alias in return object | VERIFIED | Line 369 confirmed |
| `desktop/src/hooks/useIdentity.js` | Same alias as client | VERIFIED | Line 369 confirmed — identical |
| `client/src/App.jsx` | `handleBlockPeer` uses `identity.authPrivKey` | VERIFIED | Line 256: `identity.authPrivKey` |
| `desktop/src/App.jsx` | Same as client | VERIFIED | Line 251: identical pattern |

### Plan 02-05 Artifacts (Gap closure: e2eePrivJwk undefined + sendEnvelope Error)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/src/protocol/relay.js` | Synthetic 503 fallback in `sendEnvelope` | VERIFIED | Line 117: `return lastResult?.value ?? { ok: false, status: 503, json: () => Promise.resolve({}) }` |
| `desktop/src/protocol/relay.js` | Identical to client | VERIFIED | `diff` output empty |
| `client/src/hooks/useIdentity.js` | `e2eePrivJwk: e2eePrivKey` alias at line 369 | VERIFIED | `authPrivKey, authPrivJwk: authPrivKey, authPubJwk, e2eePrivKey, e2eePrivJwk: e2eePrivKey, e2eePubJwk` |
| `desktop/src/hooks/useIdentity.js` | Identical alias | VERIFIED | Line 369 confirmed identical |
| `packages/dissolve-core/src/crypto/e2ee.js` | `instanceof CryptoKey` guard in `e2eeDecrypt` | VERIFIED | Lines 83-85: `myStaticPrivJwk instanceof CryptoKey ? myStaticPrivJwk : await importEcdhPrivateKey(myStaticPrivJwk)` |

---

## Key Link Verification

### Plan 02-01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `client/package.json` | `packages/dissolve-core` | `workspace:*` dependency | VERIFIED | `"dissolve-core": "workspace:*"` |
| `desktop/package.json` | `packages/dissolve-core` | `workspace:*` dependency | VERIFIED | `"dissolve-core": "workspace:*"` |
| `client/node_modules/dissolve-core` | `packages/dissolve-core` | pnpm symlink | VERIFIED | Symlink active |
| `desktop/node_modules/dissolve-core` | `packages/dissolve-core` | pnpm symlink | VERIFIED | Symlink active |

### Plan 02-02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `client/src/App.jsx` | `packages/dissolve-core/src/crypto` | `import from "dissolve-core/crypto"` | VERIFIED | `import { capHashFromCap } from "dissolve-core/crypto"` |
| `client/src/App.jsx` | `packages/dissolve-core/src/hooks` | `import from "dissolve-core/hooks"` | VERIFIED | `import { useToast } from "dissolve-core/hooks"` |
| `desktop/src/App.jsx` | `packages/dissolve-core` | identical imports | VERIFIED | Identical to client App.jsx |
| `client/src/hooks/useMessaging.js` | `packages/dissolve-core/src/crypto` | `import from "dissolve-core/crypto"` | VERIFIED | `randomId`, `capHashFromCap`, `signObject`, `verifyObject`, `e2eeDecrypt` from dissolve-core |
| `client/src/protocol/relay.js` | `packages/dissolve-core/src/crypto/signing.js` | `import from "dissolve-core/crypto/signing"` | VERIFIED | `import { signObject } from "dissolve-core/crypto/signing"` |
| No relative `../crypto` imports remain | both clients | grep check | VERIFIED | Zero results for `from "../crypto"` or `from "./crypto"` in both client and desktop src/ |

### Plan 02-03 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `client/src/hooks/useMessaging.js` | `client/src/protocol/relay.js` | `setRelayUrls as setRelayUrlsGlobal` called in useEffect | VERIFIED | Line 23 imports alias; line 236 parses `relayUrl.split(/[\n,]/)` and calls `setRelayUrlsGlobal(urls)` |
| `client/src/protocol/relay.js` | all configured relay URLs | `Promise.allSettled` fan-out | VERIFIED | 3 occurrences: `publishCaps` (line 74), `publishRequestCaps` (line 90), `sendEnvelope` (line 106) |
| `desktop/src/hooks/useMessaging.js` | `desktop/src/protocol/relay.js` | `setRelayUrls(urls)` | VERIFIED | Identical pattern to client |

### Plan 02-04 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useIdentity` return object | `useMessaging` `authPrivJwk` destructuring | `authPrivJwk: authPrivKey` alias | VERIFIED | Alias present; useMessaging line 48 receives CryptoKey |
| `App.jsx handleBlockPeer` | `buildBlockRequest` third argument | `identity.authPrivKey` | VERIFIED | Line 256 (client) and 251 (desktop) |

### Plan 02-05 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useIdentity` return object | `useMessaging` `e2eePrivJwk` destructuring | `e2eePrivJwk: e2eePrivKey` alias at line 369 | VERIFIED | Alias present; useMessaging line 49 now receives CryptoKey (not undefined) |
| `useMessaging` line 70 | `e2eeDecrypt` in dissolve-core | passes CryptoKey as second arg | VERIFIED | `e2eeDecrypt(env.payload, e2eePrivJwk)` where `e2eePrivJwk` is now a CryptoKey; guard at e2ee.js line 83 accepts it directly |
| `useMessaging` `resp.ok` / `resp.json()` | `sendEnvelope` return value | synthetic 503 object on all-relay failure | VERIFIED | `{ ok: false, status: 503, json: () => Promise.resolve({}) }` returned at relay.js line 117; useMessaging lines 367, 375, 376 all safe |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ARCH-01 | 02-02, 02-04, 02-05 | `crypto/` and `hooks/` extracted to `packages/dissolve-core` consumed by both clients | SATISFIED | All 6 crypto files in dissolve-core; both clients import from `dissolve-core/*`; both symlinks active; CryptoKey guard added to e2eeDecrypt to handle non-extractable key pattern |
| ARCH-02 | 02-01 | pnpm workspaces monorepo configured so both clients import from `dissolve-core` | SATISFIED | `pnpm-workspace.yaml` present; `"dissolve-core": "workspace:*"` in both `package.json` files; symlinks confirmed |
| ARCH-03 | 02-03, 02-05 | Client supports multiple relay URLs — caps broadcast to all, inboxes drained from reachable | SATISFIED | `Promise.allSettled` x3 for writes; sequential `for` loop x2 for reads; `connectWebSocket` opens one WS per relay; `useMessaging.js` parses comma-separated relay string; `sendEnvelope` now returns safe response-like object on all-relay failure |

No orphaned requirements — REQUIREMENTS.md traceability table maps ARCH-01, ARCH-02, ARCH-03 to Phase 2 only. All three are marked `[x]` (complete) in REQUIREMENTS.md.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `client/src/hooks/useMessaging.js` | 255 | `createMessageStore(JSON.stringify(e2eePrivJwk))` where `e2eePrivJwk` is a non-extractable `CryptoKey` — `JSON.stringify` returns `undefined`, coerced to the string `"undefined"` by `te.encode()` in `deriveArchiveKey` | WARNING | Archive AES key derived from constant string `"undefined"` regardless of identity — all users share the same archive key material. Not a crash; does not affect send/receive. Out of scope for Phase 2. |
| `client/src/protocol/relay.js` | 133, 151 | `return []` | INFO | Valid fallback returns in drain loops when all relays fail — correct behavior |

No blockers found. The archive key derivation warning is a pre-existing architectural issue that predates Phase 2 (Phase 2 added the monorepo structure; it did not change the archive key design). The fix would require either exporting the raw JWK separately from the CryptoKey or changing `createMessageStore` to accept the identity's `id` field instead of key material.

---

## Human Verification Required

### 1. Message decryption end-to-end

**Test:** Open two browser tabs, each logged in as a different identity. Send a message from tab A to tab B. Observe tab B's chat panel.
**Expected:** The message text appears correctly in tab B's chat — not blank, not a missing entry, and no "can't decrypt" error in the console.
**Why human:** Requires two live identities and a running relay. The static alias `e2eePrivJwk: e2eePrivKey` and the `instanceof CryptoKey` guard are verified present, but correct decryption output can only be confirmed at runtime.

### 2. Multi-relay end-to-end messaging

**Test:** Configure two relay URLs (comma-separated) in the relay settings field. Log in. Observe the browser network tab.
**Expected:** `PUT /caps/{id}` and `POST /send` requests fire to BOTH relay URLs simultaneously. A message sent reaches a contact registered on the second relay only.
**Why human:** Requires two live relay instances. `Promise.allSettled` fan-out is verified in code but relay-to-relay behavior requires runtime observation.

### 3. Backward compatibility with single relay URL

**Test:** Configure a single relay URL. Use the app normally — login, send messages, receive messages, block a peer.
**Expected:** All functionality works identically to pre-Phase-2 behavior. No regression from the `setRelayUrl` to `setRelayUrls` refactor.
**Why human:** Requires a running relay and live data flow. Single-relay path through `Promise.allSettled` is structurally correct but needs runtime confirmation.

### 4. React deduplication under real runtime

**Test:** Open the client in a browser. Open the developer console. Look for any "Invalid hook call" or "Minified React error" messages.
**Expected:** No React version mismatch errors. `dissolve-core` and `client` share the same React instance via pnpm symlinks.
**Why human:** `vite.config.js` does not include `resolve.dedupe: ['react']`. This may not be needed given pnpm's symlink resolution, but runtime verification is required.

---

## Gaps Summary

No gaps remain. All 6 observable truths are verified against the actual codebase. The three code changes from plan 02-05 (commits `1329a80` and `1402b4e`) are confirmed present:

1. `sendEnvelope` in both `relay.js` files returns a safe synthetic `{ok:false,status:503,json:()->Promise.resolve({})}` when all relay fetches are rejected — resolving the "Send attempt N failed: undefined" error.
2. `e2eePrivJwk: e2eePrivKey` alias is present at line 369 of both `useIdentity.js` files — `useMessaging` now destructures a valid `CryptoKey`, not `undefined`.
3. `e2eeDecrypt` in `packages/dissolve-core/src/crypto/e2ee.js` has the `instanceof CryptoKey` guard at line 83 — the `CryptoKey` passed via the alias is used directly without attempting re-import.

Remaining items are human verification only (runtime behaviour, multi-relay, React deduplication).

---

_Verified: 2026-03-02T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
