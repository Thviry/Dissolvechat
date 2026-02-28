# Testing Patterns

**Analysis Date:** 2026-02-27

## Test Framework

**Runner:**
- Node.js native (no Jest, Vitest, or Mocha installed)
- Tests run directly with `node test/integration.js`
- Manual test runner with console output
- No CI/CD integration visible

**Assertion Library:**
- Custom inline assertions using a simple `ok(condition, message)` helper
- Pattern: `ok(cond, msg)` tracks `passed++` and `failed++`
- Console output for pass/fail

**Run Commands:**
```bash
cd server && npm start              # Start relay server
node test/integration.js            # Run integration tests
npm run dev                         # Client dev server
npm run dev                         # Desktop Tauri dev
```

## Test File Organization

**Location:**
- Server + client tests: `test/integration.js` in project root
- No test files co-located with source (separate test directory)
- No unit test files; only integration tests

**Naming:**
- Test file: `integration.js`
- No `.test.js` or `.spec.js` suffix pattern
- Server-focused test file (tests relay API + crypto against actual server)

**Structure:**
```
test/
└── integration.js   (full flow: identity → caps → messaging → block)
```

## Test Structure

**Suite Organization:**

The integration test follows a logical flow pattern with sections marked by divider comments:

```javascript
// ── 1. Schema validation ────────────────────────────────────────
console.log("\n── 1. Schema validation ──");
// test schema rejection

// ── 2. Register capabilities ────────────────────────────────────
console.log("\n── 2. Register capabilities ──");
// test cap registration

// ... more sections ...

// Test runner
async function run() {
  let passed = 0;
  let failed = 0;

  function ok(cond, msg) {
    if (cond) { console.log(`  ✓ ${msg}`); passed++; }
    else { console.log(`  ✗ ${msg}`); failed++; }
  }
}
```

**Patterns:**

1. **Setup Phase:**
   - Create two simulated users (Alice, Bob) using `createUser(name)` factory
   - `createUser()` generates ECDSA + ECDH keypairs and random capabilities
   - Compute user IDs from authPubJwk via `computeId()`

2. **Assertion Pattern:**
   ```javascript
   const response = await api("/endpoint", { method: "POST", body: JSON.stringify(...) });
   ok(response.status === 400, `Error case: ${response.status}`);
   ok(response.ok, `Success case: ${JSON.stringify(response.body)}`);
   ```

3. **Crypto Helpers in Test:**
   - `genEcdsa()` - generate ECDSA P-256 keypair (signing)
   - `genEcdh()` - generate ECDH P-256 keypair (encryption)
   - `randomCap()` - generate random 32-byte capability
   - `signObj(obj, privKey)` - sign object with ECDSA
   - `e2eeEncrypt(plaintext, theirPubJwk)` - ephemeral ECDH + AES-GCM
   - `jcs(obj)` - canonicalize JSON via canonicalize package

4. **Envelope Builders in Test:**
   - `buildMessage(sender, recipient, text, seq)` - create message envelope
   - `buildContactRequest(sender, recipient)` - create contact request
   - `buildCapsUpdate(user, capHashes, isRequest)` - register capabilities
   - `buildBlock(user, fromId)` - create block envelope
   - `buildDirectoryPublish(user, discoverable)` - publish to directory
   - `buildInboxDrain(user)` - create drain request

## Mocking

**Framework:**
- No mock library used (no jest.mock, sinon, or similar)
- Real HTTP calls via `fetch()` to actual relay server
- Real crypto operations via Node crypto module
- Real database (in-memory store in relay)

**Patterns:**

1. **User Factory:**
   ```javascript
   function createUser(name) {
     const auth = genEcdsa();
     const e2ee = genEcdh();
     const inbox = randomCap();
     const request = randomCap();
     const id = computeId(auth.pubJwk);
     return { name, id, auth, e2ee, inboxCap: inbox, requestCap: request, ... };
   }
   ```
   Creates realistic test users without external dependencies.

2. **No External Dependencies:**
   - Tests do not mock external services
   - Relay server must be running (checked via `/health` endpoint)
   - No database mocks — uses relay's in-memory store

3. **Crypto Simulation:**
   Test crypto mirrors client-side logic:
   - ECDSA via Node's `crypto.sign("SHA256", data, privKey)`
   - ECDH via `crypto.diffieHellman({ privateKey, publicKey })`
   - AES-256-GCM via `crypto.createCipheriv("aes-256-gcm", key, iv)`
   - All using Node's native crypto module (not browser WebCrypto)

**What to Mock:**
- Not applicable in current test suite (integration test approach)
- Would mock: external APIs, databases if adding unit tests

**What NOT to Mock:**
- Cryptographic operations (test the real thing)
- Relay HTTP API (test against real server)
- Message envelopes and signing (validate entire flow)

## Fixtures and Factories

**Test Data:**

The `createUser()` factory generates all needed test data:

```javascript
function createUser(name) {
  const auth = genEcdsa();        // keypair for signing
  const e2ee = genEcdh();         // keypair for encryption
  const inbox = randomCap();      // inbox capability
  const request = randomCap();    // request capability
  const id = computeId(auth.pubJwk);
  return {
    name, id, auth, e2ee,
    inboxCap: inbox, requestCap: request,
    inboxCapHash: capHash(inbox), requestCapHash: capHash(request),
  };
}
```

**Envelope Builders:**

Separate builder functions generate valid protocol envelopes:

```javascript
function buildSendEnvelope(sender, recipientId, recipientCap, recipientE2eePub, ch, innerObj) {
  const innerJson = JSON.stringify(innerObj);
  const payload = e2eeEncrypt(innerJson, recipientE2eePub);
  const outer = {
    p: 4, to: recipientId, cap: recipientCap, ch,
    authPub: sender.auth.pubJwk, payload,
  };
  outer.sig = signObj(outer, sender.auth.privKey);
  return outer;
}

function buildMessage(sender, recipient, text, seq) {
  const convId = sha256(Buffer.from([sender.id, recipient.id].sort().join("|")));
  const inner = {
    t: "Message", from: sender.id, ts: Date.now(),
    authPub: sender.auth.pubJwk, e2eePub: sender.e2ee.pubJwk,
    senderCap: sender.inboxCap, senderLabel: sender.name,
    convId, seq, msgId: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text,
  };
  return buildSendEnvelope(sender, recipient.id, recipient.inboxCap, recipient.e2ee.pubJwk, "msg", inner);
}
```

**Location:**
- All fixtures and builders defined in `test/integration.js` itself
- Not extracted to separate fixture files
- ~100 lines of setup before test suite begins

## Coverage

**Requirements:**
- No coverage enforcement (no .nyc_config.js or coverage reports)
- Tests are smoke tests, not comprehensive coverage

**View Coverage:**
- Not available; no coverage tooling installed
- Would need to add nyc + Jest/Mocha for coverage reports

**Current Test Coverage:**
Integration test covers:

1. **Schema validation** - malformed requests rejected
2. **Capability registration** - user registers inbox/request caps
3. **Message flow** - Alice sends to Bob, Bob drains inbox
4. **Contact request/grant exchange** - bidirectional contact establishment
5. **Directory publish/lookup** - handle registration and discovery
6. **Blocking** - one user blocks another
7. **Rate limiting** - IP and identity limits enforced
8. **WebSocket connection** - authenticated WS upgrade
9. **Signature verification** - invalid signatures rejected
10. **Replay protection** - client-side sequence number checking (not server-validated)

## Test Types

**Integration Tests:**
- **Scope:** Entire flow from enrollment to messaging to blocking
- **Approach:** Real HTTP calls to running relay server
- **File:** `test/integration.js`
- **Setup:** Start server with `npm start`, then run test

**Unit Tests:**
- Not present in codebase
- Would test individual crypto functions, helpers, validators in isolation
- Could be added in `test/unit/` if needed

**E2E Tests:**
- Not present in codebase
- Browser-based or Tauri app testing would be separate
- Currently only smoke testing via integration test

**Smoke Tests:**
- Checklist documents exist:
  - `SMOKE_TEST_CHECKLIST.md` - manual browser smoke tests
  - `STABILITY_CHECKLIST.md` - stability verification steps
- Not automated

## Common Patterns

**Async Testing:**

Tests are async and await real HTTP + crypto:

```javascript
const response = await api("/send", {
  method: "POST",
  body: JSON.stringify(envelope),
});
ok(response.ok, `Message delivered`);
```

The `api()` helper:
```javascript
async function api(path, opts = {}) {
  const resp = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const body = await resp.json().catch(() => ({}));
  return { status: resp.status, ok: resp.ok, body };
}
```

**Error Testing:**

Test schema rejection via invalid input:

```javascript
const bad1 = await api("/send", {
  method: "POST",
  body: JSON.stringify({ bad: "field" }),
});
ok(bad1.status === 400, `Reject unknown fields: ${bad1.status}`);
```

Test signature verification failure:

```javascript
const badSig = { ...validCapsUpdate, sig: "invalid" };
const result = await api(`/caps/${alice.id}`, {
  method: "PUT",
  body: JSON.stringify(badSig),
});
ok(result.status === 400, `Reject invalid signature`);
```

**Message Flow Testing:**

Complete round-trip test:

```javascript
// Alice sends to Bob
const msg = buildMessage(alice, bob, "Hello Bob!", 1);
const sendResult = await api("/send", { method: "POST", body: JSON.stringify(msg) });
ok(sendResult.ok, `Alice sends: ${JSON.stringify(sendResult.body)}`);

// Bob drains his inbox
const drain = buildInboxDrain(bob);
const drainResult = await api(`/inbox/${encodeURIComponent(bob.id)}`, {
  method: "POST",
  body: JSON.stringify(drain),
});
ok(drainResult.ok && drainResult.body.count > 0, `Bob drains inbox: ${drainResult.body.count} message(s)`);
```

## Test Output Format

The test runner prints:

```
Server: 4.1.0-hardened

Alice: abc123def456…
Bob:   xyz789uvw012…

── 1. Schema validation ──
  ✓ Reject unknown fields: 400
  ✓ Reject malformed fields: 400

── 2. Register capabilities ──
  ✓ Alice registers inbox caps: {"ok":true,"count":1}
  ✓ Bob registers inbox caps: {"ok":true,"count":1}

...

PASSED: 45 / 50
FAILED: 5
```

Exit code: 0 if all pass, 1 if any fail.

---

*Testing analysis: 2026-02-27*
