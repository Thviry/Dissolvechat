import { describe, it, expect, vi, beforeEach } from "vitest";
import { CallStateMachine } from "@protocol/voiceCall.js";

describe("CallStateMachine", () => {
  let sm;

  beforeEach(() => {
    sm = new CallStateMachine();
  });

  it("starts in idle state", () => {
    expect(sm.state).toBe("idle");
  });

  it("transitions idle → offering on startCall", () => {
    sm.transition("offering");
    expect(sm.state).toBe("offering");
  });

  it("transitions offering → ringing on remote ringing", () => {
    sm.transition("offering");
    sm.transition("ringing");
    expect(sm.state).toBe("ringing");
  });

  it("transitions ringing → connected on answer", () => {
    sm.transition("offering");
    sm.transition("ringing");
    sm.transition("connected");
    expect(sm.state).toBe("connected");
  });

  it("transitions idle → incoming on receive offer", () => {
    sm.transition("incoming");
    expect(sm.state).toBe("incoming");
  });

  it("transitions incoming → connected on accept", () => {
    sm.transition("incoming");
    sm.transition("connected");
    expect(sm.state).toBe("connected");
  });

  it("transitions connected → ended on hangup", () => {
    sm.transition("offering");
    sm.transition("ringing");
    sm.transition("connected");
    sm.transition("ended");
    expect(sm.state).toBe("ended");
  });

  it("transitions offering → ended on timeout/decline", () => {
    sm.transition("offering");
    sm.transition("ended");
    expect(sm.state).toBe("ended");
  });

  it("fires onStateChange callback", () => {
    const cb = vi.fn();
    sm.onChange(cb);
    sm.transition("offering");
    expect(cb).toHaveBeenCalledWith("offering", "idle");
  });

  it("can reset to idle after ended", () => {
    sm.transition("offering");
    sm.transition("ended");
    sm.reset();
    expect(sm.state).toBe("idle");
  });

  describe("glare resolution", () => {
    it("offering → incoming when local ID is lower", () => {
      sm.transition("offering");
      // Glare: we're offering but receive an offer, and our ID is lower
      sm.transition("incoming"); // glare resolution applied externally
      expect(sm.state).toBe("incoming");
    });
  });
});
