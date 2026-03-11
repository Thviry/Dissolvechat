// client/src/protocol/groupEnvelopes.js
// Build and sign group protocol envelopes.
// Group messages use a two-layer encryption:
//   1. Inner: AES-256-GCM with shared group key
//   2. Outer: Per-member e2ee (ECDH ephemeral + AES-GCM)
// The relay sees normal-looking 1-to-1 messages.

import { signObject } from "dissolve-core/crypto/signing";
import { groupEncrypt } from "dissolve-core/crypto/group";
import { e2eeEncrypt } from "dissolve-core/crypto/e2ee";
import { nextSeq } from "./envelopes";

const PROTOCOL_VERSION = 4;

function newMsgId() {
  return crypto.randomUUID?.() || Math.random().toString(36).slice(2);
}

/**
 * Build a group message envelope set (one per member).
 * Encrypts text once with groupKey, then wraps for each member.
 *
 * @returns {{ envelopes: Array<{envelope, to}>, msgId, ts }}
 */
export async function buildGroupMessage(
  myId, myLabel, myAuthPubJwk, myAuthPrivJwk, myE2eePubJwk,
  myInboxCap, groupId, groupKeyB64, members, text, file
) {
  const ts = Date.now();
  const msgId = newMsgId();
  const seq = nextSeq(myId, groupId);

  const inner = {
    t: "GroupMessage",
    alg: "ECDH-P256+AES256GCM",
    groupId,
    from: myId,
    senderLabel: myLabel,
    senderCap: myInboxCap,
    e2eePub: myE2eePubJwk,
    authPub: myAuthPubJwk,
    msgId,
    text,
    seq,
    ts,
    ...(file ? { file } : {}),
  };

  // Encrypt once with shared group key
  const groupCipher = await groupEncrypt(JSON.stringify(inner), groupKeyB64);

  // Wrap for each member (except self)
  const envelopes = [];
  for (const member of members) {
    if (member.id === myId) continue;

    // Validate member has required keys
    if (!member.e2eePublicJwk || !member.e2eePublicJwk.kty) {
      console.warn("[Dissolve] Skipping group member with missing e2eePublicJwk:", member.id, member.label);
      continue;
    }
    if (typeof member.cap !== "string") {
      console.warn("[Dissolve] Skipping group member with missing cap:", member.id, member.label);
      continue;
    }

    // E2EE wrap the group ciphertext for this member
    // Include groupId in cleartext (within e2ee layer) so recipient can look up the key
    const payload = await e2eeEncrypt(
      JSON.stringify({ g: true, groupId, ...groupCipher }),
      member.e2eePublicJwk
    );

    const obj = {
      p: PROTOCOL_VERSION,
      to: member.id,
      cap: member.cap,
      ch: "msg",
      authPub: myAuthPubJwk,
      payload,
    };
    obj.sig = await signObject(obj, myAuthPrivJwk);
    envelopes.push({ envelope: obj, to: member.id });
  }

  return { envelopes, msgId, ts };
}

/**
 * Build a group invite envelope (sent 1-to-1 to new member).
 * Contains group metadata + wrapped group key.
 */
export async function buildGroupInvite(
  myId, myLabel, myAuthPubJwk, myAuthPrivJwk, myE2eePubJwk, myInboxCap,
  groupId, groupName, groupKeyB64, members, creator, recipient
) {
  const ts = Date.now();
  const seq = nextSeq(myId, `${groupId}:invite`);

  const memberList = members.map((m) => ({
    id: m.id,
    label: m.label,
    e2eePublicJwk: m.e2eePublicJwk,
    authPublicJwk: m.authPublicJwk,
    cap: m.cap,
    role: m.role,
  }));

  const inner = {
    t: "GroupInvite",
    alg: "ECDH-P256+AES256GCM",
    from: myId,
    senderLabel: myLabel,
    senderCap: myInboxCap,
    e2eePub: myE2eePubJwk,
    authPub: myAuthPubJwk,
    groupId,
    convId: groupId,
    msgId: newMsgId(),
    groupName,
    groupKey: groupKeyB64,
    members: memberList,
    creator,
    seq,
    ts,
  };

  const payload = await e2eeEncrypt(JSON.stringify(inner), recipient.e2eePublicJwk);

  const obj = {
    p: PROTOCOL_VERSION,
    to: recipient.id,
    cap: recipient.cap,
    ch: "msg",
    authPub: myAuthPubJwk,
    payload,
  };
  obj.sig = await signObject(obj, myAuthPrivJwk);

  return { envelope: obj, ts };
}

/**
 * Build a GroupMemberAdded notification (sent to each existing member).
 */
export async function buildGroupMemberAdded(
  myId, myLabel, myAuthPubJwk, myAuthPrivJwk, myE2eePubJwk,
  groupId, newMember, recipient
) {
  const ts = Date.now();

  const seq = nextSeq(myId, `${groupId}:control`);
  const inner = {
    t: "GroupMemberAdded",
    alg: "ECDH-P256+AES256GCM",
    from: myId,
    senderLabel: myLabel,
    e2eePub: myE2eePubJwk,
    authPub: myAuthPubJwk,
    groupId,
    convId: groupId,
    msgId: newMsgId(),
    seq,
    member: {
      id: newMember.id,
      label: newMember.label,
      e2eePublicJwk: newMember.e2eePublicJwk,
      authPublicJwk: newMember.authPublicJwk,
      cap: newMember.cap,
      role: newMember.role || "member",
    },
    ts,
  };

  const payload = await e2eeEncrypt(JSON.stringify(inner), recipient.e2eePublicJwk);
  const obj = {
    p: PROTOCOL_VERSION,
    to: recipient.id,
    cap: recipient.cap,
    ch: "msg",
    authPub: myAuthPubJwk,
    payload,
  };
  obj.sig = await signObject(obj, myAuthPrivJwk);
  return { envelope: obj, ts };
}

/**
 * Build a GroupMemberRemoved notification with rotated key.
 * Sent to each remaining member.
 */
export async function buildGroupMemberRemoved(
  myId, myLabel, myAuthPubJwk, myAuthPrivJwk,
  groupId, removedMemberId, newGroupKeyB64, updatedMembers, recipient
) {
  const ts = Date.now();

  const seq = nextSeq(myId, `${groupId}:control`);
  const inner = {
    t: "GroupMemberRemoved",
    alg: "ECDH-P256+AES256GCM",
    from: myId,
    senderLabel: myLabel,
    authPub: myAuthPubJwk,
    groupId,
    convId: groupId,
    msgId: newMsgId(),
    seq,
    removedId: removedMemberId,
    groupKey: newGroupKeyB64,
    members: updatedMembers.map((m) => ({
      id: m.id, label: m.label, e2eePublicJwk: m.e2eePublicJwk,
      authPublicJwk: m.authPublicJwk, cap: m.cap, role: m.role,
    })),
    ts,
  };

  const payload = await e2eeEncrypt(JSON.stringify(inner), recipient.e2eePublicJwk);
  const obj = {
    p: PROTOCOL_VERSION,
    to: recipient.id,
    cap: recipient.cap,
    ch: "msg",
    authPub: myAuthPubJwk,
    payload,
  };
  obj.sig = await signObject(obj, myAuthPrivJwk);
  return { envelope: obj, ts };
}

/**
 * Build a GroupAdminChange notification (creator -> all members).
 */
export async function buildGroupAdminChange(
  myId, myLabel, myAuthPubJwk, myAuthPrivJwk,
  groupId, targetId, newRole, recipient
) {
  const ts = Date.now();

  const seq = nextSeq(myId, `${groupId}:control`);
  const inner = {
    t: "GroupAdminChange",
    alg: "ECDH-P256+AES256GCM",
    from: myId,
    senderLabel: myLabel,
    authPub: myAuthPubJwk,
    groupId,
    convId: groupId,
    msgId: newMsgId(),
    seq,
    targetId,
    newRole,
    ts,
  };

  const payload = await e2eeEncrypt(JSON.stringify(inner), recipient.e2eePublicJwk);
  const obj = {
    p: PROTOCOL_VERSION,
    to: recipient.id,
    cap: recipient.cap,
    ch: "msg",
    authPub: myAuthPubJwk,
    payload,
  };
  obj.sig = await signObject(obj, myAuthPrivJwk);
  return { envelope: obj, ts };
}

/**
 * Build a GroupLeave notification (member -> all other members).
 */
export async function buildGroupLeave(
  myId, myLabel, myAuthPubJwk, myAuthPrivJwk,
  groupId, recipient
) {
  const ts = Date.now();

  const seq = nextSeq(myId, `${groupId}:control`);
  const inner = {
    t: "GroupLeave",
    alg: "ECDH-P256+AES256GCM",
    from: myId,
    senderLabel: myLabel,
    authPub: myAuthPubJwk,
    groupId,
    convId: groupId,
    msgId: newMsgId(),
    seq,
    ts,
  };

  const payload = await e2eeEncrypt(JSON.stringify(inner), recipient.e2eePublicJwk);
  const obj = {
    p: PROTOCOL_VERSION,
    to: recipient.id,
    cap: recipient.cap,
    ch: "msg",
    authPub: myAuthPubJwk,
    payload,
  };
  obj.sig = await signObject(obj, myAuthPrivJwk);
  return { envelope: obj, ts };
}

/**
 * Build a GroupNameChange notification (admin -> all members).
 */
export async function buildGroupNameChange(
  myId, myLabel, myAuthPubJwk, myAuthPrivJwk,
  groupId, newName, recipient
) {
  const ts = Date.now();

  const seq = nextSeq(myId, `${groupId}:control`);
  const inner = {
    t: "GroupNameChange",
    alg: "ECDH-P256+AES256GCM",
    from: myId,
    senderLabel: myLabel,
    authPub: myAuthPubJwk,
    groupId,
    convId: groupId,
    msgId: newMsgId(),
    seq,
    groupName: newName,
    ts,
  };

  const payload = await e2eeEncrypt(JSON.stringify(inner), recipient.e2eePublicJwk);
  const obj = {
    p: PROTOCOL_VERSION,
    to: recipient.id,
    cap: recipient.cap,
    ch: "msg",
    authPub: myAuthPubJwk,
    payload,
  };
  obj.sig = await signObject(obj, myAuthPrivJwk);
  return { envelope: obj, ts };
}
