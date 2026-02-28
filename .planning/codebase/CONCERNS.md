# Codebase Concerns

**Analysis Date:** 2026-02-27

## Tech Debt

**In-Memory Store Without Persistence Options:**
- Issue: Server uses entirely in-memory data structures (`Map`, `Set`) with no database abstraction layer. The `Store` class in `server/src/store.js` has no persistence interface, making it difficult to migrate to SQLite or other backends without refactoring all storage calls.
- Files: `server/src/store.js`
- Impact: Every server restart loses message queues, blocking lists, rate limit state, and pending message buffers. While this is intentional for the relay design, adding persistence later requires rewriting store methods.
- Fix approach: Introduce a Storage interface/abstract class with `Store` as an in-memory implementation. Create `SqliteStore` variant without changing route logic. This allows `process.env.PERSISTENCE` to switch backends.

**Monolithic Routes File:**
- Issue: `server/src/routes.js` is 582 lines with 15+ route handlers, mixed concerns (auth, validation, business logic), and nested helper functions. This makes testing individual routes difficult and increases cognitive load.
- Files: `server/src/routes.js`
- Impact: Difficult to unit test individual routes. Changes to one endpoint risk affecting others. Adding new endpoints requires understanding the entire file.
- Fix approach: Split routes into separate files by concern (`routes/caps.js`, `routes/inbox.js`, `routes/directory.js`). Move shared helpers to `middleware/` directory.

**No Type System:**
- Issue: Entire codebase is vanilla JavaScript (client: JSX, server: Node.js). Schema validation uses Zod on the server, but there's no TypeScript or JSDoc coverage. Client crypto functions lack type hints, making it easy to pass wrong key formats.
- Files: `client/src/crypto/*.js`, `server/src/routes.js`, `client/src/hooks/*.js`
- Impact: Runtime errors that TypeScript would catch at build time. Harder to onboard contributors. Crypto operations are particularly error-prone without types.
- Fix approach: Migrate to TypeScript incrementally, starting with `crypto/` and `hooks/` modules. Use `strict` mode.

**Hardcoded Constants Scattered Throughout:**
- Issue: Magic numbers appear in multiple places: MESSAGE_TTL_MS (24 hours in `store.js`), WS_NONCE_TTL (30s in `routes.js`), cleanup intervals (5min), poll intervals (5s in `useMessaging.js`), archive key derivation parameters.
- Files: `server/src/store.js`, `server/src/routes.js`, `client/src/hooks/useMessaging.js`, `client/src/utils/messageStore.js`
- Impact: Tuning these values requires editing multiple files. TTL mismatches between store and cleanup could cause message data inconsistency.
- Fix approach: Create `config.js` files (server-side and client-side) with exported constants. Import and use throughout.

**Duplicate Client Code (Web + Desktop):**
- Issue: `client/src/` and `desktop/src/` are nearly identical. File-by-file duplication of components, hooks, crypto utilities, and protocol handlers.
- Files: `client/src/**/*` and `desktop/src/**/*` (same content)
- Impact: Bug fixes must be applied twice. Features added to one client won't automatically appear in the other. Maintenance burden grows with each new feature.
- Fix approach: Extract common code to a shared package (`packages/dissolve-core`). Both clients import hooks, crypto, and protocol logic. Keep UI layer (components, Tauri-specific code) separate.

## Known Bugs

**Handle Availability Check Race Condition:**
- Symptoms: User enrolls with a handle. Between the availability check and directory publish, another user takes the same handle. Rare but possible.
- Files: `client/src/hooks/useIdentity.js` (enrollment flow), `server/src/routes.js` (`/directory/publish` endpoint), `server/src/store.js` (`isHandleTaken` check)
- Trigger: Rapid concurrent enrollment attempts with the same handle on different clients
- Current mitigation: Server rejects duplicate handles with `409 handle_taken`, but client may have already downloaded keyfile with a handle that's no longer available
- Workaround: User must re-enroll with a different handle
- Fix approach: Add distributed lock (Redis, or server-side queue) during enrollment. Or make handles mutable so users can change them without losing identity.

**Message Loss When Sender Registers Capability Late:**
- Symptoms: Alice sends a message to Bob before Bob connects and registers his inbox capability. Message is queued in `pending`, but if pending queue fills (max 50 items) or expires (24 hours), new messages are dropped silently.
- Files: `server/src/store.js` (pending queue logic), `client/src/hooks/useMessaging.js` (retry logic)
- Trigger: High-volume messaging to an offline recipient
- Current mitigation: Client retries 3x on `cap_not_allowed` with exponential backoff. Pending buffer holds up to 50 messages per recipient.
- Workaround: User manually retries sending
- Fix approach: Increase pending buffer size or make it configurable. Add metrics to track pending queue depth. Consider persistent queue (SQLite) for pending messages even if overall relay is in-memory.

**WebSocket Reconnection Doesn't Preserve Message Pump:**
- Symptoms: If WebSocket connection drops (network flake, server restart), client may stop receiving real-time notifications even after reconnect. Polling (5s interval) will eventually catch messages, but there's a gap.
- Files: `client/src/protocol/relay.js` (WebSocket reconnect logic), `client/src/hooks/useMessaging.js` (message fetch)
- Trigger: Network interruption or server restart while WebSocket is open
- Current mitigation: Polling timer runs independently of WebSocket, so messages aren't lost forever
- Workaround: Manual refresh (F5)
- Fix approach: Ensure `fetchMessages()` is called immediately after WebSocket reconnection succeeds. Add debug logging to detect reconnection gaps.

## Security Considerations

**Ephemeral Keys Not Strictly Non-Extractable:**
- Risk: `e2eeEncrypt()` in `client/src/crypto/e2ee.js` generates ephemeral keypairs with `extractable: true`. While the private key is never exported, a malicious script or XSS attack could extract it before the function finishes.
- Files: `client/src/crypto/e2ee.js` (lines ~24-29)
- Current mitigation: Ephemeral keys are never stored (only used for ECDH in-memory). XSS defense relies on CSP headers.
- Recommendations: Set `extractable: false` for ephemeral keys. Accept that the key can't be extracted and derive it directly via ECDH without export. Test with CSP violations to confirm.

**Archive Encryption Key Derived from Auth Private Key:**
- Risk: If `authPrivJwk` is exposed, the archive encryption key is compromised. The HKDF derivation in `messageStore.js` uses a fixed salt and info, so the same private key always produces the same archive key.
- Files: `client/src/utils/messageStore.js` (lines ~30-45)
- Current mitigation: Archive key is stored in memory only during the session. Private key is encrypted in the keyfile with the user's passphrase.
- Recommendations: Consider using a separate random key stored in IndexedDB, protected by the private key only at unlock time. Document that archive security depends on keyfile security.

**Rate Limiting Keyed by IP Only on `/send`:**
- Risk: On shared networks (corporate, cafe, proxy), legitimate users share an IP and could block each other with rate limits. Conversely, attackers behind NAT could spam as multiple IPs with cheap infrastructure.
- Files: `server/src/ratelimit.js`, `server/src/routes.js` (line ~183: `IP_SEND: 60/min`)
- Current mitigation: Identity-based rate limits also apply once user authenticates (see `LIMITS.ID_SEND`), but `/send` endpoint itself is checked at IP level first.
- Recommendations: Add optional client-side rate limiting (delay 100ms between sends). For truly hostile networks, rate limit on identity after signature verification, not IP alone.

**Directory Entries Not Encrypted:**
- Risk: Directory maps handles to public keys and optional request capability hashes. An observer can see who has enabled discoverability and infer social graphs.
- Files: `server/src/routes.js` (`/directory/publish`, `/directory/lookup`), `server/src/store.js` (directory storage)
- Current mitigation: Discoverability is opt-in. Users can disable it to hide from the directory.
- Recommendations: This is acceptable by design — handles are meant to be public. Document this in SECURITY.md. Consider allow-list for who can look up handles (future protocol enhancement).

**CSP Headers Allow `script-src 'self'`:**
- Risk: Vite dev server in development injects scripts dynamically. Production build is bundled, but if build output contains any dynamic script injection, it's a vulnerability.
- Files: `server/src/index.js` (CSP header on line ~36)
- Current mitigation: CSP policy is strict otherwise (no inline scripts, no `eval`). Source maps might leak code if exposed.
- Recommendations: In production, restrict `script-src` to specific hashes or nonces. Disable source maps in production builds.

**No HTTPS in Default Config:**
- Risk: Development server runs on `http://localhost:3001`. If deployed to production on HTTP, all communication is plaintext to the relay (though messages are encrypted client-side).
- Files: `server/src/index.js`, `.env.example` (client and server)
- Current mitigation: Protocol is end-to-end encrypted, so relay doesn't see message content even if network is plaintext
- Recommendations: Add `HTTPS_ONLY=true` environment variable. Reject HTTP origins in CORS check when `HTTPS_ONLY` is set. Document that production deployments must use HTTPS.

**Credential Leakage in Error Messages:**
- Risk: In `useMessaging.js` and relay routes, some error responses include technical details that could leak info about capability validation or signature verification failures.
- Files: `client/src/hooks/useMessaging.js` (error handling), `server/src/routes.js` (error responses)
- Current mitigation: Error messages are generic (e.g., `cap_not_allowed`, `invalid_signature`), not verbose
- Recommendations: Audit all error paths. Ensure errors to client are generic. Log verbose errors server-side only in structured logs, not in HTTP responses.

## Performance Bottlenecks

**Message Polling Every 5 Seconds:**
- Problem: Both messaging hooks use a 5-second polling interval (`pollTimerRef.current = setInterval(fetchMessages, 5000)`). At scale with many clients, this could stress the relay.
- Files: `client/src/hooks/useMessaging.js` (line ~250)
- Cause: WebSocket is primary, polling is backup. But polling still runs on all clients constantly.
- Improvement path: Make polling interval configurable. Increase to 10-30s in production. Implement exponential backoff if no new messages arrive. Drain all messages on each poll to reduce round-trips.

**Directory Lookup Not Indexed:**
- Problem: `store.lookupDirectory(handle)` does a linear `Map.get()` which is O(1) but no query optimization. No index on handle patterns (e.g., "user*").
- Files: `server/src/store.js` (line ~255)
- Cause: In-memory store. As directory grows, lookups remain fast, but no caching layer.
- Improvement path: Add in-memory cache layer for recent lookups. Consider Bloom filter for "not found" cases to skip repeated lookups for invalid handles.

**Full History Load on Archive Init:**
- Problem: `createMessageStore().loadAll()` loads entire message history into memory on every login. For users with months of messages, this could be slow.
- Files: `client/src/utils/messageStore.js` (line ~125), `client/src/hooks/useMessaging.js` (line ~195)
- Cause: IndexedDB query has no pagination or lazy-load.
- Improvement path: Implement pagination. Load most recent 100 messages by default. Add "Load older messages" button. Or use cursor-based pagination in IndexedDB.

**Replay Protection Uses Full localStorage:**
- Problem: `checkAndUpdateReplay()` in `storage.js` stores sequence numbers for every sender-conversation pair in localStorage. With many contacts, this grows unbounded.
- Files: `client/src/utils/storage.js` (implied from usage in `useMessaging.js`)
- Cause: No TTL or cleanup for old entries.
- Improvement path: Add expiry to replay records (7 days). Periodically clean up stale entries. Consider IndexedDB instead of localStorage for large datasets.

## Fragile Areas

**Crypto Key Import/Export:**
- Files: `client/src/crypto/e2ee.js`, `client/src/crypto/keyfile.js`, `client/src/hooks/useIdentity.js`
- Why fragile: Keys are imported and exported between JWK, CryptoKey, and file formats. A mismatch in algorithm parameters (curve, hash) can cause silent failures or wrong encryption. No validation that imported keys match expected type (signing vs encryption).
- Safe modification: Add type guards and assertions. Create a `Key` wrapper class that validates format on construction. Test with invalid keys.
- Test coverage: No unit tests for crypto key handling. Add tests for: wrong algorithm, wrong curve, wrong size, corrupted JWK.

**Envelope Structure Backwards Compat:**
- Files: `client/src/protocol/envelopes.js`, `client/src/hooks/useMessaging.js`, `server/src/routes.js`
- Why fragile: Code handles both v3 (legacy format with `body.msg.cipher`) and v4 (new format with `payload`). The two paths have slightly different validation. A typo in one path doesn't break the other, but messages could silently fail to decrypt if the wrong path is taken.
- Safe modification: Add protocol version validation at envelope entry point. Unit test both v3 and v4 paths independently. Plan v3 deprecation date.
- Test coverage: Integration tests exist (`test/integration.js`), but no unit tests for backwards compat paths.

**WebSocket Authentication Nonce Store:**
- Files: `server/src/routes.js` (lines ~104-111)
- Why fragile: `wsNonces` is a global `Map` that grows and shrinks. Cleanup runs every 15s, but there's a race: if server restarts between nonce issue and WS auth, the nonce is lost and client can't reconnect.
- Safe modification: Nonces could be moved to Redis or signed tokens. For now, document that nonce TTL (30s) must be longer than typical client latency.
- Test coverage: No tests for nonce cleanup or expiry. Manual verification only (see STABILITY_CHECKLIST.md).

**Capability Routing Without Encryption:**
- Files: `server/src/routes.js`, `client/src/protocol/envelopes.js`
- Why fragile: Relay sees `{ to: recipientId, cap: capHash }` in plaintext. If capHash is weak or reused, the relay can profile message patterns. A future protocol version (v6) aims to encrypt the `to` field, but v4 doesn't.
- Safe modification: For v4, use strong random capabilities (256-bit). Audit all cap generation in `client/src/crypto/index.js`. For v5, implement cap rotation so old caps age out.
- Test coverage: Capability strength validated in `test/integration.js`, but no fuzz tests for weak caps.

## Scaling Limits

**Pending Queue Size Cap (50 items per recipient):**
- Current capacity: 50 pending messages per offline recipient
- Limit: If a recipient is offline for hours and receives 51+ messages, the 51st message is dropped and never queued
- Scaling path: Make cap configurable (`process.env.PENDING_QUEUE_SIZE`). Move pending to SQLite for persistent queue. Implement priority queue (important contacts first) if cap is strict.

**In-Memory Store Directory (no eviction):**
- Current capacity: Unlimited handles in memory
- Limit: As more users enroll, directory grows without bound. With 1M handles at ~500 bytes each, that's ~500MB RAM.
- Scaling path: Implement LRU cache for frequently-accessed handles. Move directory to SQLite. Add TTL for directory entries (must republish periodically to stay listed).

**WebSocket Connections Per Process:**
- Current capacity: Node.js single process can handle ~10k concurrent connections (typical limit ~64k file descriptors per process, minus system overhead)
- Limit: One relay process can serve at most ~10k simultaneous clients
- Scaling path: Implement clustering with Redis pub/sub for WebSocket broadcasts across multiple processes. Or move to a higher-performance WS server (Deno, Go).

**Message Archive on IndexedDB:**
- Current capacity: Browser's IndexedDB quota (typically 50MB for web, 600MB for Electron)
- Limit: For a user with 1M messages (~5KB average with encryption overhead), archive would exceed quota
- Scaling path: Implement archival policy (delete messages older than N days). Add per-conversation limits. Or support exporting archive to file for backup.

## Dependencies at Risk

**Zod Version Locked:**
- Risk: `package.json` doesn't specify Zod version. If a Zod breaking change is released, server may fail to start.
- Impact: Server route validation would break, blocking all requests
- Migration plan: Pin Zod to major version (e.g., `^5.0.0`). Test schema compatibility on minor version bumps.

**WebCrypto Standard Compliance:**
- Risk: `client/src/crypto/*.js` uses WebCrypto APIs that may differ between browsers (Safari has known delays in supporting some P-256 operations).
- Impact: Users on older Safari versions may experience slow encryption/decryption or unsupported algorithm errors.
- Migration plan: Add polyfills or fallback crypto library (TweetNaCl.js) for unsupported operations. Test on Safari 14+.

**Tauri Version for Desktop Client:**
- Risk: Desktop client depends on Tauri for app shell and system tray. Tauri v2 has breaking changes from v1.
- Impact: If Tauri project becomes unmaintained or has critical vulnerability, desktop app is stuck.
- Migration plan: Evaluate alternatives (Electron, NW.js) if Tauri stalls. Keep Tauri dependency pinned to known-good version.

## Missing Critical Features

**Export/Backup of All User Data:**
- Problem: User identity is portable (keyfile), but contacts are stored in localStorage and IndexedDB. There's no single "export all" button to backup everything for migration.
- Blocks: Switching devices, migrating to another client implementation, disaster recovery
- Fix: Implement "Export Full Backup" button that bundles keyfile + contacts + archive into a single JSON or encrypted file.

**Message Search:**
- Problem: Archive is loaded but no search functionality. Users can't find old messages by sender or content.
- Blocks: Users with large archives can't navigate history efficiently.
- Fix: Add full-text search in IndexedDB or add a search UI component that filters loaded messages in memory.

**Relay Failover / Multi-Relay Support:**
- Problem: Client is hardcoded to one relay URL. If that relay goes down, user can't send/receive messages.
- Blocks: Deploying multiple relays for redundancy, switching relays without re-registering identity.
- Fix: Implement relay URL configuration in settings. Support registering capabilities with multiple relays. Auto-failover to secondary relay if primary is unreachable.

## Test Coverage Gaps

**Unit Tests for Crypto Functions:**
- What's not tested: Key generation edge cases, malformed JWK imports, wrong algorithm combinations, encryption with corrupted inputs.
- Files: `client/src/crypto/e2ee.js`, `client/src/crypto/signing.js`, `client/src/crypto/keyfile.js`
- Risk: Crypto bugs could silently produce wrong ciphertexts or allow forgeries.
- Priority: **High** — cryptography is security-critical.

**Server Route Isolation:**
- What's not tested: Individual routes in isolation. Only integration tests (full end-to-end flow) exist.
- Files: `server/src/routes.js`
- Risk: Refactoring one route could break others without tests catching it.
- Priority: **High** — routes are the relay's attack surface.

**Relay Stress Tests:**
- What's not tested: Sustained load (100+ simultaneous connections, 50+ messages/sec), message ordering under load, memory leaks under sustained traffic.
- Files: All server files (no load test suite found)
- Risk: Relay could fail silently under production load. Memory leaks could cause cascading failures.
- Priority: **Medium** — stability matters for reliability, but v4 is early-stage.

**WebSocket Reconnection Edge Cases:**
- What's not tested: Nonce expiry during reconnection, out-of-order WS messages, rapid disconnect/reconnect cycles, message loss during reconnection window.
- Files: `client/src/protocol/relay.js`, `server/src/routes.js` (WS setup)
- Risk: Users may experience message loss or silent disconnection without recovery.
- Priority: **Medium** — impacts user experience but rare in stable networks.

**Directory Consistency:**
- What's not tested: Concurrent publishes to directory, handle owner changes, directory persistence across restarts, stale entry cleanup.
- Files: `server/src/store.js`, `server/src/routes.js` (`/directory/publish`)
- Risk: Directory could become inconsistent (stale entries, duplicate handles).
- Priority: **Low** — current workload is small, but important for scaling.

---

*Concerns audit: 2026-02-27*
