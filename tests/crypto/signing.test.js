import { describe, it, expect } from "vitest";
import { signObject, verifyObject, jcs } from "dissolve-core/crypto/signing";

async function generateAuthKeypair() {
  const kp = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  return {
    pubJwk: await crypto.subtle.exportKey("jwk", kp.publicKey),
    privJwk: await crypto.subtle.exportKey("jwk", kp.privateKey),
  };
}

describe("jcs", () => {
  it("produces deterministic output regardless of key order", () => {
    const a = jcs({ b: 2, a: 1 });
    const b = jcs({ a: 1, b: 2 });
    expect(a).toBe(b);
  });

  it("returns a string", () => {
    expect(typeof jcs({ hello: "world" })).toBe("string");
  });
});

describe("signObject / verifyObject", () => {
  it("sign then verify succeeds", async () => {
    const { pubJwk, privJwk } = await generateAuthKeypair();
    const obj = { from: "alice", text: "hi", ts: Date.now() };
    const sig = await signObject(obj, privJwk);
    const ok = await verifyObject(obj, sig, pubJwk);
    expect(ok).toBe(true);
  });

  it("verify fails with wrong key", async () => {
    const alice = await generateAuthKeypair();
    const bob = await generateAuthKeypair();
    const obj = { data: "test" };
    const sig = await signObject(obj, alice.privJwk);
    const ok = await verifyObject(obj, sig, bob.pubJwk);
    expect(ok).toBe(false);
  });

  it("verify fails on tampered payload", async () => {
    const { pubJwk, privJwk } = await generateAuthKeypair();
    const obj = { data: "original" };
    const sig = await signObject(obj, privJwk);
    const ok = await verifyObject({ data: "tampered" }, sig, pubJwk);
    expect(ok).toBe(false);
  });

  it("works with CryptoKey (non-extractable) as signing key", async () => {
    const kp = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      false, // non-extractable
      ["sign", "verify"]
    );
    const pubJwk = await crypto.subtle.exportKey("jwk", kp.publicKey);
    const obj = { msg: "test" };
    const sig = await signObject(obj, kp.privateKey);
    expect(await verifyObject(obj, sig, pubJwk)).toBe(true);
  });

  it("signature is base64url string", async () => {
    const { privJwk } = await generateAuthKeypair();
    const sig = await signObject({ x: 1 }, privJwk);
    expect(typeof sig).toBe("string");
    expect(sig).not.toContain("=");
    expect(sig).not.toContain("+");
    expect(sig).not.toContain("/");
  });
});
