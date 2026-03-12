import { describe, it, expect, beforeAll } from "vitest";
import {
  buildVoiceOffer,
  buildVoiceAnswer,
  buildVoiceIce,
  buildVoiceEnd,
} from "@protocol/voiceEnvelopes.js";
import { e2eeDecrypt } from "dissolve-core/crypto/e2ee";

async function generateE2eeKeypair() {
  const kp = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );
  return {
    publicKey: await crypto.subtle.exportKey("jwk", kp.publicKey),
    privateKey: await crypto.subtle.exportKey("jwk", kp.privateKey),
  };
}

async function generateAuthKeypair() {
  const kp = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  return {
    publicKey: await crypto.subtle.exportKey("jwk", kp.publicKey),
    privateKey: await crypto.subtle.exportKey("jwk", kp.privateKey),
  };
}

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
