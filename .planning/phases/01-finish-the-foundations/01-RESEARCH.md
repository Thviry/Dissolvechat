# Phase 1: Finish the Foundations - Research

**Researched:** 2026-02-28
**Domain:** Cryptographic payload padding (AES-GCM) + client configuration centralization (Vite/React)
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEC-01 | Encrypted payloads padded to fixed-size buckets (512B/1KB/2KB/4KB) so ciphertext size does not leak message length. Implementation in `client/src/crypto/e2ee.js`. | Padding scheme, bucket logic, and integration pattern documented in Architecture Patterns and Code Examples sections. |
| SEC-02 | Client-side configuration constants (poll interval, reconnect delay, TTLs) centralized in `client/src/config.js`. Magic numbers currently scattered in `useMessaging.js`, `relay.js`, and other hook files. | All magic numbers catalogued with current values, target config shape, and ES module pattern documented. |
</phase_requirements>

---

## Summary

Phase 1 addresses two tightly scoped tasks with no external library dependencies. Both changes are purely client-side and do not affect the relay server or the protocol wire format.

**SEC-01 (Envelope padding):** AES-GCM is a streaming mode — it does not require or perform padding internally. The plaintext bytes are XOR'd with a keystream directly, so the ciphertext length equals the plaintext length exactly (plus 16-byte authentication tag). This means a 200-byte message produces a visibly different ciphertext size than a 1000-byte message, leaking length information to a network observer. The fix is to pad the plaintext (the JSON string) to the next bucket boundary before passing it to `crypto.subtle.encrypt`. The receiver strips the padding after decryption. Zero-byte padding to fixed power-of-two buckets (512B/1KB/2KB/4KB) is the correct approach for this use case — it is simple, has no external dependencies, and eliminates the length leak without requiring a library.

**SEC-02 (Config centralization):** The codebase has six hardcoded timing constants spread across two files. Centralizing them into `client/src/config.js` as a plain ES module export is the idiomatic pattern for Vite/React projects when constants are application logic (not environment-specific deployment config). `VITE_` env vars are the right choice for deploy-time secrets and per-environment URLs; a `config.js` module is the right choice for application-internal constants that change rarely and are not environment-specific.

**Primary recommendation:** Add zero-byte padding to fixed buckets in `e2eeEncrypt`/`e2eeDecrypt` in `e2ee.js`; extract all timing constants to a new `client/src/config.js` ES module and import them into `useMessaging.js` and `relay.js`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Web Crypto API (built-in) | Browser built-in | AES-GCM encryption/decryption | Already used throughout `e2ee.js`; no new dependency needed |
| ES Modules (built-in) | JavaScript standard | Config constants export | Vite natively supports ES module imports; tree-shaken at build time |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None required | - | Both tasks need zero new dependencies | Padding and config centralization are pure JavaScript operations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zero-byte bucket padding (manual) | PKCS#7 padding | PKCS#7 pads to 16-byte block boundaries only — this is for AES-CBC block alignment, not bucket size hiding. Irrelevant here since AES-GCM is a stream mode. |
| Zero-byte bucket padding (manual) | ISO/IEC 7816-4 padding | ISO 7816-4 (0x80 followed by 0x00 bytes) is used by libsodium. More detectable as padding than zero bytes. Adds marginal complexity for no benefit in this context since the zero bytes are already authenticated by AES-GCM's GHASH tag. |
| Plain `config.js` ES module | Vite `define` in `vite.config.js` | `define` inlines constants at build time (like C macros), good for feature flags and version strings. Harder to read and modify for ops-style constants. `config.js` is more readable and is still tree-shaken at the module level. |
| Plain `config.js` ES module | `.env` / `VITE_` env vars | Env vars require deployment plumbing and `.env` files for purely internal constants. Appropriate for relay URL (deployment config) but not for poll interval (application logic). |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure
No structural changes needed for Phase 1. Both changes are file-level:
```
client/src/
├── config.js          # NEW — centralized client constants (SEC-02)
├── crypto/
│   └── e2ee.js        # MODIFY — add padPlaintext/unpadPlaintext helpers (SEC-01)
├── hooks/
│   └── useMessaging.js  # MODIFY — replace magic numbers with config imports (SEC-02)
└── protocol/
    └── relay.js         # MODIFY — replace magic numbers with config imports (SEC-02)
```

### Pattern 1: Zero-Byte Bucket Padding for Plaintext
**What:** Before encrypting, pad the UTF-8 encoded plaintext to the next bucket boundary by appending zero bytes. After decrypting, strip trailing zero bytes. The buckets are fixed at 512B, 1024B, 2048B, and 4096B. Plaintext longer than 4KB goes into an overflow bucket rounded to the nearest 1KB above 4KB.

**When to use:** Apply in `e2eeEncrypt` after encoding to bytes, before `crypto.subtle.encrypt`. Remove in `e2eeDecrypt` after `crypto.subtle.decrypt`, before returning decoded string.

**Critical rule:** Padding is applied to the byte-encoded plaintext (the UTF-8 bytes of the JSON string), NOT to the ciphertext. AES-GCM encrypts the padded bytes, producing `len(padded) + 16` bytes of authenticated ciphertext. The receiver decrypts first, then strips padding.

**Example:**
```javascript
// Source: research synthesis — no external library required
const BUCKETS = [512, 1024, 2048, 4096];

function padPlaintext(bytes) {
  const len = bytes.length;
  // Find the smallest bucket >= len
  let target = BUCKETS.find(b => b >= len);
  if (!target) {
    // Overflow: round up to next 1KB above 4KB
    target = Math.ceil(len / 1024) * 1024;
  }
  const padded = new Uint8Array(target);
  padded.set(bytes); // remaining bytes are zero-initialized
  return padded;
}

function unpadPlaintext(bytes) {
  // Strip trailing zero bytes
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end--;
  return bytes.subarray(0, end);
}
```

**Integration with existing `e2eeEncrypt`/`e2eeDecrypt`:**

In `e2eeEncrypt`: change `enc.encode(plaintext)` to `padPlaintext(enc.encode(plaintext))` before passing to `crypto.subtle.encrypt`.

In `e2eeDecrypt`: after `crypto.subtle.decrypt` returns `ptBytes`, apply `unpadPlaintext(new Uint8Array(ptBytes))` before `dec.decode(...)`.

### Pattern 2: ES Module Config File
**What:** A single `client/src/config.js` file exporting named constants. Consumed via standard ES module imports. No singleton pattern, no class, no default export — just named exports.

**When to use:** For all client-side constants that are application-internal timing/behavior values (not secrets, not deploy-time URLs).

**Example:**
```javascript
// client/src/config.js
// Client-side configuration constants.
// Edit this file to tune polling intervals, TTLs, and reconnect behaviour.

/** How often to poll the relay for new messages (milliseconds) */
export const POLL_INTERVAL_MS = 5_000;

/** How often to republish capability hashes to the relay (milliseconds) */
export const CAP_REPUBLISH_INTERVAL_MS = 30_000;

/** Delay between WebSocket reconnect attempts (milliseconds) */
export const WS_RECONNECT_DELAY_MS = 3_000;

/** Base delay for cap_not_allowed retry backoff (milliseconds, multiplied by attempt+1) */
export const SEND_RETRY_BASE_DELAY_MS = 1_500;
```

**Import pattern in `useMessaging.js`:**
```javascript
import { POLL_INTERVAL_MS, CAP_REPUBLISH_INTERVAL_MS, SEND_RETRY_BASE_DELAY_MS } from "../config";
// Replace: setInterval(fetchMessages, 5000)
// With:    setInterval(fetchMessages, POLL_INTERVAL_MS)
```

**Import pattern in `relay.js`:**
```javascript
import { WS_RECONNECT_DELAY_MS } from "../config";
// Replace: reconnectTimer = setTimeout(connect, 3000)
// With:    reconnectTimer = setTimeout(connect, WS_RECONNECT_DELAY_MS)
```

### Anti-Patterns to Avoid
- **Padding the ciphertext:** Never pad after encryption. Padding must be inside the plaintext so the AES-GCM authentication tag covers both the message and the padding. Padding ciphertext provides no security benefit and breaks authentication.
- **Using PKCS#7 block padding for buckets:** PKCS#7 rounds to 16-byte blocks (AES block size). This is for CBC mode compatibility only, not for traffic analysis resistance. For 4KB buckets, it provides nearly no benefit.
- **Storing config constants in `.env`:** Vite's `.env` mechanism is for deployment-time secrets and per-environment overrides. Internal timing constants like `POLL_INTERVAL_MS` belong in source code where they are version-controlled and self-documenting.
- **Using a `default export` for config:** Named exports make tree-shaking reliable — only the imported constants are included in bundles. Default exports force the consumer to destructure or rename.
- **Stripping padding by length metadata:** Do NOT add a "original length" prefix to padded plaintext. The zero-stripping approach is simpler and safe because AES-GCM's authentication tag guarantees the plaintext was not tampered with. The only edge case to confirm: a message whose last character is a null byte (U+0000 as JSON). This is addressed in the Pitfalls section.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bucket boundary computation | Custom bit-twiddling power-of-two logic | Simple linear BUCKETS array scan | The bucket sizes (512/1KB/2KB/4KB) are fixed by requirement; a linear scan over 4 values is clearer and more maintainable than bit manipulation |
| Padding algorithm | Custom format with length prefix | Zero-byte trailing pad | AES-GCM authentication makes length prefix unnecessary; trailing zero strip is 3 lines and correct |
| Config loading | Runtime fetch from server / dynamic import | Static ES module import | Compile-time constants; dynamic loading adds latency and complexity for no benefit |

**Key insight:** Both tasks are deliberately simple. The right implementation is the least complex one that satisfies the requirement.

---

## Common Pitfalls

### Pitfall 1: Null Byte at End of Message Content
**What goes wrong:** If a message's actual plaintext ends with a null byte (e.g., JSON containing `"\u0000"` at the end), stripping trailing zero bytes will corrupt it.

**Why it happens:** The zero-strip unpadding is ambiguous when real content ends with 0x00.

**How to avoid:** In practice, the plaintext is always `JSON.stringify(inner)` where `inner` is a JavaScript object. JSON output never ends with a null byte — JSON strings escape control characters. Confirm this is true for all call sites in `envelopes.js`. The three callers are `buildMessage`, `buildContactRequest`, and `buildContactGrant` — all pass `JSON.stringify(inner)` which is safe.

**Warning signs:** If padding is removed from messages that end with `"}"` (the closing brace of a JSON object) — that's fine. The issue only arises with embedded null bytes in the JSON content itself.

### Pitfall 2: Oversized Message Exceeds Max Bucket
**What goes wrong:** A very long message (e.g., 10KB of text) exceeds the 4KB bucket and the overflow logic rounds up to the nearest 1KB. This is fine functionally but should be confirmed against the relay's max payload size.

**Why it happens:** The bucket scheme is designed for typical chat messages. Edge cases exist for pathologically long messages.

**How to avoid:** The relay has a `413 payload too large` response. The relay's `express.json()` body size limit should be checked (it's likely 100KB default). The overflow 1KB rounding is safe in practice; no message in a chat app should exceed the relay's body limit. No change needed to the relay.

**Warning signs:** `413` HTTP error on send after padding is added.

### Pitfall 3: Padding Applied in Wrong Location (Ciphertext vs Plaintext)
**What goes wrong:** Developer adds zero bytes to the base64url-encoded `ct` field after encryption. The AES-GCM authentication tag then doesn't cover the padding, and decryption will reject the tampered ciphertext with an error.

**Why it happens:** Easy conceptual confusion — "padding the payload" sounds like adding bytes to the output.

**How to avoid:** The padding MUST happen before `crypto.subtle.encrypt` is called. The code change is in `e2eeEncrypt` where `enc.encode(plaintext)` currently produces the byte array that goes to `encrypt`. That byte array is what gets padded.

**Warning signs:** `DOMException: The operation failed for an operation-specific reason` during decryption — this is the AES-GCM auth tag failure error in browsers.

### Pitfall 4: Config Import Breaks Hot Module Replacement (HMR)
**What goes wrong:** After adding `config.js`, changing a constant in it during development doesn't trigger a hot reload in the components/hooks that import it.

**Why it happens:** Vite's HMR works well for React components but can have dependency graph issues with non-component ES modules.

**How to avoid:** This is a developer experience issue only. Constants rarely change during development anyway. A full page reload (`Cmd+R`) always picks up the change. Not a production concern.

**Warning signs:** Developer edits `POLL_INTERVAL_MS` and the dev server doesn't reflect the change without refresh. Expected behavior.

### Pitfall 5: Desktop client not updated
**What goes wrong:** The change is made to `client/src/crypto/e2ee.js` but not `desktop/src/crypto/e2ee.js`. Both codebases are currently identical duplicates.

**Why it happens:** The repository has `client/` and `desktop/` as separate source trees with duplicated code (noted as a known concern in CONCERNS.md; Phase 2 will unify them).

**How to avoid:** Both `client/src/crypto/e2ee.js` and `desktop/src/crypto/e2ee.js` must receive identical changes. Same for any hook or config files referenced. Explicitly call this out in the plan task.

**Warning signs:** Desktop client sends/receives messages of different-length ciphertexts than the web client after the change.

---

## Code Examples

Verified patterns from official sources and codebase analysis:

### Current `e2eeEncrypt` Encrypt Call (to be modified)
```javascript
// Source: client/src/crypto/e2ee.js (current, line 46-48)
const ct = new Uint8Array(
  await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, enc.encode(plaintext))
);
```

### Modified `e2eeEncrypt` with Padding Applied
```javascript
// After change: pad the encoded bytes before encrypting
const ct = new Uint8Array(
  await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, padPlaintext(enc.encode(plaintext)))
);
```

### Current `e2eeDecrypt` Decode Call (to be modified)
```javascript
// Source: client/src/crypto/e2ee.js (current, line 75-76)
const ptBytes = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, ct);
return dec.decode(new Uint8Array(ptBytes));
```

### Modified `e2eeDecrypt` with Unpadding Applied
```javascript
// After change: strip zero-byte padding after decryption
const ptBytes = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, ct);
return dec.decode(unpadPlaintext(new Uint8Array(ptBytes)));
```

### Magic Numbers Catalogue — Current Values

All of these are currently hardcoded inline. These are the values to extract into `config.js`:

| Constant Name | Current Value | Location | Line |
|---------------|--------------|----------|------|
| `POLL_INTERVAL_MS` | `5000` | `useMessaging.js` | 325 |
| `CAP_REPUBLISH_INTERVAL_MS` | `30000` | `useMessaging.js` | 333 |
| `SEND_RETRY_BASE_DELAY_MS` | `1500` (× attempt+1) | `useMessaging.js` | 378 |
| `WS_RECONNECT_DELAY_MS` | `3000` | `relay.js` | 216 |

Note: The relay URL constants in `relay.js` lines 13-14 (`DEFAULT_API`, `DEFAULT_WS`) use `import.meta.env.VITE_API_URL` and `import.meta.env.VITE_WS_URL`. These are correctly handled via Vite env vars already. Do NOT move them to `config.js` — they are deployment configuration, not application constants.

### Complete config.js Shape
```javascript
// client/src/config.js
// Client-side application constants.
// These are application logic values — not deployment config.
// For relay URLs, see VITE_API_URL / VITE_WS_URL in .env

/** How often to poll the relay for new messages when WebSocket is unavailable (ms) */
export const POLL_INTERVAL_MS = 5_000;

/** How often to republish capability hashes to keep the relay inbox active (ms) */
export const CAP_REPUBLISH_INTERVAL_MS = 30_000;

/** Delay before retrying a WebSocket connection after drop (ms) */
export const WS_RECONNECT_DELAY_MS = 3_000;

/** Base delay for send retry backoff on cap_not_allowed (ms × attempt index) */
export const SEND_RETRY_BASE_DELAY_MS = 1_500;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PKCS#7 padding for block cipher modes | No padding needed for AES-GCM (stream mode) — but zero-byte padding to fixed buckets for traffic analysis resistance | AES-GCM adoption ~2012-2015; bucket padding for secure messaging ~2016-2020 with Signal et al. | Correct approach is zero-byte bucket padding applied to plaintext before GCM encryption |
| Magic numbers inline in hooks | Named constants in a config module | Standard practice since ES6 modules became universal | More maintainable, self-documenting, single place to change |

**Deprecated/outdated:**
- PKCS#7 to 16-byte blocks: Only for AES-CBC. Irrelevant for GCM. Do not use.
- CBC mode with padding: Vulnerable to padding oracle attacks. Existing codebase correctly uses GCM exclusively.

---

## Open Questions

1. **Should ContactRequest and ContactGrant payloads also be padded?**
   - What we know: `e2eeEncrypt` is called by `buildMessage`, `buildContactRequest`, and `buildContactGrant` in `envelopes.js`. All three paths go through the same `e2eeEncrypt` function.
   - What's unclear: The requirement (SEC-01) says "encrypted payloads" generally. ContactRequests and ContactGrants also leak length via ciphertext size.
   - Recommendation: Since padding is implemented inside `e2eeEncrypt` itself, all three call sites benefit automatically. No per-call change needed. This is the correct behavior — the fix is transparent to callers.

2. **What is the relay's maximum payload size?**
   - What we know: The relay uses `express.json()`. Default Express body limit is 100KB. The server file was not read during this research.
   - What's unclear: Whether a custom body-parser limit is set in `server/src/index.js`.
   - Recommendation: Check `server/src/index.js` for `express.json({ limit: ... })` during implementation. The 4KB max bucket is well within any reasonable limit.

3. **Should the desktop client `config.js` be the same file or a symlink?**
   - What we know: `desktop/src/` is a duplicate of `client/src/`. Phase 2 will unify them into a shared package.
   - What's unclear: Whether to create `desktop/src/config.js` with identical content, or skip it until Phase 2.
   - Recommendation: Create identical `desktop/src/config.js` with the same values. It's two minutes of copy-paste and avoids the desktop client being in a broken state. Phase 2 will delete the duplication.

---

## Sources

### Primary (HIGH confidence)
- Web Crypto API (MDN Official) — AES-GCM is a stream cipher mode that does not require or apply padding; `crypto.subtle.encrypt` accepts arbitrary-length byte arrays; verified via existing working code in `e2ee.js`
- Vite Official Docs (https://vite.dev/guide/env-and-mode) — `VITE_` prefix for env vars; `import.meta.env` for deployment config; static replacement at build time

### Secondary (MEDIUM confidence)
- Libsodium padding documentation (https://libsodium.gitbook.io/doc/padding) — confirms ISO 7816-4 padding applied before encryption; zero-byte trailing approach verified as equivalent and simpler
- WebSearch: Signal protocol padding research (multiple academic sources) — confirms fixed-bucket padding as standard practice for traffic analysis resistance in secure messaging

### Tertiary (LOW confidence)
- WebSearch: "message length hiding padding bucket scheme" — found RFC 8467 (DNS query padding to 128-byte multiples) as a related standard; provides conceptual support for fixed bucket approach but is a different protocol domain

---

## Metadata

**Confidence breakdown:**
- SEC-01 padding scheme: HIGH — AES-GCM's stream property is a WebCrypto spec fact; zero-byte bucket padding is simple and correct; integration point in `e2ee.js` is clear from reading the source
- SEC-02 config centralization: HIGH — Magic numbers catalogued directly from source; config.js pattern is standard Vite/React practice; no ambiguity
- Pitfalls: HIGH for crypto pitfalls (verifiable from spec); MEDIUM for desktop duplication pitfall (inferred from codebase structure)

**Research date:** 2026-02-28
**Valid until:** 2026-03-30 (stable domain — WebCrypto spec and Vite patterns do not change rapidly)
