// client/src/protocol/voiceCall.js
// WebRTC connection management for voice calls.
// Handles RTCPeerConnection lifecycle, SDP offer/answer, ICE candidates.

const VALID_TRANSITIONS = {
  idle: ["offering", "incoming"],
  offering: ["ringing", "ended", "incoming"], // incoming = glare resolution
  ringing: ["connected", "ended"],
  incoming: ["connected", "ended"],
  connected: ["ended"],
  ended: [], // terminal — use reset() to go back to idle
};

export class CallStateMachine {
  constructor() {
    this.state = "idle";
    this._listeners = [];
  }

  transition(newState) {
    const allowed = VALID_TRANSITIONS[this.state];
    if (!allowed || !allowed.includes(newState)) {
      console.warn(`[CallSM] Invalid transition: ${this.state} → ${newState}`);
      return false;
    }
    const prev = this.state;
    this.state = newState;
    for (const cb of this._listeners) cb(newState, prev);
    return true;
  }

  reset() {
    const prev = this.state;
    this.state = "idle";
    for (const cb of this._listeners) cb("idle", prev);
  }

  onChange(callback) {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter(cb => cb !== callback);
    };
  }
}

export function createCallConnection(turnCredentials) {
  return new RTCPeerConnection({
    iceServers: [{
      urls: turnCredentials.urls,
      username: turnCredentials.username,
      credential: turnCredentials.credential,
    }],
    iceTransportPolicy: "relay",
  });
}

export async function createOutboundCall(pc, localStream) {
  for (const track of localStream.getAudioTracks()) {
    pc.addTrack(track, localStream);
  }
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  return offer.sdp;
}

export async function handleInboundOffer(pc, localStream, offerSdp) {
  for (const track of localStream.getAudioTracks()) {
    pc.addTrack(track, localStream);
  }
  await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: offerSdp }));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return answer.sdp;
}

export async function handleAnswer(pc, answerSdp) {
  await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: answerSdp }));
}

export async function addIceCandidate(pc, candidate) {
  await pc.addIceCandidate(new RTCIceCandidate(candidate));
}

export function cleanupCall(pc, localStream) {
  if (localStream) {
    for (const track of localStream.getTracks()) {
      track.stop();
    }
  }
  if (pc) {
    pc.close();
  }
}
