// server/src/logger.js
// Structured logging for the Dissolve relay.
//
// Rules:
// - NEVER log: plaintext, capabilities, private keys, full IPs, full authPub
// - ALWAYS log: event type, truncated identity (12 chars), reason for rejection
// - Format: JSON lines for easy parsing

const IS_DEV = process.env.NODE_ENV !== "production";

/**
 * Truncate an identity ID or key to first 12 chars for logging.
 */
function trunc(s) {
  if (typeof s !== "string") return "?";
  return s.length > 12 ? s.slice(0, 12) + "…" : s;
}

/**
 * Log a structured event.
 */
function log(event, details = {}) {
  const entry = {
    ts: new Date().toISOString(),
    event,
    ...details,
  };

  // Sanitize: ensure no sensitive fields leak
  delete entry.cap;
  delete entry.senderCap;
  delete entry.requestCap;
  delete entry.authPrivJwk;
  delete entry.e2eePrivJwk;
  delete entry.plaintext;
  delete entry.passphrase;

  // Truncate IDs
  if (entry.id) entry.id = trunc(entry.id);
  if (entry.from) entry.from = trunc(entry.from);
  if (entry.to) entry.to = trunc(entry.to);
  if (entry.senderId) entry.senderId = trunc(entry.senderId);

  if (IS_DEV) {
    // Pretty print in dev
    const { ts, event: ev, ...rest } = entry;
    const detail = Object.keys(rest).length > 0 ? " " + JSON.stringify(rest) : "";
    console.log(`[${ts}] ${ev}${detail}`);
  } else {
    // JSON line in production
    console.log(JSON.stringify(entry));
  }
}

// ── Convenience methods ─────────────────────────────────────────────

const logger = {
  // Envelope lifecycle
  envelopeAccepted(to, ch) {
    log("envelope.accepted", { to, ch });
  },
  envelopeRejected(reason, details = {}) {
    log("envelope.rejected", { reason, ...details });
  },
  envelopeQueued(to, ch) {
    log("envelope.queued", { to, ch });
  },

  // Inbox
  inboxDrained(id, count) {
    log("inbox.drained", { id, count });
  },
  requestInboxDrained(id, count) {
    log("inbox.request_drained", { id, count });
  },

  // Auth
  sigVerifyFailed(endpoint, details = {}) {
    log("auth.sig_failed", { endpoint, ...details });
  },
  capValidationFailed(to, reason) {
    log("auth.cap_failed", { to, reason });
  },

  // Rate limiting
  rateLimited(layer, key, endpoint) {
    // Don't log the raw key (may contain IP)
    log("ratelimit.hit", { layer, endpoint });
  },

  // WebSocket
  wsAuthSuccess(id) {
    log("ws.auth_success", { id });
  },
  wsAuthFailed(reason) {
    log("ws.auth_failed", { reason });
  },
  wsConnected() {
    log("ws.connected");
  },
  wsDisconnected() {
    log("ws.disconnected");
  },

  // Directory
  directoryPublished(handle) {
    log("directory.published", { handle });
  },
  directoryCollision(handle) {
    log("directory.collision", { handle });
  },

  // Caps
  capsRegistered(id, count) {
    log("caps.registered", { id, count });
  },

  // Block / revoke
  blocked(id, fromId) {
    log("safety.blocked", { id, from: fromId });
  },
  capRevoked(id) {
    log("safety.cap_revoked", { id });
  },

  // Server lifecycle
  startup(port) {
    log("server.started", { port });
  },
  shutdown(signal) {
    log("server.shutdown", { signal });
  },

  // Validation
  validationFailed(endpoint, error) {
    log("validation.failed", { endpoint, error: error?.slice?.(0, 120) });
  },

  // Generic request log (dev only)
  request(method, url) {
    if (IS_DEV) {
      log("http.request", { method, url });
    }
  },
};

module.exports = logger;
