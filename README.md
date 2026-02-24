# DissolveChat v4

Protocol-first, end-to-end encrypted chat. No usernames, no accounts — your identity is a keypair stored in an encrypted `.usbkey.json` file. The server is an untrusted relay that never sees plaintext.

## Architecture

**Client:** React (Vite) with WebCrypto for all cryptographic operations.
**Server:** Express.js relay with WebSocket push notifications. In-memory only — nothing survives restart.

### Design Principles
- Identity is a keypair, not a username
- The relay is untrusted — it only routes encrypted blobs
- Messages are ephemeral by default (vanish on tab close)
- Contacts persist in browser localStorage
- Capability-based authorization (random tokens control who can message whom)
- Every mutating request is ECDSA-signed and identity-verified

## Running

```bash
# Terminal 1: Server
cd server && npm install && npm start
# → http://localhost:3001

# Terminal 2: Client
cd client && npm install && npm run dev
# → http://localhost:5173
```

## Status

See [STABILITY_CHECKLIST.md](./STABILITY_CHECKLIST.md) for detailed status of every v4 issue.

**Stage 1 (Technical Stability):** Nearly complete. All critical issues resolved, manual stress testing remaining.

## Protocol Version

v4 — backwards-compatible with v3 messages during transition.
