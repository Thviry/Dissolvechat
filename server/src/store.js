// server/src/store.js
// In-memory data stores with TTL-based message expiry.
//
// PERSISTENCE MODEL: Everything is in-memory. Nothing survives a server restart.
// This is intentional for v4 — the relay is an untrusted intermediary.
// Swap for Redis/SQLite while keeping the same interface if persistence is needed.

const MESSAGE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;  // 5 minutes

class Store {
  constructor() {
    this._dirFile = process.env.DIRECTORY_FILE || "./directory.json";
    // toId -> Set(capHash)
    this.caps = new Map();
    this.requestCaps = new Map();

    // toId -> Array<{ envelope, expiresAt }>
    this.inbox = new Map();
    this.reqInbox = new Map();

    // toId -> Set(capHash)
    this.revoked = new Map();
    // toId -> Set(fromId)
    this.blockedFrom = new Map();

    // handle -> profile object
    this.directory = new Map();
    // id -> handle (reverse lookup for ownership enforcement)
    this.handleOwners = new Map();

    // Rate limiting: key -> { count, resetAt }
    this.rateLimits = new Map();

    // Pending queue: messages sent before recipient registered caps.
    // toId -> Array<{ envelope, capHash, isRequest, expiresAt }>
    this.pending = new Map();

    // Start periodic cleanup
    this._cleanupTimer = setInterval(() => this._cleanup(), CLEANUP_INTERVAL_MS);

    // Load persisted directory
    this._loadDirectory();
  }

  // --- Helpers ---

  _getSet(map, key) {
    let s = map.get(key);
    if (!s) {
      s = new Set();
      map.set(key, s);
    }
    return s;
  }

  _cleanup() {
    const now = Date.now();
    for (const [id, items] of this.inbox) {
      const filtered = items.filter((i) => i.expiresAt > now);
      if (filtered.length === 0) this.inbox.delete(id);
      else this.inbox.set(id, filtered);
    }
    for (const [id, items] of this.reqInbox) {
      const filtered = items.filter((i) => i.expiresAt > now);
      if (filtered.length === 0) this.reqInbox.delete(id);
      else this.reqInbox.set(id, filtered);
    }
    for (const [key, entry] of this.rateLimits) {
      if (entry.resetAt <= now) this.rateLimits.delete(key);
    }
    for (const [id, items] of this.pending) {
      const filtered = items.filter((i) => i.expiresAt > now);
      if (filtered.length === 0) this.pending.delete(id);
      else this.pending.set(id, filtered);
    }
  }

  // --- Capabilities ---

  setCaps(toId, capHashes) {
    const set = new Set();
    for (const h of capHashes) {
      if (typeof h === "string" && h.length > 0) set.add(h);
    }
    this.caps.set(toId, set);
    this._flushPending(toId, set, false);
    return set.size;
  }

  setRequestCaps(toId, capHashes) {
    const set = new Set();
    for (const h of capHashes) {
      if (typeof h === "string" && h.length > 0) set.add(h);
    }
    this.requestCaps.set(toId, set);
    this._flushPending(toId, set, true);
    return set.size;
  }

  hasNormalCap(toId, capHash) {
    const s = this.caps.get(toId);
    return s ? s.has(capHash) : false;
  }

  hasRequestCap(toId, capHash) {
    const s = this.requestCaps.get(toId);
    return s ? s.has(capHash) : false;
  }

  // --- Safety controls ---

  isRevoked(toId, capHash) {
    const s = this.revoked.get(toId);
    return s ? s.has(capHash) : false;
  }

  isBlocked(toId, fromId) {
    const s = this.blockedFrom.get(toId);
    return s ? s.has(fromId) : false;
  }

  revokeCap(toId, capHash) {
    this._getSet(this.revoked, toId).add(capHash);
  }

  blockSender(toId, fromId, capHash) {
    this._getSet(this.blockedFrom, toId).add(fromId);
    if (typeof capHash === "string" && capHash) {
      this._getSet(this.revoked, toId).add(capHash);
    }
  }

  // --- Inbox ---

  pushMessage(toId, envelope) {
    const arr = this.inbox.get(toId) || [];
    arr.push({ envelope, expiresAt: Date.now() + MESSAGE_TTL_MS });
    this.inbox.set(toId, arr);
  }

  pushRequest(toId, envelope) {
    const arr = this.reqInbox.get(toId) || [];
    arr.push({ envelope, expiresAt: Date.now() + MESSAGE_TTL_MS });
    this.reqInbox.set(toId, arr);
  }

  pushPending(toId, envelope, capHash, isRequest) {
    const arr = this.pending.get(toId) || [];
    if (arr.length >= 50) return;
    arr.push({ envelope, capHash, isRequest, expiresAt: Date.now() + MESSAGE_TTL_MS });
    this.pending.set(toId, arr);
  }

  _flushPending(toId, capSet, isRequest) {
    const pending = this.pending.get(toId);
    if (!pending || pending.length === 0) return;

    const now = Date.now();
    const remaining = [];
    let flushed = 0;

    for (const item of pending) {
      if (item.expiresAt <= now) continue;
      if (item.isRequest !== isRequest) {
        remaining.push(item);
        continue;
      }
      if (!capSet.has(item.capHash)) {
        remaining.push(item);
        continue;
      }
      if (isRequest) {
        this.pushRequest(toId, item.envelope);
      } else {
        this.pushMessage(toId, item.envelope);
      }
      flushed++;
    }

    if (remaining.length === 0) this.pending.delete(toId);
    else this.pending.set(toId, remaining);

    if (flushed > 0) console.log(`Flushed ${flushed} pending message(s) for ${toId.slice(0, 12)}…`);
  }

  drainInbox(toId) {
    const items = (this.inbox.get(toId) || [])
      .filter((i) => i.expiresAt > Date.now())
      .map((i) => i.envelope);
    this.inbox.set(toId, []);
    return items;
  }

  drainRequestInbox(toId) {
    const items = (this.reqInbox.get(toId) || [])
      .filter((i) => i.expiresAt > Date.now())
      .map((i) => i.envelope);
    this.reqInbox.set(toId, []);
    return items;
  }

  // --- Rate limiting ---

  checkRate(key, maxPerWindow, windowMs = 60000) {
    const now = Date.now();
    let entry = this.rateLimits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      this.rateLimits.set(key, entry);
    }
    entry.count++;
    return entry.count <= maxPerWindow;
  }

  // --- Directory ---

  /**
   * Publish a handle -> profile mapping.
   * Enforces one-handle-per-identity: if this identity previously owned a
   * different handle, the old one is released.
   */
  publishDirectory(handle, profile) {
    const prevHandle = this.handleOwners.get(profile.id);
    if (prevHandle && prevHandle !== handle) {
      this.directory.delete(prevHandle);
    }
    this.directory.set(handle, { ...profile, updatedAt: new Date().toISOString() });
    this.handleOwners.set(profile.id, handle);
    this._saveDirectory();
  }

  _saveDirectory() {
    try {
      const data = {};
      for (const [handle, profile] of this.directory) {
        data[handle] = profile;
      }
      require("fs").writeFileSync(this._dirFile, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("[WARN] Failed to save directory:", err.message);
    }
  }

  _loadDirectory() {
    try {
      const raw = require("fs").readFileSync(this._dirFile, "utf-8");
      const data = JSON.parse(raw);
      for (const [handle, profile] of Object.entries(data)) {
        this.directory.set(handle, profile);
        if (profile.id) this.handleOwners.set(profile.id, handle);
      }
      console.log(`[STORE] Loaded ${this.directory.size} directory entries from disk`);
    } catch {
      // File doesn't exist yet — that's fine
    }
  }

  lookupDirectory(handle) {
    const entry = this.directory.get(handle) || null;
    if (entry && entry.discoverable === false) return null;
    return entry;
  }

  /**
   * Check if a handle is already claimed by a different identity.
   */
  isHandleTaken(handle, requesterId) {
    const existing = this.directory.get(handle);
    return existing ? existing.id !== requesterId : false;
  }
  isHandleClaimed(handle) {
    return this.directory.has(handle);
  }

  // --- Stats (for /health and /debug/state) ---

  stats() {
    let inboxMessages = 0;
    for (const [, items] of this.inbox) inboxMessages += items.length;
    let requestMessages = 0;
    for (const [, items] of this.reqInbox) requestMessages += items.length;
    let pendingMessages = 0;
    for (const [, items] of this.pending) pendingMessages += items.length;

    return {
      identities: this.caps.size,
      directoryEntries: this.directory.size,
      inboxMessages,
      requestMessages,
      pendingMessages,
      blockedPairs: this.blockedFrom.size,
      revokedCaps: this.revoked.size,
    };
  }

  destroy() {
    clearInterval(this._cleanupTimer);
  }
}

module.exports = Store;
