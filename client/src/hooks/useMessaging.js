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
  isRateLimited,
} from "@protocol/relay";
import {
  buildCapsUpdate,
  buildMessage,
  buildContactRequest,
  buildContactGrant,
  buildDirectoryPublish,
  buildInboxDrain,
  buildDeliveryReceipt,
} from "@protocol/envelopes";
import { checkAndUpdateReplay } from "@utils/storage";
import { notifyIncoming, flashTitle } from "@utils/notifications";

import { createMessageStore } from "@utils/messageStore";
import { POLL_INTERVAL_MS, CAP_REPUBLISH_INTERVAL_MS, SEND_RETRY_BASE_DELAY_MS } from "@config";

export function useMessaging(identity, contactsMgr, groupsMgr, addToast) {
  const [messages, setMessages] = useState([]);
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const [groupMessages, setGroupMessages] = useState({});
  const groupMessagesRef = useRef(groupMessages);
  const [activeId, setActiveId] = useState("");
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`unread:${identity.id}`) || "{}");
    } catch { return {}; }
  });
  const [lastMessages, setLastMessages] = useState({});
  const activeIdRef = useRef(activeId);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  const wsRef = useRef(null);
  const pollTimerRef = useRef(null);
  const archiveRef = useRef(null);
  const soundRef = useRef(true);
  const fetchMessagesRef = useRef(null);

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

  // --- Update message status (for receipts) ---
  const STATUS_ORDER = { sending: 0, sent: 1, queued: 2, delivered: 3, read: 4, failed: -1 };
  const updateMessageStatus = useCallback((messageIds, status) => {
    setMessages((prev) => prev.map((m) => {
      if (!messageIds.includes(m.msgId)) return m;
      // Only upgrade status, never downgrade (e.g. don't go from "read" back to "delivered")
      const current = STATUS_ORDER[m.status] ?? -1;
      const next = STATUS_ORDER[status] ?? -1;
      if (next <= current) return m;
      return { ...m, status };
    }));
    if (archiveRef.current) {
      for (const id of messageIds) {
        const msg = messagesRef.current.find((m) => m.msgId === id);
        if (msg) archiveRef.current.save(myId, { ...msg, status });
      }
    }
  }, [myId]);

  // --- Send read receipts ---
  // --- Process incoming envelope (v4-secure format) ---
  const handleIncoming = useCallback(async (env) => {
    if (!env || env.p !== 4) {
      console.warn("[Dissolve] Dropping envelope: missing or wrong protocol", env?.p);
      return;
    }
    if (env.to !== myId) {
      console.warn("[Dissolve] Dropping envelope: to mismatch", { envTo: env.to?.slice(0, 12), myId: myId?.slice(0, 12) });
      return;
    }

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

      // Replay protection (keyed on msgId — unique per message, survives device recovery)
      const convId = inner.convId || inner.groupId;
      const msgId = inner.msgId;
      if (convId && msgId) {
        if (!checkAndUpdateReplay(myId, inner.from, convId, msgId, inner.t)) return;
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

      // --- Receipt envelope types ---
      if (inner.t === "DeliveryReceipt") {
        if (Array.isArray(inner.messageIds)) {
          updateMessageStatus(inner.messageIds, "delivered");
        }
        return;
      }

      if (inner.t === "ReadReceipt") {
        // Read receipts removed — silently ignore
        return;
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
        // Track unread count (skip if this peer's chat is active)
        if (activeIdRef.current !== inner.from) {
          setUnreadCounts((prev) => {
            const updated = { ...prev, [inner.from]: (prev[inner.from] || 0) + 1 };
            localStorage.setItem(`unread:${myId}`, JSON.stringify(updated));
            return updated;
          });
        }
        // Track last message preview
        setLastMessages((prev) => ({
          ...prev,
          [inner.from]: { text: inner.file ? "Attachment" : (inner.text || "").slice(0, 80), ts: inner.ts },
        }));
        if (soundRef.current) notifyIncoming(); else flashTitle();
        return { from: inner.from, msgId: msg.msgId };
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
        // Track unread count for group
        if (activeIdRef.current !== inner.groupId) {
          setUnreadCounts((prev) => {
            const updated = { ...prev, [inner.groupId]: (prev[inner.groupId] || 0) + 1 };
            localStorage.setItem(`unread:${myId}`, JSON.stringify(updated));
            return updated;
          });
        }
        // Track last message preview for group
        setLastMessages((prev) => ({
          ...prev,
          [inner.groupId]: { text: inner.file ? "Attachment" : (inner.text || "").slice(0, 80), ts: inner.ts },
        }));
        if (soundRef.current) notifyIncoming(); else flashTitle();
        return { from: inner.from, msgId: inner.msgId };
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
      const legacyMsgId = msg.msgId || `legacy:${msg.seq || 0}`;
      if (!checkAndUpdateReplay(myId, env.from, convId, legacyMsgId, env.t)) return;

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
  }, [myId, e2eePrivJwk, computeId, contactsRef, requestsRef, addContact, addOrUpdateRequest, groupsMgr, addToast, updateMessageStatus]);

  // --- Fetch and process all pending messages (authenticated) ---
  const fetchMessages = useCallback(async () => {
    if (!isReady) return;
    try {
      const drainBody = await buildInboxDrain(myId, authPubJwk, authPrivJwk);

      const items = await drainInbox(myId, drainBody);
      const processedMsgs = [];
      for (const env of items) {
        const result = await handleIncoming(env);
        if (result) processedMsgs.push(result);
      }

      const reqItems = await drainRequestInbox(myId, drainBody);
      for (const env of reqItems) await handleIncoming(env);

      // Send batched delivery receipts
      const receiptsByPeer = {};
      for (const { from, msgId } of processedMsgs) {
        if (!receiptsByPeer[from]) receiptsByPeer[from] = [];
        receiptsByPeer[from].push(msgId);
      }
      for (const [peerId, messageIds] of Object.entries(receiptsByPeer)) {
        const peer = contactsRef.current.find((c) => c.id === peerId) ||
                     requestsRef.current.find((r) => r.id === peerId);
        if (!peer || typeof peer.cap !== "string") continue;
        try {
          const { envelope } = await buildDeliveryReceipt(
            myId, authPubJwk, authPrivJwk, e2eePubJwk,
            inboxCap, peer, messageIds
          );
          await sendEnvelope(envelope);
        } catch (err) {
          console.warn("[Dissolve] Failed to send delivery receipt:", err.message);
        }
      }
    } catch (err) {
      console.error("[Dissolve] fetchMessages failed:", err.message || err);
    }
  }, [isReady, myId, authPubJwk, authPrivJwk, e2eePubJwk, inboxCap, handleIncoming, contactsRef, requestsRef]);

  // Keep ref updated so the main effect can use the latest fetchMessages without re-running
  useEffect(() => { fetchMessagesRef.current = fetchMessages; }, [fetchMessages]);

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
          // Normalize archived messages: default outgoing status to "sent" for old messages
          const normalizedDm = dmHistory.map((m) => ({
            ...m,
            status: m.status || (m.dir === "out" ? "sent" : undefined),
          }));
          if (normalizedDm.length > 0) {
            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.msgId));
              const newFromHistory = normalizedDm.filter((m) => !existingIds.has(m.msgId));
              return [...newFromHistory, ...prev].sort((a, b) => a.ts - b.ts);
            });
          }
          // Normalize archived group messages: default outgoing status to "sent"
          const normalizedGrp = {};
          for (const [gid, msgs] of Object.entries(grpHistory)) {
            normalizedGrp[gid] = msgs.map((m) => ({
              ...m,
              status: m.status || (m.dir === "out" ? "sent" : undefined),
            }));
          }
          if (Object.keys(normalizedGrp).length > 0) {
            setGroupMessages((prev) => {
              const merged = { ...prev };
              for (const [gid, msgs] of Object.entries(normalizedGrp)) {
                const existing = merged[gid] || [];
                const existingIds = new Set(existing.map((m) => m.msgId));
                const newMsgs = msgs.filter((m) => !existingIds.has(m.msgId));
                merged[gid] = [...newMsgs, ...existing].sort((a, b) => a.ts - b.ts);
              }
              return merged;
            });
            groupMessagesRef.current = { ...groupMessagesRef.current, ...normalizedGrp };
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
      if (isRateLimited()) {
        console.warn("[Dissolve] Skipping caps republish — rate-limited");
        return;
      }
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

    let isInitialWsConnect = true;

    const publishAndStart = async () => {
      if (destroyed) return;
      await republishCaps();
      if (destroyed) return;

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

      fetchMessagesRef.current?.();

      // Debounced fetch — batches rapid WS notifications into a single drain
      let wsDebounceTimer = null;
      const debouncedFetch = () => {
        if (destroyed) return;
        clearTimeout(wsDebounceTimer);
        wsDebounceTimer = setTimeout(() => {
          if (!destroyed && !isRateLimited()) fetchMessagesRef.current?.();
        }, 500);
      };

      wsRef.current = connectWebSocket(myId, authPubJwk, authPrivJwk,
        (_channel) => { debouncedFetch(); },
        () => {
          if (isInitialWsConnect) {
            // Caps already published by publishAndStart — just fetch messages
            isInitialWsConnect = false;
            if (!destroyed) fetchMessagesRef.current?.();
            return;
          }
          // WS REconnected after disconnect — republish caps
          console.log("[Dissolve] WS reconnected — republishing caps");
          republishCaps().then(() => { if (!destroyed) fetchMessagesRef.current?.(); });
        }
      );

      if (destroyed) return;

      pollTimerRef.current = setInterval(() => {
        if (!isRateLimited()) fetchMessagesRef.current?.();
      }, POLL_INTERVAL_MS);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, myId, authPubJwk, authPrivJwk, e2eePubJwk, inboxCap, requestCap, discoverable, showPresence, handle, myLabel]);

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

    const outMsg = { dir: "out", peerId, text: text.trim(), ts, msgId, file: file || undefined, status: "sending" };
    setMessages((prev) => [...prev, outMsg]);
    // Update last message preview for this peer
    setLastMessages((prev) => ({
      ...prev,
      [peerId]: { text: file ? "Attachment" : text.trim().slice(0, 80), ts },
    }));

    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const resp = await sendEnvelope(envelope);
      if (resp.ok) {
        const newStatus = resp.status === 202 ? "queued" : "sent";
        setMessages((prev) => prev.map((m) => m.msgId === msgId ? { ...m, status: newStatus } : m));
        archiveRef.current?.save(myId, { ...outMsg, status: newStatus });
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

    setMessages((prev) => prev.map((m) => m.msgId === msgId ? { ...m, status: "failed", error: lastError } : m));
  }, [myId, myLabel, authPubJwk, authPrivJwk, e2eePubJwk, inboxCap, contactsRef, requestsRef]);

  // --- Retry a failed message ---
  const retryMsg = useCallback(async (msgId) => {
    const msg = messagesRef.current.find((m) => m.msgId === msgId);
    if (!msg || msg.status !== "failed") return;

    const peer = contactsRef.current.find((c) => c.id === msg.peerId) ||
                 requestsRef.current.find((r) => r.id === msg.peerId);
    if (!peer || typeof peer.cap !== "string") return;

    setMessages((prev) => prev.map((m) => m.msgId === msgId ? { ...m, status: "sending", error: undefined } : m));

    const { envelope } = await buildMessage(
      myId, myLabel, authPubJwk, authPrivJwk, e2eePubJwk,
      inboxCap, peer, msg.text, msg.file || undefined
    );

    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const resp = await sendEnvelope(envelope);
      if (resp.ok) {
        const newStatus = resp.status === 202 ? "queued" : "sent";
        setMessages((prev) => prev.map((m) => m.msgId === msgId ? { ...m, status: newStatus, error: undefined } : m));
        archiveRef.current?.save(myId, { ...msg, status: newStatus });
        return;
      }
      let errData;
      try { errData = await resp.json(); } catch { errData = {}; }
      lastError = errData.error || `${resp.status}`;
      if (errData.error === "cap_not_allowed" || errData.error === "request_cap_not_allowed") {
        await new Promise((r) => setTimeout(r, SEND_RETRY_BASE_DELAY_MS * (attempt + 1)));
        continue;
      }
      break;
    }

    setMessages((prev) => prev.map((m) => m.msgId === msgId ? { ...m, status: "failed", error: lastError } : m));
  }, [myId, myLabel, authPubJwk, authPrivJwk, e2eePubJwk, inboxCap, contactsRef, requestsRef]);

  // --- Dismiss a failed message ---
  const dismissMsg = useCallback((msgId) => {
    setMessages((prev) => prev.filter((m) => m.msgId !== msgId));
    archiveRef.current?.delete(msgId);
  }, []);

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
    const resp = await sendEnvelope(envelope);
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      throw new Error(`Grant failed: ${resp.status} ${errText}`);
    }
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
    // Update last message preview for this group
    setLastMessages((prev) => ({
      ...prev,
      [groupId]: { text: file ? "Attachment" : text.trim().slice(0, 80), ts },
    }));
  }, [myId, myLabel, authPubJwk, authPrivJwk, e2eePubJwk, inboxCap, groupsMgr]);

  // --- Select a peer/group and clear its unread count ---
  const selectPeer = useCallback((peerId) => {
    setActiveId(peerId);
    activeIdRef.current = peerId;
    if (peerId && unreadCounts[peerId]) {
      setUnreadCounts((prev) => {
        const updated = { ...prev };
        delete updated[peerId];
        localStorage.setItem(`unread:${myId}`, JSON.stringify(updated));
        return updated;
      });
    }
  }, [myId, unreadCounts]);

  const reset = useCallback(() => {
    setMessages([]);
    setGroupMessages({});
    groupMessagesRef.current = {};
    setActiveId("");
    setHistoryLoaded(false);
    setUnreadCounts({});
    setLastMessages({});
    wsRef.current?.close();
    clearInterval(pollTimerRef.current);
    archiveRef.current?.close();
    archiveRef.current = null;
  }, []);

  return {
    messages, activeId, setActiveId: selectPeer,
    groupMessages,
    sendMsg, sendGroupMsg, sendRequest, sendGrant,
    retryMsg, dismissMsg, updateMessageStatus,
    reset, historyLoaded,
    unreadCounts, lastMessages,
  };
}
