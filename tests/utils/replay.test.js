import { describe, it, expect, beforeEach } from "vitest";

// Mock localStorage for Node environment
const store = {};
const mockLocalStorage = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, val) => { store[key] = val; },
  removeItem: (key) => { delete store[key]; },
  clear: () => { for (const k in store) delete store[k]; },
};
globalThis.localStorage = mockLocalStorage;

import { checkAndUpdateReplay } from "../../client/src/utils/storage.js";

describe("checkAndUpdateReplay", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  it("accepts first message with a given msgId", () => {
    const ok = checkAndUpdateReplay("me", "sender", "conv1", "msg-001", "Message");
    expect(ok).toBe(true);
  });

  it("rejects duplicate msgId", () => {
    checkAndUpdateReplay("me", "sender", "conv1", "msg-001", "Message");
    const ok = checkAndUpdateReplay("me", "sender", "conv1", "msg-001", "Message");
    expect(ok).toBe(false);
  });

  it("accepts different msgIds from same sender/conv", () => {
    expect(checkAndUpdateReplay("me", "sender", "conv1", "msg-001", "Message")).toBe(true);
    expect(checkAndUpdateReplay("me", "sender", "conv1", "msg-002", "Message")).toBe(true);
  });

  it("different envelope types are independent", () => {
    expect(checkAndUpdateReplay("me", "sender", "conv1", "msg-001", "Message")).toBe(true);
    expect(checkAndUpdateReplay("me", "sender", "conv1", "msg-001", "GroupMessage")).toBe(true);
  });

  it("rejects when convId is not a string", () => {
    expect(checkAndUpdateReplay("me", "sender", undefined, "msg-001", "Message")).toBe(false);
    expect(checkAndUpdateReplay("me", "sender", null, "msg-001", "Message")).toBe(false);
  });

  it("handles sliding window (does not grow unbounded)", () => {
    // Fill up to MAX_SEEN_IDS (500) + some extra
    for (let i = 0; i < 510; i++) {
      checkAndUpdateReplay("me", "sender", "conv1", `msg-${i}`, "Message");
    }
    // Early entries should have been evicted
    const ok = checkAndUpdateReplay("me", "sender", "conv1", "msg-0", "Message");
    expect(ok).toBe(true); // should be accepted again since it was evicted
  });
});
