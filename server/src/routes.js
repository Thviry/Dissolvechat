// server/src/routes.js
// HTTP route handlers for the Dissolve relay (v4-secure, hardened).
//
// Hardening applied:
// 1. Strict Zod schema validation on every endpoint
// 2. Envelope size limits (per-field via schema)
// 3. Dual-layer rate limiting (IP + identity)
// 4. WebSocket authentication enforcement (nonce challenge)
// 5. Structured logging (never logs sensitive data)

const crypto = require("crypto");
const { capHashFromCap, computeIdFromAuthPubJwk, verifySignature } = require("./crypto");
const {
  sendSchema,
  capsUpdateSchema,
  inboxDrainSchema,
  blockSchema,
  revokeCapSchema,
  directoryPublishSchema,
  validate,
} = require("./schemas");
const { RateLimiter, LIMITS, getIpKey } = require("./ratelimit");
const logger = require("./logger");

const IS_DEV = process.env.NODE_ENV !== "production";
const startedAt = Date.now();

// ── Shared rate limiter instance ────────────────────────────────────
const rl = new RateLimiter();

/**
 * Rate-limit check helper. Returns true if allowed, sends 429 if not.
 */
function rateCheck(req, res, layer, key, limit, endpoint) {
  const result = rl.check(key, limit);
  if (!result.allowed) {
    logger.rateLimited(layer, key, endpoint);
    res.set("Retry-After", Math.ceil(result.retryAfterMs / 1000));
    res.status(429).json({ error: "rate_limited" });
    return false;
  }
  return true;
}

/**
 * Verify ownership of an identity (signed request with authPub).
 */
async function verifyOwnership(body, expectedId) {
  const sig = body?.sig;
  const authPub = body?.authPub;
  if (!sig || !authPub) return { ok: false, error: "missing_signature" };

  let computedId;
  try {
    computedId = computeIdFromAuthPubJwk(authPub);
  } catch {
    return { ok: false, error: "bad_authPub" };
  }
  if (computedId !== expectedId) return { ok: false, error: "id_mismatch" };

  const { sig: _s, ...noSig } = body;
  const valid = await verifySignature(noSig, sig, authPub);
  if (!valid) return { ok: false, error: "invalid_signature" };

  return { ok: true, id: computedId };
}

/**
 * Verify a CapsUpdate request.
 */
async function verifyCapsUpdate(body, expectedToId) {
  const capHashes = body?.body?.capHashes;
  if (!Array.isArray(capHashes)) return { ok: false, error: "bad_capHashes" };

  const sig = body?.sig;
  const authPub = body?.body?.authPub;
  if (!sig || !authPub) return { ok: false, error: "missing_signature" };

  let computedId;
  try {
    computedId = computeIdFromAuthPubJwk(authPub);
  } catch {
    return { ok: false, error: "bad_authPub" };
  }
  if (computedId !== expectedToId) return { ok: false, error: "id_mismatch" };

  const { sig: _sig, ...noSig } = body;
  const valid = await verifySignature(noSig, sig, authPub);
  if (!valid) return { ok: false, error: "invalid_signature" };

  return { ok: true, capHashes };
}

// ── WS nonce store (short-lived challenge tokens) ───────────────────
// nonce -> { createdAt }. Cleaned up periodically.
const wsNonces = new Map();
const WS_NONCE_TTL = 30_000; // 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [n, entry] of wsNonces) {
    if (now - entry.createdAt > WS_NONCE_TTL) wsNonces.delete(n);
  }
}, 15_000);


function registerRoutes(app, store, wss) {

  // ── Health ────────────────────────────────────────────────────────
  app.get("/health", (_req, res) => {
    const uptimeMs = Date.now() - startedAt;
    const s = store.stats();
    res.json({
      ok: true,
      protocol: 4,
      version: "4.1.0-hardened",
      persistence: "in-memory",
      uptime: {
        ms: uptimeMs,
        human: `${Math.floor(uptimeMs / 60000)}m ${Math.floor((uptimeMs % 60000) / 1000)}s`,
      },
      store: s,
      wsClients: wss?.clients?.size ?? 0,
    });
  });

  // ── Debug state (dev only) ────────────────────────────────────────
  if (IS_DEV) {
    app.get("/debug/state", (_req, res) => {
      const s = store.stats();
      const handles = [];
      for (const [handle, profile] of store.directory) {
        handles.push({ handle, id: profile.id?.slice(0, 12) + "…", label: profile.label });
      }
      res.json({
        warning: "DEV ONLY — do not expose in production",
        stats: s,
        wsClients: wss?.clients?.size ?? 0,
        directory: handles,
        capsRegistered: [...store.caps.keys()].map((k) => k.slice(0, 12) + "…"),
      });
    });
  }

  // ── GET /ws-challenge — issue a nonce for WS auth ─────────────────
  app.get("/ws-challenge", (req, res) => {
    const ipKey = getIpKey(req);
    if (!rateCheck(req, res, "ip", `${ipKey}:ws-challenge`, LIMITS.IP_WS_CONNECT, "/ws-challenge")) return;

    const nonce = crypto.randomBytes(32).toString("base64url");
    wsNonces.set(nonce, { createdAt: Date.now() });
    res.json({ nonce });
  });

  // ── PUT /caps/:toId ───────────────────────────────────────────────
  app.put("/caps/:toId", async (req, res) => {
    const ipKey = getIpKey(req);
    if (!rateCheck(req, res, "ip", `${ipKey}:caps`, LIMITS.IP_CAPS, "/caps")) return;

    // Schema validation
    const v = validate(capsUpdateSchema, req.body);
    if (!v.ok) {
      logger.validationFailed("/caps", v.error);
      return res.status(400).json({ error: v.error });
    }

    const toId = req.params.toId;
    if (!rateCheck(req, res, "id", `id:${toId}:caps`, LIMITS.ID_CAPS, "/caps")) return;

    const result = await verifyCapsUpdate(v.data, toId);
    if (!result.ok) {
      logger.sigVerifyFailed("/caps", { id: toId });
      return res.status(400).json({ error: result.error });
    }

    const count = store.setCaps(toId, result.capHashes);
    notifyWs(wss, toId, "message");
    logger.capsRegistered(toId, count);
    res.json({ ok: true, count });
  });

  // ── PUT /requestCaps/:toId ────────────────────────────────────────
  app.put("/requestCaps/:toId", async (req, res) => {
    const ipKey = getIpKey(req);
    if (!rateCheck(req, res, "ip", `${ipKey}:reqcaps`, LIMITS.IP_CAPS, "/requestCaps")) return;

    const v = validate(capsUpdateSchema, req.body);
    if (!v.ok) {
      logger.validationFailed("/requestCaps", v.error);
      return res.status(400).json({ error: v.error });
    }

    const toId = req.params.toId;
    if (!rateCheck(req, res, "id", `id:${toId}:reqcaps`, LIMITS.ID_CAPS, "/requestCaps")) return;

    const result = await verifyCapsUpdate(v.data, toId);
    if (!result.ok) {
      logger.sigVerifyFailed("/requestCaps", { id: toId });
      return res.status(400).json({ error: result.error });
    }

    const count = store.setRequestCaps(toId, result.capHashes);
    notifyWs(wss, toId, "request");
    logger.capsRegistered(toId, count);
    res.json({ ok: true, count });
  });

  // ── POST /block/:toId ─────────────────────────────────────────────
  app.post("/block/:toId", async (req, res) => {
    const ipKey = getIpKey(req);
    if (!rateCheck(req, res, "ip", `${ipKey}:block`, LIMITS.IP_BLOCK_REVOKE, "/block")) return;

    const v = validate(blockSchema, req.body);
    if (!v.ok) {
      logger.validationFailed("/block", v.error);
      return res.status(400).json({ error: v.error });
    }

    const toId = req.params.toId;
    const auth = await verifyOwnership(v.data, toId);
    if (!auth.ok) {
      logger.sigVerifyFailed("/block", { id: toId });
      return res.status(403).json({ error: auth.error });
    }

    store.blockSender(toId, v.data.fromId, v.data.capHash);
    logger.blocked(toId, v.data.fromId);
    res.json({ ok: true });
  });

  // ── POST /revokeCap/:toId ─────────────────────────────────────────
  app.post("/revokeCap/:toId", async (req, res) => {
    const ipKey = getIpKey(req);
    if (!rateCheck(req, res, "ip", `${ipKey}:revoke`, LIMITS.IP_BLOCK_REVOKE, "/revokeCap")) return;

    const v = validate(revokeCapSchema, req.body);
    if (!v.ok) {
      logger.validationFailed("/revokeCap", v.error);
      return res.status(400).json({ error: v.error });
    }

    const toId = req.params.toId;
    const auth = await verifyOwnership(v.data, toId);
    if (!auth.ok) {
      logger.sigVerifyFailed("/revokeCap", { id: toId });
      return res.status(403).json({ error: auth.error });
    }

    store.revokeCap(toId, v.data.capHash);
    logger.capRevoked(toId);
    res.json({ ok: true });
  });

  // ── POST /directory/publish ───────────────────────────────────────
  app.post("/directory/publish", async (req, res) => {
    const ipKey = getIpKey(req);
    if (!rateCheck(req, res, "ip", `${ipKey}:dirpub`, LIMITS.IP_DIRECTORY, "/directory/publish")) return;

    const v = validate(directoryPublishSchema, req.body);
    if (!v.ok) {
      logger.validationFailed("/directory/publish", v.error);
      return res.status(400).json({ error: v.error });
    }

    const { handle, profile, sig } = v.data;
    const trimmed = handle.trim().toLowerCase();

    const authPub = profile.authPublicJwk;
    let computedId;
    try { computedId = computeIdFromAuthPubJwk(authPub); } catch {
      return res.status(400).json({ error: "bad_authPub" });
    }
    if (computedId !== profile.id) return res.status(403).json({ error: "id_mismatch" });

    const { sig: _s, ...noSig } = v.data;
    const valid = await verifySignature(noSig, sig, authPub);
    if (!valid) {
      logger.sigVerifyFailed("/directory/publish", { id: profile.id });
      return res.status(403).json({ error: "invalid_signature" });
    }

    if (store.isHandleTaken(trimmed, profile.id)) {
      logger.directoryCollision(trimmed);
      return res.status(409).json({ error: "handle_taken" });
    }

    store.publishDirectory(trimmed, {
      dissolveProtocol: 4,
      v: 4,
      id: profile.id,
      label: profile.label,
      authPublicJwk: profile.authPublicJwk,
      e2eePublicJwk: profile.e2eePublicJwk,
      requestCap: profile.requestCap,
      requestCapHash: profile.requestCapHash,
      discoverable: profile.discoverable !== false,
      showPresence: profile.showPresence === true,
    });
    logger.directoryPublished(trimmed);
    res.json({ ok: true });
  });
// ── GET /directory/available — check if handle is unclaimed ────────
  app.get("/directory/available", (req, res) => {
    const ipKey = getIpKey(req);
    if (!rateCheck(req, res, "ip", `${ipKey}:lookup`, LIMITS.IP_LOOKUP, "/directory/available")) return;

    const handle = String(req.query.handle || "").trim().toLowerCase();
    if (!handle || !/^[a-z0-9_-]{1,32}$/.test(handle)) {
      return res.status(400).json({ error: "invalid_handle" });
    }

    const taken = store.isHandleClaimed(handle);
    res.json({ handle, available: !taken });
  });
  // ── GET /directory/lookup ─────────────────────────────────────────
  app.get("/directory/lookup", (req, res) => {
    const ipKey = getIpKey(req);
    if (!rateCheck(req, res, "ip", `${ipKey}:lookup`, LIMITS.IP_LOOKUP, "/directory/lookup")) return;

    const handle = String(req.query.handle || "").trim().toLowerCase();
    if (!handle || !/^[a-z0-9_-]{1,32}$/.test(handle)) {
      return res.status(400).json({ error: "invalid_handle" });
    }

    const p = store.lookupDirectory(handle);
    if (!p) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true, profile: p });
  });

  // ── GET /presence — check online status for a list of IDs ──────────
  app.get("/presence", (req, res) => {
    const ipKey = getIpKey(req);
    if (!rateCheck(req, res, "ip", `${ipKey}:presence`, LIMITS.IP_LOOKUP, "/presence")) return;

    const raw = String(req.query.ids || "");
    const ids = raw.split(",").map(s => s.trim()).filter(Boolean).slice(0, 50);
    if (ids.length === 0) return res.status(400).json({ error: "missing_ids" });

    const online = {};
    for (const id of ids) {
      // Check if this identity has an authenticated WS AND opted in to presence
      let connected = false;
      if (wss) {
        for (const client of wss.clients) {
          if (client.authedId === id && client.readyState === 1 && client.showPresence) {
            connected = true;
            break;
          }
        }
      }
      if (connected) online[id] = true;
    }
    res.json({ ok: true, online });
  });

  // ── POST /send — metadata-minimal message delivery ────────────────
  app.post("/send", async (req, res) => {
    const ipKey = getIpKey(req);
    if (!rateCheck(req, res, "ip", `${ipKey}:send`, LIMITS.IP_SEND, "/send")) return;

    // Step 1: Schema validation
    const v = validate(sendSchema, req.body);
    if (!v.ok) {
      logger.validationFailed("/send", v.error);
      return res.status(400).json({ error: v.error });
    }

    const obj = v.data;

    // Step 2: Verify sender signature
    let senderId;
    try { senderId = computeIdFromAuthPubJwk(obj.authPub); } catch {
      return res.status(400).json({ error: "bad_authPub" });
    }

    // Identity-based rate limit
    if (!rateCheck(req, res, "id", `id:${senderId}:send`, LIMITS.ID_SEND, "/send")) return;

    const { sig: _s, ...noSig } = obj;
    const valid = await verifySignature(noSig, obj.sig, obj.authPub);
    if (!valid) {
      // Track failed sig attempts per identity
      rl.check(`id:${senderId}:sigfail`, LIMITS.ID_SIG_FAIL);
      logger.sigVerifyFailed("/send", { senderId });
      return res.status(403).json({ error: "invalid_signature" });
    }

    // Step 3: Compute cap hash
    let capHash;
    try { capHash = capHashFromCap(obj.cap); } catch {
      return res.status(400).json({ error: "bad_cap" });
    }

    // Step 4: Block / revoke checks
    if (store.isBlocked(obj.to, senderId)) {
      logger.envelopeRejected("blocked", { to: obj.to, senderId });
      return res.status(403).json({ error: "blocked" });
    }
    if (store.isRevoked(obj.to, capHash)) {
      logger.envelopeRejected("cap_revoked", { to: obj.to });
      return res.status(403).json({ error: "cap_revoked" });
    }

    // Step 5: Route to correct inbox
    const isRequest = obj.ch === "req";

    if (isRequest) {
      if (!store.hasRequestCap(obj.to, capHash)) {
        store.pushPending(obj.to, obj, capHash, true);
        logger.envelopeQueued(obj.to, "req");
        return res.json({ ok: true, queued: true });
      }

      const rateKey = `req:${obj.to}:${capHash}`;
      if (!store.checkRate(rateKey, 10)) {
        logger.rateLimited("cap", rateKey, "/send");
        return res.status(429).json({ error: "rate_limited" });
      }

      store.pushRequest(obj.to, obj);
      notifyWs(wss, obj.to, "request");
      logger.envelopeAccepted(obj.to, "req");
      return res.json({ ok: true });
    }

    // Normal message
    if (!store.hasNormalCap(obj.to, capHash)) {
      store.pushPending(obj.to, obj, capHash, false);
      logger.envelopeQueued(obj.to, "msg");
      return res.json({ ok: true, queued: true });
    }

    const rateKey = `msg:${obj.to}:${senderId}`;
    if (!store.checkRate(rateKey, 60)) {
      logger.rateLimited("identity", rateKey, "/send");
      return res.status(429).json({ error: "rate_limited" });
    }

    store.pushMessage(obj.to, obj);
    notifyWs(wss, obj.to, "message");
    logger.envelopeAccepted(obj.to, "msg");
    return res.json({ ok: true });
  });

  // ── POST /inbox/:toId — authenticated inbox drain ─────────────────
  app.post("/inbox/:toId", async (req, res) => {
    const ipKey = getIpKey(req);
    if (!rateCheck(req, res, "ip", `${ipKey}:drain`, LIMITS.IP_DRAIN, "/inbox")) return;

    const v = validate(inboxDrainSchema, req.body);
    if (!v.ok) {
      logger.validationFailed("/inbox", v.error);
      return res.status(400).json({ error: v.error });
    }

    const toId = req.params.toId;
    if (!rateCheck(req, res, "id", `id:${toId}:drain`, LIMITS.ID_DRAIN, "/inbox")) return;

    const auth = await verifyOwnership(v.data, toId);
    if (!auth.ok) {
      logger.sigVerifyFailed("/inbox", { id: toId });
      return res.status(403).json({ error: auth.error });
    }

    const items = store.drainInbox(toId);
    logger.inboxDrained(toId, items.length);
    res.json({ ok: true, items });
  });

  // ── POST /requests/inbox/:toId — authenticated request inbox drain ─
  app.post("/requests/inbox/:toId", async (req, res) => {
    const ipKey = getIpKey(req);
    if (!rateCheck(req, res, "ip", `${ipKey}:reqdrain`, LIMITS.IP_DRAIN, "/requests/inbox")) return;

    const v = validate(inboxDrainSchema, req.body);
    if (!v.ok) {
      logger.validationFailed("/requests/inbox", v.error);
      return res.status(400).json({ error: v.error });
    }

    const toId = req.params.toId;
    if (!rateCheck(req, res, "id", `id:${toId}:reqdrain`, LIMITS.ID_DRAIN, "/requests/inbox")) return;

    const auth = await verifyOwnership(v.data, toId);
    if (!auth.ok) {
      logger.sigVerifyFailed("/requests/inbox", { id: toId });
      return res.status(403).json({ error: auth.error });
    }

    const items = store.drainRequestInbox(toId);
    logger.requestInboxDrained(toId, items.length);
    res.json({ ok: true, items });
  });
}

/**
 * Notify a connected WebSocket client that new data is available.
 * Only notifies authenticated sockets.
 */
function notifyWs(wss, toId, type) {
  if (!wss) return;
  for (const client of wss.clients) {
    if (client.authedId === toId && client.readyState === 1) {
      try {
        client.send(JSON.stringify({ type: "notify", channel: type }));
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Set up authenticated WebSocket handling.
 * Flow: client sends { type:"auth", nonce, authPub, sig }
 *       server verifies nonce + signature
 *       server binds socket to verified identity
 */
function setupAuthenticatedWs(wss, wsNonces, store) {
  wss.on("connection", (ws) => {
    ws.authedId = null;
    ws.isAlive = true;

    logger.wsConnected();

    ws.on("pong", () => { ws.isAlive = true; });

    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === "auth") {
          // Validate auth message shape
          const { nonce, authPub, sig } = msg;
          if (typeof nonce !== "string" || !authPub || typeof sig !== "string") {
            ws.send(JSON.stringify({ type: "auth_error", error: "bad_auth_message" }));
            logger.wsAuthFailed("bad_auth_message");
            return;
          }

          // Verify nonce exists and hasn't expired
          const nonceEntry = wsNonces.get(nonce);
          if (!nonceEntry) {
            ws.send(JSON.stringify({ type: "auth_error", error: "invalid_nonce" }));
            logger.wsAuthFailed("invalid_nonce");
            return;
          }
          // Consume the nonce (one-time use)
          wsNonces.delete(nonce);

          // Verify signature over the nonce
          const signedObj = { nonce, authPub };
          const { verifySignature: verifySig } = require("./crypto");
          const valid = await verifySig(signedObj, sig, authPub);
          if (!valid) {
            ws.send(JSON.stringify({ type: "auth_error", error: "invalid_signature" }));
            logger.wsAuthFailed("invalid_signature");
            return;
          }

          // Derive identity from authPub
          const { computeIdFromAuthPubJwk: computeId } = require("./crypto");
          let authedId;
          try { authedId = computeId(authPub); } catch {
            ws.send(JSON.stringify({ type: "auth_error", error: "bad_authPub" }));
            logger.wsAuthFailed("bad_authPub");
            return;
          }

          ws.authedId = authedId;
          ws.showPresence = store.hasPresence(authedId);
          ws.send(JSON.stringify({ type: "auth_ok", id: authedId }));
          logger.wsAuthSuccess(authedId);
          return;
        }

        // Legacy subscribe (reject if not authenticated)
        if (msg.type === "subscribe") {
          if (!ws.authedId) {
            ws.send(JSON.stringify({ type: "error", error: "auth_required" }));
            return;
          }
          // Already authenticated — ignore subscribe (authedId is the subscription)
          ws.send(JSON.stringify({ type: "subscribed", id: ws.authedId }));
          return;
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on("close", () => {
      logger.wsDisconnected();
    });

    ws.on("error", () => {});
  });

  // Heartbeat: close dead connections
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30_000);

  wss.on("close", () => clearInterval(heartbeat));
}

module.exports = { registerRoutes, setupAuthenticatedWs, wsNonces, rl };
