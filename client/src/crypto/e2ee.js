// client/src/crypto/e2ee.js
// End-to-end encryption using ephemeral ECDH + AES-GCM.
//
// Each message generates a fresh ECDH keypair. The ephemeral private key
// is never exported or stored, providing forward secrecy for sent messages.
//
// Padding (alg: "ECDH_P256_EPHEMERAL_AESGCM_PAD"):
//   Plaintext is padded to the nearest 256-byte block boundary before
//   encryption, so ciphertext length does not reveal message length.
//   Wire format of padded plaintext bytes:
//     [2 bytes big-endian: original UTF-8 byte length]
//     [original UTF-8 bytes]
//     [random padding to fill block]

import { b64uFromBytes, bytesFromB64u, enc } from "./encoding";

const dec = new TextDecoder();

const BLOCK_SIZE = 256; // pad to nearest multiple of this many bytes
const ALG_PADDED = "ECDH_P256_EPHEMERAL_AESGCM_PAD";
const ALG_LEGACY = "ECDH_P256_EPHEMERAL_AESGCM";

async function importEcdhPrivateKey(jwk) {
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
}

async function importEcdhPublicKey(jwk) {
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, true, []);
}

// ── Padding helpers ──────────────────────────────────────────────────

function padToBlock(plaintext) {
  const original = enc.encode(plaintext);
  const origLen = original.length;
  // Minimum padded size is BLOCK_SIZE; never pad below that
  const target = Math.max(BLOCK_SIZE, Math.ceil((origLen + 2) / BLOCK_SIZE) * BLOCK_SIZE);
  const padLen = target - origLen - 2;
  const out = new Uint8Array(target);
  // 2-byte big-endian original length header
  out[0] = (origLen >> 8) & 0xff;
  out[1] = origLen & 0xff;
  out.set(original, 2);
  if (padLen > 0) {
    out.set(crypto.getRandomValues(new Uint8Array(padLen)), 2 + origLen);
  }
  return out;
}

function unpadFromBlock(padded) {
  const origLen = (padded[0] << 8) | padded[1];
  return dec.decode(padded.slice(2, 2 + origLen));
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Encrypt plaintext using a fresh ephemeral ECDH keypair against the
 * recipient's static public key.  Plaintext is padded to BLOCK_SIZE-byte
 * boundaries before encryption to resist traffic analysis.
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

  // Pad then encrypt
  const paddedBytes = padToBlock(plaintext);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, paddedBytes)
  );

  return {
    alg: ALG_PADDED,
    epk: epkJwk,
    iv: b64uFromBytes(iv),
    ct: b64uFromBytes(ct),
  };
}

/**
 * Decrypt a message encrypted with e2eeEncrypt.
 *
 * @param {object} cipherPayload - { alg, epk, iv, ct }
 * @param {CryptoKey|object} myStaticPrivKeyOrJwk - Non-extractable CryptoKey (preferred) or JWK
 */
export async function e2eeDecrypt(cipherPayload, myStaticPrivKeyOrJwk) {
  const iv = bytesFromB64u(cipherPayload.iv);
  const ct = bytesFromB64u(cipherPayload.ct);

  const myPriv = myStaticPrivKeyOrJwk instanceof CryptoKey
    ? myStaticPrivKeyOrJwk
    : await importEcdhPrivateKey(myStaticPrivKeyOrJwk);

  const senderEphPub = await importEcdhPublicKey(cipherPayload.epk);

  const aesKey = await crypto.subtle.deriveKey(
    { name: "ECDH", public: senderEphPub },
    myPriv,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  const ptBytes = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, ct)
  );

  // Handle padded (new) and legacy (unpadded) formats
  if (cipherPayload.alg === ALG_PADDED) {
    return unpadFromBlock(ptBytes);
  }
  // Legacy ALG_LEGACY — plaintext was encoded directly
  return dec.decode(ptBytes);
}
