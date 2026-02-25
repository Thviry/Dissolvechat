# Dissolve Protocol v4 — Specification

Dissolve is an end-to-end encrypted messaging protocol built on top of a
capability-based relay. This document describes the wire format, cryptographic
primitives, and security properties of protocol version 4 ("v4-secure").

---

## Overview

```
┌──────────────────────────────────────────────────────────────┐
│  Sender                                                       │
│  • Generates ephemeral ECDH keypair per message               │
│  • Encrypts inner envelope with recipient's static ECDH pub   │
│  • Signs outer envelope with own ECDSA auth key               │
│                           │                                   │
│                           ▼                                   │
│              ┌────────────────────────┐                       │
│              │  Relay (untrusted)     │                       │
│              │  • Verifies sender sig │                       │
│              │  • Checks cap hash     │                       │
│              │  • Routes to inbox     │                       │
│              └────────────────────────┘                       │
│                           │                                   │
│                           ▼                                   │
│  Recipient                                                     │
│  • Drains inbox with signed proof of ownership                │
│  • Decrypts inner envelope with own ECDH private key          │
│  • Verifies inner sender identity                             │
└──────────────────────────────────────────────────────────────┘
```

The relay sees: `to` (recipient identity hash), `cap` (inbox token), `authPub`
(sender's public key for sig verification), and an opaque `payload` blob.

The relay **never** sees: sender identity, message text, contact relationships,
or any plaintext metadata.

---

## Identities

### Key material

Each user has two keypairs, both ECDSA/ECDH over P-256:

| Key | Algorithm | Purpose |
|-----|-----------|---------|
| `authKey` | ECDSA P-256 | Signs all outgoing envelopes |
| `e2eeKey` | ECDH P-256 | Receives encrypted messages |

### Identity ID

A user's identity ID is the SHA-256 hash of the JCS-canonicalized `authPublicJwk`:

```
id = base64url(SHA-256(JCS(authPublicJwk)))
```

This is deterministic and derivable by anyone who has the public key.

### Key file

Private keys are stored in a JSON "key file" (`dissolve-*.usbkey.json`).
The private material is encrypted with PBKDF2 (600,000 iterations, SHA-256)
+ AES-256-GCM using a user-supplied passphrase.

```json
{
  "version": 4,
  "dissolveProtocol": 4,
  "id": "<identity-id>",
  "label": "Alice",
  "handle": "alice",
  "auth": { "alg": "ECDSA_P-256", "publicJwk": { ... } },
  "e2ee": { "alg": "ECDH_P-256",  "publicJwk": { ... } },
  "encryptedPrivate": {
    "salt": "<base64url>",
    "iv":   "<base64url>",
    "ciphertext": "<base64url>"
  },
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

The `encryptedPrivate` blob decrypts to:
```json
{
  "authPrivateJwk": { ... },
  "e2eePrivateJwk": { ... },
  "inboxCap":   "<random 32-byte hex>",
  "requestCap": "<random 32-byte hex>",
  "contacts":   [ ... ]   // optional portable contact list
}
```

---

## Capabilities (caps)

A capability is a 32-byte random secret (`crypto.getRandomValues`). It
functions as an unforgeable bearer token that authorizes message delivery.

```
capHash = base64url(SHA-256(cap))
```

The relay stores capability hashes, not the caps themselves. Senders include
the raw cap in the envelope; the relay hashes it and checks it against the
stored set.

There are two cap types per identity:
- **inboxCap** — authorizes delivery to the normal message inbox
- **requestCap** — authorizes delivery to the contact-request inbox

---

## Envelope format (outer — relay-visible)

All envelopes are JSON objects sent via `POST /send`.

```json
{
  "p": 4,
  "to":      "<recipient-identity-id>",
  "cap":     "<raw-inbox-cap>",
  "ch":      "msg | req",
  "authPub": { "<sender-ECDSA-public-JWK>" },
  "payload": {
    "alg": "ECDH_P256_EPHEMERAL_AESGCM_PAD",
    "epk": { "<ephemeral-ECDH-public-JWK>" },
    "iv":  "<base64url 12-byte nonce>",
    "ct":  "<base64url ciphertext>"
  },
  "sig": "<base64url ECDSA signature>"
}
```

The `sig` field covers all other fields (JCS-canonicalized, sig field excluded).

### Payload encryption

```
ephemeralKeypair = generateKey(ECDH, P-256)
sharedSecret = ECDH(ephemeralPriv, recipientE2eePublicKey)
aesKey = HKDF(sharedSecret, ...)   // via SubtleCrypto deriveKey
paddedPlaintext = pad(innerEnvelopeJSON, blockSize=256)
ct = AES-256-GCM-Encrypt(aesKey, iv, paddedPlaintext)
```

**Padding**: The plaintext is padded to the nearest 256-byte block boundary
before encryption. The padded wire format is:

```
[2 bytes big-endian: original UTF-8 length][original bytes][random padding]
```

This prevents traffic analysis based on ciphertext length.

### Inner envelope (payload plaintext — relay-invisible)

```json
{
  "t":          "Message | ContactRequest | ContactGrant",
  "from":       "<sender-identity-id>",
  "senderLabel":"Alice",
  "senderCap":  "<sender-inbox-cap>",
  "e2eePub":    { "<sender-ECDH-public-JWK>" },
  "authPub":    { "<sender-ECDSA-public-JWK>" },
  "convId":     "<sha256(sorted(senderID, recipientID))>",
  "seq":        42,
  "msgId":      "<random>",
  "text":       "Hello",
  "ts":         1700000000000
}
```

---

## Envelope types

| `t` | Direction | Cap channel | Description |
|-----|-----------|-------------|-------------|
| `Message` | peer → peer | `msg` | Normal chat message |
| `ContactRequest` | initiator → recipient | `req` | Request to exchange contact info |
| `ContactGrant` | granter → requester | `msg` | Exchange of contact card (after accepting request) |
| `CapsUpdate` | self → self | — | Register capability hashes with relay |

---

## Sequence numbers and replay protection

Each conversation has a per-direction monotonically increasing sequence number
stored in `localStorage`. Incoming messages with `seq ≤ lastSeen` are silently
dropped. Sequence numbers are namespaced by `(myId, fromId, convId, envelopeType)`.

---

## Relay HTTP API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `PUT`  | `/caps/:id` | Signed body | Register inbox cap hashes |
| `PUT`  | `/requestCaps/:id` | Signed body | Register request cap hashes |
| `POST` | `/send` | Signed envelope | Deliver envelope to inbox |
| `POST` | `/inbox/:id` | Signed body | Drain message inbox |
| `POST` | `/requests/inbox/:id` | Signed body | Drain request inbox |
| `POST` | `/block/:id` | Signed body | Block a sender |
| `POST` | `/revokeCap/:id` | Signed body | Revoke a capability hash |
| `POST` | `/directory/publish` | Signed body | Register discoverable handle |
| `GET`  | `/directory/lookup` | — | Look up handle → profile |
| `GET`  | `/directory/available` | — | Check handle availability |
| `GET`  | `/ws-challenge` | — | Fetch WS auth nonce |
| `GET`  | `/health` | — | Health + stats |

### WebSocket push

```
Client → Server: GET /ws-challenge  →  { nonce }
Client → Server: WS connect → send { type:"auth", nonce, authPub, sig }
Server → Client: { type:"auth_ok", id } or { type:"auth_error" }
Server → Client: { type:"notify", channel:"message"|"request" }  (on new mail)
```

---

## Security properties

| Property | Mechanism |
|----------|-----------|
| Message confidentiality | AES-256-GCM with ephemeral ECDH key |
| Forward secrecy (sent) | Ephemeral keypair per message; private key never stored |
| Sender authentication (to recipient) | Inner envelope contains `authPub`; sig verified after decryption |
| Relay authentication | All writes signed with ECDSA; relay verifies sig before accepting |
| Inbox ownership | Drain requires signed proof (`authPub` + `sig` over timestamp) |
| Replay protection | Monotonic per-conversation sequence numbers |
| Traffic analysis resistance | 256-byte block padding on all ciphertexts; 20–200ms send jitter |
| Key storage safety | Private keys stored as non-extractable `CryptoKey` objects in JS runtime; JWK form kept only in sessionStorage-encrypted blob |
| Cap privacy | Only cap hashes stored/checked on relay; raw cap never leaves client |

---

## Relay federation

Each Dissolve client can be pointed at any compatible relay via Settings → Relay
URL. Relays are independent — there is no federation protocol between relays.
To communicate with a user on a different relay, they must share their contact
card (which includes no relay-specific information) and you must send via their
relay's URL. The relay URL is stored in the contact card resolution process.

In practice, the reference relay at the project's default URL handles
cross-relay routing by acting as a directory service. Users who self-host should
publicize their relay URL alongside their handle.
