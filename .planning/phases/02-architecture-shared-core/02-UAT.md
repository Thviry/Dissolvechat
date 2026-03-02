---
status: resolved
phase: 02-architecture-shared-core
source: [02-04-SUMMARY.md]
started: 2026-03-01T23:45:00Z
updated: 2026-03-01T23:55:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Login no longer throws JWK error
expected: Open the client app (`cd client && pnpm dev`). Attempt to log in with an existing identity (or create a new account). The browser console should show NO "required JWK member kty was missing" error. The login flow completes and the app loads normally.
result: pass

### 2. Account creation works without auth key error
expected: From the identity/onboarding screen, type a handle and attempt to create a new account. The registration flow completes without a "could not check — is the relay running?" error caused by undefined auth key. (A real relay connectivity error is fine if no relay is running — what we're checking is that the auth key error is gone.)
result: pass
reported: "Could not check — is the relay running? (relay not running — expected)"

### 3. Messages can be sent and received
expected: With a running relay, send a message from an existing identity. The message sends without error and appears in the chat. Received messages are decrypted and display correctly.
result: issue
reported: "useMessaging.js:377 [Dissolve] Send attempt 1 failed: undefined"
severity: major

## Summary

total: 3
passed: 2
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Messages can be sent and received correctly"
  status: resolved
  reason: "User reported: useMessaging.js:377 [Dissolve] Send attempt 1 failed: undefined"
  severity: major
  test: 3
  root_cause: |
    Two separate issues:

    (A) sendEnvelope returns Error not Response on relay failure.
    client/src/protocol/relay.js sendEnvelope() uses Promise.allSettled and when
    all relay fetches are rejected (relay unreachable), the last result's .reason
    (a network Error object) is returned directly. useMessaging expects a Response
    object — Error has no .ok/.status/.json() — so resp.ok is undefined (falsy),
    resp.json() throws, resp.status is undefined, and lastError becomes the string
    "undefined". Fix: return a mock {ok:false, status:503, json:()=>Promise.resolve({})}
    when all promises reject.

    (B) e2eePrivJwk not aliased in useIdentity return object.
    useIdentity exposes e2eePrivKey (CryptoKey) but not e2eePrivJwk. useMessaging
    destructures e2eePrivJwk and gets undefined. e2eeDecrypt(payload, undefined)
    calls importEcdhPrivateKey(undefined) which throws. The catch{return} at line
    73 swallows the error silently — all received messages fail to decrypt.
    Fix: add e2eePrivJwk: e2eePrivKey alias to both useIdentity return objects
    AND add instanceof CryptoKey guard to e2eeDecrypt (mirroring signObject).
  artifacts:
    - path: "client/src/protocol/relay.js"
      issue: "sendEnvelope returns Error object (last rejected reason) when all relays fail — not a Response"
    - path: "desktop/src/protocol/relay.js"
      issue: "identical issue"
    - path: "client/src/hooks/useIdentity.js"
      issue: "Return object at line 369 exposes e2eePrivKey (CryptoKey) but not e2eePrivJwk alias"
    - path: "desktop/src/hooks/useIdentity.js"
      issue: "identical issue"
    - path: "packages/dissolve-core/src/crypto/e2ee.js"
      issue: "e2eeDecrypt calls importEcdhPrivateKey unconditionally — no CryptoKey guard unlike signObject"
  missing:
    - "relay.js sendEnvelope: return synthetic {ok:false,status:503} when results array is empty or all rejected"
    - "client/src/hooks/useIdentity.js line 369: add e2eePrivJwk: e2eePrivKey alias"
    - "desktop/src/hooks/useIdentity.js line 369: identical change"
    - "packages/dissolve-core/src/crypto/e2ee.js: add instanceof CryptoKey guard to e2eeDecrypt"
  debug_session: ""
