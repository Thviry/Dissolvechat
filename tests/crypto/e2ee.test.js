import { describe, it, expect } from "vitest";
import { e2eeEncrypt, e2eeDecrypt } from "dissolve-core/crypto/e2ee";

async function generateE2eeKeypair() {
  const kp = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );
  return {
    pubJwk: await crypto.subtle.exportKey("jwk", kp.publicKey),
    privJwk: await crypto.subtle.exportKey("jwk", kp.privateKey),
  };
}

describe("e2eeEncrypt / e2eeDecrypt", () => {
  it("roundtrips a message", async () => {
    const { pubJwk, privJwk } = await generateE2eeKeypair();
    const plaintext = "Hello, world!";
    const cipher = await e2eeEncrypt(plaintext, pubJwk);
    const result = await e2eeDecrypt(cipher, privJwk);
    expect(result).toBe(plaintext);
  });

  it("roundtrips unicode text", async () => {
    const { pubJwk, privJwk } = await generateE2eeKeypair();
    const plaintext = "Emoji: \u{1F600} and CJK: \u4F60\u597D";
    const cipher = await e2eeEncrypt(plaintext, pubJwk);
    expect(await e2eeDecrypt(cipher, privJwk)).toBe(plaintext);
  });

  it("roundtrips long text (>4096 bytes)", async () => {
    const { pubJwk, privJwk } = await generateE2eeKeypair();
    const plaintext = "x".repeat(5000);
    const cipher = await e2eeEncrypt(plaintext, pubJwk);
    expect(await e2eeDecrypt(cipher, privJwk)).toBe(plaintext);
  });

  it("fails to decrypt with wrong key", async () => {
    const sender = await generateE2eeKeypair();
    const wrong = await generateE2eeKeypair();
    const cipher = await e2eeEncrypt("secret", sender.pubJwk);
    await expect(e2eeDecrypt(cipher, wrong.privJwk)).rejects.toThrow();
  });

  it("fails on tampered ciphertext", async () => {
    const { pubJwk, privJwk } = await generateE2eeKeypair();
    const cipher = await e2eeEncrypt("secret", pubJwk);
    // Flip a byte in the ciphertext
    const ctBytes = Uint8Array.from(atob(cipher.ct.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    ctBytes[0] ^= 0xff;
    cipher.ct = btoa(String.fromCharCode(...ctBytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    await expect(e2eeDecrypt(cipher, privJwk)).rejects.toThrow();
  });

  it("produces different ciphertext each time (ephemeral keys)", async () => {
    const { pubJwk } = await generateE2eeKeypair();
    const c1 = await e2eeEncrypt("same", pubJwk);
    const c2 = await e2eeEncrypt("same", pubJwk);
    expect(c1.ct).not.toBe(c2.ct);
    expect(c1.epk.x).not.toBe(c2.epk.x);
  });

  it("output has expected shape", async () => {
    const { pubJwk } = await generateE2eeKeypair();
    const cipher = await e2eeEncrypt("test", pubJwk);
    expect(cipher).toHaveProperty("alg", "ECDH_P256_EPHEMERAL_AESGCM");
    expect(cipher).toHaveProperty("epk");
    expect(cipher).toHaveProperty("iv");
    expect(cipher).toHaveProperty("ct");
    expect(cipher.epk).toHaveProperty("kty", "EC");
  });
});
