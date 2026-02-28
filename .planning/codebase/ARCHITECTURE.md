# Architecture

**Analysis Date:** 2026-02-27

## Pattern Overview

**Overall:** Layered client-server E2EE messenger with cryptographic protocol abstraction.

**Key Characteristics:**
- Strict separation between crypto, protocol, and UI layers
- E2E encryption with ephemeral session key storage (sessionStorage only)
- Relay-based message routing with capability-based access control
- Dual authentication: identity ownership + message sender verification
- Protocol-versioned envelopes with forward compatibility
- In-memory message relay with TTL-based expiry

## Layers

**Presentation (UI):**
- Purpose: React component tree for login, chat, sidebar, and modals
- Location: `client/src/components/` and `desktop/src/components/`
- Contains: JSX components (`App.jsx`, `ChatPanel.jsx`, `Sidebar.jsx`, `LoginScreen.jsx`)
- Depends on: Identity, messaging, contacts hooks; crypto for keyfile export
- Used by: Entry points (`main.jsx`)

**State Management (Hooks):**
- Purpose: Encapsulate identity lifecycle, contacts, messaging, and UI notifications
- Location: `client/src/hooks/` and `desktop/src/hooks/`
- Contains: `useIdentity`, `useContacts`, `useMessaging`, `useToast`
- Depends on: Crypto, protocol layers
- Used by: Components

**Protocol Layer:**
- Purpose: Envelope construction, relay communication, directory lookups
- Location: `client/src/protocol/` (envelopes.js, relay.js)
- Contains: Message builders, WebSocket + HTTP relay integration, cap publishing
- Depends on: Crypto (signing, E2EE)
- Used by: useMessaging hook

**Cryptography Layer:**
- Purpose: Identity derivation, key generation, signing, E2E encryption
- Location: `client/src/crypto/` and `server/src/crypto.js`
- Contains: JWK encoding/decoding, signing (JCS + EdDSA), E2EE (ECDH + AES-GCM), keyfile encryption
- Depends on: Web Crypto API (client), Node.js crypto (server)
- Used by: Protocol and state management layers

**Storage Layer:**
- Purpose: Persistent key material, message history, session state
- Location: `client/src/utils/storage.js`, `messageStore.js`, `useIdentity.js`
- Contains: Encrypted keyfile export/import, IndexedDB message archive, localStorage metadata
- Depends on: Crypto layer for encryption
- Used by: Hooks and components

**Server (Relay):**
- Purpose: Untrusted message intermediary with capability-based inbox routing
- Location: `server/src/` (index.js, routes.js, store.js, schemas.js, ratelimit.js)
- Contains: Express server, WebSocket handler, schema validation, rate limiting
- Depends on: Node.js, crypto utilities
- Used by: Client protocol layer

## Data Flow

**Enrollment Flow:**

1. User enters handle, display name, passphrase in LoginScreen
2. `handleEnroll` in App.jsx calls `identity.enroll()`
3. `useIdentity.enroll()` generates auth keypair + E2EE keypair, derives identity ID
4. Client publishes identity to relay directory (signed DirectoryPublish envelope)
5. Relay validates signature, stores handle → profile mapping
6. Session encrypted with AES-256-GCM and stored in sessionStorage
7. Mode switches to "chat"

**Login Flow:**

1. User selects keyfile (encrypted with passphrase)
2. `handleLogin` in App.jsx reads file, requests passphrase via PassphraseModal
3. `useIdentity.login()` decrypts keyfile, restores identity + contacts
4. Session restored to sessionStorage
5. `useMessaging` initializes, publishes caps, starts polling/WebSocket
6. Mode switches to "chat"

**Message Send Flow:**

1. User types message, hits Enter in ChatPanel
2. `messaging.sendMsg(peerId, text)` called
3. `buildMessage()` in `protocol/envelopes.js` constructs inner envelope (from, sender cap, E2EE pub, etc.)
4. Inner encrypted with peer's E2EE public key (ECDH ephemeral + AES-GCM)
5. Outer envelope (to, cap, authPub, signature) wraps opaque payload
6. Envelope signed with identity's auth private key
7. `sendEnvelope()` POSTs to relay `/send` endpoint
8. Relay validates signature against authPub, checks capability hash
9. If valid, stores envelope in recipient's inbox
10. Message added to local state, optionally archived
11. On retry loop if cap_not_allowed (cap not yet published)

**Message Receive Flow:**

1. Server inbox draining triggered by polling (5s) or WebSocket notification
2. `useMessaging.fetchMessages()` builds signed inbox drain request
3. Client drains inbox (authenticated POST) and request inbox
4. For each envelope, `handleIncoming()` processes:
   - Decrypts payload with E2EE private key (ECDH shared secret + AES-GCM)
   - Verifies outer signature against auth pub in envelope
   - Verifies sender identity by recomputing ID from inner authPub
   - Checks replay protection (conversation ID + sequence number)
   - Routes by type (Message, ContactRequest, ContactGrant)
   - If sender unknown, adds to requests; if known, shows in chat
5. Optional: archives message to IndexedDB (if archiveEnabled)

**Contact Exchange Flow:**

1. Alice looks up Bob's handle via directory lookup (unauthenticated GET)
2. Returns Bob's profile: id, label, authPublicJwk, e2eePublicJwk, requestCapHash
3. Alice clicks "Send Request", `messaging.sendRequest(recipient)` builds ContactRequest
4. Inner envelope encrypted with Bob's E2EE pub, outer signed with Alice's auth priv
5. Relay accepts if Alice provides correct requestCapHash
6. Bob receives as contact request, can accept (sends ContactGrant) or reject
7. On accept, Bob's grant includes his inbox cap (encrypted for Alice)
8. Alice now can send messages to Bob's inbox

**State Management:**

- **Identity**: Async initialization from sessionStorage → encryption/decryption cycle
- **Contacts**: Map of known peers with their public keys + inbox caps
- **Requests**: Pending contact requests (unaccepted peers)
- **Messages**: Chronological array, filterable by peerId
- **Toasts**: Ephemeral notifications (success, error, warning)

## Key Abstractions

**Envelope:**
- Purpose: Signed, versioned protocol message unit
- Examples: `buildMessage()`, `buildContactRequest()`, `buildCapsUpdate()` in `protocol/envelopes.js`
- Pattern: Outer envelope (routing metadata) + inner encrypted payload; inner signed by auth key

**Capability (Cap):**
- Purpose: Unforgeable token granting access to an inbox
- Examples: `inboxCap`, `requestCap` in identity state
- Pattern: Random base64 token; relay checks cap hash against published set; can be revoked

**Identity:**
- Purpose: Cryptographic self derived from auth public key (SHA-256 hash)
- Examples: `computeIdFromAuthPubJwk()` in server, `computeId()` in useIdentity
- Pattern: Deterministic, unforgeable; acts as username without central registry

**Conversation ID:**
- Purpose: Prevent replay across parallel conversations
- Examples: `deriveConvId()` in `protocol/envelopes.js`
- Pattern: Deterministic SHA-256(sorted(idA, idB)) — same for both parties

**MessageStore:**
- Purpose: IndexedDB-backed archive with E2EE
- Examples: `useMessaging` initialization in hooks
- Pattern: Optional (archiveEnabled flag); uses E2EE priv key as seed; survives tab close

## Entry Points

**Client Web:**
- Location: `client/src/main.jsx`
- Triggers: Browser page load
- Responsibilities: React DOM mount, App component initialization

**Client Desktop:**
- Location: `desktop/src/main.jsx`
- Triggers: Tauri app startup (`desktop/src-tauri/src/main.rs`)
- Responsibilities: Same as web, but runs in Tauri webview

**Server:**
- Location: `server/src/index.js`
- Triggers: `npm start` or `node src/index.js`
- Responsibilities: HTTP + WebSocket server initialization, CORS setup, route registration, graceful shutdown

**Key Flow Triggers in App.jsx:**
- Session restore (useEffect on mount): `identity.sessionChecked`
- URL fragment parsing: `#contact=base64` auto-import
- Enrollment/login: triggered by LoginScreen handlers
- Discoverability: triggered by Sidebar settings change

## Error Handling

**Strategy:** Try-catch with fallback-to-UI toasts; protocol failures retry with exponential backoff.

**Patterns:**

- **Crypto failures**: Silent return from envelope processing (e.g., can't decrypt = not for us)
- **Network failures**: Retry up to 3 times with exponential backoff (`cap_not_allowed` scenario); throw on exhaustion
- **Validation failures**: Schema errors logged server-side; generic 400/413 returned; no details leaked
- **Rate limiting**: Server returns 429 with Retry-After header; client shows toast
- **Unhandled rejections**: Caught globally in server (`process.on("unhandledRejection")`); logged with timestamp
- **Session corruption**: Cleared and user prompted to re-login

## Cross-Cutting Concerns

**Logging:** Structured logging in server (`logger.js`): request(), validationFailed(), rateLimited(), shutdown(). Client uses console.warn() for debugging only.

**Validation:** Server uses Zod schemas (`schemas.js`) on all endpoints (sendSchema, capsUpdateSchema, inboxDrainSchema, etc.). Client-side validation minimal (UX hints only).

**Authentication:**
- Client-to-server: Signature verification (JCS + EdDSA) on all state-mutating requests
- Envelope origin: Sender identity recomputed from inner authPub and matched against envelope.from
- WebSocket upgrade: Nonce challenge (30s TTL) before authenticated connection

**Rate Limiting:** Dual-layer (IP + identity):
- IP layer: Coarse limits on /ws-challenge, /send, /directory/publish
- Identity layer: Per-identity caps on inbox drain, send frequency
- Strategy: Token bucket with exponential backoff hints

**Security Headers (Server):** CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. No eval, no inline scripts (except Vite dev).

---

*Architecture analysis: 2026-02-27*
