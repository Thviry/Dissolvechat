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
