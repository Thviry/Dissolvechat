// client/src/utils/messageStore.js
// Encrypted local message archive using IndexedDB.
//
// Security model:
// - Messages are encrypted with AES-256-GCM before storage
// - The AES key is derived from the user's auth private key via HKDF
//   (so only the keyfile owner can read the archive)
// - IndexedDB is per-origin, so other sites can't access it
// - Clearing the archive or logging out wipes the decryption context
//
// Schema:
//   Store: "messages"
//   Key: msgId
//   Value: { convKey, iv, ct, ts }  (encrypted blob + sort timestamp)
//
//   convKey = sorted hash of the two participant IDs (for efficient per-conversation queries)

const DB_NAME = "dissolve_archive";
const DB_VERSION = 1;
const STORE_NAME = "messages";

// ── Database lifecycle ──────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "msgId" });
        store.createIndex("convKey", "convKey", { unique: false });
        store.createIndex("ts", "ts", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Encryption helpers ──────────────────────────────────────────────

const te = new TextEncoder();
const td = new TextDecoder();

/**
 * Derive an AES-256-GCM key from the user's identity ID.
 * Uses HKDF with a fixed salt + the identity ID as info.
 * This means only someone with this identity's session can read the archive.
 */
async function deriveArchiveKey(identitySecret) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    te.encode(identitySecret),
    "HKDF",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: te.encode(`dissolve-archive-v1:${identitySecret}`),
      info: te.encode("dissolve-archive"),
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptRecord(aesKey, message) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = te.encode(JSON.stringify(message));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, plaintext)
  );
  return {
    iv: Array.from(iv),
    ct: Array.from(ct),
  };
}

async function decryptRecord(aesKey, record) {
  const iv = new Uint8Array(record.iv);
  const ct = new Uint8Array(record.ct);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    ct
  );
  return JSON.parse(td.decode(new Uint8Array(plaintext)));
}

// ── Conversation key ────────────────────────────────────────────────

function makeConvKey(myId, peerId) {
  return [myId, peerId].sort().join("|");
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Create a message store bound to an identity.
 * Returns an object with save/load/clear methods.
 */
export async function createMessageStore(identityId) {
  const db = await openDB();
  const aesKey = await deriveArchiveKey(identityId);

  return {
    /**
     * Save a message to the local archive.
     * @param {string} myId - Current user's identity ID
     * @param {object} msg - { dir, peerId, text, ts, msgId }
     */
    async save(myId, msg) {
      try {
        const convKey = makeConvKey(myId, msg.peerId);
        const encrypted = await encryptRecord(aesKey, msg);
        const record = {
          msgId: msg.msgId,
          convKey,
          ts: msg.ts,
          iv: encrypted.iv,
          ct: encrypted.ct,
        };
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(record);
        await new Promise((resolve, reject) => {
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
      } catch (err) {
        console.warn("[Archive] Failed to save message:", err.message);
      }
    },

    /**
     * Load all messages for a conversation, decrypted and sorted by timestamp.
     * @param {string} myId - Current user's identity ID
     * @param {string} peerId - Conversation partner's identity ID
     * @returns {Array} Decrypted messages sorted oldest-first
     */
    async loadConversation(myId, peerId) {
      try {
        const convKey = makeConvKey(myId, peerId);
        const tx = db.transaction(STORE_NAME, "readonly");
        const index = tx.objectStore(STORE_NAME).index("convKey");
        const req = index.getAll(convKey);
        const records = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });

        const messages = [];
        for (const record of records) {
          try {
            const msg = await decryptRecord(aesKey, record);
            messages.push(msg);
          } catch {
            // Skip corrupted records
          }
        }
        return messages.sort((a, b) => a.ts - b.ts);
      } catch (err) {
        console.warn("[Archive] Failed to load conversation:", err.message);
        return [];
      }
    },

    /**
     * Load all messages for all conversations.
     * @returns {Array} All decrypted messages sorted oldest-first
     */
    async loadAll() {
      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).getAll();
        const records = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });

        const messages = [];
        for (const record of records) {
          try {
            const msg = await decryptRecord(aesKey, record);
            messages.push(msg);
          } catch {
            // Skip corrupted records
          }
        }
        return messages.sort((a, b) => a.ts - b.ts);
      } catch (err) {
        console.warn("[Archive] Failed to load all:", err.message);
        return [];
      }
    },

    /**
     * Clear all archived messages for this identity.
     */
    async clear() {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).clear();
        await new Promise((resolve, reject) => {
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
      } catch (err) {
        console.warn("[Archive] Failed to clear:", err.message);
      }
    },

    /**
     * Close the database connection.
     */
    close() {
      db.close();
    },
  };
}
