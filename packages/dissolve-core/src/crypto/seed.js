// dissolve-core/src/crypto/seed.js
// BIP39 mnemonic → deterministic identity derivation.
//
// From 12 BIP39 words (128-bit entropy) we derive all four identity
// secrets via HKDF-SHA256 with domain-separated info strings:
//
//   entropy (16 bytes)
//     └─ HKDF("auth")       → 32-byte ECDSA P-256 private scalar
//     └─ HKDF("e2ee")       → 32-byte ECDH  P-256 private scalar
//     └─ HKDF("inboxcap")   → 32-byte inbox  capability  (base64url)
//     └─ HKDF("requestcap") → 32-byte request capability (base64url)
//
// This means the 12-word phrase is a *complete* backup: if you lose
// your key file you can re-derive exactly the same identity, caps included.

import { generateMnemonic as bip39Generate, mnemonicToEntropy, validateMnemonic as bip39Validate } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { p256 } from "@noble/curves/nist.js";
import { b64uFromBytes } from "./encoding";

const te = new TextEncoder();

// ── Public API ──────────────────────────────────────────────────────

/** Generate a fresh 12-word BIP39 mnemonic (128-bit entropy). */
export function generateMnemonic() {
  return bip39Generate(wordlist, 128);
}

/** Return true if the phrase is a valid BIP39 mnemonic. */
export function validateMnemonic(phrase) {
  return bip39Validate(phrase.trim(), wordlist);
}

/**
 * Derive a full identity data object from a BIP39 mnemonic.
 *
 * Returns the same shape that useIdentity.activateSession() expects:
 * { authPrivJwk, authPubJwk, e2eePrivJwk, e2eePubJwk, inboxCap, requestCap }
 *
 * Private key JWKs are returned in extractable form here because
 * activateSession() re-imports them as non-extractable CryptoKey objects.
 */
export async function deriveIdentityFromMnemonic(mnemonic) {
  const entropyBytes = mnemonicToEntropy(mnemonic.trim(), wordlist);

  // Import entropy as HKDF key material
  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    entropyBytes,
    "HKDF",
    false,
    ["deriveBits"]
  );

  const salt = te.encode("dissolve-seed-v1");

  // Derive 32 bytes for each domain
  const [authScalar, e2eeScalar, inboxCapBytes, requestCapBytes] = await Promise.all([
    deriveBits(hkdfKey, salt, "auth"),
    deriveBits(hkdfKey, salt, "e2ee"),
    deriveBits(hkdfKey, salt, "inboxcap"),
    deriveBits(hkdfKey, salt, "requestcap"),
  ]);

  // Import P-256 private keys via JWK (cross-browser, works on Safari/WebKit)
  const [authPrivJwk, authPubJwk] = await importP256ScalarEcdsa(authScalar);
  const [e2eePrivJwk, e2eePubJwk] = await importP256ScalarEcdh(e2eeScalar);

  return {
    authPrivJwk,
    authPubJwk,
    e2eePrivJwk,
    e2eePubJwk,
    inboxCap: b64uFromBytes(new Uint8Array(inboxCapBytes)),
    requestCap: b64uFromBytes(new Uint8Array(requestCapBytes)),
  };
}

// ── Internal helpers ────────────────────────────────────────────────

async function deriveBits(hkdfKey, salt, info) {
  return crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: te.encode(info) },
    hkdfKey,
    256
  );
}

/**
 * Compute P-256 public key coordinates (x, y) from a raw 32-byte scalar
 * using @noble/curves, then build a JWK for WebCrypto import.
 * This avoids PKCS#8 DER which Safari/WebKit rejects.
 */
function scalarToJwk(scalarBuf) {
  const scalarBytes = new Uint8Array(scalarBuf);
  // Compute uncompressed public point (65 bytes: 0x04 || x(32) || y(32))
  const pubBytes = p256.getPublicKey(scalarBytes, false);
  const x = pubBytes.slice(1, 33);
  const y = pubBytes.slice(33, 65);

  return {
    kty: "EC",
    crv: "P-256",
    x: b64uFromBytes(x),
    y: b64uFromBytes(y),
    d: b64uFromBytes(scalarBytes),
  };
}

/**
 * Import a raw P-256 scalar as an ECDSA private key via JWK.
 * Returns [privateJwk, publicJwk].
 */
async function importP256ScalarEcdsa(scalarBuf) {
  const jwk = scalarToJwk(scalarBuf);
  const privJwk = { ...jwk, key_ops: ["sign"] };

  // Import and re-export to get the canonical JWK from WebCrypto
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );
  const exportedPrivJwk = await crypto.subtle.exportKey("jwk", privateKey);

  const pubJwk = { kty: exportedPrivJwk.kty, crv: exportedPrivJwk.crv, x: exportedPrivJwk.x, y: exportedPrivJwk.y, key_ops: ["verify"] };

  return [exportedPrivJwk, pubJwk];
}

/**
 * Import a raw P-256 scalar as an ECDH private key via JWK.
 * Returns [privateJwk, publicJwk].
 */
async function importP256ScalarEcdh(scalarBuf) {
  const jwk = scalarToJwk(scalarBuf);
  const privJwk = { ...jwk, key_ops: ["deriveKey"] };

  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privJwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );
  const exportedPrivJwk = await crypto.subtle.exportKey("jwk", privateKey);

  const pubJwk = { kty: exportedPrivJwk.kty, crv: exportedPrivJwk.crv, x: exportedPrivJwk.x, y: exportedPrivJwk.y, key_ops: [] };

  return [exportedPrivJwk, pubJwk];
}
