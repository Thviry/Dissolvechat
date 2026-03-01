---
phase: 02-architecture-shared-core
plan: "01"
subsystem: workspace-setup
tags: [pnpm, monorepo, source-restore, dissolve-core]
dependency_graph:
  requires: []
  provides: [pnpm-workspace, dissolve-core-scaffold, complete-source-tree]
  affects: [02-02-shared-core-extraction]
tech_stack:
  added: [pnpm@10.30.3]
  patterns: [pnpm-workspace-monorepo, workspace-star-dependency]
key_files:
  created:
    - pnpm-workspace.yaml
    - package.json
    - packages/dissolve-core/package.json
    - pnpm-lock.yaml
    - client/src/crypto/encoding.js
    - client/src/crypto/signing.js
    - client/src/crypto/keyfile.js
    - client/src/crypto/index.js
    - client/src/hooks/useContacts.js
    - client/src/protocol/envelopes.js
    - client/src/utils/storage.js
    - client/src/utils/messageStore.js
    - client/src/utils/qrcode.js
    - desktop/src/crypto/encoding.js
    - desktop/src/crypto/signing.js
    - desktop/src/crypto/keyfile.js
    - desktop/src/crypto/index.js
    - desktop/src/hooks/useContacts.js
    - desktop/src/hooks/useIdentity.js
    - desktop/src/protocol/envelopes.js
    - desktop/src/utils/storage.js
    - desktop/src/utils/messageStore.js
    - desktop/src/utils/qrcode.js
  modified:
    - client/package.json
    - desktop/package.json
key_decisions:
  - pnpm installed globally via npm since it was not in PATH on this machine
  - Used worktree version of useIdentity.js (difference was only line endings CRLF vs LF — content identical)
  - package-lock.json at repo root (from npm era) left in place; pnpm-lock.yaml is the authoritative lockfile going forward
metrics:
  duration_minutes: 3
  tasks_completed: 2
  files_created: 24
  files_modified: 2
  completed_date: "2026-03-01"
requirements_addressed: [ARCH-02]
---

# Phase 02 Plan 01: pnpm Workspace Setup and Source Restore Summary

**One-liner:** Converted repo to pnpm workspace monorepo with dissolve-core scaffold and restored 20 missing source files from the claude/stupefied-volhard branch.

## What Was Built

The main branch was missing ~10 source files (encoding.js, signing.js, keyfile.js, crypto/index.js, envelopes.js, useContacts.js, useIdentity.js, utils/storage.js, utils/messageStore.js, utils/qrcode.js) that exist in the worktree branch. This plan:

1. Restored all missing source files to both client/ and desktop/ using `git checkout claude/stupefied-volhard -- <path>`
2. Created the pnpm workspace structure: root package.json, pnpm-workspace.yaml, and packages/dissolve-core/package.json
3. Added `"dissolve-core": "workspace:*"` to client and desktop package.json
4. Ran `pnpm install` — created pnpm-lock.yaml and symlinked dissolve-core into both client and desktop node_modules

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Restore missing source files from worktree branch | 9378c8a | 20 source files in client/src and desktop/src |
| 2 | Set up pnpm workspace and dissolve-core scaffold | 252c63d | pnpm-workspace.yaml, package.json, packages/dissolve-core/package.json, pnpm-lock.yaml |

## Verification Results

All success criteria passed:

- pnpm install exited 0 (71 packages resolved)
- pnpm ls -r shows all 3 workspace packages: dissolve-core, dissolvechat-client, dissolvechat-desktop
- client/node_modules/dissolve-core symlinks to packages/dissolve-core
- All 10 source files restored to client/src and desktop/src
- Phase 1 changes preserved: BUCKETS = [512, 1024, 2048, 4096] in e2ee.js, POLL_INTERVAL_MS in config.js, WS_RECONNECT_DELAY_MS import in relay.js
- packages/dissolve-core/package.json exists with correct exports field

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] pnpm not in bash PATH**
- **Found during:** Task 2 (Step 6: Run pnpm install)
- **Issue:** pnpm was not available in the Git Bash PATH on this Windows machine
- **Fix:** Installed pnpm globally via `npm install -g pnpm` before running `pnpm install`
- **Files modified:** None (environment setup)
- **Commit:** N/A (environment-only change)

## Self-Check: PASSED

All files exist on disk:
- pnpm-workspace.yaml: FOUND
- package.json: FOUND
- packages/dissolve-core/package.json: FOUND
- pnpm-lock.yaml: FOUND
- All 9 client source files: FOUND
- All 10 desktop source files: FOUND

All commits exist in git history:
- 9378c8a (Task 1 — restore source files): FOUND
- 252c63d (Task 2 — workspace setup): FOUND
