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
 * The `envelopeType` parameter namespaces the counter so that protocol envelopes
 * (ContactRequest, ContactGrant) don't collide with normal Message seq numbers.
 */
export function checkAndUpdateReplay(myId, fromId, convId, seq, envelopeType = "Message") {
  if (typeof convId !== "string" || !Number.isFinite(seq) || seq <= 0) return false;
  const key = `seen:${myId}:${fromId}:${convId}:${envelopeType}`;
  const last = Number(localStorage.getItem(key) || "0") || 0;
  if (seq <= last) return false;
  localStorage.setItem(key, String(seq));
  return true;
}
