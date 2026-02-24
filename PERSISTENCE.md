# DissolveChat Persistence Strategy

## Architecture Decision

DissolveChat uses a **hybrid persistence model**: the relay is intentionally minimal in what it stores, while clients own their data.

## What Persists Where

### Relay (server-side)
| Data | Persists? | Storage | Notes |
|------|-----------|---------|-------|
| Handle → identity mapping | ✅ Yes | `directory.json` on disk | Survives server restarts. Public data only (handles, public keys). |
| Queued messages | ❌ No | In-memory | Lost on restart. Intentional — relay is a transit layer, not a mailbox. |
| Capability registrations | ❌ No | In-memory | Clients re-register caps on every login. |
| Block lists | ❌ No | In-memory | Clients re-issue blocks on login if needed. |
| Rate limit counters | ❌ No | In-memory | Reset on restart. |

### Client (user-side)
| Data | Persists? | Storage | Notes |
|------|-----------|---------|-------|
| Identity (keys, handle) | ✅ Yes | Encrypted keyfile (user's device) | Portable. User controls the file. |
| Contacts | ✅ Yes | localStorage + keyfile export | Portable via "Export Keyfile (with contacts)". |
| Message history | ✅ Opt-in | Encrypted IndexedDB | Off by default. Enable in settings. Encrypted with key derived from private key. |
| Session state | ⚠️ Temporary | sessionStorage | Survives refresh, lost on tab/window close. |
| Discoverability preference | ✅ Yes | localStorage | Per-identity setting. |
| Archive preference | ✅ Yes | localStorage | Per-identity setting. |

## Why This Model

### The relay stores almost nothing because:
- **Security**: Less stored data = smaller breach surface. A compromised relay yields only public keys and handles — information that's already public by design.
- **Anonymity**: No message logs means no metadata to subpoena. The relay can't produce records it doesn't have.
- **Autonomy**: Users aren't trapped. Switch relays without losing anything. The relay has no leverage over users.

### The directory persists because:
- Handle uniqueness must survive restarts. Without persistence, a server restart lets anyone claim any handle.
- Directory entries contain only public data (handles, public keys). No privacy cost.

### Message archive is opt-in because:
- Some users want ephemerality — messages that vanish when the session ends.
- Some users want history — conversations they can return to.
- The choice should be the user's, not the platform's.
- When enabled, messages are encrypted with a key derived from the user's private ECDH key. Only someone who can decrypt the keyfile can decrypt the archive.

## Future Considerations

### Relay-side encrypted archive (Option B)
A future version may support pushing encrypted message blobs to a personal relay for cross-device sync. This would be:
- Opt-in (user chooses to enable)
- Encrypted client-side before upload (relay stores opaque blobs)
- Configurable relay URL (could be a self-hosted instance)
- Complementary to local archive, not a replacement

### SQLite for relay persistence
If the relay needs to persist more data (e.g., queued messages for offline users), SQLite is the planned storage backend. This would be:
- Optional (configurable via environment variable)
- Scoped to queued envelopes only (still encrypted, still opaque to the relay)
- Subject to configurable TTL (messages expire after N hours)

## Principle

> The relay is a dumb pipe. The user owns their data. Persistence is a client concern, not a server concern.
