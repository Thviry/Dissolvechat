import { describe, it, expect } from "vitest";
import {
  b64uFromBytes,
  bytesFromB64u,
  sha256B64u,
  capHashFromCap,
  randomCap,
  randomId,
} from "dissolve-core/crypto/encoding";

describe("b64uFromBytes / bytesFromB64u", () => {
  it("roundtrips arbitrary bytes", () => {
    const original = new Uint8Array([0, 1, 127, 128, 255, 42, 99]);
    const encoded = b64uFromBytes(original);
    const decoded = bytesFromB64u(encoded);
    expect(decoded).toEqual(original);
  });

  it("roundtrips empty array", () => {
    const empty = new Uint8Array(0);
    expect(bytesFromB64u(b64uFromBytes(empty))).toEqual(empty);
  });

  it("produces no padding characters", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const encoded = b64uFromBytes(bytes);
    expect(encoded).not.toContain("=");
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
  });

  it("handles all padding lengths (1, 2, 3 byte inputs)", () => {
    for (let len = 1; len <= 4; len++) {
      const bytes = new Uint8Array(len).fill(0xab);
      expect(bytesFromB64u(b64uFromBytes(bytes))).toEqual(bytes);
    }
  });
});

describe("sha256B64u", () => {
  it("produces deterministic output", async () => {
    const data = new TextEncoder().encode("hello");
    const h1 = await sha256B64u(data);
    const h2 = await sha256B64u(data);
    expect(h1).toBe(h2);
  });

  it("different inputs produce different hashes", async () => {
    const enc = new TextEncoder();
    const h1 = await sha256B64u(enc.encode("hello"));
    const h2 = await sha256B64u(enc.encode("world"));
    expect(h1).not.toBe(h2);
  });
});

describe("capHashFromCap", () => {
  it("returns a string hash of a base64url cap", async () => {
    const cap = randomCap();
    const hash = await capHashFromCap(cap);
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("same cap produces same hash", async () => {
    const cap = randomCap();
    expect(await capHashFromCap(cap)).toBe(await capHashFromCap(cap));
  });
});

describe("randomCap", () => {
  it("produces 32-byte base64url strings", () => {
    const cap = randomCap();
    const bytes = bytesFromB64u(cap);
    expect(bytes.length).toBe(32);
  });

  it("produces unique values", () => {
    const a = randomCap();
    const b = randomCap();
    expect(a).not.toBe(b);
  });
});

describe("randomId", () => {
  it("produces unique values", () => {
    const a = randomId();
    const b = randomId();
    expect(a).not.toBe(b);
  });

  it("returns a string", () => {
    expect(typeof randomId()).toBe("string");
  });
});
