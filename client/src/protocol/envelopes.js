// client/src/protocol/envelopes.js
// Build and sign protocol envelopes for the Dissolve relay.
//
// Security model (v4-secure):
// - The outer envelope contains ONLY what the relay needs for routing:
//   `to`, `cap`, `ch` (channel hint), `authPub` (for sig verification), `sig`, `payload`
// - `from`, `t` (envelope type), `senderCap`, `senderLabel`, `e2eePub` are all
//   moved INSIDE the encrypted payload. The relay never sees them.
// - `payload` is an opaque encrypted blob (ECDH ephemeral + AES-GCM).

import { sha256B64u, enc, randomId, capHashFromCap, signObject } from "dissolve-core/crypto";
import { e2eeEncrypt } from "dissolve-core/crypto/e2ee";

/**
 * Build a signed CapsUpdate envelope.
 * (This is NOT an encrypted message — it's an identity management operation.)
 */
export async function buildCapsUpdate(myId, myAuthPubJwk, myAuthPrivJwk, capHashes) {
  const obj = {
    p: 4,
    t: "CapsUpdate",
    ts: Date.now(),
    from: myId,
    to: myId,
    body: {
      authPub: myAuthPubJwk,
      capHashes,
      replace: true,
    },
  };
  obj.sig = await signObject(obj, myAuthPrivJwk);
  return obj;
}

/**
 * Build a signed directory publish request.
 */
export async function buildDirectoryPublish(handle, profile, myAuthPrivJwk) {
  const obj = { handle, profile };
  const sig = await signObject(obj, myAuthPrivJwk);
  return { ...obj, sig };
}

/**
 * Get or increment the monotonic sequence number for a conversation.
 */
export function nextSeq(myId, convId, suffix = "") {
  const key = `seq:${myId}:${convId}${suffix ? `:${suffix}` : ""}`;
  const next = (Number(localStorage.getItem(key) || "0") || 0) + 1;
  localStorage.setItem(key, String(next));
  return next;
}

/**
 * Derive a deterministic conversation ID from two participant IDs.
 */
export async function deriveConvId(idA, idB) {
  const seed = [idA, idB].sort().join("|");
  return sha256B64u(enc.encode(seed));
}

/**
 * Build a signed, metadata-minimal Message envelope.
 *
 * Cleartext (relay sees): to, cap, ch, authPub, payload (opaque ciphertext), sig
 * Encrypted (only recipient sees): from, t, senderCap, senderLabel, e2eePub, convId, seq, msgId, text
 */
export async function buildMessage(
  myId, myLabel, myAuthPubJwk, myAuthPrivJwk, myE2eePubJwk,
  myInboxCap, peer, plaintext, file
) {
  const convId = await deriveConvId(myId, peer.id);
  const seq = nextSeq(myId, convId);
  const msgId = randomId();

  // Everything the recipient needs goes into the encrypted payload
  const inner = {
    t: "Message",
    from: myId,
    senderLabel: myLabel,
    senderCap: myInboxCap,
    e2eePub: myE2eePubJwk,
    authPub: myAuthPubJwk,
    convId,
    seq,
    msgId,
    text: plaintext,
    ts: Date.now(),
    ...(file ? { file } : {}),
  };
  const payload = await e2eeEncrypt(JSON.stringify(inner), peer.e2eePublicJwk);

  // Outer envelope: minimal metadata for relay routing
  const obj = {
    p: 4,
    to: peer.id,
    cap: peer.cap,
    ch: "msg",        // channel hint for relay (not a privacy-sensitive field)
    authPub: myAuthPubJwk,  // needed for relay signature verification
    payload,
  };
  obj.sig = await signObject(obj, myAuthPrivJwk);
  return { envelope: obj, msgId, ts: inner.ts };
}

/**
 * Build a signed ContactRequest envelope.
 */
export async function buildContactRequest(
  myId, myLabel, myAuthPubJwk, myAuthPrivJwk, myE2eePubJwk,
  myInboxCap, recipient
) {
  const convId = await deriveConvId(myId, recipient.id);
  const seq = nextSeq(myId, convId, "req");

  const inner = {
    t: "ContactRequest",
    from: myId,
    senderLabel: myLabel,
    senderCap: myInboxCap,
    e2eePub: myE2eePubJwk,
    authPub: myAuthPubJwk,
    convId,
    seq,
    msgId: randomId(),
    note: "Hi! I'd like to connect on Dissolve.",
    ts: Date.now(),
  };
  const payload = await e2eeEncrypt(JSON.stringify(inner), recipient.e2eePublicJwk);

  const obj = {
    p: 4,
    to: recipient.id,
    cap: recipient.requestCap,
    ch: "req",        // tells relay to use request inbox
    authPub: myAuthPubJwk,
    payload,
  };
  obj.sig = await signObject(obj, myAuthPrivJwk);
  return obj;
}

/**
 * Build a signed ContactGrant envelope.
 */
export async function buildContactGrant(
  myId, myLabel, myAuthPubJwk, myAuthPrivJwk, myE2eePubJwk,
  myInboxCap, recipient
) {
  const convId = await deriveConvId(myId, recipient.id);
  const seq = nextSeq(myId, convId, "grant");

  const card = {
    dissolveProtocol: 4,
    v: 4,
    id: myId,
    label: myLabel,
    authPublicJwk: myAuthPubJwk,
    e2eePublicJwk: myE2eePubJwk,
    cap: myInboxCap,
    createdAt: new Date().toISOString(),
  };

  const inner = {
    t: "ContactGrant",
    from: myId,
    senderLabel: myLabel,
    senderCap: myInboxCap,
    e2eePub: myE2eePubJwk,
    authPub: myAuthPubJwk,
    convId,
    seq,
    msgId: randomId(),
    card,
    ts: Date.now(),
  };
  const payload = await e2eeEncrypt(JSON.stringify(inner), recipient.e2eePublicJwk);

  const obj = {
    p: 4,
    to: recipient.id,
    cap: recipient.cap,
    ch: "msg",
    authPub: myAuthPubJwk,
    payload,
  };
  obj.sig = await signObject(obj, myAuthPrivJwk);
  return obj;
}

/**
 * Build a signed block request.
 */
export async function buildBlockRequest(myId, myAuthPubJwk, myAuthPrivJwk, fromId, capHash) {
  const obj = {
    fromId,
    capHash: capHash || undefined,
    authPub: myAuthPubJwk,
  };
  obj.sig = await signObject(obj, myAuthPrivJwk);
  return obj;
}

/**
 * Build a signed inbox drain request (Fix #1: authenticated drain).
 */
export async function buildInboxDrain(myId, myAuthPubJwk, myAuthPrivJwk) {
  const obj = {
    ts: Date.now(),
    authPub: myAuthPubJwk,
  };
  obj.sig = await signObject(obj, myAuthPrivJwk);
  return obj;
}
