// dissolve-core/src/crypto/e2ee.js
// End-to-end encryption using ephemeral ECDH + AES-GCM.
//
// Each message generates a fresh ECDH keypair. The ephemeral private key
// is never exported or stored, providing forward secrecy for sent messages.

import { b64uFromBytes, bytesFromB64u, enc } from "./encoding";

const dec = new TextDecoder();

const BUCKETS = [512, 1024, 2048, 4096];

function padPlaintext(bytes) {
  const len = bytes.length;
  let target = BUCKETS.find(b => b >= len);
  if (!target) {
    target = Math.ceil(len / 1024) * 1024;
  }
  const padded = new Uint8Array(target);
  padded.set(bytes);
  return padded;
}

function unpadPlaintext(bytes) {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end--;
  return bytes.subarray(0, end);
}

async function importEcdhPrivateKey(jwk) {
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
}

async function importEcdhPublicKey(jwk) {
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, true, []);
}

/**
 * Encrypt plaintext using a fresh ephemeral ECDH keypair against the
 * recipient's static public key.
 *
 * Returns: { alg, epk, iv, ct }
 */
export async function e2eeEncrypt(plaintext, theirStaticPubJwk) {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Generate ephemeral keypair
  const kp = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );
  const epkJwk = await crypto.subtle.exportKey("jwk", kp.publicKey);

  // Derive shared secret
  const theirPub = await importEcdhPublicKey(theirStaticPubJwk);
  const aesKey = await crypto.subtle.deriveKey(
    { name: "ECDH", public: theirPub },
    kp.privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, padPlaintext(enc.encode(plaintext)))
  );

  return {
    alg: "ECDH_P256_EPHEMERAL_AESGCM",
    epk: epkJwk,
    iv: b64uFromBytes(iv),
    ct: b64uFromBytes(ct),
  };
}

/**
 * Decrypt a message encrypted with e2eeEncrypt using our static private key.
 */
export async function e2eeDecrypt(cipherPayload, myStaticPrivJwk) {
  const iv = bytesFromB64u(cipherPayload.iv);
  const ct = bytesFromB64u(cipherPayload.ct);
  const myPriv = myStaticPrivJwk instanceof CryptoKey
    ? myStaticPrivJwk
    : await importEcdhPrivateKey(myStaticPrivJwk);
  const senderEphPub = await importEcdhPublicKey(cipherPayload.epk);

  const aesKey = await crypto.subtle.deriveKey(
    { name: "ECDH", public: senderEphPub },
    myPriv,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  const ptBytes = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, ct);
  return dec.decode(unpadPlaintext(new Uint8Array(ptBytes)));
}
