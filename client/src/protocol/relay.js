// client/src/protocol/relay.js
// Communication with the Dissolve relay server.
// Handles both HTTP endpoints and authenticated WebSocket push notifications.
//
// WebSocket auth flow (Step 4):
// 1. Client fetches GET /ws-challenge → { nonce }
// 2. Client signs { nonce, authPub } with authPriv
// 3. Client sends { type:"auth", nonce, authPub, sig } over WS
// 4. Server verifies and binds socket to identity

import { signObject } from "dissolve-core/crypto/signing";
import { WS_RECONNECT_DELAY_MS } from "@config";

const DEFAULT_API = import.meta.env.VITE_API_URL || "https://relay.dissolve.chat";

let _relayUrls = [DEFAULT_API]; // array of HTTP base URLs (no trailing slash)

// Rate-limit backoff state (shared across all relay calls)
let _rateLimitedUntil = 0; // timestamp when we can retry after a 429

/**
 * Get the current relay API URL (first relay, for backward compat).
 */
export function getRelayUrl() { return _relayUrls[0]; }

/**
 * Get the current relay WebSocket URL (first relay, for backward compat).
 */
export function getRelayWsUrl() {
  return _relayUrls[0].replace(/^http/, "ws") + "/ws";
}

/**
 * Set the relay URLs at runtime (multi-relay support).
 * @param {string[]} urls - Array of HTTP(S) relay base URLs
 */
export function setRelayUrls(urls) {
  if (!Array.isArray(urls) || urls.length === 0) return;
  _relayUrls = urls
    .map(u => (typeof u === "string" ? u.trim().replace(/\/+$/, "") : ""))
    .filter(Boolean);
  if (_relayUrls.length === 0) _relayUrls = [DEFAULT_API];
}

/** @deprecated Use setRelayUrls([url]) instead. Kept for backward compatibility. */
export function setRelayUrl(url) {
  setRelayUrls([url]);
}

/**
 * Reset relay URLs to default (from env or localhost).
 */
export function resetRelayUrl() {
  _relayUrls = [DEFAULT_API];
}

/**
 * Check if we're currently rate-limited by the relay.
 */
export function isRateLimited() {
  return Date.now() < _rateLimitedUntil;
}

/**
 * Make a JSON request to the relay.
 * @param {string} base - Base URL of the relay
 * @param {string} path - Path to request
 * @param {object} options - Fetch options
 */
async function relayFetch(base, path, options = {}) {
  const url = `${base}${path}`;
  const resp = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (resp.status === 429) {
    const retryAfter = resp.headers.get("Retry-After");
    const delaySec = retryAfter ? Math.min(parseInt(retryAfter, 10) || 10, 60) : 10;
    _rateLimitedUntil = Date.now() + delaySec * 1000;
    console.warn(`[Dissolve] 429 on ${path} — backing off ${delaySec}s`);
  }
  return resp;
}

/**
 * Broadcast: publish caps to ALL relay URLs (Promise.allSettled).
 * Returns the first successful response, or the last error.
 */
export async function publishCaps(toId, signedBody) {
  const results = await Promise.allSettled(
    _relayUrls.map(base =>
      relayFetch(base, `/caps/${encodeURIComponent(toId)}`, {
        method: "PUT",
        body: JSON.stringify(signedBody),
      })
    )
  );
  const ok = results.find(r => r.status === "fulfilled" && r.value.ok);
  return ok ? ok.value : (results[results.length - 1].value ?? results[results.length - 1].reason);
}

/**
 * Broadcast: publish request caps to ALL relay URLs (Promise.allSettled).
 */
export async function publishRequestCaps(toId, signedBody) {
  const results = await Promise.allSettled(
    _relayUrls.map(base =>
      relayFetch(base, `/requestCaps/${encodeURIComponent(toId)}`, {
        method: "PUT",
        body: JSON.stringify(signedBody),
      })
    )
  );
  const ok = results.find(r => r.status === "fulfilled" && r.value.ok);
  return ok ? ok.value : (results[results.length - 1].value ?? results[results.length - 1].reason);
}

/**
 * Broadcast: send envelope to ALL relay URLs (Promise.allSettled).
 */
export async function sendEnvelope(signedEnvelope) {
  const results = await Promise.allSettled(
    _relayUrls.map(base =>
      relayFetch(base, "/send", {
        method: "POST",
        body: JSON.stringify(signedEnvelope),
      })
    )
  );
  // Accept both 200 (delivered) and 202 (queued) as success
  const ok = results.find(r => r.status === "fulfilled" && r.value.ok);
  if (ok) return ok.value;
  const lastResult = results[results.length - 1];
  return lastResult?.value ?? { ok: false, status: 503, json: () => Promise.resolve({}) };
}

/**
 * First-reachable: drain inbox — try relays in order, return on first 200.
 */
export async function drainInbox(toId, signedBody) {
  for (const base of _relayUrls) {
    try {
      const resp = await relayFetch(base, `/inbox/${encodeURIComponent(toId)}`, {
        method: "POST",
        body: JSON.stringify(signedBody),
      });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        console.warn(`[Dissolve] drainInbox ${resp.status}:`, errText);
        continue;
      }
      const data = await resp.json();
      return Array.isArray(data.items) ? data.items : [];
    } catch (err) {
      console.warn("[Dissolve] drainInbox error:", err.message);
      continue;
    }
  }
  return [];
}

/**
 * First-reachable: drain request inbox — try relays in order, return on first 200.
 */
export async function drainRequestInbox(toId, signedBody) {
  for (const base of _relayUrls) {
    try {
      const resp = await relayFetch(base, `/requests/inbox/${encodeURIComponent(toId)}`, {
        method: "POST",
        body: JSON.stringify(signedBody),
      });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        console.warn(`[Dissolve] drainRequestInbox ${resp.status}:`, errText);
        continue;
      }
      const data = await resp.json();
      return Array.isArray(data.items) ? data.items : [];
    } catch (err) {
      console.warn("[Dissolve] drainRequestInbox error:", err.message);
      continue;
    }
  }
  return [];
}

/**
 * Primary relay only: block a contact.
 */
export async function blockOnRelay(toId, fromId, capHash, signedBody) {
  return relayFetch(_relayUrls[0], `/block/${encodeURIComponent(toId)}`, {
    method: "POST",
    body: JSON.stringify(signedBody),
  });
}

/**
 * Primary relay only: publish directory entry.
 */
export async function publishDirectoryEntry(handle, profile, sig) {
  return relayFetch(_relayUrls[0], "/directory/publish", {
    method: "POST",
    body: JSON.stringify({ handle, profile, sig }),
  });
}

/**
 * Primary relay only: look up a directory entry.
 */
export async function lookupDirectory(handle) {
  const resp = await relayFetch(_relayUrls[0], `/directory/lookup?handle=${encodeURIComponent(handle)}`);
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.profile || null;
}

/**
 * Primary relay only: check if a handle is available.
 */
export async function checkHandleAvailable(handle) {
  const resp = await relayFetch(_relayUrls[0], `/directory/available?handle=${encodeURIComponent(handle)}`);
  if (!resp.ok) return false;
  const data = await resp.json();
  return !!data.available;
}

/**
 * Fetch a WebSocket authentication nonce from a relay.
 * @param {string} base - Base URL of the relay
 */
async function fetchWsChallenge(base) {
  const resp = await relayFetch(base, "/ws-challenge");
  if (!resp.ok) throw new Error("Failed to get WS challenge");
  const data = await resp.json();
  return data.nonce;
}

/**
 * Create an authenticated WebSocket connection to a single relay URL.
 * Flow: fetch nonce → sign → authenticate → receive notifications.
 */
function connectSingleWS(wsUrl, base, myId, authPubJwk, authPrivJwk, onNotify, onAuthenticated) {
  let ws = null;
  let reconnectTimer = null;
  let closed = false;
  let reconnectAttempts = 0;

  async function connect() {
    if (closed) return;
    if (Date.now() < _rateLimitedUntil) {
      scheduleReconnect();
      return;
    }

    let nonce;
    try {
      nonce = await fetchWsChallenge(base);
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
      ws = new WebSocket(wsUrl);
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
        if (msg.type === "auth_ok") {
          reconnectAttempts = 0; // reset backoff on successful auth
          if (onAuthenticated) onAuthenticated();
          return;
        }
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
    // Exponential backoff: 3s, 6s, 12s, 24s, max 30s
    const delay = Math.min(WS_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts), 30_000);
    reconnectAttempts++;
    reconnectTimer = setTimeout(connect, delay);
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

/**
 * Create authenticated WebSocket connections to ALL configured relay URLs.
 * Any notification from any relay triggers the onNotify callback.
 */
export function connectWebSocket(myId, authPubJwk, authPrivJwk, onNotify, onAuthenticated) {
  const handles = _relayUrls.map(base => {
    const wsUrl = base.replace(/^http/, "ws") + "/ws";
    return connectSingleWS(wsUrl, base, myId, authPubJwk, authPrivJwk, onNotify, onAuthenticated);
  });
  return {
    close() { handles.forEach(h => h.close()); },
  };
}

/**
 * Fetch ephemeral TURN credentials for voice call setup.
 * Authenticated via signed request body.
 */
export async function fetchTurnCredentials(authPubJwk, authPrivJwk) {
  const ts = Date.now();
  // Pass raw object to signObject — it uses JCS canonicalization internally
  const sig = await signObject({ action: "turn-credentials", ts }, authPrivJwk);
  const base = getRelayUrl();
  const resp = await relayFetch(base, "/turn-credentials", {
    method: "POST",
    body: JSON.stringify({ authPub: authPubJwk, ts, sig }),
  });
  if (!resp.ok) throw new Error(`TURN credentials failed: ${resp.status}`);
  return resp.json ? await resp.json() : resp;
}
