# Architecture

**Analysis Date:** 2026-03-08 (updated from 2026-02-27)

## Pattern Overview

**Overall:** Layered client-server E2EE messenger with cryptographic protocol abstraction.

**Key Characteristics:**
- Strict separation between crypto, protocol, and UI layers
- E2E encryption with ephemeral session key storage (sessionStorage only)
- Relay-based message routing with capability-based access control
- Dual authentication: identity ownership + message sender verification
- Protocol-versioned envelopes with forward compatibility
- In-memory message relay with TTL-based expiry
- Group chat via two-layer encryption + client-side fan-out
- Desktop shares client source via Vite aliases (no duplication)
- Multi-relay support (broadcast writes, first-reachable drain)

## Layers

**Presentation (UI):**
- Purpose: React component tree for login, chat, sidebar, groups, and modals
- Location: `client/src/components/` (shared with desktop via Vite alias)
- Contains: JSX components (`App.jsx`, `ChatPanel.jsx`, `Sidebar.jsx`, `LoginScreen.jsx`, `CreateGroupModal.jsx`, `GroupInfoPanel.jsx`)
- Depends on: Identity, messaging, contacts, groups hooks; crypto for keyfile export
- Used by: Entry points (`main.jsx` in both client and desktop)

**State Management (Hooks):**
- Purpose: Encapsulate identity lifecycle, contacts, messaging, groups, and UI notifications
- Location: `client/src/hooks/` (shared with desktop via Vite alias)
- Contains: `useIdentity`, `useContacts`, `useMessaging`, `useGroups`, `useGroupActions`, `useToast`
- Depends on: Crypto, protocol layers
- Used by: Components

**Protocol Layer:**
- Purpose: Envelope construction, relay communication, directory lookups
- Location: `client/src/protocol/` (`envelopes.js`, `groupEnvelopes.js`, `relay.js`)
- Contains: 1-to-1 message builders, 7 group envelope builders, WebSocket + HTTP relay integration, cap publishing, multi-relay broadcast
- Depends on: Crypto (signing, E2EE, group crypto)
- Used by: useMessaging, useGroupActions hooks

**Cryptography Layer:**
- Purpose: Identity derivation, key generation, signing, E2E encryption, group encryption
- Location: `packages/dissolve-core/src/crypto/` (shared package)
- Contains: JWK encoding/decoding, signing (JCS + EdDSA), E2EE (ECDH + AES-GCM), keyfile encryption, seed phrase derivation, group crypto (AES-256-GCM symmetric key)
- Depends on: Web Crypto API (client), Node.js crypto (server)
- Used by: Protocol and state management layers

**Storage Layer:**
- Purpose: Persistent key material, message history, session state
- Location: `client/src/utils/storage.js`, `messageStore.js`
- Contains: Encrypted keyfile export/import, IndexedDB message archive, localStorage metadata
- Depends on: Crypto layer for encryption
- Used by: Hooks and components

**Configuration:**
- Purpose: Centralized timing constants
- Location: `client/src/config.js` (shared with desktop via Vite alias)
- Contains: `POLL_INTERVAL_MS`, `CAP_REPUBLISH_INTERVAL_MS`, `SEND_RETRY_BASE_DELAY_MS`, `WS_RECONNECT_DELAY_MS`
- Used by: `useMessaging`, `relay.js`

**Server (Relay):**
- Purpose: Untrusted message intermediary with capability-based inbox routing
- Location: `server/src/` (index.js, routes.js, store.js, schemas.js, ratelimit.js)
- Contains: Express server, WebSocket handler, schema validation, rate limiting, presence tracking
- Depends on: Node.js, crypto utilities
- Used by: Client protocol layer

**Landing Page:**
- Purpose: Public-facing product page with download links
- Location: `landing/` (static HTML/CSS/JS, no build step)
- Contains: `index.html`, `styles.css`, `script.js`
- Hosted by: Caddy on IONOS VPS at dissolve.chat

## Data Flow

**Enrollment Flow:**

1. User enters handle and passphrase in LoginScreen
2. `handleEnroll` in App.jsx calls `identity.enroll()`
3. `useIdentity.enroll()` generates auth keypair + E2EE keypair, derives identity ID, generates mnemonic
4. Client publishes identity to relay directory (signed DirectoryPublish envelope)
5. Relay validates signature, stores handle → profile mapping
6. Session encrypted with AES-256-GCM and stored in sessionStorage
7. Keyfile auto-downloads (encrypted with passphrase, includes contacts + groups)
8. Mode switches to "chat"

**Login Flow:**

1. User selects keyfile (encrypted with passphrase)
2. `handleLogin` in App.jsx reads file, requests passphrase via PassphraseModal
3. `useIdentity.login()` decrypts keyfile, restores identity + contacts + groups
4. Session restored to sessionStorage
5. `useMessaging` initializes, publishes caps to all configured relays, starts polling/WebSocket
6. Mode switches to "chat"

**Message Send Flow (1-to-1):**

1. User types message, hits Enter in ChatPanel
2. `messaging.sendMsg(peerId, text)` called
3. `buildMessage()` in `protocol/envelopes.js` constructs inner envelope
4. Inner encrypted with peer's E2EE public key (ECDH ephemeral + AES-GCM)
5. Outer envelope signed with identity's auth private key
6. `sendEnvelope()` broadcasts to all configured relays (Promise.allSettled)
7. Relay validates signature, checks capability hash, stores in recipient's inbox
8. Message added to local state, optionally archived to IndexedDB

**Group Message Send Flow:**

1. User sends message in a group chat
2. `messaging.sendGroupMessage(groupId, text)` called
3. `buildGroupMessage()` constructs inner envelope with group metadata
4. **Inner layer**: Encrypted with group's AES-256-GCM symmetric key
5. **Outer layer**: For each member, the inner ciphertext is wrapped with that member's E2EE public key (ECDH ephemeral)
6. Client-side fan-out: one `sendEnvelope()` call per member (up to 50)
7. Relay sees normal 1-to-1 messages — zero group awareness
8. Recipients decrypt outer layer (E2EE), then inner layer (group key) to get plaintext

**Group Envelope Types:**
- `GroupMessage` — chat message (two-layer encryption)
- `GroupInvite` — initial invitation with wrapped group key
- `GroupMemberAdded` — announce new member to existing members
- `GroupMemberRemoved` — announce member removal
- `GroupAdminChange` — promote/demote admin
- `GroupLeave` — voluntary departure
- `GroupNameChange` — rename group

**Message Receive Flow:**

1. Server inbox draining triggered by polling (5s) or WebSocket notification
2. `useMessaging.fetchMessages()` builds signed inbox drain request
3. Client drains inbox (authenticated POST) and request inbox
4. For each envelope, `handleIncoming()` processes:
   - Decrypts payload with E2EE private key
   - Verifies outer signature against auth pub
   - Checks for group envelope: if `groupId` present, decrypts inner with group key
   - Checks replay protection (conversation ID + sequence number)
   - Routes by type (Message, ContactRequest, ContactGrant, Group*)
5. Optional: archives message to IndexedDB (if archiveEnabled)

**Presence System:**

1. User toggles presence in settings → `handlePresenceChange` in App.jsx
2. Client republishes directory entry with `showPresence` flag
3. Server syncs `showPresence` on all active WS clients for that identity
4. Other clients poll `GET /presence?ids=` every 20s with contact IDs
5. Server checks which IDs have active WS connections with `showPresence=true`
6. Green dot rendered on contact avatar via `.presence-dot` CSS class
7. Auto-cleared on WS disconnect

**Notification System:**

1. Incoming message detected in `handleIncoming()`
2. `notifyIncoming()` plays two-tone audio ping via Web Audio API
3. `flashTitle()` alternates document title to draw attention
4. Togglable via "Message notification sound" setting (on by default)

**Caps Republish on WS Reconnect:**

1. WebSocket disconnects (relay restart, network flake)
2. Client reconnects with exponential backoff
3. On `auth_ok`, `onAuthenticated` callback fires
4. Immediate `republishCaps()` — reduces cap gap from ~30s to ~3s
5. Prevents messages from being silently queued during gap

**Contact Exchange Flow:**

1. Alice looks up Bob's handle via directory lookup (unauthenticated GET)
2. Returns Bob's profile: id, label, authPublicJwk, e2eePublicJwk, requestCapHash
3. Alice clicks "Send Request", builds ContactRequest envelope
4. Inner envelope encrypted with Bob's E2EE pub, outer signed with Alice's auth priv
5. Relay accepts if Alice provides correct requestCapHash
6. Bob receives as contact request, can accept (sends ContactGrant) or reject
7. On accept, Bob's grant includes his inbox cap (encrypted for Alice)
8. Alice now can send messages to Bob's inbox

## Key Abstractions

**Envelope:**
- Purpose: Signed, versioned protocol message unit
- Examples: `buildMessage()`, `buildContactRequest()`, `buildGroupMessage()` in protocol/
- Pattern: Outer envelope (routing metadata) + inner encrypted payload; inner signed by auth key

**Capability (Cap):**
- Purpose: Unforgeable token granting access to an inbox
- Examples: `inboxCap`, `requestCap` in identity state
- Pattern: Random base64 token; relay checks cap hash against published set; can be revoked

**Identity:**
- Purpose: Cryptographic self derived from auth public key (SHA-256 hash)
- Pattern: Deterministic, unforgeable; acts as username without central registry

**Group Key:**
- Purpose: Shared symmetric key for group message encryption
- Examples: `generateGroupKey()` in `dissolve-core/crypto/group.js`
- Pattern: AES-256-GCM; wrapped per-member via E2EE for distribution; stored in localStorage

**MessageStore:**
- Purpose: IndexedDB-backed archive with E2EE
- Pattern: Optional (archiveEnabled flag); uses identity secret as seed for key derivation; survives tab close

## Entry Points

**Client Web:**
- Location: `client/src/main.jsx`
- Triggers: Browser page load

**Client Desktop:**
- Location: `desktop/src/main.jsx`
- Triggers: Tauri app startup (`desktop/src-tauri/src/lib.rs`)
- Note: All shared code resolved from `client/src/` via Vite aliases

**Server:**
- Location: `server/src/index.js`
- Triggers: `npm start` or `node src/index.js`

**Landing Page:**
- Location: `landing/index.html`
- Triggers: Browser navigation to dissolve.chat

## Error Handling

**Strategy:** Try-catch with fallback-to-UI toasts; protocol failures retry with exponential backoff.

**Patterns:**
- **Crypto failures**: Silent return from envelope processing (can't decrypt = not for us)
- **Network failures**: Retry up to 3 times with exponential backoff; throw on exhaustion
- **Validation failures**: Schema errors logged server-side; generic 400/413 returned
- **Rate limiting**: Server returns 429 with Retry-After header; client shows toast
- **Group member key validation**: Skip + warn on invalid keys (don't crash group send)
- **Queued messages**: Server returns HTTP 202 (not 200) so client can detect cap gap

## Cross-Cutting Concerns

**Multi-Relay Support:**
- `relay.js` supports multiple relay URLs
- Writes (publishCaps, sendEnvelope): broadcast to all via `Promise.allSettled`
- Reads (drainInbox): sequential first-reachable loop
- WebSocket: one connection per relay URL

**Desktop/Client Sharing:**
- Desktop `vite.config.js` aliases `@components`, `@hooks`, `@protocol`, `@utils`, `@config` to `../client/src/`
- Client has matching aliases pointing to its own `src/`
- Desktop `src/` only contains: `main.jsx`, `App.jsx`, `App.css`, `index.css`

**Authentication:**
- Client-to-server: Signature verification (JCS + EdDSA) on all state-mutating requests
- Envelope origin: Sender identity recomputed from inner authPub
- WebSocket upgrade: Nonce challenge (30s TTL) before authenticated connection

**Rate Limiting:** Dual-layer (IP + identity):
- IP layer: Coarse limits on /ws-challenge, /send, /directory/publish
- Identity layer: Per-identity caps on inbox drain, send frequency

---

*Architecture analysis: 2026-03-08*
