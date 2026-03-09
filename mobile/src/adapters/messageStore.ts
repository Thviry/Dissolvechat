// Mobile message archive — SQLite + AES-256-GCM encryption
// Mirrors the web client's IndexedDB message store API

import * as SQLite from 'expo-sqlite';

const te = new TextEncoder();
const td = new TextDecoder();

let db: SQLite.SQLiteDatabase | null = null;
let archiveKey: CryptoKey | null = null;

// ── Encryption helpers ──────────────────────────────────────────────

async function deriveArchiveKey(identityId: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    te.encode(identityId),
    'HKDF',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: te.encode('dissolve-message-archive-v1'),
      info: te.encode('dissolve-archive'),
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ── Conversation key ────────────────────────────────────────────────

function makeConvKey(myId: string, peerId: string): string {
  return [myId, peerId].sort().join('|');
}

// ── Public API ──────────────────────────────────────────────────────

export async function openArchive(identityId: string): Promise<void> {
  db = await SQLite.openDatabaseAsync('dissolve_archive');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS messages (
      msgId TEXT PRIMARY KEY,
      convKey TEXT NOT NULL,
      ts INTEGER NOT NULL,
      iv TEXT NOT NULL,
      ct TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_conv ON messages(convKey);
    CREATE INDEX IF NOT EXISTS idx_ts ON messages(ts);
  `);
  archiveKey = await deriveArchiveKey(identityId);
}

export async function saveMessage(
  myId: string,
  msg: { msgId: string; peerId: string; ts: number; [key: string]: unknown }
): Promise<void> {
  if (!db || !archiveKey) return;

  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = te.encode(JSON.stringify(msg));
    const ct = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, archiveKey, plaintext)
    );
    const convKey = makeConvKey(myId, msg.peerId);

    await db.runAsync(
      'INSERT OR REPLACE INTO messages (msgId, convKey, ts, iv, ct) VALUES (?, ?, ?, ?, ?)',
      [msg.msgId, convKey, msg.ts, toBase64(iv), toBase64(ct)]
    );
  } catch (err) {
    console.warn('[Archive] Failed to save message:', err);
  }
}

export async function loadConversation(
  myId: string,
  peerId: string,
  limit = 50,
  before?: number
): Promise<Array<Record<string, unknown>>> {
  if (!db || !archiveKey) return [];

  try {
    const convKey = makeConvKey(myId, peerId);
    const rows = before
      ? await db.getAllAsync(
          'SELECT * FROM messages WHERE convKey = ? AND ts < ? ORDER BY ts DESC LIMIT ?',
          [convKey, before, limit]
        )
      : await db.getAllAsync(
          'SELECT * FROM messages WHERE convKey = ? ORDER BY ts DESC LIMIT ?',
          [convKey, limit]
        );

    const messages = [];
    for (const row of rows as any[]) {
      try {
        const iv = fromBase64(row.iv);
        const ct = fromBase64(row.ct);
        const plaintext = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          archiveKey!,
          ct
        );
        messages.push(JSON.parse(td.decode(new Uint8Array(plaintext))));
      } catch {
        // Skip corrupted records
      }
    }
    return messages.reverse(); // oldest first
  } catch (err) {
    console.warn('[Archive] Failed to load conversation:', err);
    return [];
  }
}

export async function loadAll(): Promise<Array<Record<string, unknown>>> {
  if (!db || !archiveKey) return [];

  try {
    const rows = await db.getAllAsync(
      'SELECT * FROM messages ORDER BY ts ASC'
    );

    const messages = [];
    for (const row of rows as any[]) {
      try {
        const iv = fromBase64(row.iv);
        const ct = fromBase64(row.ct);
        const plaintext = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          archiveKey!,
          ct
        );
        messages.push(JSON.parse(td.decode(new Uint8Array(plaintext))));
      } catch {
        // Skip corrupted records
      }
    }
    return messages;
  } catch (err) {
    console.warn('[Archive] Failed to load all:', err);
    return [];
  }
}

export async function clearArchive(): Promise<void> {
  if (!db) return;
  await db.execAsync('DELETE FROM messages');
}

export async function closeArchive(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
  archiveKey = null;
}
