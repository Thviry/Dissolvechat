import { describe, it, expect } from "vitest";
import {
  encryptPrivateData,
  decryptPrivateData,
} from "dissolve-core/crypto/keyfile";

describe("encryptPrivateData / decryptPrivateData", () => {
  it("roundtrips an object", async () => {
    const data = { secretKey: "abc123", name: "test" };
    const encrypted = await encryptPrivateData(data, "mypassphrase");
    const decrypted = await decryptPrivateData(encrypted, "mypassphrase");
    expect(decrypted).toEqual(data);
  });

  it("fails with wrong passphrase", async () => {
    const encrypted = await encryptPrivateData({ key: "val" }, "correct");
    await expect(decryptPrivateData(encrypted, "wrong")).rejects.toThrow();
  });

  it("output has salt, iv, ciphertext fields", async () => {
    const encrypted = await encryptPrivateData({ a: 1 }, "pass");
    expect(encrypted).toHaveProperty("salt");
    expect(encrypted).toHaveProperty("iv");
    expect(encrypted).toHaveProperty("ciphertext");
  });

  it("different encryptions produce different ciphertext", async () => {
    const data = { x: 1 };
    const a = await encryptPrivateData(data, "pass");
    const b = await encryptPrivateData(data, "pass");
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.salt).not.toBe(b.salt);
  });
});
