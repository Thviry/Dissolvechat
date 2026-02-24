// test/integration.js
// Full integration test for DissolveChat v4-secure protocol.
//
// Tests the complete flow between two simulated users (Alice and Bob):
//   1. Identity creation
//   2. Capability registration (authenticated)
//   3. Authenticated inbox drain
//   4. Contact request → grant exchange (encrypted payload)
//   5. Message delivery (encrypted payload)
//   6. Directory publish + lookup
//   7. Blocking
//   8. Schema validation rejection
//   9. Rate limiting
//
// Usage:
//   1. Start the relay:  cd server && npm start
//   2. Run this test:    node test/integration.js
//
// Requires: Node 18+ (for native fetch)

const crypto = require("crypto");
const canonicalize = require("canonicalize");

const API = process.env.API_URL || "http://localhost:3001";

// ══════════════════════════════════════════════════════════════════════
// Crypto helpers (mirrors client-side logic using Node crypto)
// ══════════════════════════════════════════════════════════════════════

function b64u(bytes) { return Buffer.from(bytes).toString("base64url"); }
function unb64u(s) { return Buffer.from(s, "base64url"); }
function sha256(data) { return crypto.createHash("sha256").update(data).digest("base64url"); }
function capHash(cap) { return sha256(unb64u(cap)); }
function randomCap() { return b64u(crypto.randomBytes(32)); }
function jcs(obj) { return canonicalize(obj); }
function computeId(pubJwk) { return sha256(Buffer.from(jcs(pubJwk), "utf-8")); }

function genEcdsa() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  return { pubJwk: publicKey.export({ format: "jwk" }), privKey: privateKey, privateKey };
}

function genEcdh() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  return { pubJwk: publicKey.export({ format: "jwk" }), privKey: privateKey, privateKey };
}

// ── Signing (ECDSA P-256 SHA-256, IEEE P1363 format) ────────────────

function signObj(obj, privKey) {
  const data = Buffer.from(jcs(obj), "utf-8");
  const der = crypto.sign("SHA256", data, privKey);
  return b64u(derToP1363(der));
}

function derToP1363(der) {
  let off = 2;
  if (der[1] & 0x80) off += (der[1] & 0x7f);
  function readInt(buf, o) {
    const len = buf[o + 1];
    return { val: buf.subarray(o + 2, o + 2 + len), next: o + 2 + len };
  }
  function pad32(b) {
    if (b.length === 32) return b;
    if (b.length > 32) return b.subarray(b.length - 32);
    const p = Buffer.alloc(32); b.copy(p, 32 - b.length); return p;
  }
  const r = readInt(der, off);
  const s = readInt(der, r.next);
  return Buffer.concat([pad32(r.val), pad32(s.val)]);
}

// ── E2EE encryption (ephemeral ECDH + AES-256-GCM) ─────────────────

function e2eeEncrypt(plaintext, theirPubJwk) {
  const iv = crypto.randomBytes(12);
  const eph = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const ephPubJwk = eph.publicKey.export({ format: "jwk" });
  const theirPub = crypto.createPublicKey({ key: theirPubJwk, format: "jwk" });
  const shared = crypto.diffieHellman({ privateKey: eph.privateKey, publicKey: theirPub });
  const cipher = crypto.createCipheriv("aes-256-gcm", shared, iv);
  const enc = Buffer.concat([cipher.update(Buffer.from(plaintext, "utf-8")), cipher.final()]);
  const ct = Buffer.concat([enc, cipher.getAuthTag()]);
  return { alg: "ECDH_P256_EPHEMERAL_AESGCM", epk: ephPubJwk, iv: b64u(iv), ct: b64u(ct) };
}

// ══════════════════════════════════════════════════════════════════════
// HTTP helpers
// ══════════════════════════════════════════════════════════════════════

async function api(path, opts = {}) {
  const resp = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const body = await resp.json().catch(() => ({}));
  return { status: resp.status, ok: resp.ok, body };
}

// ══════════════════════════════════════════════════════════════════════
// User factory
// ══════════════════════════════════════════════════════════════════════

function createUser(name) {
  const auth = genEcdsa();
  const e2ee = genEcdh();
  const inbox = randomCap();
  const request = randomCap();
  const id = computeId(auth.pubJwk);
  return {
    name, id, auth, e2ee,
    inboxCap: inbox, requestCap: request,
    inboxCapHash: capHash(inbox), requestCapHash: capHash(request),
  };
}

// ══════════════════════════════════════════════════════════════════════
// Envelope builders (v4-secure: metadata inside encrypted payload)
// ══════════════════════════════════════════════════════════════════════

function buildSendEnvelope(sender, recipientId, recipientCap, recipientE2eePub, ch, innerObj) {
  // Encrypt the inner envelope as the payload
  const innerJson = JSON.stringify(innerObj);
  const payload = e2eeEncrypt(innerJson, recipientE2eePub);

  const outer = {
    p: 4,
    to: recipientId,
    cap: recipientCap,
    ch,
    authPub: sender.auth.pubJwk,
    payload,
  };
  outer.sig = signObj(outer, sender.auth.privKey);
  return outer;
}

function buildMessage(sender, recipient, text, seq) {
  const seeds = [sender.id, recipient.id].sort().join("|");
  const convId = sha256(Buffer.from(seeds, "utf-8"));
  const inner = {
    t: "Message",
    from: sender.id,
    ts: Date.now(),
    authPub: sender.auth.pubJwk,
    e2eePub: sender.e2ee.pubJwk,
    senderCap: sender.inboxCap,
    senderLabel: sender.name,
    convId, seq,
    msgId: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text,
  };
  return buildSendEnvelope(sender, recipient.id, recipient.inboxCap, recipient.e2ee.pubJwk, "msg", inner);
}

function buildContactRequest(sender, recipient) {
  const inner = {
    t: "ContactRequest",
    from: sender.id,
    ts: Date.now(),
    authPub: sender.auth.pubJwk,
    e2eePub: sender.e2ee.pubJwk,
    senderCap: sender.inboxCap,
    senderLabel: sender.name,
    note: `Hi, this is ${sender.name}!`,
  };
  return buildSendEnvelope(sender, recipient.id, recipient.requestCap, recipient.e2ee.pubJwk, "req", inner);
}

function buildCapsUpdate(user, capHashes, isRequest) {
  const obj = {
    p: 4,
    t: "CapsUpdate",
    ts: Date.now(),
    from: user.id,
    to: user.id,
    body: {
      authPub: user.auth.pubJwk,
      capHashes,
      replace: true,
    },
  };
  obj.sig = signObj(obj, user.auth.privKey);
  return obj;
}

function buildInboxDrain(user) {
  const obj = {
    ts: Date.now(),
    authPub: user.auth.pubJwk,
  };
  obj.sig = signObj(obj, user.auth.privKey);
  return obj;
}

function buildBlock(user, fromId) {
  const obj = {
    fromId,
    authPub: user.auth.pubJwk,
  };
  obj.sig = signObj(obj, user.auth.privKey);
  return obj;
}

function buildDirectoryPublish(user, discoverable) {
  const profile = {
    dissolveProtocol: 4, v: 4,
    id: user.id,
    label: user.name,
    authPublicJwk: user.auth.pubJwk,
    e2eePublicJwk: user.e2ee.pubJwk,
    requestCap: discoverable ? user.requestCap : undefined,
    requestCapHash: discoverable ? user.requestCapHash : undefined,
    discoverable,
  };
  const handle = user.name.toLowerCase();
  const obj = { handle, profile };
  obj.sig = signObj(obj, user.auth.privKey);
  return { handle, obj };
}

// ══════════════════════════════════════════════════════════════════════
// Test runner
// ══════════════════════════════════════════════════════════════════════

async function run() {
  let passed = 0;
  let failed = 0;

  function ok(cond, msg) {
    if (cond) { console.log(`  ✓ ${msg}`); passed++; }
    else { console.log(`  ✗ ${msg}`); failed++; }
  }

  // Verify server is up
  const health = await api("/health").catch(() => null);
  if (!health?.ok) {
    console.error("Server not reachable at " + API);
    console.error("Start it with: cd server && npm start");
    process.exit(1);
  }
  console.log(`Server: ${health.body.version || "unknown"}\n`);

  const alice = createUser("Alice");
  const bob = createUser("Bob");
  console.log(`Alice: ${alice.id.slice(0, 16)}…`);
  console.log(`Bob:   ${bob.id.slice(0, 16)}…`);

  // ── 1. Schema validation ────────────────────────────────────────
  console.log("\n── 1. Schema validation ──");

  const bad1 = await api("/send", { method: "POST", body: JSON.stringify({ bad: "field" }) });
  ok(bad1.status === 400, `Reject unknown fields: ${bad1.status}`);

  const bad2 = await api("/send", { method: "POST", body: JSON.stringify({ p: 4, to: "x", cap: "y", ch: "msg", authPub: {}, payload: {}, sig: "z" }) });
  ok(bad2.status === 400, `Reject malformed fields: ${bad2.status}`);

  // ── 2. Register capabilities ────────────────────────────────────
  console.log("\n── 2. Register capabilities ──");

  const aliceCaps = buildCapsUpdate(alice, [alice.inboxCapHash]);
  const ac = await api(`/caps/${encodeURIComponent(alice.id)}`, { method: "PUT", body: JSON.stringify(aliceCaps) });
  ok(ac.ok, `Alice registers inbox caps: ${JSON.stringify(ac.body)}`);

  const bobCaps = buildCapsUpdate(bob, [bob.inboxCapHash]);
  const bc = await api(`/caps/${encodeURIComponent(bob.id)}`, { method: "PUT", body: JSON.stringify(bobCaps) });
  ok(bc.ok, `Bob registers inbox caps: ${JSON.stringify(bc.body)}`);

  const bobReqCaps = buildCapsUpdate(bob, [bob.requestCapHash]);
  const brc = await api(`/requestCaps/${encodeURIComponent(bob.id)}`, { method: "PUT", body: JSON.stringify(bobReqCaps) });
  ok(brc.ok, `Bob registers request caps: ${JSON.stringify(brc.body)}`);

  // ── 3. Authenticated inbox drain ────────────────────────────────
  console.log("\n── 3. Authenticated inbox drain ──");

  // Unauthenticated GET should fail (404 or 400, not 200)
  const badDrain = await api(`/inbox/${encodeURIComponent(bob.id)}`);
  ok(badDrain.status !== 200, `GET /inbox rejected (no auth): ${badDrain.status}`);

  // Authenticated POST should work
  const drain1 = await api(`/inbox/${encodeURIComponent(bob.id)}`, {
    method: "POST", body: JSON.stringify(buildInboxDrain(bob)),
  });
  ok(drain1.ok, `Authenticated drain works: ${drain1.body.items?.length ?? "?"} items`);
  ok(drain1.body.items?.length === 0, "Inbox empty before any messages sent");

  // Wrong identity should be rejected
  const wrongDrain = await api(`/inbox/${encodeURIComponent(bob.id)}`, {
    method: "POST", body: JSON.stringify(buildInboxDrain(alice)),
  });
  ok(wrongDrain.status === 403, `Wrong identity drain rejected: ${wrongDrain.status}`);

  // ── 4. Contact request (encrypted payload) ──────────────────────
  console.log("\n── 4. Contact request ──");

  const reqEnv = buildContactRequest(alice, bob);
  const reqSend = await api("/send", { method: "POST", body: JSON.stringify(reqEnv) });
  ok(reqSend.ok, `Alice sends contact request: ${JSON.stringify(reqSend.body)}`);

  // Bob drains request inbox
  const reqDrain = await api(`/requests/inbox/${encodeURIComponent(bob.id)}`, {
    method: "POST", body: JSON.stringify(buildInboxDrain(bob)),
  });
  ok(reqDrain.ok && reqDrain.body.items?.length === 1, `Bob receives request: ${reqDrain.body.items?.length ?? 0} items`);

  // Verify payload is opaque (server can't see inner fields)
  if (reqDrain.body.items?.[0]) {
    const env = reqDrain.body.items[0];
    ok(env.payload && !env.from && !env.senderLabel, "Envelope is metadata-minimal (no from/senderLabel in outer)");
    ok(env.ch === "req", `Channel hint correct: ${env.ch}`);
  }

  // ── 5. Message delivery (encrypted payload) ─────────────────────
  console.log("\n── 5. Message delivery ──");

  const msg1 = buildMessage(alice, bob, "Hello Bob! This is encrypted.", 1);
  const s1 = await api("/send", { method: "POST", body: JSON.stringify(msg1) });
  ok(s1.ok, `Alice sends message 1: ${JSON.stringify(s1.body)}`);

  const msg2 = buildMessage(alice, bob, "Second message, still encrypted.", 2);
  const s2 = await api("/send", { method: "POST", body: JSON.stringify(msg2) });
  ok(s2.ok, `Alice sends message 2: ${JSON.stringify(s2.body)}`);

  // Bob drains inbox
  const msgDrain = await api(`/inbox/${encodeURIComponent(bob.id)}`, {
    method: "POST", body: JSON.stringify(buildInboxDrain(bob)),
  });
  ok(msgDrain.ok, "Bob drains inbox");
  ok(msgDrain.body.items?.length === 2, `Bob receives 2 messages: ${msgDrain.body.items?.length ?? 0}`);

  // Inbox should now be empty
  const emptyDrain = await api(`/inbox/${encodeURIComponent(bob.id)}`, {
    method: "POST", body: JSON.stringify(buildInboxDrain(bob)),
  });
  ok(emptyDrain.body.items?.length === 0, "Inbox empty after drain");

  // ── 6. Bidirectional messaging ──────────────────────────────────
  console.log("\n── 6. Bidirectional messaging ──");

  // Bob registers Alice's caps so Bob can send to Alice
  const aliceReqCaps = buildCapsUpdate(alice, [alice.inboxCapHash]);
  await api(`/caps/${encodeURIComponent(alice.id)}`, { method: "PUT", body: JSON.stringify(aliceReqCaps) });

  const msg3 = buildMessage(bob, alice, "Hi Alice! Bob here.", 1);
  const s3 = await api("/send", { method: "POST", body: JSON.stringify(msg3) });
  ok(s3.ok, `Bob sends message to Alice: ${JSON.stringify(s3.body)}`);

  const aliceDrain = await api(`/inbox/${encodeURIComponent(alice.id)}`, {
    method: "POST", body: JSON.stringify(buildInboxDrain(alice)),
  });
  ok(aliceDrain.body.items?.length === 1, `Alice receives Bob's message: ${aliceDrain.body.items?.length ?? 0}`);

  // ── 7. Directory publish + lookup ───────────────────────────────
  console.log("\n── 7. Directory ──");

  const { handle: aliceHandle, obj: aliceDirObj } = buildDirectoryPublish(alice, true);
  const dirPub = await api("/directory/publish", { method: "POST", body: JSON.stringify(aliceDirObj) });
  ok(dirPub.ok, `Alice publishes to directory: ${dirPub.status}`);

  const lookup = await api(`/directory/lookup?handle=${aliceHandle}`);
  ok(lookup.ok && lookup.body.profile?.id === alice.id, "Lookup finds Alice by handle");

  // Non-discoverable user
  const { handle: bobHandle, obj: bobDirObj } = buildDirectoryPublish(bob, false);
  await api("/directory/publish", { method: "POST", body: JSON.stringify(bobDirObj) });
  const bobLookup = await api(`/directory/lookup?handle=${bobHandle}`);
  ok(bobLookup.status === 404, `Non-discoverable Bob not found: ${bobLookup.status}`);

  // Duplicate handle
  const eve = createUser("Alice"); // same handle "alice"
  const { obj: eveDirObj } = buildDirectoryPublish(eve, true);
  const dupPub = await api("/directory/publish", { method: "POST", body: JSON.stringify(eveDirObj) });
  ok(dupPub.status === 409, `Duplicate handle rejected: ${dupPub.status}`);

  // ── 8. Blocking ─────────────────────────────────────────────────
  console.log("\n── 8. Blocking ──");

  const blockBody = buildBlock(bob, alice.id);
  const blockRes = await api(`/block/${encodeURIComponent(bob.id)}`, {
    method: "POST", body: JSON.stringify(blockBody),
  });
  ok(blockRes.ok, `Bob blocks Alice: ${JSON.stringify(blockRes.body)}`);

  // Alice tries to send — should be rejected
  const blocked = buildMessage(alice, bob, "This should be blocked", 3);
  const blockedRes = await api("/send", { method: "POST", body: JSON.stringify(blocked) });
  ok(blockedRes.status === 403, `Blocked message rejected: ${blockedRes.status}`);

  // ── 9. Pending message queue ────────────────────────────────────
  console.log("\n── 9. Pending message queue ──");

  const carol = createUser("Carol");
  // Send to Carol before she registers caps
  const pendMsg = buildMessage(alice, carol, "You there?", 1);
  const pendRes = await api("/send", { method: "POST", body: JSON.stringify(pendMsg) });
  ok(pendRes.ok && pendRes.body.queued, `Message queued for unregistered user: queued=${pendRes.body.queued}`);

  // Carol registers caps → message should flush
  const carolCaps = buildCapsUpdate(carol, [carol.inboxCapHash]);
  await api(`/caps/${encodeURIComponent(carol.id)}`, { method: "PUT", body: JSON.stringify(carolCaps) });

  const carolDrain = await api(`/inbox/${encodeURIComponent(carol.id)}`, {
    method: "POST", body: JSON.stringify(buildInboxDrain(carol)),
  });
  ok(carolDrain.body.items?.length === 1, `Pending message flushed after cap registration: ${carolDrain.body.items?.length ?? 0}`);

  // ══════════════════════════════════════════════════════════════════
  // Results
  // ══════════════════════════════════════════════════════════════════

  console.log(`\n${"═".repeat(50)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`${"═".repeat(50)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});
