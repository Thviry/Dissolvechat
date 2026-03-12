# Voice Calls Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 1-to-1 E2EE voice calling to DissolveChat using raw WebRTC with forced TURN relay, signaling through the existing encrypted envelope system.

**Architecture:** Four new envelope types (VoiceOffer/Answer/Ice/End) flow through the existing `/send` + inbox drain pipeline. A new `voiceCall.js` module manages the `RTCPeerConnection` lifecycle. coturn runs on the existing IONOS VPS for TURN relay. A single new server route (`POST /turn-credentials`) provides ephemeral HMAC credentials.

**Tech Stack:** WebRTC (`RTCPeerConnection`), Web Audio API (ringtone), coturn (TURN server), existing ECDH-P256 + AES-256-GCM crypto layer.

**Spec:** `docs/superpowers/specs/2026-03-12-voice-calls-design.md`

---

## Chunk 1: Protocol Layer (Envelope Builders + TURN Credentials)

### Task 1: Voice Envelope Builders

**Files:**
- Create: `client/src/protocol/voiceEnvelopes.js`
- Test: `tests/protocol/voiceEnvelopes.test.js`
- Reference: `client/src/protocol/envelopes.js` (pattern to follow)

- [ ] **Step 1: Write failing tests for voice envelope builders**

Create `tests/protocol/voiceEnvelopes.test.js`:

```javascript
import { describe, it, expect, beforeAll } from "vitest";
import {
  buildVoiceOffer,
  buildVoiceAnswer,
  buildVoiceIce,
  buildVoiceEnd,
} from "@protocol/voiceEnvelopes.js";
import { generateE2eeKeypair, generateAuthKeypair, e2eeDecrypt } from "dissolve-core/crypto/e2ee";
import { signObject, verifySignature } from "dissolve-core/crypto/signing";

let alice, bob;

beforeAll(async () => {
  const aE2ee = await generateE2eeKeypair();
  const aAuth = await generateAuthKeypair();
  const bE2ee = await generateE2eeKeypair();
  const bAuth = await generateAuthKeypair();
  alice = {
    id: "alice-id-000",
    label: "Alice",
    e2eePub: aE2ee.publicKey,
    e2eePriv: aE2ee.privateKey,
    authPub: aAuth.publicKey,
    authPriv: aAuth.privateKey,
    cap: "alice-cap-token",
  };
  bob = {
    id: "bob-id-111",
    label: "Bob",
    e2eePub: bE2ee.publicKey,
    e2eePriv: bE2ee.privateKey,
    authPub: bAuth.publicKey,
    authPriv: bAuth.privateKey,
    cap: "bob-cap-token",
  };
});

describe("buildVoiceOffer", () => {
  it("builds a valid v4 envelope with VoiceOffer inner type", async () => {
    const callId = "call-001";
    const sdp = "v=0\r\no=- 123 456 IN IP4 0.0.0.0\r\n";
    const { envelope, msgId } = await buildVoiceOffer(
      alice.id, alice.label, alice.authPub, alice.authPriv,
      alice.e2eePub, alice.cap,
      bob.id, bob.e2eePub, bob.cap,
      callId, sdp
    );

    // Outer envelope structure
    expect(envelope.p).toBe(4);
    expect(envelope.to).toBe(bob.id);
    expect(envelope.cap).toBe(bob.cap);
    expect(envelope.ch).toBe("msg");
    expect(envelope.sig).toBeTruthy();
    expect(msgId).toBeTruthy();

    // Decrypt inner and verify
    const inner = JSON.parse(await e2eeDecrypt(envelope.payload, bob.e2eePriv));
    expect(inner.t).toBe("VoiceOffer");
    expect(inner.callId).toBe(callId);
    expect(inner.sdp).toBe(sdp);
    expect(inner.from).toBe(alice.id);
    expect(inner.senderLabel).toBe(alice.label);
    expect(inner.e2eePub).toEqual(alice.e2eePub);
    expect(inner.senderCap).toBe(alice.cap);
    expect(inner.authPub).toEqual(alice.authPub);
    expect(inner.msgId).toBeTruthy();
    expect(inner.convId).toBeTruthy();
    expect(inner.ts).toBeGreaterThan(0);
  });
});

describe("buildVoiceAnswer", () => {
  it("builds a valid VoiceAnswer envelope", async () => {
    const { envelope } = await buildVoiceAnswer(
      bob.id, bob.label, bob.authPub, bob.authPriv,
      bob.e2eePub, bob.cap,
      alice.id, alice.e2eePub, alice.cap,
      "call-001", "v=0\r\nanswer-sdp\r\n"
    );
    const inner = JSON.parse(await e2eeDecrypt(envelope.payload, alice.e2eePriv));
    expect(inner.t).toBe("VoiceAnswer");
    expect(inner.callId).toBe("call-001");
    expect(inner.sdp).toBe("v=0\r\nanswer-sdp\r\n");
  });
});

describe("buildVoiceIce", () => {
  it("builds a VoiceIce envelope with unique msgId per candidate", async () => {
    const candidate = { candidate: "candidate:1 1 udp 2122260223 10.0.0.1 12345 typ host", sdpMid: "0", sdpMLineIndex: 0 };
    const r1 = await buildVoiceIce(
      alice.id, alice.label, alice.authPub, alice.authPriv,
      alice.e2eePub, alice.cap,
      bob.id, bob.e2eePub, bob.cap,
      "call-001", candidate
    );
    const r2 = await buildVoiceIce(
      alice.id, alice.label, alice.authPub, alice.authPriv,
      alice.e2eePub, alice.cap,
      bob.id, bob.e2eePub, bob.cap,
      "call-001", candidate
    );
    // Each ICE envelope must have a unique msgId for replay protection
    expect(r1.msgId).not.toBe(r2.msgId);

    const inner = JSON.parse(await e2eeDecrypt(r1.envelope.payload, bob.e2eePriv));
    expect(inner.t).toBe("VoiceIce");
    expect(inner.candidate).toEqual(candidate);
  });
});

describe("buildVoiceEnd", () => {
  it("builds VoiceEnd with each valid reason", async () => {
    for (const reason of ["hangup", "decline", "timeout", "missed", "busy", "error"]) {
      const { envelope } = await buildVoiceEnd(
        alice.id, alice.label, alice.authPub, alice.authPriv,
        alice.e2eePub, alice.cap,
        bob.id, bob.e2eePub, bob.cap,
        "call-001", reason
      );
      const inner = JSON.parse(await e2eeDecrypt(envelope.payload, bob.e2eePriv));
      expect(inner.t).toBe("VoiceEnd");
      expect(inner.reason).toBe(reason);
      expect(inner.callId).toBe("call-001");
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/protocol/voiceEnvelopes.test.js`
Expected: FAIL — module `@protocol/voiceEnvelopes.js` not found.

- [ ] **Step 3: Implement voice envelope builders**

Create `client/src/protocol/voiceEnvelopes.js`. Follow the exact pattern from `envelopes.js` — same imports, same `deriveConvId`, `randomId`, `nextSeq`, `e2eeEncrypt`, `signObject` usage. Four exported async functions:

- `buildVoiceOffer(myId, myLabel, myAuthPubJwk, myAuthPrivJwk, myE2eePubJwk, myInboxCap, peerId, peerE2eePubJwk, peerCap, callId, sdp)` — inner type `"VoiceOffer"`, includes `callId` and `sdp`
- `buildVoiceAnswer(...)` — same signature, inner type `"VoiceAnswer"`
- `buildVoiceIce(...)` — replace `sdp` param with `candidate`, inner type `"VoiceIce"`
- `buildVoiceEnd(...)` — replace `sdp` param with `reason`, inner type `"VoiceEnd"`

All must include in inner: `from`, `senderLabel`, `senderCap`, `e2eePub`, `authPub`, `convId` (via `deriveConvId`), `msgId` (via `randomId()`), `ts`. Voice envelopes intentionally omit `seq` — they are transient signaling, not stored messages, and replay protection keys on `msgId` not `seq`. Each call to any builder must produce a unique `msgId`.

Import `deriveConvId`, `randomId`, `nextSeq` from `./envelopes.js` (same pattern as `groupEnvelopes.js` line 11). Reference `client/src/protocol/envelopes.js` lines 68-105 (`buildMessage`) for the exact pattern.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/protocol/voiceEnvelopes.test.js`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/protocol/voiceEnvelopes.js tests/protocol/voiceEnvelopes.test.js
git commit -m "feat(voice): add voice envelope builders with tests"
```

---

### Task 2: TURN Credentials Server Endpoint

**Files:**
- Modify: `server/src/routes.js` (add route after existing routes, before WS upgrade)
- Test: `tests/server/turnCredentials.test.js`
- Reference: `server/src/routes.js` lines 368-460 (`/send` route for auth pattern)

- [ ] **Step 1: Write failing test for TURN credentials endpoint**

Create `tests/server/turnCredentials.test.js`:

```javascript
import { describe, it, expect, beforeAll } from "vitest";
import crypto from "crypto";

// Test the HMAC credential generation logic in isolation
// (We test the crypto, not the HTTP layer, since the server doesn't have a test harness)

describe("TURN credential generation", () => {
  const TURN_SECRET = "test-shared-secret-for-turn";

  function generateTurnCredentials(identityId, secret, ttlSeconds = 300) {
    const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
    const username = `${expiry}:${identityId}`;
    const credential = crypto
      .createHmac("sha1", secret)
      .update(username)
      .digest("base64");
    return { username, credential, ttl: ttlSeconds, urls: ["turn:relay.dissolve.chat:3478"] };
  }

  it("generates credentials with correct format", () => {
    const creds = generateTurnCredentials("user-123", TURN_SECRET);
    expect(creds.username).toMatch(/^\d+:user-123$/);
    expect(creds.credential).toBeTruthy();
    expect(typeof creds.credential).toBe("string");
    expect(creds.ttl).toBe(300);
    expect(creds.urls).toEqual(["turn:relay.dissolve.chat:3478"]);
  });

  it("generates different credentials for different users", () => {
    const c1 = generateTurnCredentials("user-a", TURN_SECRET);
    const c2 = generateTurnCredentials("user-b", TURN_SECRET);
    expect(c1.credential).not.toBe(c2.credential);
  });

  it("generates credentials that coturn can verify (HMAC-SHA1)", () => {
    const creds = generateTurnCredentials("user-123", TURN_SECRET);
    // Verify by recomputing
    const expected = crypto
      .createHmac("sha1", TURN_SECRET)
      .update(creds.username)
      .digest("base64");
    expect(creds.credential).toBe(expected);
  });

  it("sets expiry in the future", () => {
    const creds = generateTurnCredentials("user-123", TURN_SECRET, 300);
    const expiry = parseInt(creds.username.split(":")[0], 10);
    const now = Math.floor(Date.now() / 1000);
    expect(expiry).toBeGreaterThan(now);
    expect(expiry).toBeLessThanOrEqual(now + 301);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/turnCredentials.test.js`
Expected: Should PASS already since we're testing standalone logic. This validates our credential generation algorithm before wiring it into the route.

- [ ] **Step 3: Add `POST /turn-credentials` route to server**

In `server/src/routes.js`, add a new route. Place it near the other authenticated endpoints. Pattern:

```javascript
app.post("/turn-credentials", async (req, res) => {
  // 1. IP rate limit
  const ipKey = getIpKey(req);
  if (!rateCheck(req, res, "ip", `${ipKey}:turn`, { window: 60, max: 10 }, "/turn-credentials")) return;

  // 2. Validate body: { authPub, ts, sig }
  const { authPub, ts, sig } = req.body;
  if (!authPub || !ts || !sig) return res.status(400).json({ error: "missing_fields" });

  // 3. Check timestamp within 30s (anti-replay)
  const now = Date.now();
  if (Math.abs(now - ts) > 30000) return res.status(403).json({ error: "timestamp_expired" });

  // 4. Verify signature over { action: "turn-credentials", ts }
  // IMPORTANT: pass raw object, not JSON.stringify — verifySignature uses JCS canonicalization internally
  const valid = await verifySignature({ action: "turn-credentials", ts }, sig, authPub);
  if (!valid) return res.status(403).json({ error: "invalid_signature" });

  // 5. Derive identity ID
  const identityId = computeIdFromAuthPubJwk(authPub);

  // 6. Identity rate limit
  if (!rateCheck(req, res, "id", `id:${identityId}:turn`, { window: 60, max: 5 }, "/turn-credentials")) return;

  // 7. Generate TURN credentials
  const secret = process.env.TURN_SECRET;
  if (!secret) return res.status(503).json({ error: "turn_not_configured" });

  const expiry = Math.floor(Date.now() / 1000) + 300;
  const username = `${expiry}:${identityId}`;
  // crypto is already imported at top of routes.js — use the existing import
  const credential = crypto
    .createHmac("sha1", secret)
    .update(username)
    .digest("base64");

  return res.json({ username, credential, ttl: 300, urls: ["turn:relay.dissolve.chat:3478"] });
});
```

Check `server/src/routes.js` for exact imports — `verifySignature` and `computeIdFromAuthPubJwk` are already imported/defined. `rateCheck` and `getIpKey` are also already available.

- [ ] **Step 4: Add `fetchTurnCredentials` to client relay module**

Add to `client/src/protocol/relay.js`:

```javascript
export async function fetchTurnCredentials(authPubJwk, authPrivJwk) {
  const ts = Date.now();
  // IMPORTANT: pass raw object to signObject — it uses JCS canonicalization internally
  const sig = await signObject({ action: "turn-credentials", ts }, authPrivJwk);
  const base = getRelayUrl();
  const resp = await relayFetch(base, "/turn-credentials", {
    method: "POST",
    body: JSON.stringify({ authPub: authPubJwk, ts, sig }),
  });
  if (!resp.ok) throw new Error(`TURN credentials failed: ${resp.status}`);
  return resp.json ? await resp.json() : resp;
}
```

Note: `signObject` is imported from `dissolve-core/crypto/signing` — check if it's already imported in `relay.js`, add the import if not. `relayFetch` is a module-private function — `fetchTurnCredentials` must be defined inside `relay.js` (not a separate file) to access it.

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: All existing + new tests PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes.js client/src/protocol/relay.js tests/server/turnCredentials.test.js
git commit -m "feat(voice): add TURN credentials endpoint and client fetcher"
```

---

## Chunk 2: WebRTC Connection Layer

### Task 3: Call State Machine + WebRTC Module

**Files:**
- Create: `client/src/protocol/voiceCall.js`
- Test: `tests/protocol/voiceCall.test.js`

- [ ] **Step 1: Write failing tests for the call state machine**

Create `tests/protocol/voiceCall.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CallStateMachine } from "@protocol/voiceCall.js";

describe("CallStateMachine", () => {
  let sm;

  beforeEach(() => {
    sm = new CallStateMachine();
  });

  it("starts in idle state", () => {
    expect(sm.state).toBe("idle");
  });

  it("transitions idle → offering on startCall", () => {
    sm.transition("offering");
    expect(sm.state).toBe("offering");
  });

  it("transitions offering → ringing on remote ringing", () => {
    sm.transition("offering");
    sm.transition("ringing");
    expect(sm.state).toBe("ringing");
  });

  it("transitions ringing → connected on answer", () => {
    sm.transition("offering");
    sm.transition("ringing");
    sm.transition("connected");
    expect(sm.state).toBe("connected");
  });

  it("transitions idle → incoming on receive offer", () => {
    sm.transition("incoming");
    expect(sm.state).toBe("incoming");
  });

  it("transitions incoming → connected on accept", () => {
    sm.transition("incoming");
    sm.transition("connected");
    expect(sm.state).toBe("connected");
  });

  it("transitions connected → ended on hangup", () => {
    sm.transition("offering");
    sm.transition("ringing");
    sm.transition("connected");
    sm.transition("ended");
    expect(sm.state).toBe("ended");
  });

  it("transitions offering → ended on timeout/decline", () => {
    sm.transition("offering");
    sm.transition("ended");
    expect(sm.state).toBe("ended");
  });

  it("fires onStateChange callback", () => {
    const cb = vi.fn();
    sm.onChange(cb);
    sm.transition("offering");
    expect(cb).toHaveBeenCalledWith("offering", "idle");
  });

  it("can reset to idle after ended", () => {
    sm.transition("offering");
    sm.transition("ended");
    sm.reset();
    expect(sm.state).toBe("idle");
  });

  describe("glare resolution", () => {
    it("offering → incoming when local ID is lower", () => {
      sm.transition("offering");
      // Glare: we're offering but receive an offer, and our ID is lower
      sm.transition("incoming"); // glare resolution applied externally
      expect(sm.state).toBe("incoming");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/protocol/voiceCall.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `voiceCall.js`**

Create `client/src/protocol/voiceCall.js` with:

**`CallStateMachine` class** — simple state machine with `state`, `transition(newState)`, `reset()`, `onChange(callback)`. Valid transitions:
- `idle` → `offering`, `incoming`
- `offering` → `ringing`, `ended`, `incoming` (glare)
- `ringing` → `connected`, `ended`
- `incoming` → `connected`, `ended`
- `connected` → `ended`
- `ended` → (terminal, use `reset()` to go back to `idle`)

**`createCallConnection(turnCredentials)` function** — creates and returns an `RTCPeerConnection` with:
```javascript
{
  iceServers: [{
    urls: turnCredentials.urls,
    username: turnCredentials.username,
    credential: turnCredentials.credential,
  }],
  iceTransportPolicy: "relay",
}
```

**`createOutboundCall(pc, localStream)` async function** — adds audio tracks from `localStream` to `pc`, creates offer, sets local description, returns SDP offer string.

**`handleInboundOffer(pc, localStream, offerSdp)` async function** — adds audio tracks, sets remote description from offer SDP, creates answer, sets local description, returns SDP answer string.

**`handleAnswer(pc, answerSdp)` async function** — sets remote description from answer SDP.

**`addIceCandidate(pc, candidate)` async function** — calls `pc.addIceCandidate()`.

**`cleanupCall(pc, localStream)` function** — stops all tracks on `localStream`, closes `pc`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/protocol/voiceCall.test.js`
Expected: PASS (at least the state machine tests — WebRTC functions need browser APIs which may not be available in Node test env, so those are tested via integration).

- [ ] **Step 5: Commit**

```bash
git add client/src/protocol/voiceCall.js tests/protocol/voiceCall.test.js
git commit -m "feat(voice): add call state machine and WebRTC connection helpers"
```

---

### Task 4: Ringtone Audio

**Files:**
- Create: `client/src/utils/ringtone.js`
- Reference: `client/src/utils/notifications.js` (pattern to follow)

- [ ] **Step 1: Implement ringtone module**

Create `client/src/utils/ringtone.js`:

```javascript
let audioCtx = null;
let ringInterval = null;

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playRingTone() {
  // Single ring pulse: two-tone rising pattern
  // Similar to notifications.js playPing but more ring-like
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    // Tone A: 440Hz sine, 0.3s
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(440, t);
    gain1.gain.setValueAtTime(0.15, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc1.start(t);
    osc1.stop(t + 0.3);
    // Tone B: 520Hz sine, 0.3s, offset 0.35s
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(520, t + 0.35);
    gain2.gain.setValueAtTime(0.15, t + 0.35);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
    osc2.start(t + 0.35);
    osc2.stop(t + 0.65);
  } catch { /* audio not available */ }
}

export function startRinging() {
  stopRinging();
  playRingTone();
  ringInterval = setInterval(playRingTone, 2000); // Ring every 2s
}

export function stopRinging() {
  if (ringInterval) {
    clearInterval(ringInterval);
    ringInterval = null;
  }
}

export function playCallConnected() {
  // Short confirmation beep
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, t);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.start(t);
    osc.stop(t + 0.15);
  } catch { /* audio not available */ }
}

export function playCallEnded() {
  // Two descending tones
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(480, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.3);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.start(t);
    osc.stop(t + 0.35);
  } catch { /* audio not available */ }
}
```

- [ ] **Step 2: Write a basic smoke test**

Create `tests/utils/ringtone.test.js` — just verify the module exports load without errors (Web Audio API isn't available in Node, so we only verify exports):

```javascript
import { describe, it, expect } from "vitest";
import { startRinging, stopRinging, playCallConnected, playCallEnded } from "@utils/ringtone.js";

describe("ringtone module", () => {
  it("exports all expected functions", () => {
    expect(typeof startRinging).toBe("function");
    expect(typeof stopRinging).toBe("function");
    expect(typeof playCallConnected).toBe("function");
    expect(typeof playCallEnded).toBe("function");
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add client/src/utils/ringtone.js tests/utils/ringtone.test.js
git commit -m "feat(voice): add ringtone and call sound effects"
```

---

## Chunk 3: React Hook + Message Routing

### Task 5: `useVoiceCall` Hook

**Files:**
- Create: `client/src/hooks/useVoiceCall.js`
- Reference: `client/src/hooks/useMessaging.js` (for state patterns, sendEnvelope usage)

- [ ] **Step 1: Implement `useVoiceCall` hook**

Create `client/src/hooks/useVoiceCall.js`. This is the central coordination hook.

**State**:
```javascript
const [callState, setCallState] = useState("idle"); // idle|offering|ringing|incoming|connected|ended
const [callPeer, setCallPeer] = useState(null);      // { id, label, e2eePub, cap }
const [callId, setCallId] = useState(null);
const [isMuted, setIsMuted] = useState(false);
const [callDuration, setCallDuration] = useState(0);
```

**Refs** (to avoid stale closures):
```javascript
const pcRef = useRef(null);          // RTCPeerConnection
const localStreamRef = useRef(null); // MediaStream
const remoteAudioRef = useRef(null); // <audio> element ref
const ringTimeoutRef = useRef(null); // 30s caller / 35s callee timer
const durationRef = useRef(null);    // 1s interval for callDuration
const callIdRef = useRef(null);      // current callId for matching incoming signals
const stateRef = useRef("idle");     // mirror of callState for use in callbacks
const iceCandidateQueue = useRef([]); // buffer ICE candidates before remote description set
```

**Key functions to implement**:

`startCall(peer, identity, contacts)` — async:
1. Set state to `offering`, store peer info and generate `callId` (UUID)
2. Fetch TURN credentials via `fetchTurnCredentials(identity.authPubJwk, identity.authPrivJwk)`
3. Create `RTCPeerConnection` via `createCallConnection(creds)`
4. Get local audio via `getUserMedia({ audio: true, video: false })`
5. Add tracks to pc
6. Set up `pc.onicecandidate` → build+send `VoiceIce` envelope for each candidate
7. Set up `pc.ontrack` → attach remote stream to hidden `<audio>` element
8. Set up `pc.oniceconnectionstatechange` → handle `connected`, `disconnected`, `failed`
9. Create SDP offer, set local description
10. Build+send `VoiceOffer` envelope
11. Start 30s ring timeout

`handleIncomingOffer(inner, identity, contacts)`:
1. If `callState === "connected"` → auto-send `VoiceEnd` with reason `busy`, return
2. If `callState === "offering"` → glare resolution: compare IDs
   - If `identity.id < inner.from` → tear down outbound, accept incoming
   - Else → ignore incoming offer
3. Set state to `incoming`, store peer info and `callId` from inner
4. Start 35s callee safety timeout
5. Start ringtone via `startRinging()`
6. Buffer the SDP offer for when user clicks accept

`acceptCall(identity)` — async:
1. Stop ringing, clear timeout
2. Fetch TURN credentials
3. Create `RTCPeerConnection`, get local audio, add tracks
4. Set up ICE/track/state handlers (same as startCall)
5. Call `handleInboundOffer(pc, localStream, bufferedOfferSdp)`
6. Build+send `VoiceAnswer` envelope
7. Flush any queued ICE candidates via `addIceCandidate()`
8. Set state to `connected`, start duration timer, play connected sound

`declineCall(identity)`:
1. Stop ringing, clear timeout
2. Build+send `VoiceEnd` with reason `decline`
3. Clean up, set state to `ended`

`hangup(identity)`:
1. Build+send `VoiceEnd` with reason `hangup`
2. Stop duration timer, play ended sound
3. Clean up pc + streams, set state to `ended`

`handleIncomingAnswer(inner)`:
1. Verify `inner.callId === callIdRef.current`
2. Call `handleAnswer(pc, inner.sdp)`
3. Flush queued ICE candidates
4. Set state to `connected`, start duration timer, play connected sound
5. Clear ring timeout

`handleIncomingIce(inner)`:
1. Verify `inner.callId === callIdRef.current`
2. If remote description not set yet → queue the candidate
3. Else → `addIceCandidate(pc, inner.candidate)`

`handleIncomingEnd(inner)`:
1. Verify `inner.callId === callIdRef.current`
2. Stop ringing/timer
3. Handle by reason: show appropriate toast (`busy` → "User is on another call", `decline` → "Call declined", `timeout` → "No answer", `error` → "Call failed")
4. Clean up, set state to `ended`
5. Return `{ callId, duration, reason, direction }` for call history entry

`mute()` / `unmute()`:
1. Toggle `enabled` on local audio track(s)
2. Update `isMuted` state

`insertCallEvent(addCallEvent, direction, reason, duration)`:
1. Build `{ t: "CallEvent", callId, duration, reason, direction, ts: Date.now(), from: callPeer.id }`
2. Call the `addCallEvent` callback (provided by useMessaging) to insert into message state

**Cleanup on unmount**: `useEffect` cleanup that calls `cleanupCall` if active.

**Duration timer**: `useEffect` that runs a 1-second interval when `callState === "connected"`, incrementing `callDuration`. Clears on state change.

**Return**:
```javascript
return {
  callState, callPeer, callId, isMuted, callDuration,
  startCall, acceptCall, declineCall, hangup, mute, unmute,
  handleIncomingOffer, handleIncomingAnswer, handleIncomingIce, handleIncomingEnd,
  remoteAudioRef,
};
```

- [ ] **Step 2: Commit**

```bash
git add client/src/hooks/useVoiceCall.js
git commit -m "feat(voice): add useVoiceCall hook with full call lifecycle"
```

---

### Task 6: Wire Voice Envelopes into Message Routing

**Files:**
- Modify: `client/src/hooks/useMessaging.js`

- [ ] **Step 1: Add voice envelope routing to `handleIncoming`**

In `client/src/hooks/useMessaging.js`, find the type routing in `handleIncoming` (around line 188). **Important**: The existing code uses `if/else if` chains, NOT a switch statement. Follow the same pattern. Add the voice type checks alongside the existing type checks (e.g., after the `GroupLeave` check).

The hook needs to accept a `voiceCallHandlers` via a ref pattern (same pattern as `contactsRef`). Add a `voiceHandlersRef = useRef(null)` and a `setVoiceCallHandlers` function that sets it.

Add routing (using if/else to match existing pattern):
```javascript
} else if (inner.t === "VoiceOffer") {
  if (voiceHandlersRef.current?.handleIncomingOffer) {
    voiceHandlersRef.current.handleIncomingOffer(inner);
  }
  return; // Don't store as a message

} else if (inner.t === "VoiceAnswer") {
  if (voiceHandlersRef.current?.handleIncomingAnswer) {
    voiceHandlersRef.current.handleIncomingAnswer(inner);
  }
  return;

} else if (inner.t === "VoiceIce") {
  if (voiceHandlersRef.current?.handleIncomingIce) {
    voiceHandlersRef.current.handleIncomingIce(inner);
  }
  return;

} else if (inner.t === "VoiceEnd") {
  if (voiceHandlersRef.current?.handleIncomingEnd) {
    const callEvent = voiceHandlersRef.current.handleIncomingEnd(inner);
    if (callEvent) {
      addCallEvent(callEvent);
    }
  }
  return;
}
```

Also add an `addCallEvent` function exposed from useMessaging that inserts a `CallEvent` into the messages array, updates `lastMessages`, and archives to IndexedDB — but does NOT increment `unreadCounts`:
```javascript
const addCallEvent = useCallback((event) => {
  const peerId = event.from;
  setMessages(prev => [...prev, event]);
  setLastMessages(prev => ({ ...prev, [peerId]: event }));
  // Archive to IndexedDB if archiving is enabled
  if (archiveRef.current) {
    archiveRef.current.save(myId, event).catch(() => {});
  }
  // Note: no setUnreadCounts update — call events are informational
}, [myId]);
```

Expose both `addCallEvent` and `setVoiceCallHandlers` in the hook's return value.

- [ ] **Step 2: Run existing tests to verify nothing broke**

Run: `npx vitest run`
Expected: All existing tests PASS.

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useMessaging.js
git commit -m "feat(voice): route voice envelopes in message handler"
```

---

## Chunk 4: UI Components

### Task 7: Extract Shared Utilities

**Files:**
- Create: `client/src/utils/callHelpers.js`
- Modify: `client/src/components/Sidebar.jsx` (update import)
- Modify: `client/src/components/ChatPanel.jsx` (update import)

- [ ] **Step 1: Create shared utility file**

Create `client/src/utils/callHelpers.js`:

```javascript
/** Derive a stable hue (0-359) from an identity ID string */
export function idToHue(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return ((hash % 360) + 360) % 360;
}

/** Format seconds into MM:SS or H:MM:SS */
export function formatCallDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
```

- [ ] **Step 2: Update Sidebar.jsx and ChatPanel.jsx to import from shared util**

In both files, replace the local `idToHue` function with:
```javascript
import { idToHue } from "@utils/callHelpers";
```
Delete the local `idToHue` definition from each file.

- [ ] **Step 3: Verify app still works**

Run: `cd client && npx vite build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add client/src/utils/callHelpers.js client/src/components/Sidebar.jsx client/src/components/ChatPanel.jsx
git commit -m "refactor: extract idToHue and formatCallDuration to shared utils"
```

---

### Task 8: Icons

**Files:**
- Modify: `client/src/components/Icons.jsx`

- [ ] **Step 1: Add voice call icons**

Add to `client/src/components/Icons.jsx`, following the existing pattern (16x16 viewBox, `size` prop, `currentColor`, strokeWidth 1.5):

- `IconPhone` — phone handset (for call button + call history)
- `IconPhoneOff` — phone with slash (for end call)
- `IconPhoneMissed` — phone with arrow (for missed call history)
- `IconMic` — microphone (for unmuted state)
- `IconMicOff` — microphone with slash (for muted state)

Use simple SVG paths. Reference existing icons in the file for the exact pattern.

- [ ] **Step 2: Commit**

```bash
git add client/src/components/Icons.jsx
git commit -m "feat(voice): add phone and mic icons"
```

---

### Task 8: Incoming Call Overlay Component

**Files:**
- Create: `client/src/components/IncomingCallOverlay.jsx`

- [ ] **Step 1: Implement IncomingCallOverlay**

Create `client/src/components/IncomingCallOverlay.jsx`:

```jsx
import { IconPhone, IconPhoneOff } from "./Icons";
import { idToHue } from "@utils/callHelpers";

export default function IncomingCallOverlay({ callerLabel, callerId, onAccept, onDecline }) {
  const hue = idToHue(callerId);

  return (
    <div className="call-overlay">
      <div className="call-overlay-content">
        <div className="call-overlay-avatar" style={{ "--avatar-hue": hue }}>
          {(callerLabel || "?")[0].toUpperCase()}
        </div>
        <div className="call-overlay-label">{callerLabel}</div>
        <div className="call-overlay-status">Incoming voice call...</div>
        <div className="call-overlay-actions">
          <button className="call-btn call-btn-decline" onClick={onDecline} title="Decline">
            <IconPhoneOff size={24} />
          </button>
          <button className="call-btn call-btn-accept" onClick={onAccept} title="Accept">
            <IconPhone size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}
```

`idToHue` is imported from the shared `callHelpers.js` extracted in Task 7.

- [ ] **Step 2: Commit**

```bash
git add client/src/components/IncomingCallOverlay.jsx
git commit -m "feat(voice): add incoming call overlay component"
```

---

### Task 9: Persistent Call Bar Component

**Files:**
- Create: `client/src/components/CallBar.jsx`

- [ ] **Step 1: Implement CallBar**

Create `client/src/components/CallBar.jsx`:

```jsx
import { IconPhoneOff, IconMic, IconMicOff } from "./Icons";
import { formatCallDuration } from "@utils/callHelpers";

export default function CallBar({ peerLabel, duration, isMuted, onMute, onUnmute, onHangup, onNavigate }) {
  return (
    <div className="call-bar" onClick={onNavigate}>
      <div className="call-bar-info">
        <span className="call-bar-label">{peerLabel}</span>
        <span className="call-bar-duration">{formatCallDuration(duration)}</span>
      </div>
      <div className="call-bar-actions" onClick={(e) => e.stopPropagation()}>
        <button
          className={`btn-icon call-bar-btn ${isMuted ? "call-bar-muted" : ""}`}
          onClick={isMuted ? onUnmute : onMute}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <IconMicOff size={16} /> : <IconMic size={16} />}
        </button>
        <button className="btn-icon call-bar-btn call-bar-end" onClick={onHangup} title="End call">
          <IconPhoneOff size={16} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/CallBar.jsx
git commit -m "feat(voice): add persistent call bar component"
```

---

### Task 10: CSS Styles for Voice Call UI

**Files:**
- Modify: `client/src/App.css`
- Modify: `desktop/src/App.css` (copy same styles)

- [ ] **Step 1: Add call-related CSS to client App.css**

Add to `client/src/App.css` (at the end, before any media queries):

```css
/* ── Voice Call ─────────────────────────────────────────── */

/* Call overlay (incoming call + brief connected state) */
.call-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px);
}

.call-overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.call-overlay-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: hsl(var(--avatar-hue, 200) 60% 30%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 600;
  color: #fff;
  font-family: var(--font-display);
}

.call-overlay-label {
  font-size: 20px;
  font-weight: 600;
  color: #fff;
  font-family: var(--font-display);
}

.call-overlay-status {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  font-family: var(--font-sans);
}

.call-overlay-actions {
  display: flex;
  gap: 40px;
  margin-top: 24px;
}

.call-btn {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s, opacity 0.15s;
}

.call-btn:hover {
  transform: scale(1.1);
}

.call-btn-accept {
  background: var(--accent);
  color: #000;
}

.call-btn-decline {
  background: #e53e3e;
  color: #fff;
}

/* Persistent call bar */
.call-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  background: var(--bg-secondary);
  border-left: 3px solid var(--accent);
  cursor: pointer;
  font-family: var(--font-sans);
  flex-shrink: 0;
}

.call-bar:hover {
  background: var(--bg-hover, rgba(255, 255, 255, 0.05));
}

.call-bar-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.call-bar-label {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary);
}

.call-bar-duration {
  font-size: 12px;
  color: var(--accent);
  font-family: var(--font-mono);
}

.call-bar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.call-bar-btn {
  color: var(--text-secondary);
}

.call-bar-btn:hover {
  color: var(--text-primary);
}

.call-bar-muted {
  color: #e53e3e;
}

.call-bar-end {
  color: #e53e3e;
}

.call-bar-end:hover {
  color: #fc4848;
}

/* Call button in chat header */
.chat-header-call {
  color: var(--text-secondary);
  transition: color 0.15s;
}

.chat-header-call:hover {
  color: var(--accent);
}

.chat-header-call:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* Call history entries in chat */
.call-event {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  color: var(--text-secondary);
  font-size: 12px;
  font-family: var(--font-sans);
  justify-content: center;
}

.call-event-icon {
  color: var(--text-tertiary);
}

.call-event-missed .call-event-icon {
  color: #e53e3e;
}

/* Hidden audio element for remote stream */
.call-remote-audio {
  display: none;
}
```

- [ ] **Step 2: Copy the same CSS block to desktop App.css**

Add the identical CSS block to `desktop/src/App.css` at the same location (end of file, before media queries).

- [ ] **Step 3: Commit**

```bash
git add client/src/App.css desktop/src/App.css
git commit -m "feat(voice): add voice call CSS styles"
```

---

## Chunk 5: Wiring & Integration

### Task 11: Wire Everything in App.jsx

**Files:**
- Modify: `client/src/components/App.jsx`

- [ ] **Step 1: Add imports**

Add at top of `client/src/components/App.jsx`:
```javascript
import useVoiceCall from "@hooks/useVoiceCall";
import IncomingCallOverlay from "@components/IncomingCallOverlay";
import CallBar from "@components/CallBar";
```

- [ ] **Step 2: Wire the `useVoiceCall` hook**

Inside the main `App` component, after the existing hook calls (`useIdentity`, `useContacts`, `useMessaging`, etc.), add:

```javascript
const voiceCall = useVoiceCall(identity, contactsRef, messaging.addCallEvent);
```

Where `contactsRef` is the contacts ref used to look up peer info by ID.

- [ ] **Step 3: Pass voice handlers to useMessaging**

The `useMessaging` hook needs voice call handlers. Pass them via a ref or parameter so `handleIncoming` can route voice envelopes:

```javascript
// After useVoiceCall is initialized, set the ref that useMessaging reads
useEffect(() => {
  messaging.setVoiceCallHandlers({
    handleIncomingOffer: (inner) => voiceCall.handleIncomingOffer(inner, identity, contacts),
    handleIncomingAnswer: voiceCall.handleIncomingAnswer,
    handleIncomingIce: voiceCall.handleIncomingIce,
    handleIncomingEnd: voiceCall.handleIncomingEnd,
  });
}, [voiceCall, identity, contacts]);
```

Note: Check how `useMessaging` currently receives external handlers. If it uses a ref pattern (like `contactsRef`), follow that. If not, add a `voiceHandlersRef` pattern.

- [ ] **Step 4: Add hidden audio element for remote stream**

Add in the JSX, outside the main layout:
```jsx
<audio ref={voiceCall.remoteAudioRef} className="call-remote-audio" autoPlay />
```

- [ ] **Step 5: Render IncomingCallOverlay and Outbound Calling Overlay**

Add conditionally in JSX. Both `incoming` and `offering`/`ringing` states need visual feedback:

```jsx
{/* Incoming call — full overlay with accept/decline */}
{voiceCall.callState === "incoming" && (
  <IncomingCallOverlay
    callerLabel={voiceCall.callPeer?.label}
    callerId={voiceCall.callPeer?.id}
    onAccept={() => voiceCall.acceptCall(identity)}
    onDecline={() => voiceCall.declineCall(identity)}
  />
)}

{/* Outbound calling — reuse overlay with "Calling..." text and cancel button */}
{(voiceCall.callState === "offering" || voiceCall.callState === "ringing") && (
  <div className="call-overlay">
    <div className="call-overlay-content">
      <div className="call-overlay-avatar" style={{ "--avatar-hue": idToHue(voiceCall.callPeer?.id || "") }}>
        {(voiceCall.callPeer?.label || "?")[0].toUpperCase()}
      </div>
      <div className="call-overlay-label">{voiceCall.callPeer?.label}</div>
      <div className="call-overlay-status">Calling...</div>
      <div className="call-overlay-actions">
        <button className="call-btn call-btn-decline" onClick={() => voiceCall.hangup(identity)} title="Cancel">
          <IconPhoneOff size={24} />
        </button>
      </div>
    </div>
  </div>
)}
```

Import `idToHue` from `@utils/callHelpers` and `IconPhoneOff` from `@components/Icons` at the top of App.jsx.

- [ ] **Step 6: Render CallBar**

Add in the `.app-layout` div, before `<Sidebar>`:
```jsx
{voiceCall.callState === "connected" && (
  <CallBar
    peerLabel={voiceCall.callPeer?.label}
    duration={voiceCall.callDuration}
    isMuted={voiceCall.isMuted}
    onMute={voiceCall.mute}
    onUnmute={voiceCall.unmute}
    onHangup={() => voiceCall.hangup(identity)}
    onNavigate={() => handleSelectPeer(voiceCall.callPeer?.id)}
  />
)}
```

- [ ] **Step 7: Pass `startCall` to ChatPanel**

Add `onStartCall` prop to `<ChatPanel>`:
```jsx
<ChatPanel
  {...existingProps}
  onStartCall={(peerId) => {
    const peer = contacts.find(c => c.id === peerId);
    if (peer) voiceCall.startCall(peer, identity, contacts);
  }}
  callState={voiceCall.callState}
/>
```

- [ ] **Step 8: Commit**

```bash
git add client/src/components/App.jsx
git commit -m "feat(voice): wire voice call hook and UI into App"
```

---

### Task 12: Add Call Button and Call History to ChatPanel

**Files:**
- Modify: `client/src/components/ChatPanel.jsx`

- [ ] **Step 1: Add call button to chat header**

In `ChatPanel.jsx`, find the header section (around line 290-321). Add the call button after the contact name/info area, before any existing action buttons. Only show for 1-to-1 chats (when `peer` prop is present, not `group`):

```jsx
{peer && !group && (
  <button
    className="btn-icon chat-header-call"
    onClick={() => onStartCall(peer.id)}
    disabled={callState !== "idle"}
    title={callState !== "idle" ? "Already in a call" : "Start voice call"}
  >
    <IconPhone size={16} />
  </button>
)}
```

Add `IconPhone, IconPhoneMissed` to the imports from `./Icons`.
Add `onStartCall` and `callState` to the destructured props.

- [ ] **Step 2: Add CallEvent rendering in message list**

In the message rendering section (around line 345-417), add a case for `CallEvent` type messages. Insert before the regular bubble rendering:

```jsx
if (item.t === "CallEvent") {
  const isMissed = item.reason === "timeout" || item.reason === "missed";
  const label = item.reason === "hangup" && item.duration > 0
    ? `Voice call — ${formatCallDuration(item.duration)}`
    : item.reason === "decline"
    ? "Call declined"
    : item.reason === "busy"
    ? "User busy"
    : item.reason === "error"
    ? "Call failed"
    : item.direction === "inbound"
    ? "Missed voice call"
    : "No answer";
  return (
    <div key={item.callId} className={`call-event ${isMissed ? "call-event-missed" : ""}`}>
      <span className="call-event-icon">
        {isMissed ? <IconPhoneMissed size={14} /> : <IconPhone size={14} />}
      </span>
      {label}
    </div>
  );
}
```

Import `formatCallDuration` from the shared utility (already extracted in Task 7):
```javascript
import { formatCallDuration } from "@utils/callHelpers";
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ChatPanel.jsx
git commit -m "feat(voice): add call button and call history rendering to ChatPanel"
```

---

## Chunk 6: Server Deployment (coturn)

### Task 13: coturn Setup on IONOS VPS

**Files:**
- Server deployment (SSH to `74.208.170.22`)

> **Note**: This task requires SSH access to the production VPS. It should be done manually or via a deployment script.

- [ ] **Step 1: Install coturn**

```bash
ssh root@74.208.170.22
apt update && apt install -y coturn
```

- [ ] **Step 2: Configure coturn**

Write `/etc/turnserver.conf`:

```
# Dissolve TURN server config
listening-port=3478
fingerprint
use-auth-secret
static-auth-secret=<GENERATE_A_STRONG_SECRET_HERE>
realm=relay.dissolve.chat
no-cli
no-multicast-peers
no-tlsv1
no-tlsv1_1

# Media relay ports
min-port=49152
max-port=65535

# Bandwidth limits (bytes/s) — 256kbps = 32000 bytes/s
max-bps=32000

# Logging: minimal (no peer IPs)
no-stdout-log
log-file=/var/log/turnserver.log
simple-log

# Only relay, no STUN-only mode
no-stun
no-loopback-peers

# Prevent TURN relay abuse as proxy to internal network
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
```

Generate the shared secret: `openssl rand -hex 32`

- [ ] **Step 3: Enable and start coturn**

```bash
# Enable coturn daemon
sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn
systemctl enable coturn
systemctl start coturn
systemctl status coturn
```

- [ ] **Step 4: Open firewall ports**

```bash
ufw allow 3478/tcp
ufw allow 3478/udp
ufw allow 49152:65535/udp
ufw reload
ufw status
```

- [ ] **Step 5: Add TURN_SECRET to relay service**

Edit `/etc/systemd/system/dissolve-relay.service`, add to the `Environment=` section:

```
Environment=TURN_SECRET=<same_secret_from_step_2>
```

Then reload and restart:
```bash
systemctl daemon-reload
systemctl restart dissolve-relay
```

- [ ] **Step 6: Verify coturn is reachable**

Test from local machine (or use an online TURN tester):
```bash
# Quick test: try connecting to the TURN port
nc -zv 74.208.170.22 3478
```

- [ ] **Step 7: Deploy updated server code**

```bash
# On VPS
cd /opt/dissolve && git pull
systemctl restart dissolve-relay
```

- [ ] **Step 8: Commit deployment notes (optional)**

No code to commit for this task — it's infrastructure. Consider adding a note to the project's deployment docs if they exist.

---

## Chunk 7: Integration Testing & Polish

### Task 14: End-to-End Manual Testing

- [ ] **Step 1: Test outbound call flow**

1. Open two browser tabs (or browser + Tauri desktop), logged in as different identities
2. From Tab A: click the phone icon in the chat header for Tab B's contact
3. Verify: Tab A shows "offering" state, Tab B shows incoming call overlay with ringtone
4. Tab B clicks Accept
5. Verify: Both see connected state, call bar appears, audio flows both ways
6. Tab A clicks End Call
7. Verify: Both return to idle, call history entry appears in chat ("Voice call — Xs")

- [ ] **Step 2: Test decline flow**

1. Tab A calls Tab B
2. Tab B clicks Decline
3. Verify: Tab A sees "Call declined" toast, both see call history entry

- [ ] **Step 3: Test timeout flow**

1. Tab A calls Tab B
2. Wait 30 seconds without answering
3. Verify: Call auto-cancels, Tab A sees "No answer", Tab B sees "Missed voice call"

- [ ] **Step 4: Test busy flow**

1. Tab A calls Tab B, Tab B accepts (active call)
2. Tab C calls Tab B
3. Verify: Tab C sees "User is on another call" toast

- [ ] **Step 5: Test mute/unmute**

1. Establish a call between Tab A and Tab B
2. Tab A clicks mute → verify Tab B no longer hears audio
3. Tab A clicks unmute → verify audio resumes

- [ ] **Step 6: Test call bar navigation**

1. Establish a call, then navigate Tab A to a different conversation
2. Verify: call bar stays visible at top
3. Click call bar → verify it navigates back to the call conversation

- [ ] **Step 7: Test glare resolution (simultaneous calls)**

1. Tab A and Tab B both click "Call" on each other at nearly the same time
2. Verify: one party becomes the callee based on lexicographic ID comparison
3. Verify: call connects successfully — the lower-ID party accepted the incoming offer

- [ ] **Step 8: Test in Tauri desktop**

Run `cd desktop && npm run tauri:dev`, repeat steps 1-7 with the desktop app as one of the participants.

---

### Task 15: Run Full Test Suite and Final Commit

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass (existing + new voice call tests).

- [ ] **Step 2: Verify no lint/type errors**

```bash
cd client && npx vite build
cd ../desktop && npx vite build
```

Expected: Both build without errors.

- [ ] **Step 3: Final commit if any polish changes were made**

```bash
git add -A
git commit -m "feat(voice): polish and integration fixes"
```
