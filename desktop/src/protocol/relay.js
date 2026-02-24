// client/src/protocol/relay.js
// Communication with the Dissolve relay server.
// Handles both HTTP endpoints and authenticated WebSocket push notifications.
//
// WebSocket auth flow (Step 4):
// 1. Client fetches GET /ws-challenge → { nonce }
// 2. Client signs { nonce, authPub } with authPriv
// 3. Client sends { type:"auth", nonce, authPub, sig } over WS
// 4. Server verifies and binds socket to identity

import { signObject } from "../crypto/signing";

const DEFAULT_API = import.meta.env.VITE_API_URL || "http://localhost:3001";
const DEFAULT_WS = import.meta.env.VITE_WS_URL || "ws://localhost:3001/ws";

let _apiUrl = DEFAULT_API;
let _wsUrl = DEFAULT_WS;

/**
 * Get the current relay API URL.
 */
export function getRelayUrl() { return _apiUrl; }

/**
 * Get the current relay WebSocket URL.
 */
export function getRelayWsUrl() { return _wsUrl; }

/**
 * Set the relay URL at runtime. Derives the WS URL automatically.
 * @param {string} url - HTTP(S) URL of the relay (e.g. "https://relay.example.com")
 */
export function setRelayUrl(url) {
  if (!url || typeof url !== "string") return;
  _apiUrl = url.replace(/\/+$/, "");
  _wsUrl = _apiUrl.replace(/^http/, "ws") + "/ws";
}

/**
 * Reset relay URL to default (from env or localhost).
 */
export function resetRelayUrl() {
  _apiUrl = DEFAULT_API;
  _wsUrl = DEFAULT_WS;
}

/**
 * Make a JSON request to the relay.
 */
async function relayFetch(path, options = {}) {
  const url = `${_apiUrl}${path}`;
  const resp = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  return resp;
}

export async function publishCaps(toId, signedBody) {
  return relayFetch(`/caps/${encodeURIComponent(toId)}`, {
    method: "PUT",
    body: JSON.stringify(signedBody),
  });
}

export async function publishRequestCaps(toId, signedBody) {
  return relayFetch(`/requestCaps/${encodeURIComponent(toId)}`, {
    method: "PUT",
    body: JSON.stringify(signedBody),
  });
}

export async function sendEnvelope(signedEnvelope) {
  return relayFetch("/send", {
    method: "POST",
    body: JSON.stringify(signedEnvelope),
  });
}

/**
 * Drain inbox — POST with signed proof of ownership.
 */
export async function drainInbox(toId, signedBody) {
  const resp = await relayFetch(`/inbox/${encodeURIComponent(toId)}`, {
    method: "POST",
    body: JSON.stringify(signedBody),
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return Array.isArray(data.items) ? data.items : [];
}

/**
 * Drain request inbox — POST with signed proof of ownership.
 */
export async function drainRequestInbox(toId, signedBody) {
  const resp = await relayFetch(`/requests/inbox/${encodeURIComponent(toId)}`, {
    method: "POST",
    body: JSON.stringify(signedBody),
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return Array.isArray(data.items) ? data.items : [];
}

export async function blockOnRelay(toId, fromId, capHash, signedBody) {
  return relayFetch(`/block/${encodeURIComponent(toId)}`, {
    method: "POST",
    body: JSON.stringify(signedBody),
  });
}

export async function publishDirectoryEntry(handle, profile, sig) {
  return relayFetch("/directory/publish", {
    method: "POST",
    body: JSON.stringify({ handle, profile, sig }),
  });
}

export async function lookupDirectory(handle) {
  const resp = await relayFetch(`/directory/lookup?handle=${encodeURIComponent(handle)}`);
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.profile || null;
}

/**
 * Fetch a WebSocket authentication nonce from the relay.
 */
async function fetchWsChallenge() {
  const resp = await relayFetch("/ws-challenge");
  if (!resp.ok) throw new Error("Failed to get WS challenge");
  const data = await resp.json();
  return data.nonce;
}
export async function checkHandleAvailable(handle) {
  const resp = await relayFetch(`/directory/available?handle=${encodeURIComponent(handle)}`);
  if (!resp.ok) return false;
  const data = await resp.json();
  return !!data.available;
}
/**
 * Create an authenticated WebSocket connection.
 * Flow: fetch nonce → sign → authenticate → receive notifications.
 */
export function connectWebSocket(myId, authPubJwk, authPrivJwk, onNotify) {
  let ws = null;
  let reconnectTimer = null;
  let closed = false;

  async function connect() {
    if (closed) return;

    let nonce;
    try {
      nonce = await fetchWsChallenge();
    } catch {
      scheduleReconnect();
      return;
    }

    let sig;
    try {
      const authObj = { nonce, authPub: authPubJwk };
      sig = await signObject(authObj, authPrivJwk);
    } catch {
      scheduleReconnect();
      return;
    }

    try {
      ws = new WebSocket(_wsUrl);
    } catch {
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "auth",
        nonce,
        authPub: authPubJwk,
        sig,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "auth_ok") return;
        if (msg.type === "auth_error") {
          console.warn("[Dissolve WS] Auth failed:", msg.error);
          ws.close();
          return;
        }
        if (msg.type === "notify" && onNotify) {
          onNotify(msg.channel);
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      if (!closed) scheduleReconnect();
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  function scheduleReconnect() {
    if (closed) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 3000);
  }

  connect();

  return {
    close() {
      closed = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    },
  };
  
}
