# Codebase Concerns

**Analysis Date:** 2026-03-08 (updated from 2026-02-27)

## Tech Debt

**In-Memory Store Without Persistence Options:**
- Issue: Server uses entirely in-memory data structures (`Map`, `Set`) with no database abstraction. The `Store` class in `server/src/store.js` has no persistence interface.
- Files: `server/src/store.js`
- Impact: Every server restart loses message queues, caps, pending messages (max 200), and rate limit state. Relay restart causes ~3s cap gap (mitigated by WS reconnect caps republish, but not eliminated).
- Fix approach: Introduce a Storage interface with `Store` as in-memory impl. Create `SqliteStore` variant for pending queue persistence.

**Monolithic Routes File:**
- Issue: `server/src/routes.js` is ~621 lines with 15+ route handlers, mixed concerns (auth, validation, business logic, presence tracking).
- Files: `server/src/routes.js`
- Impact: Difficult to unit test individual routes. Adding endpoints requires understanding the entire file.
- Fix approach: Split into `routes/caps.js`, `routes/inbox.js`, `routes/directory.js`, `routes/presence.js`. Move shared helpers to `middleware/`.

**No Type System:**
- Issue: Entire codebase is vanilla JavaScript. No TypeScript or JSDoc. Crypto functions lack type hints.
- Files: `packages/dissolve-core/src/crypto/*.js`, `client/src/hooks/*.js`, `server/src/routes.js`
- Impact: Runtime errors that TypeScript would catch at build time. Crypto operations error-prone without types (e.g., the "kty missing" bug from passing undefined keys).
- Fix approach: Migrate to TypeScript incrementally, starting with `dissolve-core/crypto/`.

**App.css Still Duplicated:**
- Issue: `desktop/src/App.css` is a manual copy of `client/src/App.css`. All other source files are now shared via Vite aliases, but CSS is the last holdout.
- Files: `client/src/App.css`, `desktop/src/App.css`
- Impact: CSS changes must be manually synced. Risk of drift.
- Fix approach: Import client's App.css from desktop's App.css, or add a CSS alias. Low priority — drift risk is small since CSS changes are infrequent.

## Known Bugs

**Handle Availability Check Race Condition:**
- Symptoms: Between availability check and directory publish, another user could take the same handle.
- Files: `client/src/hooks/useIdentity.js`, `server/src/routes.js`, `server/src/store.js`
- Trigger: Rapid concurrent enrollment with same handle on different clients
- Current mitigation: Server rejects duplicate handles with `409 handle_taken`
- Fix approach: Server-side atomic check-and-claim, or make handles mutable.

**Message Loss Under High Volume to Offline Recipient:**
- Symptoms: Messages to offline recipients fill pending queue (max 200 items per recipient) or expire (24h TTL). Excess messages dropped with console warning.
- Files: `server/src/store.js` (pending queue logic)
- Trigger: High-volume messaging to an offline recipient
- Current mitigation: Client retries 3x with exponential backoff. Pending buffer holds 200 messages.
- Fix approach: Persistent queue (SQLite) for pending messages. Add metrics for queue depth.

## Security Considerations

**Ephemeral Keys Not Strictly Non-Extractable:**
- Risk: `e2eeEncrypt()` generates ephemeral keypairs with `extractable: true`. A malicious script could extract before function finishes.
- Files: `packages/dissolve-core/src/crypto/e2ee.js`
- Current mitigation: Ephemeral keys never stored. XSS defense relies on CSP headers.
- Recommendation: Set `extractable: false` for ephemeral keys.

**Archive Encryption Key Derived from Auth Private Key:**
- Risk: If `authPrivJwk` is exposed, archive encryption key is compromised. HKDF uses fixed salt.
- Files: `client/src/utils/messageStore.js`
- Current mitigation: Archive key in memory only during session. Private key encrypted in keyfile.
- Recommendation: Use separate random key protected by private key at unlock time.

**Rate Limiting Keyed by IP Only on `/send`:**
- Risk: Shared networks cause legitimate users to block each other. NAT allows attackers to appear as multiple IPs.
- Files: `server/src/ratelimit.js`, `server/src/routes.js`
- Current mitigation: Identity-based rate limits also apply after authentication.

**Group Keys Stored in Plaintext localStorage:**
- Risk: Group symmetric keys are stored unencrypted in `localStorage` under `groups:{identityId}`. Any XSS or malicious extension can read them.
- Files: `client/src/hooks/useGroups.js`
- Impact: Compromises group message confidentiality without needing private key material.
- Fix approach: Encrypt group keys at rest using a key derived from session material (similar to sessionStorage encryption for identity keys).

**Group Key Not Rotated on Voluntary Leave:**
- Risk: When a member voluntarily leaves a group (`buildGroupLeave`), the group key is not rotated. The departing member retains the old key and can decrypt future messages if they intercept the ciphertext.
- Files: `client/src/hooks/useGroupActions.js` (leave handler)
- Impact: Forward secrecy gap for group conversations after member departure.
- Fix approach: On leave/removal, generate new group key and distribute to remaining members via `GroupMemberRemoved` envelope.

## Performance Considerations

**Presence Lookup O(N) Scan:**
- Issue: `GET /presence?ids=` endpoint scans all active WebSocket clients to find matches. With many connected users, this becomes expensive.
- Files: `server/src/routes.js` (presence endpoint)
- Impact: Polling every 20s per client × O(N) scan = potentially heavy server load at scale.
- Fix approach: Maintain a `Map<identityId, Set<ws>>` index for O(1) presence lookups.

**Group Message Fan-Out O(N) Sends:**
- Issue: Each group message requires N separate `sendEnvelope()` calls (one per member). 50-member group = 50 HTTP requests.
- Files: `client/src/hooks/useMessaging.js` (group send), `client/src/protocol/groupEnvelopes.js`
- Impact: Slow sends for large groups. Best-effort delivery — no confirmation that all members received. Network-intensive for mobile/low-bandwidth users.
- Fix approach: Short-term: batch sends. Long-term: server-side group broadcast (trades privacy for efficiency).

**WebSocket Notification O(N) Scan:**
- Issue: When a message is delivered to an inbox, server scans all WS clients to find the recipient for push notification.
- Files: `server/src/routes.js` (send endpoint WS notification)
- Fix approach: Same `Map<identityId, Set<ws>>` index as presence fix above.

## Operational Concerns

**Silent Error Swallowing:**
- Issue: Multiple `catch` blocks across client and server swallow errors silently or log only to console.
- Files: Various — `client/src/hooks/useMessaging.js`, `client/src/protocol/relay.js`, `server/src/routes.js`
- Impact: Failures go undetected. Hard to debug production issues.
- Fix approach: Add structured error reporting. At minimum, replace empty catches with `console.warn`.

**node_modules Tracked in Git:**
- Issue: `client/node_modules/` appears to be partially tracked in git (visible in git status with hundreds of modified/deleted files).
- Impact: Bloated git history, noisy diffs, slow operations.
- Fix approach: Add to `.gitignore`, remove from tracking with `git rm -r --cached client/node_modules/`.

---

*Concerns analysis: 2026-03-08*
