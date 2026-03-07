// dissolve-core/src/crypto/group.js
// Symmetric group key utilities (AES-256-GCM) + key wrapping via e2ee.

import { b64uFromBytes, bytesFromB64u } from "./encoding";
import { e2eeEncrypt, e2eeDecrypt } from "./e2ee";

const GCM_IV_BYTES = 12;
const GROUP_KEY_BYTES = 32; // AES-256

/**
 * Generate a random AES-256 group key.
 * Returns raw key as base64url string for storage/transport.
 */
export async function generateGroupKey() {
  const raw = crypto.getRandomValues(new Uint8Array(GROUP_KEY_BYTES));
  return b64uFromBytes(raw);
}

/**
 * Generate a random group ID (32 bytes, base64url).
 */
export function generateGroupId() {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return b64uFromBytes(raw);
}

/**
 * Encrypt plaintext with a symmetric group key (AES-256-GCM).
 * @param {string} plaintext - JSON string to encrypt
 * @param {string} groupKeyB64 - base64url-encoded AES-256 key
 * @returns {{ iv: string, ct: string }} base64url-encoded IV and ciphertext
 */
export async function groupEncrypt(plaintext, groupKeyB64) {
  const keyBuf = bytesFromB64u(groupKeyB64);
  const key = await crypto.subtle.importKey("raw", keyBuf, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(GCM_IV_BYTES));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  return { iv: b64uFromBytes(iv), ct: b64uFromBytes(new Uint8Array(ct)) };
}

/**
 * Decrypt ciphertext with a symmetric group key (AES-256-GCM).
 * @param {{ iv: string, ct: string }} cipher - base64url IV and ciphertext
 * @param {string} groupKeyB64 - base64url-encoded AES-256 key
 * @returns {string} decrypted plaintext
 */
export async function groupDecrypt(cipher, groupKeyB64) {
  const keyBuf = bytesFromB64u(groupKeyB64);
  const key = await crypto.subtle.importKey("raw", keyBuf, "AES-GCM", false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytesFromB64u(cipher.iv) },
    key,
    bytesFromB64u(cipher.ct)
  );
  return new TextDecoder().decode(pt);
}

/**
 * Wrap a group key for a specific recipient using their e2ee public key.
 * Uses the existing e2eeEncrypt (ephemeral ECDH + AES-GCM).
 */
export async function wrapGroupKey(groupKeyB64, recipientE2eePubJwk) {
  return e2eeEncrypt(groupKeyB64, recipientE2eePubJwk);
}

/**
 * Unwrap a group key encrypted for us.
 */
export async function unwrapGroupKey(wrappedPayload, myE2eePrivKey) {
  return e2eeDecrypt(wrappedPayload, myE2eePrivKey);
}
