# DissolveChat Protocol Roadmap

## Current: v4-secure (v5.15)

Working protocol with hardened relay, web + desktop clients, encrypted local archive.

## v5.x — Non-Breaking Improvements

These changes enhance the existing protocol without breaking backwards compatibility.

### Relay Portability
- Configurable relay URL per user (settings UI)
- Support connecting to multiple relays simultaneously
- Broadcast capability registrations to all configured relays
- Drain inboxes from whichever relay is reachable
- **Impact**: Eliminates single-relay dependency. Users can self-host or use community relays.

### Envelope Padding + Timing Jitter
- Pad all encrypted payloads to fixed size buckets (512B / 1KB / 2KB / 4KB)
- Add random 0-800ms delay before sending
- **Impact**: Prevents traffic analysis based on message size or timing patterns.

### Non-Extractable Key Storage
- Import private keys as non-extractable CryptoKeys via WebCrypto
- Store in IndexedDB instead of raw JWK in React state
- Refactor all crypto functions to use CryptoKey handles
- **Impact**: Private keys cannot be read by JavaScript, even if XSS occurs. Keys are bound to the origin.

### Relay-Side Encrypted Archive (Option B)
- New server endpoint for storing encrypted blobs long-term
- Client pushes encrypted messages to a personal relay after receipt
- Configurable archive relay URL (can differ from message relay)
- **Impact**: Cross-device message history without trusting the relay with plaintext.

### Cover Traffic
- Periodic indistinguishable noise messages between client and relay
- Configurable frequency and bandwidth budget
- **Impact**: Prevents observers from determining when real communication occurs. High bandwidth cost — opt-in only.

## v6 — Protocol Evolution (Breaking Changes)

These changes require a new protocol version and migration path.

### Capability-Scoped Routing
Replace identity-based routing (`to: recipientId`) with capability-scoped routing (`to: capabilityToken`). The relay routes messages based solely on capability tokens, never seeing identity IDs.

- **Current**: Relay sees recipient's identity ID for routing
- **Proposed**: Relay sees only a capability token; recipient identity is inside the encrypted payload
- **Migration**: Clients support both v4 and v6 envelopes during transition. Relay accepts both formats.
- **Impact**: Relay cannot build social graphs from `to` fields. Maximum metadata minimization.

### Multi-Relay Mesh
- Relays can forward envelopes to other relays
- Users register capabilities across multiple relays
- Messages find the recipient regardless of which relay they're connected to
- **Impact**: No single relay is a bottleneck or point of failure. True decentralization.

### Group Messaging
- Sender-key protocol for efficient group encryption
- Group capabilities distributed by group admin
- Per-member revocation without re-keying the group
- **Impact**: Extends the capability model to multi-party communication.

### Key Rotation
- Periodic rotation of signing and encryption keys
- Old keys retained for decrypting historical messages
- New keys published to contacts via signed update
- **Impact**: Limits exposure window if a key is compromised.

## Guiding Principles

Every protocol change is evaluated against three criteria:

1. **Autonomy** — Does the user maintain full control? Can they self-host, switch providers, export everything?
2. **Security** — Does this reduce the attack surface? Does it maintain forward secrecy and zero-trust relay?
3. **Anonymity** — Does this minimize metadata? Can the relay learn less about users?

Changes that improve one dimension at the cost of another require explicit documentation of the tradeoff.
