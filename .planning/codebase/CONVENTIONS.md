# Coding Conventions

**Analysis Date:** 2026-02-27

## Naming Patterns

**Files:**
- Client components: PascalCase, e.g., `ChatPanel.jsx`, `LoginScreen.jsx`
- Client utilities/hooks: camelCase, e.g., `useMessaging.js`, `messageStore.js`, `encoding.js`
- Server modules: camelCase, e.g., `routes.js`, `logger.js`, `store.js`, `ratelimit.js`
- No file type indicators in names; extensions are clear (.jsx for React components, .js for Node modules)

**Functions:**
- Exported functions: camelCase for utilities, PascalCase for React components
- Private helpers: prefixed with underscore (e.g., `_cleanup()`, `_loadDirectory()`)
- Callback handlers: `handle` + noun pattern (e.g., `handleSend()`, `handleIncoming()`, `handleEnroll()`)
- Async functions marked clearly with `async` keyword

**Variables:**
- Local state: camelCase (e.g., `messages`, `activeId`, `sending`)
- Constants: UPPER_SNAKE_CASE (e.g., `MESSAGE_TTL_MS`, `CLEANUP_INTERVAL_MS`, `LIMITS`)
- Booleans: `is` prefix (e.g., `isReady`, `isKnownContact`, `isRequest`)
- Ref-based storage: `Ref` suffix (e.g., `wsRef`, `pollTimerRef`, `contactsRef`)

**Types/Schemas:**
- Zod schemas: PascalCase with "Schema" suffix (e.g., `sendSchema`, `capsUpdateSchema`)
- Cryptographic types: descriptive names (e.g., `authPubJwk`, `e2eePrivJwk`, `inboxCap`)
- Message envelope parts: `t` (type), `p` (protocol), `ts` (timestamp), `sig` (signature), `payload` (encrypted data)

## Code Style

**Formatting:**
- No automated formatter installed; code follows conventional JavaScript/JSX style
- 2-space indentation throughout (server, client, test)
- Trailing semicolons omitted (common in modern JS)
- Single quotes preferred for strings (where used consistently in files)

**Linting:**
- No ESLint or other linter enforced
- Conventions are self-enforced through code review and consistency patterns
- Imports are organized logically (see Import Organization below)

**Comments:**
- High-level comments use `// ──` divider style for section headers:
  ```javascript
  // ── Section Header ──────────────────────────────────────────────────
  ```
- Inline comments explain *why*, not *what*: "Verify sender identity" vs "check sender"
- JSDoc-style comments on exported functions explain parameters and return types:
  ```javascript
  /**
   * Sign an object (without the `sig` field) using ECDSA P-256 + SHA-256.
   * Returns the signature as base64url.
   */
  ```
- Complex crypto operations include algorithm details in comments
- Security-sensitive operations explicitly documented (e.g., "ephemeral key never exported")

## Import Organization

**Order (Client - React):**
1. React hooks from "react"
2. Crypto utilities (client/src/crypto/)
3. Protocol/relay functions (client/src/protocol/)
4. Other utilities (storage, qrcode)
5. Components (relative imports)
6. CSS files

**Example from `useMessaging.js`:**
```javascript
import { useState, useEffect, useRef, useCallback } from "react";
import { randomId, capHashFromCap } from "../crypto";
import { signObject, verifyObject } from "../crypto/signing";
import { e2eeDecrypt } from "../crypto/e2ee";
import { drainInbox, sendEnvelope, ... } from "../protocol/relay";
import { buildMessage, buildContactRequest, ... } from "../protocol/envelopes";
import { checkAndUpdateReplay } from "../utils/storage";
```

**Order (Server - Node.js):**
1. Built-in modules (`http`, `crypto`, etc.)
2. External dependencies (`express`, `cors`, `ws`, `zod`)
3. Local modules (`./ paths`)

**Example from `routes.js`:**
```javascript
const crypto = require("crypto");
const { capHashFromCap, ... } = require("./crypto");
const { sendSchema, ... } = require("./schemas");
const { RateLimiter, LIMITS, ... } = require("./ratelimit");
const logger = require("./logger");
```

**Path aliases:**
- None used; all imports use relative paths (`./ ../`)

## Error Handling

**Pattern - Client:**
- Try-catch wraps async operations and sensitive work:
  ```javascript
  try {
    const decrypted = await e2eeDecrypt(env.payload, e2eePrivJwk);
    inner = JSON.parse(decrypted);
  } catch {
    return; // Silently skip on decryption failure
  }
  ```
- Silent failures (empty catch) for non-fatal operations (malformed fragments, decrypt failures)
- User-visible errors thrown as exceptions with messages:
  ```javascript
  if (!passphrase) throw new Error("Passphrase required");
  ```
- Alert boxes for user feedback on enrollment/login errors
- UI error state stored in component state (e.g., `error` in ChatPanel)

**Pattern - Server:**
- Validation failures logged + 400 response:
  ```javascript
  if (!v.ok) {
    logger.validationFailed("/caps", v.error);
    return res.status(400).json({ error: v.error });
  }
  ```
- Signature verification failures logged + 400 response
- Rate limit violations return 429 with `Retry-After` header
- Oversized bodies return 413 Payload Too Large
- Generic errors return 500 with non-leaky message (`"error": "internal_error"`)
- Global error handler in `index.js` catches body-parser errors and unhandled exceptions

**Pattern - Crypto:**
- All crypto operations are async (using WebCrypto API)
- Import/export errors caught and logged
- Verification failures return false (not throw)
- Invalid JWKs cause import failures (caught at call site)

## Logging

**Framework:**
- Client: `console` directly (in dev), no centralized logging
- Server: Custom structured logger in `src/logger.js`

**Server Logging Rules:**
- **Never log:** plaintext, capabilities, private keys, full IPs, full authPub
- **Always log:** event type, truncated identity (12 chars), reason for rejection
- Truncate function `trunc()` used on IDs: `id.slice(0, 12) + "…"`
- Format: Pretty-printed in dev, JSON lines in production
- Events prefixed with namespace: `envelope.accepted`, `inbox.drained`, `auth.sig_failed`, `ratelimit.hit`, `directory.published`
- Structured with timestamp and event name:
  ```javascript
  { ts: "2026-02-27T...", event: "envelope.accepted", to: "abc123…", ch: "msg" }
  ```

**Client Logging:**
- No centralized logging; errors shown via `alert()` or `console` in dev
- Error state displayed in UI (ChatPanel shows error div)

## Validation

**Server Side:**
- Zod schemas enforce every HTTP endpoint (not optional)
- All schemas use `.strict()` to reject unknown fields
- Base64url validation: `/^[A-Za-z0-9_-]+$/`
- JWK keys validated as EC P-256: `{ kty: "EC", crv: "P-256", x, y }`
- Timestamp bounds: not before 2024, not more than 5min in future
- Capability hashes: base64url, max 64 chars
- Identities: sha256(jcs(authPubJwk)), base64url = 43 chars
- String lengths capped: handles max 32 chars, labels max 64 chars
- Array bounds: capHashes min 1, max 16 items
- Encrypted payloads: max ~12KB ciphertext allowed

**Client Side:**
- Handle availability checked before enrollment via `/directory/lookup`
- Passphrase confirmation required (double-prompt)
- Contact import validates required fields: `id`, `authPublicJwk`, `e2eePublicJwk`
- Message text accepted as-is (no validation, user responsibility)

## Module Design

**Exports:**
- React components export default function
- Utility modules export named functions
- All exported functions documented with JSDoc

**Barrel Files:**
- Not used; imports are direct from modules
- Example: `import { e2eeEncrypt } from "./crypto/e2ee"` (not from `./crypto/index`)
- `crypto/index.js` exists but only re-exports symbols for convenience

**Hooks (Client):**
- Located in `client/src/hooks/`
- Return state, refs, and callback handlers
- Names follow `use*` convention (React rule)
- `useIdentity()`, `useContacts()`, `useMessaging()` are main three
- Each hook manages a distinct concern (identity, contacts, messaging)

**Crypto Module Structure (Client):**
```
client/src/crypto/
├── index.js         (re-exports)
├── e2ee.js         (ephemeral ECDH + AES-GCM)
├── signing.js      (ECDSA P-256 + JCS)
├── encoding.js     (base64url, SHA-256, random)
└── keyfile.js      (encrypted key file format)
```

**Protocol Module Structure (Client):**
```
client/src/protocol/
├── relay.js        (HTTP + WebSocket API client)
└── envelopes.js    (envelope builders)
```

## React Component Patterns

**State Management:**
- useState for local UI state (messages, sending, error, activeId)
- useRef for persistent references (scrollRef, inputRef, wsRef, pollTimerRef, archiveRef)
- useCallback for memoized handlers
- useEffect for side effects (auto-scroll, WebSocket setup, polling)
- useCallback + useRef pattern for avoiding stale closures in callbacks

**Event Handlers:**
- Named `handle*` (e.g., `handleSend`, `handleEnroll`, `handleChatClick`)
- Async when calling server/crypto operations
- Set/clear error state around async work
- Disable buttons during async work (using `sending` flag)

**Props:**
- No prop validation (no PropTypes or TypeScript)
- Props spread implicitly expected to be correct
- Key components: `ChatPanel`, `LoginScreen`, `Sidebar`, `ShareModal`

## Function Design

**Size:**
- Most functions 10-50 lines
- Crypto functions smaller (5-20 lines), focused on single operation
- Hooks can be 100+ lines (manage multiple refs and side effects)
- Server route handlers 30-60 lines (validation + business logic + response)

**Parameters:**
- Functions take explicit parameters, not object destructuring (except React components)
- Callback functions follow `(value) => void` or `(value) => Promise<T>` pattern
- Object parameters used for complex requests (e.g., HTTP body)

**Return Values:**
- Async functions return Promise<T>
- Validation functions return `{ ok: true, data }` or `{ ok: false, error }`
- Crypto functions return the encrypted/decrypted value directly
- Handlers return undefined (side effects only)
- Helpers return the computed value

## Security Patterns

**Sensitive Data:**
- Private keys never leave crypto modules except via encrypted keyfiles
- Capabilities never logged or exposed in errors
- Authentication public keys (`authPublicJwk`) included in signatures for verification
- Signatures verified before trusting any envelope data

**Crypto Operations:**
- ECDSA P-256 + SHA-256 for signing/verification
- Ephemeral ECDH P-256 for forward secrecy
- AES-256-GCM for encryption (authenticated)
- All operations use WebCrypto API (server uses Node crypto module)
- JCS (JSON Canonicalization Scheme) for deterministic serialization before signing

**Request Authentication:**
- All mutation requests (POST, PUT) require signature
- Signature covers entire request body (JCS-canonicalized)
- Identity verified by computing ID from authPubJwk and comparing
- Capability tokens passed as `cap` field in envelope
- WebSocket upgrade requires nonce challenge (issued via `/ws-challenge`)

---

*Convention analysis: 2026-02-27*
