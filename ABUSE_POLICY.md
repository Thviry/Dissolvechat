# Dissolve Relay — Rate Limits & Abuse Policy

## Rate limits

The relay enforces two independent layers of rate limiting.

### IP-based limits (per minute per IP)

| Endpoint | Default | Env variable |
|----------|---------|--------------|
| `POST /send` | 60 | `LIMIT_IP_SEND` |
| `POST /inbox/*` | 120 | `LIMIT_IP_DRAIN` |
| `PUT /caps/*` | 20 | `LIMIT_IP_CAPS` |
| `POST /directory/publish` | 20 | `LIMIT_IP_DIRECTORY` |
| `GET /directory/lookup` | 60 | `LIMIT_IP_LOOKUP` |
| `GET /ws-challenge` | 10 | `LIMIT_IP_WS_CONNECT` |
| `POST /block/*` `POST /revokeCap/*` | 10 | `LIMIT_IP_BLOCK_REVOKE` |

### Identity-based limits (per minute per verified identity)

| Operation | Default | Env variable |
|-----------|---------|--------------|
| Send messages | 60 | `LIMIT_ID_SEND` |
| Drain inbox | 60 | `LIMIT_ID_DRAIN` |
| Update caps | 10 | `LIMIT_ID_CAPS` |
| Failed signature attempts | 5 | `LIMIT_ID_SIG_FAIL` |
| Failed cap attempts | 10 | `LIMIT_ID_CAP_FAIL` |

Responses that exceed a limit return `HTTP 429` with a `Retry-After` header
(in seconds).

All limits are configurable via environment variables. Set them to lower values
on public deployments under active abuse.

---

## What the relay does and doesn't store

**Stored (in-memory only, cleared on restart):**
- Capability hashes (not the raw caps) per identity
- Queued message envelopes (opaque encrypted blobs)
- Verified identity → WebSocket binding (for push notifications)
- Directory entries (handle → public profile)

**Never stored:**
- Message plaintext (the relay cannot decrypt messages)
- Sender identities (not present in outer envelope)
- IP addresses (used transiently for rate limiting, never logged)
- Passphrases or private keys

---

## Blocking and moderation

End-users can block senders directly from the client. When a block is issued:
1. The relay marks the `(recipient, sender)` pair as blocked
2. Future deliveries from that sender to that recipient are rejected with `HTTP 403 blocked`
3. The block is in-memory only; it is cleared on relay restart

There is no centralized moderation. Relay operators are responsible for their
own instances. The reference relay does not retain message content and cannot
assist with content-based moderation requests.

---

## Abuse reporting

For the reference relay: open an issue at the project repository describing the
abuse pattern. Do not include message content in reports — the relay operator
cannot read messages anyway.

For self-hosted relays: contact the relay operator directly.

---

## Recommended settings for public deployments

```env
# Tighter limits for high-traffic public relays
LIMIT_IP_SEND=30
LIMIT_ID_SEND=30
LIMIT_IP_DRAIN=60
LIMIT_ID_DRAIN=30
LIMIT_IP_WS_CONNECT=5
LIMIT_ID_SIG_FAIL=3
```
