# Requirements: DissolveChat v1.0

**Defined:** 2026-02-28
**Core Value:** Users can send and receive end-to-end encrypted messages without trusting any platform with their identity, contacts, or message content.

## v1 Requirements

### Security

- [x] **SEC-01**: Encrypted payloads are padded to fixed-size buckets (512B/1KB/2KB/4KB) so ciphertext size does not leak message length
- [x] **SEC-02**: Client-side configuration constants (poll interval, reconnect delay, TTLs) are centralized in `client/src/config.js` rather than scattered as magic numbers

### Architecture

- [ ] **ARCH-01**: `crypto/` and `hooks/` modules are extracted to a `packages/dissolve-core` shared package consumed by both `client/` and `desktop/`
- [x] **ARCH-02**: pnpm workspaces monorepo is configured so both clients import from `dissolve-core`
- [ ] **ARCH-03**: Client supports multiple relay URLs — capability registrations broadcast to all, inboxes drained from whichever is reachable

### Deployment

- [ ] **DEPLOY-01**: Relay server ships with a `docker-compose.yml` for single-command production deployment
- [ ] **DEPLOY-02**: Environment variables for relay configuration are documented (ports, rate limits, TTLs, CORS)
- [ ] **DEPLOY-03**: An nginx reverse proxy config example is provided for SSL termination
- [ ] **DEPLOY-04**: Relay exposes a `/health` endpoint for monitoring

### Documentation

- [ ] **DOCS-01**: `SELF_HOSTING.md` covers relay deployment end-to-end (Docker, env vars, reverse proxy, DNS)
- [ ] **DOCS-02**: End-user guide covers: creating identity, adding contacts, seed phrase backup/recovery, switching relays
- [ ] **DOCS-03**: README is updated to production quality with quickstart, architecture overview, and self-hosting link

### Onboarding

- [ ] **ONB-01**: Landing page explains what DissolveChat is, why it's different, and how to get started (static HTML or GitHub Pages)
- [ ] **ONB-02**: First-run flow prompts user to save/acknowledge seed phrase before entering the app

### Beta & Release

- [ ] **BETA-01**: A defined beta process exists — invite mechanism, feedback channel, issue triage workflow
- [ ] **BETA-02**: Beta findings are triaged and critical bugs fixed before v1.0 tag
- [ ] **REL-01**: Threat model is re-audited against v1.0 implementation — all claims verified or updated
- [ ] **REL-02**: v1.0.0 git tag is created and release notes published

## v2 Requirements

### Security

- **SEC-V2-01**: Envelope timing jitter (0-800ms random delay before sending) to prevent traffic analysis via timing
- **SEC-V2-02**: Cover traffic (periodic indistinguishable noise messages) — opt-in, configurable bandwidth budget
- **SEC-V2-03**: Distributed lock (Redis) for handle race condition in clustered relay deployments

### Architecture

- **ARCH-V2-01**: UI components (`components/`) deduplicated between client and desktop
- **ARCH-V2-02**: Multi-relay mesh — relays forward envelopes to other relays (true decentralization)
- **ARCH-V2-03**: Capability-scoped routing (v6 protocol) — relay never sees recipient identity ID

### Features

- **FEAT-V2-01**: Group messaging via sender-key protocol with per-member capability revocation
- **FEAT-V2-02**: Key rotation — periodic rotation of signing and encryption keys
- **FEAT-V2-03**: Relay-side encrypted archive — optional long-term blob storage for cross-device history
- **FEAT-V2-04**: Mobile native app (iOS/Android)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Persistent server-side message storage | Relay is intentionally stateless; conflicts with zero-trust design |
| OAuth / social login | Conflicts with self-sovereign identity model |
| Group messaging | Sender-key complexity; v6 protocol change required — v2 |
| Mobile native app | Web client works on mobile; native is post-v1.0 |
| Distributed lock (Redis) | Single-instance relay is v1.0 target |
| UI component deduplication | Pre-v1.0 risk outweighs benefit; only crypto/hooks shared |
| Server-side user accounts | Antithetical to the product's core design |
| Analytics / telemetry | Privacy-first product; no tracking |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1 | Complete |
| SEC-02 | Phase 1 | Complete |
| ARCH-01 | Phase 2 | Pending |
| ARCH-02 | Phase 2 | Complete |
| ARCH-03 | Phase 2 | Pending |
| DEPLOY-01 | Phase 3 | Pending |
| DEPLOY-02 | Phase 3 | Pending |
| DEPLOY-03 | Phase 3 | Pending |
| DEPLOY-04 | Phase 3 | Pending |
| DOCS-01 | Phase 3 | Pending |
| DOCS-02 | Phase 4 | Pending |
| DOCS-03 | Phase 4 | Pending |
| ONB-01 | Phase 4 | Pending |
| ONB-02 | Phase 4 | Pending |
| BETA-01 | Phase 5 | Pending |
| BETA-02 | Phase 5 | Pending |
| REL-01 | Phase 6 | Pending |
| REL-02 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-28*
*Last updated: 2026-03-01 — SEC-01 marked complete (01-01)*
