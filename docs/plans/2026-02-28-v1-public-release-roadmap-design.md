# DissolveChat v1.0 Public Release — Roadmap Design

**Date:** 2026-02-28
**Goal:** Drive DissolveChat from working prototype to public release using a GSD phased roadmap.

---

## Context

DissolveChat v5.16 is a working P2P encrypted chat application with:
- Defined protocol (v4-secure) with formal spec and threat model
- Web client (React/Vite)
- Desktop client (Tauri)
- Hardened relay server (Node.js)
- Core security features: non-extractable keys, capability-based routing, forward secrecy

The product works but isn't ready for public use. This document defines the phased plan to get there.

---

## Audit: What's Already Done

| Feature | Status |
|---------|--------|
| WebSocket reconnection fix | ✅ Done |
| Message loss buffer (pending queue = 50) | ✅ Done |
| Non-extractable key storage (WebCrypto) | ✅ Done |
| Configurable relay URL in settings | ✅ Done |
| Handle race condition (single-instance) | ⚠️ Partial — no distributed lock |
| Config centralization (server) | ⚠️ Partial — client still has magic numbers |
| Envelope padding (fixed-size buckets) | ❌ Not done |
| Shared dissolve-core package | ❌ Not done |
| Multi-relay support | ❌ Not done |
| Self-hosting docs | ⚠️ Partial — fragments in desktop/README |

---

## Phase Breakdown

### Phase 1 — Finish the Foundations
**Goal:** Close remaining gaps before building on top.

- Envelope padding — pad encrypted payloads to fixed size buckets (512B/1KB/2KB/4KB) in `e2ee.js` to prevent traffic analysis via ciphertext size
- Client config centralization — extract magic numbers (reconnect delay, poll interval, TTLs) into a `client/src/config.js`
- Self-hosting guide — write `SELF_HOSTING.md` covering relay deployment, environment variables, reverse proxy setup

### Phase 2 — Architecture (Shared Core)
**Goal:** Extract shared logic to eliminate client/desktop duplication and make beta-phase iteration faster.

- Extract `crypto/` and `hooks/` into a `packages/dissolve-core` shared package
- Set up pnpm workspaces monorepo
- Both `client/` and `desktop/` import from `dissolve-core`
- UI components (JSX) remain duplicated — out of scope for this phase
- Multi-relay support — array of relay URLs, broadcast capability registrations, drain from whichever is reachable

### Phase 3 — Deployment & Infrastructure
**Goal:** Make the relay runnable in production by anyone.

- Docker + docker-compose for relay and (optionally) static web client
- Environment variable documentation
- SSL/reverse proxy guidance (nginx config)
- Basic health/metrics endpoint for monitoring
- CI pipeline for automated testing on push

### Phase 4 — Onboarding & Docs
**Goal:** A stranger can understand, install, and use DissolveChat without asking questions.

- Landing page (static, can be GitHub Pages or simple HTML)
- End-user guide covering: creating identity, adding contacts, recovering from seed phrase, self-hosting
- In-app first-run improvements (clearer onboarding for seed phrase backup)
- Update README to production-quality

### Phase 5 — Public Beta
**Goal:** Real users, real feedback, controlled rollout.

- Invite-based beta (limit to known community: security researchers, privacy-focused devs)
- Feedback collection mechanism (GitHub issues template or simple form)
- Bug triage and rapid patch cycle
- Monitoring relay health under real traffic

### Phase 6 — v1.0 Release
**Goal:** Ship it publicly.

- Final security review (threat model re-audit against implemented features)
- Public announcement (HN, privacy communities, open-source channels)
- Open relay (or publish relay-hosting instructions for community relays)
- Tag v1.0.0 in git

---

## Key Decisions

**Shared core scoping:** Extract only `crypto/` and `hooks/` pre-v1.0. UI components (`components/`) remain duplicated until post-v1.0 to limit refactor risk.

**Multi-relay in Phase 2:** Included alongside shared core because the relay URL logic lives in `protocol/relay.js` which will be part of the shared package anyway — natural time to do it.

**No distributed lock for handle race:** Single-instance relay is the target deployment for v1.0. Distributed lock (Redis) deferred to post-v1.0 when/if clustering is needed.

**Envelope padding is Phase 1:** This is a security gap (message length leaks via ciphertext size), not a polish item. It belongs in foundations, not a later phase.

---

## Success Criteria for v1.0

- [ ] A stranger can set up DissolveChat (self-hosted or using open relay) from the README alone
- [ ] Encrypted messages between web and desktop clients work end-to-end
- [ ] Seed phrase backup and recovery works
- [ ] Relay can be deployed with a single `docker-compose up`
- [ ] No known security gaps in the threat model
- [ ] Beta users report the core flow (enroll → add contact → message) works without guidance
