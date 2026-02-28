# Roadmap: DissolveChat v1.0

## Overview

DissolveChat v5.16 is a working P2P encrypted chat app. This roadmap drives it from working prototype to public v1.0 release. The six phases close security gaps, eliminate code duplication, harden deployment infrastructure, write the docs a stranger needs, run a controlled beta, and ship. Each phase delivers a verifiable capability before the next begins.

## Phases

- [ ] **Phase 1: Finish the Foundations** - Close security and configuration gaps before building on top
- [ ] **Phase 2: Architecture (Shared Core)** - Extract shared logic and add multi-relay support
- [ ] **Phase 3: Deployment & Infrastructure** - Make the relay self-hostable by anyone with one command
- [ ] **Phase 4: Onboarding & Docs** - A stranger can understand, install, and use DissolveChat without asking questions
- [ ] **Phase 5: Public Beta** - Real users, real feedback, controlled rollout
- [ ] **Phase 6: v1.0 Release** - Security re-audit, public announcement, tag v1.0.0

## Phase Details

### Phase 1: Finish the Foundations
**Goal**: Security gaps are closed and client configuration is maintainable before the codebase is restructured
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02
**Success Criteria** (what must be TRUE):
  1. An encrypted message payload is always one of four fixed sizes (512B, 1KB, 2KB, 4KB) — ciphertext size no longer reveals message length
  2. A developer can change the poll interval, reconnect delay, or TTL by editing a single file (`client/src/config.js`) rather than hunting through hook source
  3. The app functions correctly with the padded payload format — send and receive work end-to-end with no regressions
**Plans**: TBD

Plans:
- [ ] 01-01: Implement envelope padding in e2ee.js (fixed-size buckets)
- [ ] 01-02: Centralize client magic numbers into config.js

### Phase 2: Architecture (Shared Core)
**Goal**: `crypto/` and `hooks/` live in one place, both clients import from it, and the client can use multiple relay URLs
**Depends on**: Phase 1
**Requirements**: ARCH-01, ARCH-02, ARCH-03
**Success Criteria** (what must be TRUE):
  1. A bug fix in a crypto function requires changing exactly one file, and the fix is immediately reflected in both the web and desktop clients
  2. The monorepo builds cleanly with `pnpm install` and both clients pass their existing tests
  3. A user with two relay URLs configured can send a message that reaches a recipient connected to either relay
  4. Capability registrations are published to all configured relays automatically on login
**Plans**: TBD

Plans:
- [ ] 02-01: Set up pnpm workspaces and create packages/dissolve-core scaffold
- [ ] 02-02: Extract crypto/ and hooks/ into dissolve-core; wire client and desktop imports
- [ ] 02-03: Implement multi-relay support (array of URLs, broadcast caps, drain from reachable)

### Phase 3: Deployment & Infrastructure
**Goal**: Anyone can deploy the relay to production with a single command, with SSL, monitoring, and full documentation
**Depends on**: Phase 2
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DOCS-01
**Success Criteria** (what must be TRUE):
  1. Running `docker-compose up` in the repo root starts a production-ready relay (no additional steps required)
  2. A self-hoster can read `SELF_HOSTING.md` and go from zero to a running relay with SSL in under 30 minutes, without prior knowledge of the codebase
  3. All relay environment variables (ports, rate limits, TTLs, CORS origins) are documented with defaults and valid ranges
  4. The relay's `/health` endpoint returns a valid response that a monitoring tool (UptimeRobot, etc.) can poll
  5. An nginx reverse proxy config example is included that terminates SSL and proxies to the relay
**Plans**: TBD

Plans:
- [ ] 03-01: Add /health endpoint to relay server
- [ ] 03-02: Write docker-compose.yml for relay (and optional static web client)
- [ ] 03-03: Document all environment variables (DEPLOY-02) and write nginx config example (DEPLOY-03)
- [ ] 03-04: Write SELF_HOSTING.md end-to-end guide (DOCS-01)

### Phase 4: Onboarding & Docs
**Goal**: A stranger can find DissolveChat, understand what it is, and complete the full flow (enroll, add contact, message) without help
**Depends on**: Phase 3
**Requirements**: DOCS-02, DOCS-03, ONB-01, ONB-02
**Success Criteria** (what must be TRUE):
  1. A new user visiting the landing page understands what DissolveChat is and why it is different from Signal or WhatsApp before clicking any link
  2. A user who loses their device can restore their identity by following the end-user guide using only their seed phrase and keyfile
  3. A first-time user is explicitly prompted to write down (or acknowledge) their seed phrase before they can enter the main chat view
  4. A developer or self-hoster can find quickstart instructions, an architecture overview, and a link to SELF_HOSTING.md in the README without scrolling past the fold
**Plans**: TBD

Plans:
- [ ] 04-01: Build landing page (static HTML or GitHub Pages)
- [ ] 04-02: Write end-user guide (identity, contacts, seed phrase, relay switching)
- [ ] 04-03: Implement first-run seed phrase acknowledgment flow
- [ ] 04-04: Update README to production quality

### Phase 5: Public Beta
**Goal**: Real users exercise the core flow, feedback is collected systematically, and critical bugs are fixed before v1.0
**Depends on**: Phase 4
**Requirements**: BETA-01, BETA-02
**Success Criteria** (what must be TRUE):
  1. Beta invites can be issued and tracked — it is known who is in the beta
  2. A feedback channel exists (GitHub issue template or form) and at least one feedback item has been submitted and triaged
  3. Every critical bug found in beta is resolved or explicitly deferred with a rationale before v1.0 is tagged
  4. The relay has operated under real traffic for at least one beta cycle with health monitoring in place
**Plans**: TBD

Plans:
- [ ] 05-01: Define beta process (invite mechanism, feedback channel, triage workflow)
- [ ] 05-02: Run beta, triage findings, ship critical fixes

### Phase 6: v1.0 Release
**Goal**: The threat model is verified against the implementation and DissolveChat is publicly announced with a stable git tag
**Depends on**: Phase 5
**Requirements**: REL-01, REL-02
**Success Criteria** (what must be TRUE):
  1. Every claim in the threat model has been re-verified against the v1.0 implementation — no unverified claims remain
  2. The v1.0.0 git tag exists and release notes accurately describe what is and is not included
  3. The release has been announced in at least two public channels (e.g., Hacker News, a privacy community)
**Plans**: TBD

Plans:
- [ ] 06-01: Threat model re-audit against v1.0 implementation
- [ ] 06-02: Tag v1.0.0, write release notes, publish announcement

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Finish the Foundations | 0/2 | Not started | - |
| 2. Architecture (Shared Core) | 0/3 | Not started | - |
| 3. Deployment & Infrastructure | 0/4 | Not started | - |
| 4. Onboarding & Docs | 0/4 | Not started | - |
| 5. Public Beta | 0/2 | Not started | - |
| 6. v1.0 Release | 0/2 | Not started | - |
