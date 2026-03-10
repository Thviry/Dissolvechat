// client/src/hooks/useMessaging.js
// Handles message sending, receiving, decryption, and inbox polling.
//
// v4-secure changes:
// - Incoming envelopes have a flat `payload` (encrypted blob) instead of
//   cleartext `body.authPub`, `body.senderCap`, etc. We decrypt `payload`
//   to get the inner envelope with all sender info.
// - Inbox drain is authenticated (signed POST, not unauthenticated GET).
// - Backwards-compatible: still accepts old v4 envelopes with `body.msg.cipher`.

import { useState, useEffect, useRef, useCallback } from "react";
import { randomId, capHashFromCap } from "dissolve-core/crypto";
import { signObject, verifyObject } from "dissolve-core/crypto/signing";
import { e2eeDecrypt } from "dissolve-core/crypto/e2ee";
import { groupDecrypt } from "dissolve-core/crypto/group";
import { buildGroupMessage } from "@protocol/groupEnvelopes";
import {
  drainInbox,
  drainRequestInbox,
  sendEnvelope,
  publishCaps,
  publishRequestCaps,
  connectWebSocket,
  getRelayUrl,
  setRelayUrls as setRelayUrlsGlobal,
  resetRelayUrl,
} from "@protocol/relay";
import {
  buildCapsUpdate,
  buildMessage,
  buildContactRequest,
  buildContactGrant,
  buildDirectoryPublish,
  buildInboxDrain,
} from "@protocol/envelopes";
import { checkAndUpdateReplay } from "@utils/storage";
import { notifyIncoming, flashTitle } from "@utils/notifications";

import { createMessageStore } from "@utils/messageStore";
import { POLL_INTERVAL_MS, CAP_REPUBLISH_INTERVAL_MS, SEND_RETRY_BASE_DELAY_MS } from "@config";

export function useMessaging(identity, contactsMgr, groupsMgr, addToast) {
  const [messages, setMessages] = useState([]);
  const [groupMessages, setGroupMessages] = useState({});
  const groupMessagesRef = useRef(groupMessages);
  const [activeId, setActiveId] = useState("");
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const wsRef = useRef(null);
  const pollTimerRef = useRef(null);
  const archiveRef = useRef(null);
  const soundRef = useRef(true);

  const {
    id: myId, label: myLabel,
    authPubJwk, authPrivJwk,
    e2eePubJwk, e2eePrivJwk,
    inboxCap, requestCap,
    isReady, discoverable, handle,
    archiveEnabled, soundEnabled, showPresence, relayUrl,
    computeId,
  } = identity;

  const {
    contactsRef, requestsRef,
    addContact, addOrUpdateRequest, findContact,
  } = contactsMgr;

  useEffect(() => { soundRef.current = soundEnabled; }, [soundEnabled]);

  // --- Process incoming envelope (v4-secure format) ---
  const handleIncoming = useCallback(async (env) => {
    if (!env || env.p !== 4) return;
    if (env.to !== myId) return;

    // ── New secure format: opaque `payload` ──
    if (env.payload) {
      let inner;
      try {
        const decrypted = await e2eeDecrypt(env.payload, e2eePrivJwk);
        inner = JSON.parse(decrypted);
      } catch (err) {
        console.warn("[Dissolve] e2ee decrypt failed:", err.message || err);
        return; // can't decrypt — not for us or corrupted
      }

      // Group message detection: e2ee layer contains { g: true, groupId, iv, ct }
      // The group-decrypted inner won't have authPub — carry it from the outer envelope
      if (inner.g === true && inner.groupId) {
        const group = groupsMgr?.findGroup(inner.groupId);
        if (!group) {
          console.warn("[Dissolve] Received group message for unknown group:", inner.groupId?.slice(0, 12));
          return;
        }
        try {
          const outerAuthPub = env.authPub;
          const groupPlaintext = await groupDecrypt({ iv: inner.iv, ct: inner.ct }, group.groupKey);
          inner = JSON.parse(groupPlaintext);
          // Carry sender identity from outer envelope into group-decrypted inner
          if (!inner.authPub) inner.authPub = outerAuthPub;
        } catch (err) {
          console.warn("[Dissolve] Group decrypt failed:", err.message || err);
          return;
        }
      }

      if (!inner.from || !inner.t || !inner.authPub) {
        console.warn("[Dissolve] Dropping envelope: missing from/t/authPub", { from: !!inner.from, t: inner.t, authPub: !!inner.authPub });
        return;
      }

      // Verify the outer signature matches the inner sender
      const { sig, ...outerNoSig } = env;
      if (!sig) {
        console.warn("[Dissolve] Dropping envelope: no signature");
        return;
      }
      const outerOk = await verifyObject(outerNoSig, sig, inner.authPub);
      if (!outerOk) {
        console.warn("[Dissolve] Dropping envelope: signature verification failed for", inner.from?.slice(0, 12));
        return;
      }

      // Verify sender identity
      const computedFromId = await computeId(inner.authPub);
      if (computedFromId !== inner.from) {
        console.warn("[Dissolve] Dropping envelope: computeId mismatch", { computed: computedFromId?.slice(0, 12), from: inner.from?.slice(0, 12) });
        return;
      }

      // Timestamp validation — reject messages with timestamps too far in past or future
      if (inner.ts) {
        const now = Date.now();
        const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
        const MAX_FUTURE = 5 * 60 * 1000; // 5 minutes (clock skew tolerance)
        if (inner.ts < now - MAX_AGE || inner.ts > now + MAX_FUTURE) {
          console.warn("[Dissolve] Dropping envelope: timestamp out of range", { ts: inner.ts, now });
          return;
        }
      }

      // Replay protection
      const convId = inner.convId;
      const seq = Number(inner.seq || 0);
      if (convId && seq) {
        if (!checkAndUpdateReplay(myId, inner.from, convId, seq, inner.t)) return;
      }

      // Handle by type
      if (inner.t === "ContactGrant") {
        const card = inner.card;
        if (card?.id && card?.authPublicJwk && card?.e2eePublicJwk) {
          addContact({
            id: card.id,
            label: card.label || "Contact",
            authPublicJwk: card.authPublicJwk,
            e2eePublicJwk: card.e2eePublicJwk,
            cap: typeof card.cap === "string" ? card.cap : null,
          });
        }
      }

      // If sender unknown, add to requests (only if we have enough info for future contact)
      const isKnownContact = contactsRef.current.find((c) => c.id === inner.from);
      if (!isKnownContact && inner.e2eePub) {
        let preview = "";
        if (inner.t === "ContactRequest") {
          preview = (typeof inner.note === "string" && inner.note.trim())
            ? inner.note.trim()
            : "Wants to connect";
        } else if (inner.t === "ContactGrant") {
          preview = "Accepted your request";
        } else {
          preview = inner.text || "";
        }

        addOrUpdateRequest({
          id: inner.from,
          label: inner.senderLabel || "Unknown",
          authPublicJwk: inner.authPub,
          e2eePublicJwk: inner.e2eePub,
          cap: typeof inner.senderCap === "string" ? inner.senderCap : null,
          lastMessagePreview: preview.slice(0, 80),
        });
      }

      // Show in chat
      if (inner.t === "Message") {
        const msg = {
          dir: "in", peerId: inner.from, text: inner.text, ts: inner.ts,
          msgId: inner.msgId || randomId(),
          file: inner.file || undefined,
        };
        setMessages((prev) => [...prev, msg]);
        archiveRef.current?.save(myId, msg);
        if (soundRef.current) notifyIncoming(); else flashTitle();
      }

      // --- Group message types ---
      if (inner.t === "GroupMessage") {
        if (inner.from === myId) return; // ignore own messages echoed back
        const msg = {
          dir: "in",
          from: inner.from,
          senderLabel: inner.senderLabel,
          text: inner.text,
          ts: inner.ts,
          msgId: inner.msgId,
          file: inner.file || undefined,
        };
        setGroupMessages((prev) => ({
          ...prev,
          [inner.groupId]: [...(prev[inner.groupId] || []), msg],
        }));
        groupMessagesRef.current = {
          ...groupMessagesRef.current,
          [inner.groupId]: [...(groupMessagesRef.current[inner.groupId] || []), msg],
        };
        if (archiveRef.current) {
          archiveRef.current.save(myId, { ...msg, peerId: inner.groupId });
        }
        if (soundRef.current) notifyIncoming(); else flashTitle();
      }

      if (inner.t === "GroupInvite" && groupsMgr) {
        const group = {
          groupId: inner.groupId,
          groupName: inner.groupName,
          groupKey: inner.groupKey,
          members: inner.members,
          creator: inner.creator,
          createdAt: inner.ts,
        };
        groupsMgr.addGroup(group);
        addToast?.(`Added to group: ${inner.groupName}`);
      }

      if (inner.t === "GroupMemberAdded" && groupsMgr) {
        groupsMgr.addMember(inner.groupId, inner.member);
        addToast?.(`${inner.member.label} joined the group`);
      }

      if (inner.t === "GroupMemberRemoved" && groupsMgr) {
        if (inner.removedId === myId) {
          groupsMgr.removeGroup(inner.groupId);
          addToast?.("You were removed from a group");
        } else {
          groupsMgr.updateGroup(inner.groupId, () => ({
            groupKey: inner.groupKey,
            members: inner.members,
          }));
          addToast?.(`A member was removed from the group`);
        }
      }

      if (inner.t === "GroupAdminChange" && groupsMgr) {
        groupsMgr.setMemberRole(inner.groupId, inner.targetId, inner.newRole);
      }

      if (inner.t === "GroupLeave" && groupsMgr) {
        groupsMgr.removeMember(inner.groupId, inner.from);
        addToast?.(`${inner.senderLabel} left the group`);
      }

      if (inner.t === "GroupNameChange" && groupsMgr) {
        groupsMgr.renameGroup(inner.groupId, inner.groupName);
      }

      return;
    }

    // ── Legacy v4 format (backwards compat) ──
    if (env.body?.msg?.cipher) {
      const { sig, ...noSig } = env;
      const authPub = env?.body?.authPub;
      const senderE2eePub = env?.body?.e2eePub;
      const msg = env?.body?.msg;
      if (!sig || !authPub || !senderE2eePub || !msg) return;

      const computedFromId = await computeId(authPub);
      if (computedFromId !== env.from) return;

      const ok = await verifyObject(noSig, sig, authPub);
      if (!ok) return;

      const convId = msg.convId;
      const seq = Number(msg.seq || 0);
      if (!checkAndUpdateReplay(myId, env.from, convId, seq, env.t)) return;

      let plaintext = "";
      try {
        plaintext = await e2eeDecrypt(msg.cipher, e2eePrivJwk);
      } catch {
        return;
      }

      if (env.t === "ContactGrant") {
        try {
          const parsed = JSON.parse(plaintext);
          const card = parsed?.card;
          if (card?.id && card?.authPublicJwk && card?.e2eePublicJwk) {
            addContact({
              id: card.id,
              label: card.label || "Contact",
              authPublicJwk: card.authPublicJwk,
              e2eePublicJwk: card.e2eePublicJwk,
              cap: typeof card.cap === "string" ? card.cap : null,
            });
          }
        } catch { /* ignore */ }
      }

      const isKnownContact = contactsRef.current.find((c) => c.id === env.from);
      if (!isKnownContact) {
        const senderCap = env?.body?.senderCap;
        const senderLabel = env?.body?.senderLabel;
        let preview = "";
        if (env.t === "ContactRequest") {
          try {
            const parsed = JSON.parse(plaintext);
            preview = (typeof parsed?.note === "string" && parsed.note.trim()) ? parsed.note.trim() : "Wants to connect";
          } catch { preview = "Wants to connect"; }
        } else if (env.t === "ContactGrant") {
          preview = "Accepted your request";
        } else {
          preview = plaintext;
        }
        addOrUpdateRequest({
          id: env.from,
          label: senderLabel || "Unknown",
          authPublicJwk: authPub,
          e2eePublicJwk: senderE2eePub,
          cap: typeof senderCap === "string" ? senderCap : null,
          lastMessagePreview: preview.slice(0, 80),
        });
      }

      if (env.t === "Message") {
        const archMsg = { dir: "in", peerId: env.from, text: plaintext, ts: env.ts, msgId: msg.msgId || randomId() };
        setMessages((prev) => [...prev, archMsg]);
        archiveRef.current?.save(myId, archMsg);
        if (soundRef.current) notifyIncoming(); else flashTitle();
      }
    }
  }, [myId, e2eePrivJwk, computeId, contactsRef, requestsRef, addContact, addOrUpdateRequest, groupsMgr, addToast]);

  // --- Fetch and process all pending messages (authenticated) ---
  const fetchMessages = useCallback(async () => {
    if (!isReady) return;
    try {
      // Build signed drain requests (Fix #1)
      const drainBody = await buildInboxDrain(myId, authPubJwk, authPrivJwk);

      const items = await drainInbox(myId, drainBody);
      for (const env of items) await handleIncoming(env);

      const reqItems = await drainRequestInbox(myId, drainBody);
      for (const env of reqItems) await handleIncoming(env);
    } catch { /* ignore */ }
  }, [isReady, myId, authPubJwk, authPrivJwk, handleIncoming]);

  // --- Sync relay URL(s) when identity settings change ---
  useEffect(() => {
    if (relayUrl && relayUrl.trim()) {
      const urls = relayUrl.split(/[\n,]/).map(u => u.trim()).filter(Boolean);
      setRelayUrlsGlobal(urls.length ? urls : []);
    } else {
      resetRelayUrl();
    }
  }, [relayUrl]);

  // --- Initialize message archive and load history (only if enabled) ---
  useEffect(() => {
    if (!isReady || !myId) return;
    if (!archiveEnabled) {
      if (archiveRef.current) {
        // Was open this session — clear persisted data so it can't resurface on re-enable
        const store = archiveRef.current;
        archiveRef.current = null;
        store.clear().finally(() => store.close());
      } else {
        // Store wasn't open this session but stale data may exist from a prior session
        // where archive was on. Wipe it so enabling archive later starts clean.
        createMessageStore(JSON.stringify(e2eePrivJwk))
          .then(store => store.clear().finally(() => store.close()))
          .catch(() => {});
      }
      setHistoryLoaded(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const store = await createMessageStore(JSON.stringify(e2eePrivJwk));
        archiveRef.current = store;

        const history = await store.loadAll();
        if (!cancelled && history.length > 0) {
          // Partition into 1-to-1 and group messages
          const groupIds = new Set((groupsMgr?.groups || []).map((g) => g.groupId));
          const dmHistory = [];
          const grpHistory = {};
          for (const m of history) {
            if (groupIds.has(m.peerId)) {
              if (!grpHistory[m.peerId]) grpHistory[m.peerId] = [];
              grpHistory[m.peerId].push(m);
            } else {
              dmHistory.push(m);
            }
          }
          if (dmHistory.length > 0) {
            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.msgId));
              const newFromHistory = dmHistory.filter((m) => !existingIds.has(m.msgId));
              return [...newFromHistory, ...prev].sort((a, b) => a.ts - b.ts);
            });
          }
          if (Object.keys(grpHistory).length > 0) {
            setGroupMessages((prev) => {
              const merged = { ...prev };
              for (const [gid, msgs] of Object.entries(grpHistory)) {
                const existing = merged[gid] || [];
                const existingIds = new Set(existing.map((m) => m.msgId));
                const newMsgs = msgs.filter((m) => !existingIds.has(m.msgId));
                merged[gid] = [...newMsgs, ...existing].sort((a, b) => a.ts - b.ts);
              }
              return merged;
            });
            groupMessagesRef.current = { ...groupMessagesRef.current, ...grpHistory };
          }
        }
        setHistoryLoaded(true);
      } catch (err) {
        console.warn("[Archive] Init failed:", err.message);
        setHistoryLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
      archiveRef.current?.close();
      archiveRef.current = null;
    };
  }, [isReady, myId, archiveEnabled]);

  // --- Publish capabilities and start polling/websocket ---
  useEffect(() => {
    if (!isReady) return;

    let destroyed = false;

    // Republish caps to the relay — called on startup, WS reconnect, and periodically
    const republishCaps = async () => {
      try {
        const ch = await capHashFromCap(inboxCap);
        const cb = await buildCapsUpdate(myId, authPubJwk, authPrivJwk, [ch]);
        await publishCaps(myId, cb);
        const rch = await capHashFromCap(requestCap);
        const rcb = await buildCapsUpdate(myId, authPubJwk, authPrivJwk, [rch]);
        await publishRequestCaps(myId, rcb);
      } catch (err) {
        console.warn("[Dissolve] Caps publish failed:", err.message || err);
      }
    };

    const publishAndStart = async () => {
      await republishCaps();

      try {
        if (handle?.trim()) {
          const reqCapHash = await capHashFromCap(requestCap);
          const profile = {
            dissolveProtocol: 4, v: 4,
            id: myId, label: myLabel,
            authPublicJwk: authPubJwk,
            e2eePublicJwk: e2eePubJwk,
            requestCap: discoverable ? requestCap : undefined,
            requestCapHash: discoverable ? reqCapHash : undefined,
            discoverable: !!discoverable,
            showPresence: !!showPresence,
          };
          const dirBody = await buildDirectoryPublish(handle.trim(), profile, authPrivJwk);
          await fetch(
            `${getRelayUrl()}/directory/publish`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(dirBody),
            }
          ).catch(() => {});
        }
      } catch { /* ignore */ }

      if (destroyed) return;

      fetchMessages();

      wsRef.current = connectWebSocket(myId, authPubJwk, authPrivJwk,
        (_channel) => { fetchMessages(); },
        () => {
          // WS (re)authenticated — republish caps immediately so the relay
          // has them even after a restart, then fetch any queued messages.
          console.log("[Dissolve] WS authenticated — republishing caps");
          republishCaps().then(() => { if (!destroyed) fetchMessages(); });
        }
      );

      pollTimerRef.current = setInterval(fetchMessages, POLL_INTERVAL_MS);

      const republishTimer = setInterval(republishCaps, CAP_REPUBLISH_INTERVAL_MS);

      return () => clearInterval(republishTimer);
    };

    const cleanupPromise = publishAndStart();

    return () => {
      destroyed = true;
      wsRef.current?.close();
      clearInterval(pollTimerRef.current);
      cleanupPromise?.then?.((cleanup) => cleanup?.());
    };
  }, [isReady, myId, authPubJwk, authPrivJwk, e2eePubJwk, inboxCap, requestCap, discoverable, showPresence, handle, myLabel, fetchMessages]);

  // --- Send a message ---
  const sendMsg = useCallback(async (peerId, text, file) => {
    const peer = contactsRef.current.find((c) => c.id === peerId) ||
                 requestsRef.current.find((r) => r.id === peerId);
    if (!peer) throw new Error("Peer not found");
    if (typeof peer.cap !== "string") {
      throw new Error("This contact has no inbox capability. Re-import their contact card.");
    }

    const { envelope, msgId, ts } = await buildMessage(
      myId, myLabel, authPubJwk, authPrivJwk, e2eePubJwk,
      inboxCap, peer, text.trim(), file || undefined
    );

    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const resp = await sendEnvelope(envelope);
      if (resp.ok) {
        if (resp.status === 202) {
          console.warn("[Dissolve] Message queued on relay — recipient caps not yet registered");
        }
        const outMsg = { dir: "out", peerId, text: text.trim(), ts, msgId, file: file || undefined };
        setMessages((prev) => [...prev, outMsg]);
        archiveRef.current?.save(myId, outMsg);
        return;
      }

      let errData;
      try { errData = await resp.json(); } catch { errData = {}; }
      lastError = errData.error || `${resp.status}`;
      console.warn(`[Dissolve] Send attempt ${attempt + 1} failed:`, lastError);

      if (errData.error === "cap_not_allowed" || errData.error === "request_cap_not_allowed") {
        await new Promise((r) => setTimeout(r, SEND_RETRY_BASE_DELAY_MS * (attempt + 1)));
        continue;
      }

      break;
    }

    throw new Error(`Send failed: ${lastError}`);
  }, [myId, myLabel, authPubJwk, authPrivJwk, e2eePubJwk, inboxCap, contactsRef, requestsRef]);

  // --- Send contact request ---
  const sendRequest = useCallback(async (recipient) => {
    const envelope = await buildContactRequest(
      myId, myLabel, authPubJwk, authPrivJwk, e2eePubJwk, inboxCap, recipient
    );
    const resp = await sendEnvelope(envelope);
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      throw new Error(`Request failed: ${resp.status} ${errText}`);
    }
  }, [myId, myLabel, authPubJwk, authPrivJwk, e2eePubJwk, inboxCap]);

  // --- Send contact grant ---
  const sendGrant = useCallback(async (recipient) => {
    if (typeof recipient.cap !== "string" || !recipient.cap) return;
    const envelope = await buildContactGrant(
      myId, myLabel, authPubJwk, authPrivJwk, e2eePubJwk, inboxCap, recipient
    );
    await sendEnvelope(envelope).catch(() => {});
  }, [myId, myLabel, authPubJwk, authPrivJwk, e2eePubJwk, inboxCap]);

  // --- Send a group message (fan-out to all members) ---
  const sendGroupMsg = useCallback(async (groupId, text, file) => {
    if (!groupsMgr) return;
    const group = groupsMgr.findGroup(groupId);
    if (!group) return;

    const { envelopes, msgId, ts } = await buildGroupMessage(
      myId, myLabel, authPubJwk, authPrivJwk, e2eePubJwk,
      inboxCap, groupId, group.groupKey, group.members, text.trim(), file || undefined
    );

    const results = await Promise.allSettled(
      envelopes.map(({ envelope }) => sendEnvelope(envelope))
    );

    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      console.warn(`[Dissolve] Group send: ${failures.length}/${envelopes.length} failed`);
    }

    const msg = { dir: "out", from: myId, senderLabel: myLabel, text: text.trim(), ts, msgId, file: file || undefined };
    setGroupMessages((prev) => ({
      ...prev,
      [groupId]: [...(prev[groupId] || []), msg],
    }));
    groupMessagesRef.current = {
      ...groupMessagesRef.current,
      [groupId]: [...(groupMessagesRef.current[groupId] || []), msg],
    };

    if (archiveRef.current) {
      archiveRef.current.save(myId, { ...msg, peerId: groupId });
    }
  }, [myId, myLabel, authPubJwk, authPrivJwk, e2eePubJwk, inboxCap, groupsMgr]);

  const reset = useCallback(() => {
    setMessages([]);
    setGroupMessages({});
    groupMessagesRef.current = {};
    setActiveId("");
    setHistoryLoaded(false);
    wsRef.current?.close();
    clearInterval(pollTimerRef.current);
    archiveRef.current?.close();
    archiveRef.current = null;
  }, []);

  return {
    messages, activeId, setActiveId,
    groupMessages,
    sendMsg, sendGroupMsg, sendRequest, sendGrant,
    reset, historyLoaded,
  };
}
