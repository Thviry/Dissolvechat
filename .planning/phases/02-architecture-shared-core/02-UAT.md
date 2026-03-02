---
status: complete
phase: 02-architecture-shared-core
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md]
started: 2026-03-01T22:45:00Z
updated: 2026-03-01T23:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. pnpm install and both clients build
expected: From the repo root, run `pnpm install` — completes with no errors. `cd client && pnpm build` exits 0. `cd desktop && pnpm build` exits 0.
result: pass

### 2. App loads in browser without JS errors
expected: Run `cd client && pnpm dev`, open the URL in a browser. The login/identity screen appears with no red console errors about missing modules or failed imports. (dissolve-core resolves at runtime via the pnpm symlink)
result: pass

### 3. Single relay URL still works
expected: With a single relay URL configured as before (e.g., `http://localhost:4000`), the app behaves exactly as it did before Phase 2 — login, send/receive messages, capability registration all work normally. No breakage from the setRelayUrl → setRelayUrls refactor.
result: issue
reported: "getting 'the required JWK member kty was missing' error; when typing a handle to create a new account get 'could not check - is the relay running?'"
severity: major

### 4. Multi-relay URL entry persists
expected: In the relay URL settings field, enter two URLs separated by a comma (e.g., `http://relay1:4000,http://relay2:4000`). Save/confirm. On reload, the same comma-separated string appears in the field — localStorage preserved the value.
result: pass
reported: "no save/confirm option — field auto-saves"

### 5. Multi-relay broadcast reaches all relays
expected: With two relay URLs configured and both relay servers running, logging in sends publishCaps requests to BOTH relay URLs — visible in browser network tab.
result: skipped
reason: relay server not available in this repo — separate project

## Summary

total: 5
passed: 3
issues: 1
pending: 0
skipped: 1

## Gaps

- truth: "App works normally with a single relay URL — login, account creation, messaging all function as before Phase 2"
  status: failed
  reason: "User reported: getting 'the required JWK member kty was missing' error; relay connectivity errors noted but expected when relay not running"
  severity: major
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
