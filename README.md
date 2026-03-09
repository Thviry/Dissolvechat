# DissolveChat

End-to-end encrypted chat with zero-knowledge relay infrastructure. No accounts, no usernames — your identity is a cryptographic keypair in an encrypted keyfile. The server never sees plaintext.

> "Power to the user, not the platform."

**v0.1.6-beta** | [dissolve.chat](https://dissolve.chat) | [GitHub](https://github.com/Thviry/Dissolvechat) | MIT License

---

## Features

- **End-to-end encrypted messaging** — 1-to-1 and group chat (up to 50 members)
- **Zero-knowledge relay** — in-memory only, nothing persists on the server
- **Self-sovereign identity** — keypair-based, no registration, no phone number
- **Portable encrypted keyfile** — carries your identity, contacts, and groups
- **Recovery via seed phrase** — BIP39 mnemonic backup
- **Local message archive** — opt-in, AES-256-GCM encrypted IndexedDB
- **File sharing** — up to 5MB with inline image preview
- **Traffic analysis resistance** — message padding with fixed-size buckets
- **Online presence** — opt-in, off by default
- **Notifications** — audio ping and title flash on incoming messages
- **5 themes** — Terminal (default), Ocean, Forest, Ember, Violet
- **Multi-relay support** — connect to any relay, including your own
- **System tray** — minimize-to-tray on close (desktop)
- **Self-hostable** — run your own relay with Docker Compose

## Architecture

```
[Client A] <--e2ee--> [Relay] <--e2ee--> [Client B]
```

**Client** (React 19 + Vite): All cryptography runs in the browser via WebCrypto. The client encrypts, signs, and decrypts everything locally. The relay is treated as an untrusted courier.

**Relay** (Node.js/Express + WebSocket): Routes encrypted blobs between clients. In-memory only — messages, capabilities, and pending queues are lost on restart. Every mutating request is ECDSA-signed and identity-verified.

**Crypto** (`packages/dissolve-core`): ECDH ephemeral key exchange, AES-256-GCM message encryption, ECDSA request signing. Group messages use two-layer encryption: inner AES-256-GCM with shared group key, outer per-member ECDH. The relay has zero group awareness.

**Desktop** (Tauri v2): Native wrapper sharing the web client source via Vite aliases. Adds system tray, native file dialogs, and OS integration.

## Quickstart

Requires Node.js 20+ and [pnpm](https://pnpm.io/).

```bash
# Install dependencies
pnpm install

# Terminal 1 — Relay server
cd server && npm run dev
# -> http://localhost:3001

# Terminal 2 — Web client
cd client && npm run dev
# -> http://localhost:5173

# Terminal 3 — Desktop app (requires Rust toolchain)
cd desktop && npm run tauri:dev
# -> Tauri window on localhost:5174
```

### Monorepo structure

```
client/             React 19 web client
desktop/            Tauri v2 desktop wrapper
server/             Node.js relay server
packages/
  dissolve-core/    Shared crypto primitives
landing/            Static site (dissolve.chat)
```

## Self-Hosting

See [SELF_HOSTING.md](./SELF_HOSTING.md) for instructions on running your own relay with Docker Compose.

## Downloads

Desktop builds for Windows, macOS (universal), and Linux are available at [dissolve.chat](https://dissolve.chat) and on the [GitHub Releases](https://github.com/Thviry/Dissolvechat/releases) page.

## License

MIT — see [LICENSE](./LICENSE).
