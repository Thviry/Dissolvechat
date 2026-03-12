// client/src/protocol/voiceEnvelopes.js
// Build and sign voice call signaling envelopes.
// Voice envelopes flow through the existing E2EE envelope system —
// the relay treats them as normal encrypted messages.

import { signObject } from "dissolve-core/crypto/signing";
import { e2eeEncrypt } from "dissolve-core/crypto/e2ee";
import { randomId } from "dissolve-core/crypto";
import { deriveConvId } from "./envelopes";

const PROTOCOL_VERSION = 4;

async function buildVoiceEnvelope(
  myId, myLabel, myAuthPubJwk, myAuthPrivJwk, myE2eePubJwk,
  myInboxCap, peerId, peerE2eePubJwk, peerCap,
  type, extraFields
) {
  const convId = await deriveConvId(myId, peerId);
  const msgId = randomId();

  const inner = {
    t: type,
    alg: "ECDH-P256+AES256GCM",
    from: myId,
    senderLabel: myLabel,
    senderCap: myInboxCap,
    e2eePub: myE2eePubJwk,
    authPub: myAuthPubJwk,
    convId,
    msgId,
    ts: Date.now(),
    ...extraFields,
  };
  const payload = await e2eeEncrypt(JSON.stringify(inner), peerE2eePubJwk);

  const obj = {
    p: PROTOCOL_VERSION,
    to: peerId,
    cap: peerCap,
    ch: "msg",
    authPub: myAuthPubJwk,
    payload,
  };
  obj.sig = await signObject(obj, myAuthPrivJwk);
  return { envelope: obj, msgId };
}

export async function buildVoiceOffer(
  myId, myLabel, myAuthPubJwk, myAuthPrivJwk, myE2eePubJwk,
  myInboxCap, peerId, peerE2eePubJwk, peerCap,
  callId, sdp
) {
  return buildVoiceEnvelope(
    myId, myLabel, myAuthPubJwk, myAuthPrivJwk, myE2eePubJwk,
    myInboxCap, peerId, peerE2eePubJwk, peerCap,
    "VoiceOffer", { callId, sdp }
  );
}

export async function buildVoiceAnswer(
  myId, myLabel, myAuthPubJwk, myAuthPrivJwk, myE2eePubJwk,
  myInboxCap, peerId, peerE2eePubJwk, peerCap,
  callId, sdp
) {
  return buildVoiceEnvelope(
    myId, myLabel, myAuthPubJwk, myAuthPrivJwk, myE2eePubJwk,
    myInboxCap, peerId, peerE2eePubJwk, peerCap,
    "VoiceAnswer", { callId, sdp }
  );
}

export async function buildVoiceIce(
  myId, myLabel, myAuthPubJwk, myAuthPrivJwk, myE2eePubJwk,
  myInboxCap, peerId, peerE2eePubJwk, peerCap,
  callId, candidate
) {
  return buildVoiceEnvelope(
    myId, myLabel, myAuthPubJwk, myAuthPrivJwk, myE2eePubJwk,
    myInboxCap, peerId, peerE2eePubJwk, peerCap,
    "VoiceIce", { callId, candidate }
  );
}

export async function buildVoiceEnd(
  myId, myLabel, myAuthPubJwk, myAuthPrivJwk, myE2eePubJwk,
  myInboxCap, peerId, peerE2eePubJwk, peerCap,
  callId, reason
) {
  return buildVoiceEnvelope(
    myId, myLabel, myAuthPubJwk, myAuthPrivJwk, myE2eePubJwk,
    myInboxCap, peerId, peerE2eePubJwk, peerCap,
    "VoiceEnd", { callId, reason }
  );
}
