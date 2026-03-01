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
import { randomId, capHashFromCap } from "../crypto";
import { signObject, verifyObject } from "../crypto/signing";
import { e2eeDecrypt } from "../crypto/e2ee";
import {
  drainInbox,
  drainRequestInbox,
  sendEnvelope,
  publishCaps,
  publishRequestCaps,
  connectWebSocket,
  getRelayUrl,
  setRelayUrl as setRelayUrlGlobal,
  resetRelayUrl,
} from "../protocol/relay";
import {
  buildCapsUpdate,
  buildMessage,
  buildContactRequest,
  buildContactGrant,
  buildDirectoryPublish,
  buildInboxDrain,
} from "../protocol/envelopes";
import { checkAndUpdateReplay } from "../utils/storage";
import { createMessageStore } from "../utils/messageStore";
import { POLL_INTERVAL_MS, CAP_REPUBLISH_INTERVAL_MS, SEND_RETRY_BASE_DELAY_MS } from "../config";

export function useMessaging(identity, contactsMgr) {
  const [messages, setMessages] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const wsRef = useRef(null);
  const pollTimerRef = useRef(null);
  const archiveRef = useRef(null);

  const {
    id: myId, label: myLabel,
    authPubJwk, authPrivJwk,
    e2eePubJwk, e2eePrivJwk,
    inboxCap, requestCap,
    isReady, discoverable, handle,
    archiveEnabled, relayUrl,
    computeId,
  } = identity;

  const {
    contactsRef, requestsRef,
    addContact, addOrUpdateRequest, findContact,
  } = contactsMgr;

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
      } catch {
        return; // can't decrypt — not for us or corrupted
      }

      if (!inner.from || !inner.t || !inner.authPub) return;

      // Verify the outer signature matches the inner sender
      const { sig, ...outerNoSig } = env;
      if (!sig) return;
      const outerOk = await verifyObject(outerNoSig, sig, inner.authPub);
      if (!outerOk) return;

      // Verify sender identity
      const computedFromId = await computeId(inner.authPub);
      if (computedFromId !== inner.from) return;

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

      // If sender unknown, add to requests
      const isKnownContact = contactsRef.current.find((c) => c.id === inner.from);
      if (!isKnownContact) {
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
        const msg = { dir: "in", peerId: inner.from, text: inner.text, ts: inner.ts, msgId: inner.msgId || randomId() };
        setMessages((prev) => [...prev, msg]);
        archiveRef.current?.save(myId, msg);
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
      }
    }
  }, [myId, e2eePrivJwk, computeId, contactsRef, requestsRef, addContact, addOrUpdateRequest]);

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

  // --- Sync relay URL when identity settings change ---
  useEffect(() => {
    if (relayUrl && relayUrl.trim()) {
      setRelayUrlGlobal(relayUrl.trim());
    } else {
      resetRelayUrl();
    }
  }, [relayUrl]);

  // --- Initialize message archive and load history (only if enabled) ---
  useEffect(() => {
    if (!isReady || !myId) return;
    if (!archiveEnabled) {
      archiveRef.current?.close();
      archiveRef.current = null;
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
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.msgId));
            const newFromHistory = history.filter((m) => !existingIds.has(m.msgId));
            const merged = [...newFromHistory, ...prev].sort((a, b) => a.ts - b.ts);
            return merged;
          });
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

    const publishAndStart = async () => {
      try {
        const capHash = await capHashFromCap(inboxCap);
        const capsBody = await buildCapsUpdate(myId, authPubJwk, authPrivJwk, [capHash]);
        await publishCaps(myId, capsBody);

        const reqCapHash = await capHashFromCap(requestCap);
        const reqCapsBody = await buildCapsUpdate(myId, authPubJwk, authPrivJwk, [reqCapHash]);
        await publishRequestCaps(myId, reqCapsBody);

        if (handle?.trim()) {
          const profile = {
            dissolveProtocol: 4, v: 4,
            id: myId, label: myLabel,
            authPublicJwk: authPubJwk,
            e2eePublicJwk: e2eePubJwk,
            requestCap: discoverable ? requestCap : undefined,
            requestCapHash: discoverable ? reqCapHash : undefined,
            discoverable: !!discoverable,
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

      wsRef.current = connectWebSocket(myId, authPubJwk, authPrivJwk, (_channel) => {
        fetchMessages();
      });

      pollTimerRef.current = setInterval(fetchMessages, POLL_INTERVAL_MS);

      const republishTimer = setInterval(async () => {
        try {
          const ch = await capHashFromCap(inboxCap);
          const cb = await buildCapsUpdate(myId, authPubJwk, authPrivJwk, [ch]);
          await publishCaps(myId, cb);
        } catch { /* ignore */ }
      }, CAP_REPUBLISH_INTERVAL_MS);

      return () => clearInterval(republishTimer);
    };

    const cleanupPromise = publishAndStart();

    return () => {
      destroyed = true;
      wsRef.current?.close();
      clearInterval(pollTimerRef.current);
      cleanupPromise?.then?.((cleanup) => cleanup?.());
    };
  }, [isReady, myId, authPubJwk, authPrivJwk, e2eePubJwk, inboxCap, requestCap, discoverable, handle, myLabel, fetchMessages]);

  // --- Send a message ---
  const sendMsg = useCallback(async (peerId, text) => {
    const peer = contactsRef.current.find((c) => c.id === peerId) ||
                 requestsRef.current.find((r) => r.id === peerId);
    if (!peer) throw new Error("Peer not found");
    if (typeof peer.cap !== "string") {
      throw new Error("This contact has no inbox capability. Re-import their contact card.");
    }

    const { envelope, msgId, ts } = await buildMessage(
      myId, myLabel, authPubJwk, authPrivJwk, e2eePubJwk,
      inboxCap, peer, text.trim()
    );

    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const resp = await sendEnvelope(envelope);
      if (resp.ok) {
        const outMsg = { dir: "out", peerId, text: text.trim(), ts, msgId };
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

  const reset = useCallback(() => {
    setMessages([]);
    setActiveId("");
    setHistoryLoaded(false);
    wsRef.current?.close();
    clearInterval(pollTimerRef.current);
    archiveRef.current?.close();
    archiveRef.current = null;
  }, []);

  return {
    messages, activeId, setActiveId,
    sendMsg, sendRequest, sendGrant,
    reset, historyLoaded,
  };
}
