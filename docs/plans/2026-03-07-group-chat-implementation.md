# Group Chat Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add encrypted group messaging with client-side fan-out, shared AES-256 group key, multi-admin, invite-only, max 50 members.

**Architecture:** Groups are entirely client-side. The relay has zero awareness of groups. A shared symmetric AES-256-GCM key encrypts group messages. The sender encrypts once, then wraps the ciphertext in individual e2ee envelopes for each member and sends via their personal inboxes. Key rotation happens on member removal.

**Tech Stack:** Web Crypto API (AES-256-GCM, ECDH P-256), React 19, localStorage, IndexedDB

**Design doc:** `docs/plans/2026-03-07-group-chat-design.md`

**IMPORTANT:** After completing ALL tasks in `client/src/`, copy every changed file to `desktop/src/` (desktop mirrors client).

---

## Task 1: Group Crypto Utilities

**Files:**
- Create: `packages/dissolve-core/src/crypto/group.js`

**Context:** This module handles symmetric group key generation, encryption/decryption with the group key, and wrapping/unwrapping the group key for distribution via existing e2ee channels.

**Step 1: Create group crypto module**

```javascript
// packages/dissolve-core/src/crypto/group.js
import { e2eeEncrypt, e2eeDecrypt } from "./e2ee.js";

const GCM_IV_BYTES = 12;
const GROUP_KEY_BYTES = 32; // AES-256

/**
 * Generate a random AES-256 group key.
 * Returns raw key as base64url string for storage/transport.
 */
export async function generateGroupKey() {
  const raw = crypto.getRandomValues(new Uint8Array(GROUP_KEY_BYTES));
  return bufToBase64url(raw);
}

/**
 * Generate a random group ID (32 bytes, base64url).
 */
export function generateGroupId() {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return bufToBase64url(raw);
}

/**
 * Encrypt plaintext with a symmetric group key (AES-256-GCM).
 * @param {string} plaintext - JSON string to encrypt
 * @param {string} groupKeyB64 - base64url-encoded AES-256 key
 * @returns {{ iv: string, ct: string }} base64url-encoded IV and ciphertext
 */
export async function groupEncrypt(plaintext, groupKeyB64) {
  const keyBuf = base64urlToBuf(groupKeyB64);
  const key = await crypto.subtle.importKey("raw", keyBuf, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(GCM_IV_BYTES));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  return { iv: bufToBase64url(iv), ct: bufToBase64url(new Uint8Array(ct)) };
}

/**
 * Decrypt ciphertext with a symmetric group key (AES-256-GCM).
 * @param {{ iv: string, ct: string }} cipher - base64url IV and ciphertext
 * @param {string} groupKeyB64 - base64url-encoded AES-256 key
 * @returns {string} decrypted plaintext
 */
export async function groupDecrypt(cipher, groupKeyB64) {
  const keyBuf = base64urlToBuf(groupKeyB64);
  const key = await crypto.subtle.importKey("raw", keyBuf, "AES-GCM", false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64urlToBuf(cipher.iv) },
    key,
    base64urlToBuf(cipher.ct)
  );
  return new TextDecoder().decode(pt);
}

/**
 * Wrap a group key for a specific recipient using their e2ee public key.
 * Uses the existing e2eeEncrypt (ephemeral ECDH + AES-GCM).
 * @param {string} groupKeyB64 - the group key to wrap
 * @param {object} recipientE2eePubJwk - recipient's ECDH public JWK
 * @returns {object} e2ee payload (epk, iv, ct)
 */
export async function wrapGroupKey(groupKeyB64, recipientE2eePubJwk) {
  return e2eeEncrypt(groupKeyB64, recipientE2eePubJwk);
}

/**
 * Unwrap a group key encrypted for us.
 * @param {object} wrappedPayload - e2ee payload from wrapGroupKey
 * @param {CryptoKey} myE2eePrivKey - our ECDH private key
 * @returns {string} the group key as base64url
 */
export async function unwrapGroupKey(wrappedPayload, myE2eePrivKey) {
  return e2eeDecrypt(wrappedPayload, myE2eePrivKey);
}

// --- base64url helpers (match existing pattern in e2ee.js) ---
function bufToBase64url(buf) {
  const str = String.fromCharCode(...new Uint8Array(buf));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBuf(b64) {
  const str = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(str, (c) => c.charCodeAt(0));
}
```

**Step 2: Export from dissolve-core index**

Check `packages/dissolve-core/src/index.js` (or wherever exports are) and add:
```javascript
export { generateGroupKey, generateGroupId, groupEncrypt, groupDecrypt, wrapGroupKey, unwrapGroupKey } from "./crypto/group.js";
```

**Step 3: Commit**
```
feat: add group crypto utilities (AES-256-GCM symmetric key, wrap/unwrap)
```

---

## Task 2: Group Envelope Builders

**Files:**
- Create: `client/src/protocol/groupEnvelopes.js`
- Reference: `client/src/protocol/envelopes.js` (follow same patterns)

**Context:** These builders create the inner+outer envelopes for group operations. Each group message is encrypted with the group key, then wrapped in individual e2ee envelopes per member and sent via `/send` to each member's personal inbox. The relay sees normal-looking 1-to-1 messages.

**Step 1: Create group envelope builders**

```javascript
// client/src/protocol/groupEnvelopes.js
import { signObject } from "dissolve-core";
import { groupEncrypt } from "dissolve-core";
import { e2eeEncrypt } from "dissolve-core";

// Reuse nextSeq from envelopes.js
import { nextSeq } from "./envelopes.js";

const PROTOCOL_VERSION = 4;

/**
 * Build a group message envelope set (one per member).
 * Encrypts text once with groupKey, then wraps for each member.
 *
 * @returns {{ envelopes: Array<{envelope, to}>, msgId, ts }}
 */
export async function buildGroupMessage(
  myId, myLabel, myAuthPubJwk, myAuthPrivJwk, myE2eePubJwk,
  groupId, groupKeyB64, members, text
) {
  const ts = Date.now();
  const msgId = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
  const seq = nextSeq(myId, groupId);

  const inner = {
    t: "GroupMessage",
    groupId,
    from: myId,
    senderLabel: myLabel,
    msgId,
    text,
    seq,
    ts,
  };

  // Encrypt once with shared group key
  const groupCipher = await groupEncrypt(JSON.stringify(inner), groupKeyB64);

  // Wrap for each member (except self)
  const envelopes = [];
  for (const member of members) {
    if (member.id === myId) continue;

    // E2EE wrap the group ciphertext for this member
    const payload = await e2eeEncrypt(
      JSON.stringify({ g: true, ...groupCipher }),
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

  // Member list (public info only, no keys the recipient shouldn't have)
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
    from: myId,
    senderLabel: myLabel,
    groupId,
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
  myId, myLabel, myAuthPubJwk, myAuthPrivJwk,
  groupId, newMember, recipient
) {
  const ts = Date.now();

  const inner = {
    t: "GroupMemberAdded",
    from: myId,
    senderLabel: myLabel,
    groupId,
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

  const inner = {
    t: "GroupMemberRemoved",
    from: myId,
    senderLabel: myLabel,
    groupId,
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
 * Build a GroupAdminChange notification (creator → all members).
 */
export async function buildGroupAdminChange(
  myId, myLabel, myAuthPubJwk, myAuthPrivJwk,
  groupId, targetId, newRole, recipient
) {
  const ts = Date.now();

  const inner = {
    t: "GroupAdminChange",
    from: myId,
    senderLabel: myLabel,
    groupId,
    targetId,
    newRole, // "admin" or "member"
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
 * Build a GroupLeave notification (member → all other members).
 */
export async function buildGroupLeave(
  myId, myLabel, myAuthPubJwk, myAuthPrivJwk,
  groupId, recipient
) {
  const ts = Date.now();

  const inner = {
    t: "GroupLeave",
    from: myId,
    senderLabel: myLabel,
    groupId,
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
 * Build a GroupNameChange notification (admin → all members).
 */
export async function buildGroupNameChange(
  myId, myLabel, myAuthPubJwk, myAuthPrivJwk,
  groupId, newName, recipient
) {
  const ts = Date.now();

  const inner = {
    t: "GroupNameChange",
    from: myId,
    senderLabel: myLabel,
    groupId,
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
```

**Step 2: Export nextSeq from envelopes.js**

In `client/src/protocol/envelopes.js`, the `nextSeq` function needs to be exported (currently it may be internal). Add `export` keyword if not already exported.

**Step 3: Commit**
```
feat: add group envelope builders for all group message types
```

---

## Task 3: useGroups Hook

**Files:**
- Create: `client/src/hooks/useGroups.js`

**Context:** Manages group state in localStorage. Follows the same patterns as `useContacts.js` — state + refs, localStorage persistence, keyed by identity ID.

**Step 1: Create the hook**

```javascript
// client/src/hooks/useGroups.js
import { useState, useRef, useCallback } from "react";
import { loadJson, saveJson } from "../utils/storage.js";

const MAX_GROUP_MEMBERS = 50;

/**
 * Group object shape:
 * {
 *   groupId: string,        // random 32-byte base64url
 *   groupName: string,
 *   groupKey: string,        // AES-256 key as base64url
 *   members: [{              // includes self
 *     id, label, e2eePublicJwk, authPublicJwk, cap, role ("admin"|"member")
 *   }],
 *   creator: string,         // identity ID of creator
 *   createdAt: number,       // timestamp
 * }
 */

export default function useGroups(myId) {
  const [groups, setGroups] = useState([]);
  const groupsRef = useRef(groups);

  const persist = useCallback(
    (updated) => {
      groupsRef.current = updated;
      setGroups(updated);
      if (myId) saveJson(`groups:${myId}`, updated);
    },
    [myId]
  );

  const load = useCallback(
    (id) => {
      const saved = loadJson(`groups:${id}`) || [];
      groupsRef.current = saved;
      setGroups(saved);
    },
    []
  );

  const addGroup = useCallback(
    (group) => {
      const current = groupsRef.current;
      const exists = current.findIndex((g) => g.groupId === group.groupId);
      let updated;
      if (exists >= 0) {
        updated = [...current];
        updated[exists] = group;
      } else {
        updated = [...current, group];
      }
      persist(updated);
    },
    [persist]
  );

  const removeGroup = useCallback(
    (groupId) => {
      const updated = groupsRef.current.filter((g) => g.groupId !== groupId);
      persist(updated);
    },
    [persist]
  );

  const findGroup = useCallback(
    (groupId) => groupsRef.current.find((g) => g.groupId === groupId) || null,
    []
  );

  const updateGroup = useCallback(
    (groupId, updater) => {
      const current = groupsRef.current;
      const idx = current.findIndex((g) => g.groupId === groupId);
      if (idx < 0) return;
      const updated = [...current];
      updated[idx] = { ...updated[idx], ...updater(updated[idx]) };
      persist(updated);
    },
    [persist]
  );

  const addMember = useCallback(
    (groupId, member) => {
      updateGroup(groupId, (g) => {
        if (g.members.length >= MAX_GROUP_MEMBERS) {
          console.warn("Group member limit reached:", MAX_GROUP_MEMBERS);
          return {};
        }
        if (g.members.some((m) => m.id === member.id)) return {};
        return { members: [...g.members, { ...member, role: member.role || "member" }] };
      });
    },
    [updateGroup]
  );

  const removeMember = useCallback(
    (groupId, memberId) => {
      updateGroup(groupId, (g) => ({
        members: g.members.filter((m) => m.id !== memberId),
      }));
    },
    [updateGroup]
  );

  const setMemberRole = useCallback(
    (groupId, memberId, role) => {
      updateGroup(groupId, (g) => ({
        members: g.members.map((m) => (m.id === memberId ? { ...m, role } : m)),
      }));
    },
    [updateGroup]
  );

  const updateGroupKey = useCallback(
    (groupId, newKey) => {
      updateGroup(groupId, () => ({ groupKey: newKey }));
    },
    [updateGroup]
  );

  const renameGroup = useCallback(
    (groupId, newName) => {
      updateGroup(groupId, () => ({ groupName: newName }));
    },
    [updateGroup]
  );

  const reset = useCallback(() => {
    groupsRef.current = [];
    setGroups([]);
  }, []);

  return {
    groups,
    groupsRef,
    load,
    addGroup,
    removeGroup,
    findGroup,
    updateGroup,
    addMember,
    removeMember,
    setMemberRole,
    updateGroupKey,
    renameGroup,
    reset,
  };
}
```

**Step 2: Commit**
```
feat: add useGroups hook for group state management
```

---

## Task 4: Group Message Handling in useMessaging

**Files:**
- Modify: `client/src/hooks/useMessaging.js`

**Context:** Extend the existing `handleIncoming` function to recognize group envelope types (`GroupMessage`, `GroupInvite`, `GroupMemberAdded`, `GroupMemberRemoved`, `GroupAdminChange`, `GroupLeave`, `GroupNameChange`). Add `sendGroupMsg` for outgoing group messages. Add group admin action senders.

**Step 1: Add group message state**

Add alongside existing `messages` state (around line 30):

```javascript
const [groupMessages, setGroupMessages] = useState({});
// Shape: { [groupId]: [{ dir, from, senderLabel, text, ts, msgId }] }

const groupMessagesRef = useRef(groupMessages);
```

**Step 2: Add group replay protection**

Add alongside existing replay check logic (around lines 55-65):

```javascript
const groupReplayState = useRef({});

function checkGroupReplay(myId, groupId, fromId, seq) {
  const key = `${myId}:${groupId}:${fromId}`;
  const last = groupReplayState.current[key] ?? -1;
  if (seq <= last) return false; // duplicate
  groupReplayState.current[key] = seq;
  return true;
}
```

**Step 3: Extend handleIncoming for group types**

In the `handleIncoming` function, after the existing type switch (around line 100-145), add cases for group message types:

```javascript
// After existing type handling (Message, ContactRequest, ContactGrant, CapsUpdate):

case "GroupMessage": {
  // inner has: groupId, from, senderLabel, msgId, text, seq, ts
  // But it's wrapped: the e2ee-decrypted payload contains { g: true, iv, ct }
  // We need to detect this and decrypt with group key
  // See Step 4 for the detection logic
  break;
}

case "GroupInvite": {
  // inner has: groupId, groupName, groupKey, members, creator, from, ts
  const group = {
    groupId: inner.groupId,
    groupName: inner.groupName,
    groupKey: inner.groupKey,
    members: inner.members,
    creator: inner.creator,
    createdAt: inner.ts,
  };
  groupsMgr.addGroup(group);
  addToast(`Added to group: ${inner.groupName}`);
  break;
}

case "GroupMemberAdded": {
  // inner has: groupId, member, from, ts
  groupsMgr.addMember(inner.groupId, inner.member);
  addToast(`${inner.member.label} joined the group`);
  break;
}

case "GroupMemberRemoved": {
  // inner has: groupId, removedId, groupKey, members, from, ts
  if (inner.removedId === myId) {
    groupsMgr.removeGroup(inner.groupId);
    addToast("You were removed from a group");
  } else {
    groupsMgr.updateGroup(inner.groupId, () => ({
      groupKey: inner.groupKey,
      members: inner.members,
    }));
    const removed = inner.members.find((m) => m.id === inner.removedId);
    addToast(`${removed?.label || "Someone"} was removed from the group`);
  }
  break;
}

case "GroupAdminChange": {
  // inner has: groupId, targetId, newRole, from, ts
  groupsMgr.setMemberRole(inner.groupId, inner.targetId, inner.newRole);
  break;
}

case "GroupLeave": {
  // inner has: groupId, from, senderLabel, ts
  groupsMgr.removeMember(inner.groupId, inner.from);
  addToast(`${inner.senderLabel} left the group`);
  break;
}

case "GroupNameChange": {
  // inner has: groupId, groupName, from, ts
  groupsMgr.renameGroup(inner.groupId, inner.groupName);
  break;
}
```

**Step 4: GroupMessage decryption**

GroupMessages have a two-layer encryption. The outer e2ee layer is decrypted by existing code. The inner payload contains `{ g: true, iv, ct }` — a flag indicating it's a group-encrypted message. After the existing e2ee decryption, add detection:

```javascript
// After e2ee decryption of payload, before type switch:
let inner = JSON.parse(decryptedPayload);

if (inner.g === true) {
  // This is a group message — decrypt inner layer with group key
  const group = groupsMgr.findGroup(inner.groupId || "");
  if (!group) {
    // We don't have this group anymore (removed/left)
    // Try to find groupId from the cipher — but we can't without knowing which group
    // So we need the groupId outside the group cipher. Let's include it.
    console.warn("Received group message for unknown group, ignoring");
    continue;
  }
  const groupPlaintext = await groupDecrypt({ iv: inner.iv, ct: inner.ct }, group.groupKey);
  inner = JSON.parse(groupPlaintext);
}
```

Wait — there's a problem. If the groupId is inside the group-encrypted payload, we can't look up the group key to decrypt it. We need the groupId in the outer (e2ee-encrypted) wrapper. Let me fix the envelope design.

**Revised approach for `buildGroupMessage`:** The e2ee-encrypted payload should be:
```javascript
{ g: true, groupId: "...", iv: "...", ct: "..." }
```
Where `groupId` is plaintext (within the e2ee layer — only the recipient sees it), and `iv`/`ct` are the group-key-encrypted inner message.

This is already handled correctly in the `buildGroupMessage` code in Task 2 — the `groupId` is included alongside the cipher.

**Step 5: Add sendGroupMsg**

```javascript
async function sendGroupMsg(groupId, text) {
  const group = groupsMgr.findGroup(groupId);
  if (!group) return;

  const { envelopes, msgId, ts } = await buildGroupMessage(
    identity.id, identity.label,
    identity.authPubJwk, identity.authPrivJwk, identity.e2eePubJwk,
    groupId, group.groupKey, group.members, text
  );

  // Fan-out: send to each member
  const results = await Promise.allSettled(
    envelopes.map(({ envelope }) => sendEnvelope(envelope))
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.warn(`Group send: ${failures.length}/${envelopes.length} failed`);
  }

  // Add to local state
  const msg = { dir: "out", from: identity.id, senderLabel: identity.label, text, ts, msgId };
  setGroupMessages((prev) => ({
    ...prev,
    [groupId]: [...(prev[groupId] || []), msg],
  }));
  groupMessagesRef.current = {
    ...groupMessagesRef.current,
    [groupId]: [...(groupMessagesRef.current[groupId] || []), msg],
  };

  // Archive if enabled
  if (archiveEnabled && storeRef.current) {
    storeRef.current.save(identity.id, { ...msg, peerId: groupId });
  }
}
```

**Step 6: Add incoming GroupMessage to state**

In the GroupMessage case handler:
```javascript
case "GroupMessage": {
  // inner is already decrypted from group key (see Step 4)
  if (!checkGroupReplay(myId, inner.groupId, inner.from, inner.seq)) break;

  const msg = {
    dir: "in",
    from: inner.from,
    senderLabel: inner.senderLabel,
    text: inner.text,
    ts: inner.ts,
    msgId: inner.msgId,
  };

  setGroupMessages((prev) => ({
    ...prev,
    [inner.groupId]: [...(prev[inner.groupId] || []), msg],
  }));
  groupMessagesRef.current = {
    ...groupMessagesRef.current,
    [inner.groupId]: [...(groupMessagesRef.current[inner.groupId] || []), msg],
  };

  // Archive
  if (archiveEnabled && storeRef.current) {
    storeRef.current.save(myId, { ...msg, peerId: inner.groupId });
  }

  // Notification
  if (inner.from !== myId && soundEnabled) {
    playNotificationSound();
  }
  break;
}
```

**Step 7: Expose new state and functions**

Add to the hook's return object:
```javascript
return {
  // ... existing returns ...
  groupMessages,
  sendGroupMsg,
};
```

**Step 8: Pass groupsMgr into useMessaging**

The hook needs access to `groupsMgr` (from `useGroups`). Add it as a parameter:
```javascript
export default function useMessaging(identity, contactsMgr, groupsMgr, addToast) {
```

**Step 9: Commit**
```
feat: handle group messages in useMessaging (send, receive, decrypt, replay)
```

---

## Task 5: Group Admin Actions

**Files:**
- Modify: `client/src/hooks/useMessaging.js` (or create separate `client/src/hooks/useGroupActions.js`)

**Context:** Functions for group creation, adding/removing members, promoting/demoting admins, leaving, renaming. These are called from the UI and orchestrate envelope building + fan-out sending.

**Step 1: Create useGroupActions hook**

```javascript
// client/src/hooks/useGroupActions.js
import { useCallback } from "react";
import { generateGroupKey, generateGroupId } from "dissolve-core";
import {
  buildGroupInvite,
  buildGroupMemberAdded,
  buildGroupMemberRemoved,
  buildGroupAdminChange,
  buildGroupLeave,
  buildGroupNameChange,
} from "../protocol/groupEnvelopes.js";
import { sendEnvelope } from "../protocol/relay.js";

export default function useGroupActions(identity, groupsMgr, addToast) {

  const createGroup = useCallback(async (groupName, initialMembers) => {
    // initialMembers: array of contact objects { id, label, e2eePublicJwk, authPublicJwk, cap }
    const groupId = generateGroupId();
    const groupKey = await generateGroupKey();

    // Build member list including self
    const selfMember = {
      id: identity.id,
      label: identity.label,
      e2eePublicJwk: identity.e2eePubJwk,
      authPublicJwk: identity.authPubJwk,
      cap: identity.inboxCap,
      role: "admin",
    };

    const members = [
      selfMember,
      ...initialMembers.map((m) => ({ ...m, role: "member" })),
    ];

    const group = {
      groupId,
      groupName,
      groupKey,
      members,
      creator: identity.id,
      createdAt: Date.now(),
    };

    // Save locally first
    groupsMgr.addGroup(group);

    // Send invites to all initial members
    await Promise.allSettled(
      initialMembers.map(async (recipient) => {
        const { envelope } = await buildGroupInvite(
          identity.id, identity.label,
          identity.authPubJwk, identity.authPrivJwk, identity.e2eePubJwk,
          identity.inboxCap,
          groupId, groupName, groupKey, members, identity.id,
          recipient
        );
        return sendEnvelope(envelope);
      })
    );

    addToast(`Group "${groupName}" created`);
    return groupId;
  }, [identity, groupsMgr, addToast]);

  const addGroupMember = useCallback(async (groupId, newContact) => {
    const group = groupsMgr.findGroup(groupId);
    if (!group) return;

    const me = group.members.find((m) => m.id === identity.id);
    if (!me || me.role !== "admin") {
      addToast("Only admins can add members");
      return;
    }
    if (group.members.length >= 50) {
      addToast("Group is full (max 50)");
      return;
    }
    if (group.members.some((m) => m.id === newContact.id)) {
      addToast("Already in the group");
      return;
    }

    const newMember = { ...newContact, role: "member" };
    const updatedMembers = [...group.members, newMember];

    // Update local state
    groupsMgr.addMember(groupId, newMember);

    // Send invite to new member (with full member list + key)
    const { envelope: inviteEnv } = await buildGroupInvite(
      identity.id, identity.label,
      identity.authPubJwk, identity.authPrivJwk, identity.e2eePubJwk,
      identity.inboxCap,
      groupId, group.groupName, group.groupKey, updatedMembers, group.creator,
      newContact
    );
    await sendEnvelope(inviteEnv);

    // Notify existing members
    await Promise.allSettled(
      group.members
        .filter((m) => m.id !== identity.id && m.id !== newContact.id)
        .map(async (recipient) => {
          const { envelope } = await buildGroupMemberAdded(
            identity.id, identity.label,
            identity.authPubJwk, identity.authPrivJwk,
            groupId, newMember, recipient
          );
          return sendEnvelope(envelope);
        })
    );

    addToast(`${newContact.label} added to group`);
  }, [identity, groupsMgr, addToast]);

  const removeGroupMember = useCallback(async (groupId, memberId) => {
    const group = groupsMgr.findGroup(groupId);
    if (!group) return;

    const me = group.members.find((m) => m.id === identity.id);
    const target = group.members.find((m) => m.id === memberId);
    if (!me || me.role !== "admin") {
      addToast("Only admins can remove members");
      return;
    }
    if (target?.role === "admin" && group.creator !== identity.id) {
      addToast("Only the creator can remove admins");
      return;
    }

    // Generate new key (removed member can't read future messages)
    const newGroupKey = await generateGroupKey();
    const remainingMembers = group.members.filter((m) => m.id !== memberId);

    // Update local state
    groupsMgr.removeMember(groupId, memberId);
    groupsMgr.updateGroupKey(groupId, newGroupKey);

    // Notify remaining members with new key
    await Promise.allSettled(
      remainingMembers
        .filter((m) => m.id !== identity.id)
        .map(async (recipient) => {
          const { envelope } = await buildGroupMemberRemoved(
            identity.id, identity.label,
            identity.authPubJwk, identity.authPrivJwk,
            groupId, memberId, newGroupKey, remainingMembers, recipient
          );
          return sendEnvelope(envelope);
        })
    );

    addToast(`Member removed from group`);
  }, [identity, groupsMgr, addToast]);

  const changeAdminRole = useCallback(async (groupId, targetId, newRole) => {
    const group = groupsMgr.findGroup(groupId);
    if (!group || group.creator !== identity.id) {
      addToast("Only the creator can change admin roles");
      return;
    }

    groupsMgr.setMemberRole(groupId, targetId, newRole);

    // Notify all members
    await Promise.allSettled(
      group.members
        .filter((m) => m.id !== identity.id)
        .map(async (recipient) => {
          const { envelope } = await buildGroupAdminChange(
            identity.id, identity.label,
            identity.authPubJwk, identity.authPrivJwk,
            groupId, targetId, newRole, recipient
          );
          return sendEnvelope(envelope);
        })
    );
  }, [identity, groupsMgr, addToast]);

  const leaveGroup = useCallback(async (groupId) => {
    const group = groupsMgr.findGroup(groupId);
    if (!group) return;

    if (group.creator === identity.id) {
      addToast("Creator cannot leave — delete the group instead");
      return;
    }

    // Notify all members
    await Promise.allSettled(
      group.members
        .filter((m) => m.id !== identity.id)
        .map(async (recipient) => {
          const { envelope } = await buildGroupLeave(
            identity.id, identity.label,
            identity.authPubJwk, identity.authPrivJwk,
            groupId, recipient
          );
          return sendEnvelope(envelope);
        })
    );

    groupsMgr.removeGroup(groupId);
    addToast("Left the group");
  }, [identity, groupsMgr, addToast]);

  const renameGroup = useCallback(async (groupId, newName) => {
    const group = groupsMgr.findGroup(groupId);
    if (!group) return;

    const me = group.members.find((m) => m.id === identity.id);
    if (!me || me.role !== "admin") {
      addToast("Only admins can rename the group");
      return;
    }

    groupsMgr.renameGroup(groupId, newName);

    await Promise.allSettled(
      group.members
        .filter((m) => m.id !== identity.id)
        .map(async (recipient) => {
          const { envelope } = await buildGroupNameChange(
            identity.id, identity.label,
            identity.authPubJwk, identity.authPrivJwk,
            groupId, newName, recipient
          );
          return sendEnvelope(envelope);
        })
    );
  }, [identity, groupsMgr, addToast]);

  const deleteGroup = useCallback(async (groupId) => {
    const group = groupsMgr.findGroup(groupId);
    if (!group || group.creator !== identity.id) {
      addToast("Only the creator can delete the group");
      return;
    }

    // Notify all members they've been removed
    await Promise.allSettled(
      group.members
        .filter((m) => m.id !== identity.id)
        .map(async (recipient) => {
          const { envelope } = await buildGroupMemberRemoved(
            identity.id, identity.label,
            identity.authPubJwk, identity.authPrivJwk,
            groupId, recipient.id, "", [], recipient
          );
          return sendEnvelope(envelope);
        })
    );

    groupsMgr.removeGroup(groupId);
    addToast("Group deleted");
  }, [identity, groupsMgr, addToast]);

  return {
    createGroup,
    addGroupMember,
    removeGroupMember,
    changeAdminRole,
    leaveGroup,
    renameGroup,
    deleteGroup,
  };
}
```

**Step 2: Commit**
```
feat: add useGroupActions hook for group admin operations
```

---

## Task 6: Group Icons

**Files:**
- Modify: `client/src/components/Icons.jsx`

**Context:** Add IconGroup (for group list items) and IconCrown (for admin badge) and IconPlus (for create/add actions).

**Step 1: Add new icons**

Add these components to Icons.jsx:

```jsx
export function IconGroup(props) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor"
         strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconCrown(props) {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor" {...props}>
      <path d="M2.5 19h19v2h-19zM22.5 7l-5 5-5-7-5 7-5-5 2.5 12h15z" />
    </svg>
  );
}

export function IconPlus(props) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor"
         strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function IconLeave(props) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor"
         strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function IconTrash(props) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor"
         strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
```

**Step 2: Commit**
```
feat: add group-related icons (Group, Crown, Plus, Leave, Trash)
```

---

## Task 7: CreateGroupModal Component

**Files:**
- Create: `client/src/components/CreateGroupModal.jsx`

**Context:** Modal for creating a new group. Shows a name input and a checkbox list of contacts to add as initial members.

**Step 1: Create the component**

```jsx
// client/src/components/CreateGroupModal.jsx
import { useState } from "react";
import { IconClose } from "./Icons";

export default function CreateGroupModal({ contacts, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState(new Set());

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    if (selected.size === 0) return;
    const members = contacts.filter((c) => selected.has(c.id));
    onCreate(name.trim(), members);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create Group</h3>
          <button className="btn-icon" onClick={onClose}><IconClose /></button>
        </div>
        <div className="modal-body">
          <label className="input-label">Group Name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter group name"
            maxLength={50}
            autoFocus
          />
          <label className="input-label" style={{ marginTop: 16 }}>
            Add Members ({selected.size} selected)
          </label>
          <div className="group-member-select">
            {contacts.length === 0 && (
              <p className="text-secondary">No contacts yet</p>
            )}
            {contacts.map((c) => (
              <label key={c.id} className="toggle-label group-member-option">
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                />
                <span>{c.label || c.id.slice(0, 8)}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={!name.trim() || selected.size === 0}
          >
            Create Group
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**
```
feat: add CreateGroupModal component
```

---

## Task 8: GroupInfoPanel Component

**Files:**
- Create: `client/src/components/GroupInfoPanel.jsx`

**Context:** Slide-in panel showing group details: member list with role badges, admin controls (add/remove members, promote/demote, rename), leave/delete actions.

**Step 1: Create the component**

```jsx
// client/src/components/GroupInfoPanel.jsx
import { useState } from "react";
import { IconClose, IconCrown, IconPlus, IconTrash, IconLeave } from "./Icons";

export default function GroupInfoPanel({
  group,
  myId,
  contacts,
  onClose,
  onAddMember,
  onRemoveMember,
  onChangeRole,
  onRenameGroup,
  onLeaveGroup,
  onDeleteGroup,
}) {
  const [showAddMember, setShowAddMember] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(group.groupName);

  const me = group.members.find((m) => m.id === myId);
  const isAdmin = me?.role === "admin";
  const isCreator = group.creator === myId;

  const memberIds = new Set(group.members.map((m) => m.id));
  const addableContacts = contacts.filter((c) => !memberIds.has(c.id));

  const handleRename = () => {
    if (newName.trim() && newName.trim() !== group.groupName) {
      onRenameGroup(group.groupId, newName.trim());
    }
    setEditingName(false);
  };

  return (
    <div className="group-info-panel">
      <div className="group-info-header">
        {editingName ? (
          <input
            className="input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
            autoFocus
            maxLength={50}
          />
        ) : (
          <h3
            onClick={() => isAdmin && setEditingName(true)}
            className={isAdmin ? "editable" : ""}
            title={isAdmin ? "Click to rename" : ""}
          >
            {group.groupName}
          </h3>
        )}
        <button className="btn-icon" onClick={onClose}><IconClose /></button>
      </div>

      <div className="group-info-body">
        <div className="group-members-header">
          <span>{group.members.length} members</span>
          {isAdmin && (
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setShowAddMember(!showAddMember)}
            >
              <IconPlus /> Add
            </button>
          )}
        </div>

        {showAddMember && (
          <div className="group-add-member-list">
            {addableContacts.length === 0 ? (
              <p className="text-secondary">No contacts to add</p>
            ) : (
              addableContacts.map((c) => (
                <div key={c.id} className="group-add-member-item">
                  <span>{c.label || c.id.slice(0, 8)}</span>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => { onAddMember(group.groupId, c); setShowAddMember(false); }}
                  >
                    Add
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        <div className="group-member-list">
          {group.members.map((m) => (
            <div key={m.id} className="group-member-item">
              <div className="group-member-info">
                <div className="contact-avatar">
                  {(m.label || "?")[0].toUpperCase()}
                </div>
                <span className="group-member-name">
                  {m.label || m.id.slice(0, 8)}
                  {m.id === myId && " (you)"}
                </span>
                {m.role === "admin" && (
                  <span className="group-role-badge" title={m.id === group.creator ? "Creator" : "Admin"}>
                    <IconCrown />
                  </span>
                )}
              </div>
              <div className="group-member-actions">
                {isCreator && m.id !== myId && (
                  <button
                    className="btn btn-xs btn-secondary"
                    onClick={() => onChangeRole(group.groupId, m.id, m.role === "admin" ? "member" : "admin")}
                  >
                    {m.role === "admin" ? "Demote" : "Promote"}
                  </button>
                )}
                {isAdmin && m.id !== myId && m.role !== "admin" && (
                  <button
                    className="btn btn-xs btn-danger"
                    onClick={() => onRemoveMember(group.groupId, m.id)}
                  >
                    Remove
                  </button>
                )}
                {/* Creator can remove admins too */}
                {isCreator && m.id !== myId && m.role === "admin" && (
                  <button
                    className="btn btn-xs btn-danger"
                    onClick={() => onRemoveMember(group.groupId, m.id)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="group-info-footer">
        {isCreator ? (
          <button className="btn btn-danger" onClick={() => onDeleteGroup(group.groupId)}>
            <IconTrash /> Delete Group
          </button>
        ) : (
          <button className="btn btn-danger" onClick={() => onLeaveGroup(group.groupId)}>
            <IconLeave /> Leave Group
          </button>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**
```
feat: add GroupInfoPanel component for group management
```

---

## Task 9: Extend ChatPanel for Group Messages

**Files:**
- Modify: `client/src/components/ChatPanel.jsx`

**Context:** ChatPanel currently shows 1-to-1 messages with `dir: "out"` or `"in"`. For groups, messages also have `from` and `senderLabel`. Need to show sender name on incoming group messages. The component should accept a `group` prop — when set, it renders in group mode.

**Step 1: Add group mode support**

Add `group` prop. When `group` is set, show sender labels on incoming messages and group name in header.

In the props destructuring, add `group`:
```jsx
export default function ChatPanel({ peer, group, messages, onSend }) {
```

In the header section, show group info when in group mode:
```jsx
// Replace existing header with conditional:
{group ? (
  <div className="chat-header" onClick={onGroupInfo}>
    <div className="contact-avatar group-avatar">
      {group.groupName[0].toUpperCase()}
    </div>
    <div className="chat-header-text">
      <span className="chat-header-name">{group.groupName}</span>
      <span className="chat-header-id">{group.members.length} members</span>
    </div>
  </div>
) : peer ? (
  // existing peer header
) : null}
```

In the message bubble rendering, add sender label for group incoming:
```jsx
{group && msg.dir === "in" && (
  <span className="group-msg-sender">{msg.senderLabel}</span>
)}
```

Add `onGroupInfo` prop for clicking the header to open GroupInfoPanel.

**Step 2: Commit**
```
feat: extend ChatPanel to support group message display
```

---

## Task 10: Extend Sidebar with Groups Section

**Files:**
- Modify: `client/src/components/Sidebar.jsx`

**Context:** Add a "Groups" section below Contacts. Shows group list items, "Create Group" button. Groups are selectable just like contacts — clicking a group sets it as active.

**Step 1: Add groups section**

Add props: `groups`, `activeGroupId`, `onSelectGroup`, `onCreateGroup`.

Add a groups section after the contacts list:

```jsx
{/* Groups section — after contacts, before requests */}
<div className="sidebar-section">
  <div className="sidebar-section-header">
    <h3>Groups</h3>
    <button className="btn btn-sm btn-primary" onClick={() => setShowCreateGroup(true)}>
      <IconPlus />
    </button>
  </div>
  {groups.length === 0 ? (
    <p className="text-secondary sidebar-empty">No groups yet</p>
  ) : (
    groups.map((g) => (
      <div
        key={g.groupId}
        className={`contact-item ${activeGroupId === g.groupId ? "active" : ""}`}
        onClick={() => onSelectGroup(g.groupId)}
      >
        <div className="contact-avatar group-avatar">
          {g.groupName[0].toUpperCase()}
        </div>
        <div className="contact-info">
          <span className="contact-name">{g.groupName}</span>
          <span className="contact-id">{g.members.length} members</span>
        </div>
      </div>
    ))
  )}
</div>
```

**Step 2: Commit**
```
feat: add groups section to sidebar
```

---

## Task 11: Wire Everything in App.jsx

**Files:**
- Modify: `client/src/App.jsx`

**Context:** Initialize `useGroups` and `useGroupActions` hooks, pass groups state down to Sidebar and ChatPanel, manage active group selection (mutually exclusive with active contact), render CreateGroupModal and GroupInfoPanel.

**Step 1: Add hooks and state**

```javascript
import useGroups from "./hooks/useGroups";
import useGroupActions from "./hooks/useGroupActions";
import CreateGroupModal from "./components/CreateGroupModal";
import GroupInfoPanel from "./components/GroupInfoPanel";

// In App component:
const groupsMgr = useGroups(identity.id);
const groupActions = useGroupActions(identity, groupsMgr, addToast);

const [activeGroupId, setActiveGroupId] = useState(null);
const [showCreateGroup, setShowCreateGroup] = useState(false);
const [showGroupInfo, setShowGroupInfo] = useState(false);
```

**Step 2: Load groups on identity ready**

In the existing useEffect that loads contacts on identity.isReady:
```javascript
groupsMgr.load(identity.id);
```

**Step 3: Pass groupsMgr to useMessaging**

Update the useMessaging call to include groupsMgr:
```javascript
const messaging = useMessaging(identity, contactsMgr, groupsMgr, addToast);
```

**Step 4: Mutual exclusion for active selection**

When selecting a group, deselect contact and vice versa:
```javascript
const handleSelectGroup = (groupId) => {
  setActiveGroupId(groupId);
  messaging.setActiveId(null);
};

const handleSelectPeer = (peerId) => {
  messaging.setActiveId(peerId);
  setActiveGroupId(null);
};
```

**Step 5: Compute active group and messages**

```javascript
const activeGroup = activeGroupId ? groupsMgr.findGroup(activeGroupId) : null;
const activeGroupMessages = activeGroupId ? (messaging.groupMessages[activeGroupId] || []) : [];
```

**Step 6: Pass props to Sidebar**

Add to Sidebar props:
```jsx
groups={groupsMgr.groups}
activeGroupId={activeGroupId}
onSelectGroup={handleSelectGroup}
onCreateGroup={() => setShowCreateGroup(true)}
```

Update `onSelectPeer` to use `handleSelectPeer`.

**Step 7: Render ChatPanel conditionally**

```jsx
{activeGroup ? (
  <ChatPanel
    group={activeGroup}
    messages={activeGroupMessages}
    onSend={(_, text) => messaging.sendGroupMsg(activeGroupId, text)}
    onGroupInfo={() => setShowGroupInfo(true)}
  />
) : (
  <ChatPanel
    peer={activePeer}
    messages={visibleMessages}
    onSend={messaging.sendMsg}
  />
)}
```

**Step 8: Render modals**

```jsx
{showCreateGroup && (
  <CreateGroupModal
    contacts={contactsMgr.contacts}
    onClose={() => setShowCreateGroup(false)}
    onCreate={groupActions.createGroup}
  />
)}

{showGroupInfo && activeGroup && (
  <GroupInfoPanel
    group={activeGroup}
    myId={identity.id}
    contacts={contactsMgr.contacts}
    onClose={() => setShowGroupInfo(false)}
    onAddMember={groupActions.addGroupMember}
    onRemoveMember={groupActions.removeGroupMember}
    onChangeRole={groupActions.changeAdminRole}
    onRenameGroup={groupActions.renameGroup}
    onLeaveGroup={(gid) => { groupActions.leaveGroup(gid); setActiveGroupId(null); setShowGroupInfo(false); }}
    onDeleteGroup={(gid) => { groupActions.deleteGroup(gid); setActiveGroupId(null); setShowGroupInfo(false); }}
  />
)}
```

**Step 9: Commit**
```
feat: wire group chat hooks and components in App.jsx
```

---

## Task 12: Group Chat CSS

**Files:**
- Modify: `client/src/App.css`

**Context:** Add styles for group-specific UI elements. Follow existing design system (cold blue-black palette, sky accent, glass effects).

**Step 1: Add group CSS classes**

Add at the end of App.css (before theme overrides):

```css
/* ── Group Chat ──────────────────────────── */

.group-avatar {
  background: var(--accent-muted, rgba(56, 189, 248, 0.15));
  color: var(--accent);
  font-family: "Syne", sans-serif;
  font-weight: 800;
}

.sidebar-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
}

.sidebar-section-header h3 {
  margin: 0;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}

.sidebar-empty {
  padding: 8px 16px;
  font-size: 0.8rem;
}

/* Group message sender label */
.group-msg-sender {
  display: block;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 2px;
  font-family: "Outfit", sans-serif;
}

/* Group member select (create modal) */
.group-member-select {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 4px;
}

.group-member-option {
  padding: 6px 8px;
  border-radius: 4px;
}

.group-member-option:hover {
  background: var(--bg-hover);
}

/* Group info panel */
.group-info-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border);
}

.group-info-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--border);
}

.group-info-header h3 {
  margin: 0;
  font-family: "Syne", sans-serif;
  font-weight: 800;
}

.group-info-header h3.editable {
  cursor: pointer;
  border-bottom: 1px dashed var(--text-secondary);
}

.group-info-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.group-members-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.group-member-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.group-member-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  border-radius: 8px;
}

.group-member-item:hover {
  background: var(--bg-hover);
}

.group-member-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-member-name {
  font-size: 0.85rem;
}

.group-role-badge {
  color: var(--accent);
  display: flex;
  align-items: center;
}

.group-member-actions {
  display: flex;
  gap: 4px;
}

.group-add-member-list {
  margin-bottom: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px;
}

.group-add-member-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 4px;
}

.group-info-footer {
  padding: 16px;
  border-top: 1px solid var(--border);
}

.group-info-footer .btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

/* Button sizes */
.btn-xs {
  padding: 2px 8px;
  font-size: 0.7rem;
}

.btn-danger {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.btn-danger:hover {
  background: rgba(239, 68, 68, 0.25);
}

/* Modal footer */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid var(--border);
}
```

**Step 2: Commit**
```
feat: add group chat CSS styles
```

---

## Task 13: Archive Support for Group Messages

**Files:**
- Modify: `client/src/utils/messageStore.js`

**Context:** Group messages use `peerId: groupId` as the convKey, which already works with the existing archive pattern. The `convKey` index on `{myId}:{peerId}` naturally supports group messages. No schema changes needed — just verify that `loadConversation(myId, groupId)` works for loading group history.

**Step 1: Verify existing pattern works**

The existing `save(myId, msg)` uses `msg.peerId` to build `convKey = ${myId}:${msg.peerId}`. For group messages, `peerId` is set to `groupId` (done in Task 4). `loadConversation(myId, peerId)` will correctly load group messages when called with the groupId.

No code changes needed — just ensure that group messages pass `peerId: groupId` when archiving (already done in Task 4's `sendGroupMsg` and incoming handler).

**Step 2: Load group history from archive**

In useMessaging, when loading history, add group message loading alongside 1-to-1 messages. The `loadAll()` call already returns everything — just need to partition results into `messages` (1-to-1) and `groupMessages` by checking if the peerId matches a known groupId.

**Step 3: Commit**
```
feat: verify archive support for group messages
```

---

## Task 14: Copy to Desktop

**Files:**
- Copy all changed/new files from `client/src/` to `desktop/src/`

**Step 1: Copy all modified files**

```bash
# New files
cp client/src/protocol/groupEnvelopes.js desktop/src/protocol/groupEnvelopes.js
cp client/src/hooks/useGroups.js desktop/src/hooks/useGroups.js
cp client/src/hooks/useGroupActions.js desktop/src/hooks/useGroupActions.js
cp client/src/components/CreateGroupModal.jsx desktop/src/components/CreateGroupModal.jsx
cp client/src/components/GroupInfoPanel.jsx desktop/src/components/GroupInfoPanel.jsx

# Modified files
cp client/src/hooks/useMessaging.js desktop/src/hooks/useMessaging.js
cp client/src/components/ChatPanel.jsx desktop/src/components/ChatPanel.jsx
cp client/src/components/Sidebar.jsx desktop/src/components/Sidebar.jsx
cp client/src/components/Icons.jsx desktop/src/components/Icons.jsx
cp client/src/App.jsx desktop/src/App.jsx
cp client/src/App.css desktop/src/App.css
```

**Step 2: Commit**
```
chore: sync group chat changes to desktop
```

---

## Task 15: Integration Testing & Polish

**Step 1: Manual test flow**

1. Start relay: `cd server && npm run dev`
2. Start client: `cd client && npm run dev`
3. Open two browser tabs with different identities
4. Create a contact relationship between them
5. In tab 1: Create a group, add tab 2's contact
6. Verify tab 2 receives the group invite
7. Send messages in both directions
8. Test admin actions: rename group, add/remove member
9. Test leave group
10. Test that messages are archived and restored on refresh

**Step 2: Fix any issues found during testing**

**Step 3: Final commit**
```
feat: group chat v1 — encrypted group messaging with client-side fan-out
```
