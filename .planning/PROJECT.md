# DissolveChat

## What This Is

DissolveChat is an end-to-end encrypted P2P messaging app where users own their identity as a local cryptographic key file — no phone number, no email, no server-side account. The relay server routes encrypted blobs without ever seeing plaintext or private keys. Users control exactly who can reach them via capability tokens they issue and can revoke per-contact.

The product ships as a web client (React/Vite) and a desktop client (Tauri), both backed by a hardened Node.js relay server. The goal is to reach public release: a polished, deployable, documented v1.0 that anyone can self-host or use via an open relay.

## Core Value

Users can send and receive end-to-end encrypted messages without trusting any platform with their identity, contacts, or message content.

## Requirements

### Validated

- ✓ Cryptographic identity — key pair created locally, encrypted with passphrase, stored as portable file — existing
- ✓ Seed phrase backup and recovery — BIP39 mnemonic, enroll returns mnemonic, recover() restores identity — existing
- ✓ End-to-end encryption — AES-GCM with ephemeral ECDH keys, forward secrecy — existing
- ✓ Capability-based access control — per-contact tokens, revocation, no token = no delivery — existing
- ✓ Web client — React/Vite, zero-install, all core flows — existing
- ✓ Desktop client — Tauri wrapper, identical flows to web — existing
- ✓ Hardened relay — schema validation, dual-layer rate limiting, authenticated WebSocket — existing
- ✓ Contact management — add by handle lookup, accept/reject requests, block — existing
- ✓ Session persistence — encrypted JWK in sessionStorage, restore on refresh — existing
- ✓ UI polish — editorial design, 5 themes, SVG icons, animations — existing (v5.16)
- ✓ Non-extractable key storage — WebCrypto non-extractable CryptoKey, private keys never in JS state — existing
- ✓ Configurable relay URL — users can point client at any compatible relay — existing
- ✓ WebSocket real-time + polling fallback — reconnect preserves message pump — existing

### Active

- [ ] Envelope padding — fixed-size payload buckets to prevent traffic analysis via ciphertext size
- [ ] Client config centralization — magic numbers extracted to `client/src/config.js`
- [ ] Self-hosting guide — `SELF_HOSTING.md` covering relay deploy, env vars, reverse proxy
- [ ] Shared dissolve-core package — `crypto/` and `hooks/` extracted to `packages/dissolve-core`, consumed by both clients
- [ ] Multi-relay support — array of relay URLs, broadcast caps, drain from whichever is reachable
- [ ] Production Docker setup — `docker-compose.yml` for relay + static client
- [ ] Landing page — static page explaining what DissolveChat is and how to get started
- [ ] End-user documentation — guide covering identity, contacts, seed phrase, self-hosting
- [ ] First-run UX improvements — clearer onboarding flow for new users
- [ ] Public beta — invite-based rollout, feedback collection, bug triage
- [ ] v1.0 release — security review, public announcement, open relay

### Out of Scope

- Persistent server-side message storage — relay is intentionally a dumb pipe; archive is client-side only
- OAuth / social login — conflicts with the self-sovereign identity model
- Group messaging — sender-key protocol complexity; deferred to v6 per ROADMAP.md
- Mobile native app — web client works on mobile; native app is post-v1.0
- Distributed lock for handle race — single-instance relay is v1.0 target; Redis lock deferred to clustering phase
- UI component deduplication (client/desktop) — components stay duplicated pre-v1.0; only crypto/ and hooks/ are shared

## Context

**Current state:** v5.16, all core protocol features working, UI polished. 9 commits of UI polish just merged to main. Codebase is a working prototype that needs the gaps below closed before public release.

**Known gaps from audit:**
- `client/src/crypto/e2ee.js` — no envelope padding; ciphertext size leaks message length
- Client has magic number constants scattered (poll interval 5s, reconnect delay 3s, etc.)
- `client/src/` and `desktop/src/` are nearly identical duplicates — crypto/ and hooks/ should be shared
- No docker-compose, no deployment docs beyond fragments in desktop/README.md
- No landing page or end-user guide

**Architecture:** Monorepo with `client/`, `desktop/`, `server/` directories. `client/` is web app, `desktop/` duplicates `client/src/` under Tauri. `server/` is Express + WebSocket relay. `test/integration.js` requires live server.

**Stack:** React 18 + Vite (client), Tauri 2 + Rust (desktop), Node.js + Express + ws (server), WebCrypto API + @scure/bip39 (crypto), pnpm (package manager target for monorepo).

## Constraints

- **Security**: All crypto must use WebCrypto API — no custom crypto primitives
- **Protocol**: Changes must remain backward compatible with v4-secure protocol spec until v6
- **Architecture**: Relay must remain stateless-by-design (no required persistence for message routing)
- **Compatibility**: Web client must work without install (no desktop required)
- **Deployment**: v1.0 relay must be self-hostable with a single `docker-compose up`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Share only crypto/ and hooks/ pre-v1.0 | Components stay duplicated to limit refactor risk before public release | — Pending |
| Multi-relay in same phase as shared core | relay.js moves to shared package anyway; natural co-location | — Pending |
| No distributed lock for handle race | Single-instance relay is v1.0 scope; Redis deferred to clustering | — Pending |
| Envelope padding is Phase 1 (not later) | Security gap, not polish item — ciphertext leaks message length | — Pending |
| pnpm workspaces for monorepo | Standard for multi-package JS repos; works with existing Vite setup | — Pending |

---
*Last updated: 2026-02-28 after initial GSD initialization*
