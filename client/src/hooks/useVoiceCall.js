// client/src/hooks/useVoiceCall.js
// Manages voice call state, WebRTC lifecycle, and signaling.

import { useState, useRef, useEffect, useCallback } from "react";
import { fetchTurnCredentials, sendEnvelope } from "@protocol/relay";
import {
  buildVoiceOffer,
  buildVoiceAnswer,
  buildVoiceIce,
  buildVoiceEnd,
} from "@protocol/voiceEnvelopes";
import {
  CallStateMachine,
  createCallConnection,
  createOutboundCall,
  handleInboundOffer,
  handleAnswer,
  addIceCandidate,
  cleanupCall,
} from "@protocol/voiceCall";
import { startRinging, stopRinging, playCallConnected, playCallEnded } from "@utils/ringtone";

const RING_TIMEOUT_CALLER = 30000;
const RING_TIMEOUT_CALLEE = 35000;
const ICE_TIMEOUT = 15000;
const DISCONNECT_TIMEOUT = 5000;

export default function useVoiceCall(identity, contactsRef, addCallEvent) {
  const [callState, setCallState] = useState("idle");
  const [callPeer, setCallPeer] = useState(null);
  const [callId, setCallId] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const ringTimeoutRef = useRef(null);
  const durationRef = useRef(null);
  const callIdRef = useRef(null);
  const stateRef = useRef("idle");
  const iceCandidateQueue = useRef([]);
  const smRef = useRef(new CallStateMachine());
  const offerSdpRef = useRef(null);
  const iceTimeoutRef = useRef(null);
  const disconnectTimeoutRef = useRef(null);
  const callStartRef = useRef(null);
  const directionRef = useRef(null);

  // Keep stateRef in sync
  useEffect(() => { stateRef.current = callState; }, [callState]);

  // Duration timer
  useEffect(() => {
    if (callState === "connected") {
      callStartRef.current = Date.now();
      setCallDuration(0);
      durationRef.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartRef.current) / 1000));
      }, 1000);
    } else {
      if (durationRef.current) {
        clearInterval(durationRef.current);
        durationRef.current = null;
      }
    }
    return () => {
      if (durationRef.current) {
        clearInterval(durationRef.current);
        durationRef.current = null;
      }
    };
  }, [callState]);

  const cleanup = useCallback(() => {
    stopRinging();
    clearTimeout(ringTimeoutRef.current);
    clearTimeout(iceTimeoutRef.current);
    clearTimeout(disconnectTimeoutRef.current);
    ringTimeoutRef.current = null;
    iceTimeoutRef.current = null;
    disconnectTimeoutRef.current = null;
    cleanupCall(pcRef.current, localStreamRef.current);
    pcRef.current = null;
    localStreamRef.current = null;
    iceCandidateQueue.current = [];
    offerSdpRef.current = null;
  }, []);

  const endCall = useCallback((reason) => {
    const duration = callStartRef.current
      ? Math.floor((Date.now() - callStartRef.current) / 1000)
      : 0;
    const peer = callPeer;
    const direction = directionRef.current;
    const cid = callIdRef.current;

    cleanup();
    smRef.current.reset();
    setCallState("idle");
    setCallPeer(null);
    setCallId(null);
    setIsMuted(false);
    setCallDuration(0);
    callIdRef.current = null;
    directionRef.current = null;
    callStartRef.current = null;

    if (reason !== "busy" && peer && cid && addCallEvent) {
      addCallEvent({
        t: "CallEvent",
        callId: cid,
        duration: reason === "hangup" ? duration : 0,
        reason,
        direction: direction || "outbound",
        ts: Date.now(),
        from: peer.id,
        peerId: peer.id,
      });
    }

    if (reason === "hangup" && duration > 0) {
      playCallEnded();
    }
  }, [callPeer, cleanup, addCallEvent]);

  // Helper to send a voice envelope
  const sendVoice = useCallback(async (builder, peer, ...args) => {
    if (!identity?.isReady) return;
    const { envelope } = await builder(
      identity.id, identity.label, identity.authPubJwk, identity.authPrivKey,
      identity.e2eePubJwk, identity.inboxCap,
      peer.id, peer.e2eePublicJwk, peer.cap,
      ...args
    );
    await sendEnvelope(envelope);
  }, [identity]);

  const setupPcHandlers = useCallback((pc, peer) => {
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        try {
          await sendVoice(buildVoiceIce, peer, callIdRef.current, event.candidate.toJSON());
        } catch (err) {
          console.warn("[Voice] Failed to send ICE candidate:", err.message);
        }
      }
    };

    pc.ontrack = (event) => {
      if (remoteAudioRef.current && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
    };

    // ICE connection timeout
    iceTimeoutRef.current = setTimeout(() => {
      if (stateRef.current === "offering" || stateRef.current === "ringing") {
        // No ICE connection established
        sendVoice(buildVoiceEnd, peer, callIdRef.current, "error").catch(() => {});
        endCall("error");
      }
    }, ICE_TIMEOUT);

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === "connected" || state === "completed") {
        clearTimeout(iceTimeoutRef.current);
        clearTimeout(disconnectTimeoutRef.current);
      } else if (state === "disconnected") {
        disconnectTimeoutRef.current = setTimeout(() => {
          if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
            sendVoice(buildVoiceEnd, peer, callIdRef.current, "error").catch(() => {});
            endCall("error");
          }
        }, DISCONNECT_TIMEOUT);
      } else if (state === "failed") {
        sendVoice(buildVoiceEnd, peer, callIdRef.current, "error").catch(() => {});
        endCall("error");
      }
    };
  }, [sendVoice, endCall]);

  const startCall = useCallback(async (peer) => {
    if (stateRef.current !== "idle") return;
    if (!identity?.isReady) return;

    // Fetch TURN credentials before showing call UI to avoid flash on failure
    let creds;
    try {
      creds = await fetchTurnCredentials(identity.authPubJwk, identity.authPrivKey);
    } catch (err) {
      console.error("[Voice] Failed to get TURN credentials:", err);
      return { error: "turn_failed" };
    }

    const newCallId = crypto.randomUUID();
    callIdRef.current = newCallId;
    directionRef.current = "outbound";
    smRef.current.reset();
    smRef.current.transition("offering");
    setCallState("offering");
    setCallPeer(peer);
    setCallId(newCallId);
    setIsMuted(false);
    setCallDuration(0);

    try {
      const pc = createCallConnection(creds);
      pcRef.current = pc;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      setupPcHandlers(pc, peer);

      const sdp = await createOutboundCall(pc, stream);
      await sendVoice(buildVoiceOffer, peer, newCallId, sdp);

      // Ring timeout
      ringTimeoutRef.current = setTimeout(() => {
        if (stateRef.current === "offering" || stateRef.current === "ringing") {
          sendVoice(buildVoiceEnd, peer, callIdRef.current, "timeout").catch(() => {});
          endCall("timeout");
        }
      }, RING_TIMEOUT_CALLER);
    } catch (err) {
      console.error("[Voice] Failed to start call:", err);
      cleanup();
      smRef.current.reset();
      setCallState("idle");
      setCallPeer(null);
      setCallId(null);
    }
  }, [identity, sendVoice, setupPcHandlers, endCall, cleanup]);

  const handleIncomingOffer = useCallback((inner) => {
    if (!identity?.isReady) return;

    // Busy: already in a connected call
    if (stateRef.current === "connected") {
      const peer = contactsRef?.current?.find(c => c.id === inner.from);
      if (peer) {
        sendVoice(buildVoiceEnd, peer, inner.callId, "busy").catch(() => {});
      }
      return;
    }

    // Glare resolution: both offering simultaneously
    if (stateRef.current === "offering") {
      if (identity.id < inner.from) {
        // Our ID is lower — we become callee, tear down outbound
        cleanup();
        smRef.current.reset();
      } else {
        // Our ID is higher — ignore incoming, they'll accept ours
        return;
      }
    }

    if (stateRef.current !== "idle" && stateRef.current !== "offering") return;

    const peer = contactsRef?.current?.find(c => c.id === inner.from) || {
      id: inner.from,
      label: inner.senderLabel,
      e2eePublicJwk: inner.e2eePub,
      cap: inner.senderCap,
    };

    callIdRef.current = inner.callId;
    directionRef.current = "inbound";
    offerSdpRef.current = inner.sdp;
    smRef.current.transition("incoming");
    setCallState("incoming");
    setCallPeer(peer);
    setCallId(inner.callId);

    startRinging();

    // Callee safety timeout
    ringTimeoutRef.current = setTimeout(() => {
      if (stateRef.current === "incoming") {
        stopRinging();
        endCall("missed");
      }
    }, RING_TIMEOUT_CALLEE);
  }, [identity, contactsRef, sendVoice, cleanup, endCall]);

  const acceptCall = useCallback(async () => {
    if (stateRef.current !== "incoming") return;
    if (!identity?.isReady) return;

    stopRinging();
    clearTimeout(ringTimeoutRef.current);

    const peer = callPeer;
    const savedSdp = offerSdpRef.current;

    try {
      const creds = await fetchTurnCredentials(identity.authPubJwk, identity.authPrivKey);
      const pc = createCallConnection(creds);
      pcRef.current = pc;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      setupPcHandlers(pc, peer);

      const answerSdp = await handleInboundOffer(pc, stream, savedSdp);
      await sendVoice(buildVoiceAnswer, peer, callIdRef.current, answerSdp);

      // Flush queued ICE candidates
      for (const c of iceCandidateQueue.current) {
        try { await addIceCandidate(pc, c); } catch { /* ignore */ }
      }
      iceCandidateQueue.current = [];

      smRef.current.transition("connected");
      setCallState("connected");
      playCallConnected();
    } catch (err) {
      console.error("[Voice] Failed to accept call:", err);
      sendVoice(buildVoiceEnd, peer, callIdRef.current, "error").catch(() => {});
      endCall("error");
    }
  }, [identity, callPeer, sendVoice, setupPcHandlers, endCall]);

  const declineCall = useCallback(() => {
    if (stateRef.current !== "incoming") return;
    stopRinging();
    clearTimeout(ringTimeoutRef.current);
    const peer = callPeer;
    if (peer) {
      sendVoice(buildVoiceEnd, peer, callIdRef.current, "decline").catch(() => {});
    }
    endCall("decline");
  }, [callPeer, sendVoice, endCall]);

  const hangup = useCallback(() => {
    if (stateRef.current === "idle" || stateRef.current === "ended") return;
    const peer = callPeer;
    if (peer) {
      sendVoice(buildVoiceEnd, peer, callIdRef.current, "hangup").catch(() => {});
    }
    endCall("hangup");
  }, [callPeer, sendVoice, endCall]);

  const handleIncomingAnswer = useCallback(async (inner) => {
    if (inner.callId !== callIdRef.current) return;
    if (!pcRef.current) return;

    try {
      await handleAnswer(pcRef.current, inner.sdp);

      // Flush queued ICE candidates
      for (const c of iceCandidateQueue.current) {
        try { await addIceCandidate(pcRef.current, c); } catch { /* ignore */ }
      }
      iceCandidateQueue.current = [];

      clearTimeout(ringTimeoutRef.current);
      smRef.current.transition("connected");
      setCallState("connected");
      playCallConnected();
    } catch (err) {
      console.error("[Voice] Failed to handle answer:", err);
    }
  }, []);

  const handleIncomingIce = useCallback(async (inner) => {
    if (inner.callId !== callIdRef.current) return;
    if (!pcRef.current || !pcRef.current.remoteDescription) {
      iceCandidateQueue.current.push(inner.candidate);
      return;
    }
    try {
      await addIceCandidate(pcRef.current, inner.candidate);
    } catch (err) {
      console.warn("[Voice] Failed to add ICE candidate:", err.message);
    }
  }, []);

  const handleIncomingEnd = useCallback((inner) => {
    if (inner.callId !== callIdRef.current) return;
    stopRinging();
    endCall(inner.reason || "hangup");
    return null; // call event already inserted by endCall
  }, [endCall]);

  const mute = useCallback(() => {
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getAudioTracks()) {
        track.enabled = false;
      }
      setIsMuted(true);
    }
  }, []);

  const unmute = useCallback(() => {
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getAudioTracks()) {
        track.enabled = true;
      }
      setIsMuted(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      clearInterval(durationRef.current);
    };
  }, [cleanup]);

  return {
    callState, callPeer, callId, isMuted, callDuration,
    startCall, acceptCall, declineCall, hangup, mute, unmute,
    handleIncomingOffer, handleIncomingAnswer, handleIncomingIce, handleIncomingEnd,
    remoteAudioRef,
  };
}
