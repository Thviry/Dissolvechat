---
phase: 01-finish-the-foundations
plan: 02
subsystem: config
tags: [constants, timing, refactor, maintainability]

# Dependency graph
requires: []
provides:
  - "client/src/config.js with four named timing constants (POLL_INTERVAL_MS, CAP_REPUBLISH_INTERVAL_MS, WS_RECONNECT_DELAY_MS, SEND_RETRY_BASE_DELAY_MS)"
  - "desktop/src/config.js as identical copy of client config"
  - "useMessaging.js (client + desktop) imports constants instead of bare numeric literals"
  - "relay.js (client + desktop) imports WS_RECONNECT_DELAY_MS instead of hardcoded 3000"
affects: [all future phases touching timing behavior, performance tuning]

# Tech tracking
tech-stack:
  added: []
  patterns: [centralized application constants in config.js, named exports only (no default export)]

key-files:
  created:
    - client/src/config.js
    - desktop/src/config.js
  modified:
    - client/src/hooks/useMessaging.js
    - client/src/protocol/relay.js
    - desktop/src/hooks/useMessaging.js
    - desktop/src/protocol/relay.js

key-decisions:
  - "Relay URL constants (DEFAULT_API, DEFAULT_WS using import.meta.env) remain in relay.js — not moved to config.js, since they are deployment config not application constants"
  - "desktop/src/config.js is an identical copy of client/src/config.js — no abstraction; duplication accepted to limit refactor risk pre-v1.0"
  - "Named exports only (no default export) — enables selective import and tree-shaking"

patterns-established:
  - "Application timing constants centralized in src/config.js — tuning a timing value means editing one file"
  - "Numeric separator syntax (5_000, 30_000) used in config.js for readability"

requirements-completed: [SEC-02]

# Metrics
duration: 2min
completed: 2026-03-01
---

# Phase 1 Plan 2: Centralize Timing Constants Summary

**Four bare timing literals (5000, 30000, 3000, 1500 ms) replaced with named exports from new client/src/config.js across both client and desktop trees**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-01T17:55:57Z
- **Completed:** 2026-03-01T17:57:47Z
- **Tasks:** 2
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- Created client/src/config.js exporting POLL_INTERVAL_MS, CAP_REPUBLISH_INTERVAL_MS, WS_RECONNECT_DELAY_MS, and SEND_RETRY_BASE_DELAY_MS as named constants with documentation comments
- Replaced all four magic timing literals in client/src/hooks/useMessaging.js and client/src/protocol/relay.js with named constant imports
- Created desktop/src/config.js as identical copy and applied the same replacements to desktop variants, keeping client and desktop trees synchronized
- Relay env-var constants (DEFAULT_API, DEFAULT_WS) left untouched in relay.js as intended

## Task Commits

Each task was committed atomically:

1. **Task 1: Create client/src/config.js with four named exports** - `72620bf` (feat)
2. **Task 2: Replace magic numbers in useMessaging.js and relay.js (client + desktop)** - `088a38e` (feat)

## Files Created/Modified
- `client/src/config.js` - New file; four named timing constants with JSDoc comments
- `desktop/src/config.js` - Identical copy of client/src/config.js
- `client/src/hooks/useMessaging.js` - Added config import; replaced 5000, 30000, 1500 literals
- `client/src/protocol/relay.js` - Added config import; replaced 3000 literal
- `desktop/src/hooks/useMessaging.js` - Same changes as client variant
- `desktop/src/protocol/relay.js` - Same changes as client variant

## Verification Results

```
=== 1. Both config files identical ===
Files are identical: PASS

=== 2. All four exports ===
[ 'CAP_REPUBLISH_INTERVAL_MS', 'POLL_INTERVAL_MS', 'SEND_RETRY_BASE_DELAY_MS', 'WS_RECONNECT_DELAY_MS' ]

=== 3. No bare timing literals in modified files ===
No bare literals: PASS

=== 4. Relay env var constants untouched ===
const DEFAULT_API = import.meta.env.VITE_API_URL || "http://localhost:3001";
const DEFAULT_WS = import.meta.env.VITE_WS_URL || "ws://localhost:3001/ws";
```

## Decisions Made
- Relay URL constants (DEFAULT_API, DEFAULT_WS using import.meta.env) remain in relay.js — not moved to config.js since they are deployment config not application constants
- desktop/src/config.js is an identical copy — duplication accepted to limit refactor risk pre-v1.0 per project decisions
- Named exports only (no default export) for selective import capability

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- SEC-02 satisfied: all timing knobs are in one file, developer can tune any interval by editing client/src/config.js
- No functional behavior change — constant values identical to original hardcoded literals
- Both client and desktop trees updated with no divergence

---
*Phase: 01-finish-the-foundations*
*Completed: 2026-03-01*
