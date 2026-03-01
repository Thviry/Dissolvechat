// dissolve-core/src/crypto/encoding.js
// Base64url encoding/decoding and hashing utilities.

const enc = new TextEncoder();

export function b64uFromBytes(bytes) {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function bytesFromB64u(b64u) {
  const b64 = b64u.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64u.length + 3) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function sha256B64u(dataBytes) {
  const hash = await crypto.subtle.digest("SHA-256", dataBytes);
  return b64uFromBytes(new Uint8Array(hash));
}

export async function capHashFromCap(capB64u) {
  const bytes = bytesFromB64u(capB64u);
  return sha256B64u(bytes);
}

export function randomCap() {
  return b64uFromBytes(crypto.getRandomValues(new Uint8Array(32)));
}

export function randomId() {
  return crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now();
}

export { enc };
