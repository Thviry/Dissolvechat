# DissolveChat

**End-to-end encrypted messaging where users own their identity, control who can reach them, and don't depend on any single platform.**

---

## The Problem

Every major encrypted messenger today shares the same flaw: **your identity belongs to the platform, not to you.**

Signal requires your phone number. WhatsApp is owned by Meta. Telegram stores messages on their servers. Even privacy-focused alternatives force you to trust a central authority with your account, your contacts, and your metadata.

If the platform goes down, gets acquired, or changes its terms — you lose everything. Your identity, your relationships, your ability to communicate. Users don't have real ownership. They have accounts.

## What DissolveChat Does Differently

DissolveChat is built on three principles:

**Your identity is a file you control.** No phone number, no email, no server-side account. Your identity is a cryptographic key pair stored in an encrypted file on your device. You can back it up, move it between devices, or run it from a USB drive. If you lose it, no one can recover it — and no one can take it from you.

**The server is a dumb pipe.** The relay server routes encrypted blobs. It never sees message content, never stores private keys, and can't impersonate users. Every message is encrypted end-to-end with ephemeral keys that provide forward secrecy. The relay is designed to be untrusted — and replaceable. Users can point their client at any compatible relay.

**You control who can reach you.** DissolveChat uses capability-based addressing: to send you a message, someone needs a cryptographic token that you issued to them. No token, no delivery. You can revoke any individual token at any time, instantly cutting off a sender without blocking your entire inbox. No other messenger gives users this level of granular access control.

## How It Works

1. A user creates an identity — a cryptographic key pair encrypted with a passphrase and saved as a portable file.
2. To connect with someone, users exchange contact cards containing their public keys and an inbox capability token.
3. Messages are encrypted on the sender's device using a fresh ephemeral key, sent through the relay as an opaque blob, and decrypted on the recipient's device.
4. The relay validates signatures and capability tokens but never sees plaintext or private keys.

## What's Built

DissolveChat is a working protocol with two clients and a hardened relay server:

- **Defined protocol** with formal specification, threat model, and compliance rules
- **Web client** (React) for zero-install access
- **Desktop client** (Tauri/Rust) with sandboxed webview and system tray
- **Hardened relay** with strict schema validation, dual-layer rate limiting, authenticated WebSocket, and structured logging
- **Reproducible security tests** verifying relay enforcement
- **Metadata-minimal envelope design** — the relay sees only the recipient ID and a capability token; sender identity, message type, and all content are encrypted

## What Makes This Investable

This isn't a feature list — it's an architecture that compounds.

**The capability model is a moat.** No other consumer messenger uses capability-based routing. It enables features that are architecturally impossible on platforms built around identity-based addressing: per-contact revocation, spam-proof inboxes, anonymous contact requests.

**Relay portability prevents platform lock-in — by design.** Users can run their own relay or switch between relays without losing their identity or contacts. This makes DissolveChat resistant to the centralization pressure that turns every communication platform into a walled garden.

**The protocol is the product.** DissolveChat isn't an app — it's a protocol with reference implementations. Any developer can build a compatible client. This is how open standards win: email, XMPP, Matrix. But unlike those, DissolveChat has capability-based access control and metadata minimization built into the protocol layer, not bolted on.

## Wedge Users

The initial audience is people who have an active reason to care about communication sovereignty:

- Security researchers and journalists who need untraceable communication
- Privacy-conscious professionals tired of trusting platforms with their metadata  
- Open-source communities that value protocol ownership over product lock-in
- Anyone who has lost access to an account and realized they never owned their identity

## Long-Term Opportunity

Encrypted messaging is a growing market driven by regulatory pressure (GDPR, digital sovereignty laws), enterprise security requirements, and consumer privacy awareness. The incumbents are vulnerable because their architectures can't deliver true user autonomy — it conflicts with their business models.

DissolveChat is positioned to be the protocol layer for sovereign communication: messaging where users own their identity, control their access, and aren't dependent on any single operator.

---

*DissolveChat v5.15 — Protocol v4, hardened relay, web + desktop clients*
*Contact: [your email/handle]*
