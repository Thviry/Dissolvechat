// dissolve-core/src/crypto/keyfile.js
// Encrypt/decrypt the USB key file's private material with a passphrase.

import { b64uFromBytes, bytesFromB64u, enc } from "./encoding";

const dec = new TextDecoder();

async function deriveAesKey(passphrase, saltBytes) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations: 600_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptPrivateData(obj, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt);
  const plaintext = enc.encode(JSON.stringify(obj));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext)
  );
  return {
    salt: b64uFromBytes(salt),
    iv: b64uFromBytes(iv),
    ciphertext: b64uFromBytes(ciphertext),
  };
}

export async function decryptPrivateData(payload, passphrase) {
  const salt = bytesFromB64u(payload.salt);
  const iv = bytesFromB64u(payload.iv);
  const ciphertext = bytesFromB64u(payload.ciphertext);
  const key = await deriveAesKey(passphrase, salt);
  const plaintextBytes = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return JSON.parse(dec.decode(new Uint8Array(plaintextBytes)));
}
