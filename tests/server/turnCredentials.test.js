import { describe, it, expect } from "vitest";
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
