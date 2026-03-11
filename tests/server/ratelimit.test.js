import { describe, it, expect, beforeEach, afterEach } from "vitest";

// The rate limiter is CJS, use dynamic import
let RateLimiter, LIMITS, getIpKey;
beforeEach(async () => {
  const mod = await import("../../server/src/ratelimit.js");
  RateLimiter = mod.RateLimiter;
  LIMITS = mod.LIMITS;
  getIpKey = mod.getIpKey;
});

describe("RateLimiter", () => {
  let rl;

  beforeEach(() => {
    rl = new RateLimiter();
  });

  afterEach(() => {
    rl.destroy();
  });

  it("allows requests within limit", () => {
    for (let i = 0; i < 5; i++) {
      expect(rl.check("test-key", 5).allowed).toBe(true);
    }
  });

  it("blocks requests exceeding limit", () => {
    for (let i = 0; i < 5; i++) {
      rl.check("test-key", 5);
    }
    const result = rl.check("test-key", 5);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("different keys are independent", () => {
    for (let i = 0; i < 5; i++) {
      rl.check("key-a", 5);
    }
    expect(rl.check("key-a", 5).allowed).toBe(false);
    expect(rl.check("key-b", 5).allowed).toBe(true);
  });

  it("resets after window expires", async () => {
    const shortWindow = 50; // 50ms
    for (let i = 0; i < 3; i++) {
      rl.check("expire-test", 3, shortWindow);
    }
    expect(rl.check("expire-test", 3, shortWindow).allowed).toBe(false);

    await new Promise((r) => setTimeout(r, 60));
    expect(rl.check("expire-test", 3, shortWindow).allowed).toBe(true);
  });
});

describe("LIMITS", () => {
  it("has expected IP limits", () => {
    expect(LIMITS.IP_SEND).toBeGreaterThan(0);
    expect(LIMITS.IP_DRAIN).toBeGreaterThan(0);
    expect(LIMITS.IP_CAPS).toBeGreaterThan(0);
  });

  it("has expected identity limits", () => {
    expect(LIMITS.ID_SEND).toBeGreaterThan(0);
    expect(LIMITS.ID_DRAIN).toBeGreaterThan(0);
  });
});

describe("getIpKey", () => {
  it("uses req.ip when no forwarded header", () => {
    const req = { headers: {}, ip: "127.0.0.1" };
    const key = getIpKey(req);
    expect(key).toContain("ip:");
  });

  it("returns a key even with no IP info", () => {
    const req = { headers: {} };
    const key = getIpKey(req);
    expect(typeof key).toBe("string");
  });
});
