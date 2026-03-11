import { describe, it, expect } from "vitest";
import {
  generateGroupKey,
  generateGroupId,
  groupEncrypt,
  groupDecrypt,
  wrapGroupKey,
  unwrapGroupKey,
} from "dissolve-core/crypto/group";
import { bytesFromB64u } from "dissolve-core/crypto/encoding";

describe("generateGroupKey", () => {
  it("produces a 32-byte base64url key", async () => {
    const key = await generateGroupKey();
    expect(bytesFromB64u(key).length).toBe(32);
  });

  it("produces unique keys", async () => {
    const a = await generateGroupKey();
    const b = await generateGroupKey();
    expect(a).not.toBe(b);
  });
});

describe("generateGroupId", () => {
  it("produces a 32-byte base64url ID", () => {
    const id = generateGroupId();
    expect(bytesFromB64u(id).length).toBe(32);
  });
});

describe("groupEncrypt / groupDecrypt", () => {
  it("roundtrips plaintext", async () => {
    const key = await generateGroupKey();
    const plaintext = JSON.stringify({ text: "hello group" });
    const cipher = await groupEncrypt(plaintext, key);
    const result = await groupDecrypt(cipher, key);
    expect(result).toBe(plaintext);
  });

  it("fails with wrong key", async () => {
    const key1 = await generateGroupKey();
    const key2 = await generateGroupKey();
    const cipher = await groupEncrypt("secret", key1);
    await expect(groupDecrypt(cipher, key2)).rejects.toThrow();
  });

  it("produces different ciphertext each time (fresh IV)", async () => {
    const key = await generateGroupKey();
    const c1 = await groupEncrypt("same", key);
    const c2 = await groupEncrypt("same", key);
    expect(c1.iv).not.toBe(c2.iv);
    expect(c1.ct).not.toBe(c2.ct);
  });

  it("output has iv and ct fields", async () => {
    const key = await generateGroupKey();
    const cipher = await groupEncrypt("data", key);
    expect(cipher).toHaveProperty("iv");
    expect(cipher).toHaveProperty("ct");
  });
});

describe("wrapGroupKey / unwrapGroupKey", () => {
  it("roundtrips a group key via e2ee wrapping", async () => {
    const groupKey = await generateGroupKey();
    const kp = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey"]
    );
    const pubJwk = await crypto.subtle.exportKey("jwk", kp.publicKey);
    const privJwk = await crypto.subtle.exportKey("jwk", kp.privateKey);

    const wrapped = await wrapGroupKey(groupKey, pubJwk);
    const unwrapped = await unwrapGroupKey(wrapped, privJwk);
    expect(unwrapped).toBe(groupKey);
  });
});
