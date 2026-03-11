// client/src/utils/storage.js
// Local storage helpers and file utilities.

export function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

export function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Check replay protection. Returns true if message should be processed (not a replay).
 * Uses a sliding window of recently seen message IDs (msgId-based dedup).
 * Keyed on msgId (random per-message) instead of seq to avoid false dedup
 * when a sender recovers on a new device and their seq counter resets.
 */
const MAX_SEEN_IDS = 500;
export function checkAndUpdateReplay(myId, fromId, convId, msgId, envelopeType = "Message") {
  if (typeof convId !== "string") return false;
  const key = `seen2:${myId}:${fromId}:${convId}:${envelopeType}`;
  let seen;
  try {
    seen = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(seen)) seen = [];
  } catch { seen = []; }
  if (seen.includes(msgId)) return false;
  seen.push(msgId);
  if (seen.length > MAX_SEEN_IDS) seen = seen.slice(-MAX_SEEN_IDS);
  localStorage.setItem(key, JSON.stringify(seen));
  return true;
}
