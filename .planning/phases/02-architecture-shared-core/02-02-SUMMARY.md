---
phase: 02-architecture-shared-core
plan: 02
subsystem: infra
tags: [pnpm-workspace, monorepo, crypto, e2ee, ecdh, ecdsa, bip39, dissolve-core]

# Dependency graph
requires:
  - phase: 02-01
    provides: pnpm workspace with dissolve-core package.json and exports map set up
provides:
  - packages/dissolve-core/src/crypto/ with all 6 canonical crypto source files
  - packages/dissolve-core/src/hooks/ with useToast hook and index.js barrel
  - Both clients (client, desktop) import all crypto and useToast from dissolve-core package paths
affects:
  - 02-03 (any further shared-core work builds on this canonical source location)
  - All future crypto changes (one file change in dissolve-core propagates to both clients automatically)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - dissolve-core package is the canonical source for all crypto utilities
    - Relative ../crypto/ and ./crypto/ imports replaced with dissolve-core/crypto package paths
    - useToast moved to dissolve-core; per-client hooks with protocol/utils deps remain per-client

key-files:
  created:
    - packages/dissolve-core/src/crypto/e2ee.js
    - packages/dissolve-core/src/crypto/encoding.js
    - packages/dissolve-core/src/crypto/index.js
    - packages/dissolve-core/src/crypto/keyfile.js
    - packages/dissolve-core/src/crypto/seed.js
    - packages/dissolve-core/src/crypto/signing.js
    - packages/dissolve-core/src/hooks/index.js
    - packages/dissolve-core/src/hooks/useToast.js
  modified:
    - client/src/App.jsx
    - client/src/components/LoginScreen.jsx
    - client/src/hooks/useIdentity.js
    - client/src/hooks/useMessaging.js
    - client/src/protocol/relay.js
    - client/src/protocol/envelopes.js
    - desktop/src/App.jsx
    - desktop/src/components/LoginScreen.jsx
    - desktop/src/hooks/useIdentity.js
    - desktop/src/hooks/useMessaging.js
    - desktop/src/protocol/relay.js
    - desktop/src/protocol/envelopes.js

key-decisions:
  - "useToast moved to dissolve-core (only imports react) — useIdentity, useMessaging, useContacts kept per-client (import ../utils/ and ../protocol/)"
  - "LoginScreen.jsx and protocol/envelopes.js also had relative crypto imports — updated in addition to the files listed in the plan"
  - "Build infrastructure files (index.html, vite.config.js, main.jsx, index.css) were missing from disk (worktree artifact) — restored from git before build verification"

patterns-established:
  - "All new crypto utility code goes to packages/dissolve-core/src/crypto/ — never to client/src/crypto/ or desktop/src/crypto/"
  - "Hook migration rule: only move hooks that import exclusively from react and dissolve-core/*"

requirements-completed: [ARCH-01]

# Metrics
duration: 4min
completed: 2026-03-01
---

# Phase 2 Plan 02: Move Crypto to dissolve-core and Rewrite Imports Summary

**All 6 crypto source files moved to dissolve-core canonical package; both clients rewritten to import from dissolve-core/* paths; pnpm workspace symlink delivers single source of truth to both builds**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-01T22:23:58Z
- **Completed:** 2026-03-01T22:27:31Z
- **Tasks:** 2
- **Files modified:** 20

## Accomplishments

- Populated `packages/dissolve-core/src/crypto/` with all 6 crypto files (e2ee.js, encoding.js, index.js, keyfile.js, seed.js, signing.js) — Phase 1 BUCKETS=[512,1024,2048,4096] preserved in e2ee.js
- Created `packages/dissolve-core/src/hooks/` with useToast.js (pure React hook, no per-client deps) and index.js barrel
- Rewrote all relative `../crypto/` and `./crypto/` imports to `dissolve-core/crypto` package paths in 13 source files across both clients (App.jsx, LoginScreen.jsx, useIdentity.js, useMessaging.js, relay.js, envelopes.js)
- Both `cd client && pnpm build` and `cd desktop && pnpm build` exit 0 — all dissolve-core imports resolve via pnpm workspace symlink
- Both client/src/crypto/ and desktop/src/crypto/ are now empty — canonical source lives only in dissolve-core

## Task Commits

Each task was committed atomically:

1. **Task 1: Populate dissolve-core/src/crypto/ and move pure hook files** - `ca96902` (feat)
2. **Task 2: Rewrite crypto/hooks imports in both clients to use dissolve-core package** - `b7bad37` (feat)

**Plan metadata:** (included in final state commit)

## Files Created/Modified

**Created in dissolve-core:**
- `packages/dissolve-core/src/crypto/e2ee.js` - ECDH ephemeral + AES-GCM e2ee encryption with bucket padding
- `packages/dissolve-core/src/crypto/encoding.js` - Base64url, SHA-256, randomCap, randomId utilities
- `packages/dissolve-core/src/crypto/index.js` - Barrel re-export of all crypto utilities
- `packages/dissolve-core/src/crypto/keyfile.js` - PBKDF2/AES-GCM passphrase-protect key file
- `packages/dissolve-core/src/crypto/seed.js` - BIP39 mnemonic to HKDF identity derivation
- `packages/dissolve-core/src/crypto/signing.js` - ECDSA P-256 sign/verify over JCS-canonicalized JSON
- `packages/dissolve-core/src/hooks/index.js` - Barrel exporting useToast only
- `packages/dissolve-core/src/hooks/useToast.js` - Pure React toast hook

**Modified (import rewrites):**
- `client/src/App.jsx` - capHashFromCap, signObject, useToast now from dissolve-core
- `client/src/components/LoginScreen.jsx` - validateMnemonic from dissolve-core/crypto/seed
- `client/src/hooks/useIdentity.js` - All crypto imports now from dissolve-core
- `client/src/hooks/useMessaging.js` - randomId, capHashFromCap, signObject, verifyObject, e2eeDecrypt from dissolve-core
- `client/src/protocol/relay.js` - signObject from dissolve-core/crypto/signing
- `client/src/protocol/envelopes.js` - sha256B64u, enc, randomId, capHashFromCap, signObject, e2eeEncrypt from dissolve-core
- `desktop/src/App.jsx` - identical rewrites to client App.jsx
- `desktop/src/components/LoginScreen.jsx` - validateMnemonic from dissolve-core/crypto/seed
- `desktop/src/hooks/useIdentity.js` - All crypto imports now from dissolve-core
- `desktop/src/hooks/useMessaging.js` - All crypto imports now from dissolve-core
- `desktop/src/protocol/relay.js` - signObject from dissolve-core/crypto/signing
- `desktop/src/protocol/envelopes.js` - All crypto imports now from dissolve-core

**Deleted (source moved to dissolve-core):**
- `client/src/crypto/*` (6 files) - all deleted
- `desktop/src/crypto/*` (6 files) - all deleted
- `client/src/hooks/useToast.js` - moved to dissolve-core
- `desktop/src/hooks/useToast.js` - moved to dissolve-core

## Decisions Made

- useToast is the only hook that moved to dissolve-core. It imports only from react. useIdentity imports `../utils/storage`, useMessaging imports `../protocol/relay`, `../protocol/envelopes`, `../utils/storage`, `../utils/messageStore`, and useContacts imports `../utils/storage` — all kept per-client per the plan's moving rules.
- dissolve-core/src/hooks/index.js exports only useToast — does NOT export useIdentity or useMessaging.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated LoginScreen.jsx and protocol/envelopes.js in both clients**
- **Found during:** Task 2 (import rewrite sweep)
- **Issue:** Plan listed files to update but did not explicitly include `LoginScreen.jsx` or `protocol/envelopes.js`. Both had relative `../crypto/` imports that would break the build.
- **Fix:** Updated both files in client and desktop to use dissolve-core/crypto paths.
- **Files modified:** client/src/components/LoginScreen.jsx, client/src/protocol/envelopes.js, desktop/src/components/LoginScreen.jsx, desktop/src/protocol/envelopes.js
- **Verification:** Both builds pass with zero import resolution errors
- **Committed in:** b7bad37 (Task 2 commit)

**2. [Rule 3 - Blocking] Restored build infrastructure files missing from disk**
- **Found during:** Task 2 (build verification)
- **Issue:** client/index.html, client/vite.config.js, desktop/index.html, desktop/vite.config.js, client/src/main.jsx, desktop/src/main.jsx, client/src/index.css, desktop/src/index.css were all deleted from disk (git worktree artifact visible in initial git status). Build could not proceed without them.
- **Fix:** `git restore` for each missing file — no content changes, purely restoring tracked files to disk.
- **Files modified:** index.html, vite.config.js, src/main.jsx, src/index.css (both client and desktop)
- **Verification:** Both builds complete successfully after restore
- **Committed in:** b7bad37 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical — additional files needed, 1 blocking — missing build files)
**Impact on plan:** Both fixes necessary for correctness and build success. No scope creep.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- dissolve-core is now the single canonical source for all crypto utilities and the useToast hook
- A bug fix in `packages/dissolve-core/src/crypto/e2ee.js` propagates to both clients automatically via pnpm workspace symlink
- Both client and desktop build cleanly — ready for Phase 02 plan 03 if one exists, or Phase 03

---
*Phase: 02-architecture-shared-core*
*Completed: 2026-03-01*
