// client/src/crypto/seed.js
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
import { b64uFromBytes } from "./encoding";

const te = new TextEncoder();

// PKCS#8 DER wrapper for a raw 32-byte P-256 private key scalar.
// RFC 5958 / SEC1: OneAsymmetricKey v1 for id-ecPublicKey / secp256r1
const P256_PKCS8_PREFIX = new Uint8Array([
  0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06,
  0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
  0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
  0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01,
  0x01, 0x04, 0x20,
]); // 35 bytes

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

  // Import P-256 private keys from raw scalars
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
 * Build PKCS#8 DER from a raw 32-byte P-256 scalar.
 */
function scalarToPkcs8(scalarBuf) {
  const der = new Uint8Array(P256_PKCS8_PREFIX.length + 32);
  der.set(P256_PKCS8_PREFIX);
  der.set(new Uint8Array(scalarBuf), P256_PKCS8_PREFIX.length);
  return der;
}

/**
 * Import a raw P-256 scalar as an ECDSA private key.
 * Returns [privateJwk, publicJwk].
 * Imports as extractable first to get the JWK (which carries x, y coords),
 * then the caller (activateSession) re-imports as non-extractable.
 */
async function importP256ScalarEcdsa(scalarBuf) {
  const der = scalarToPkcs8(scalarBuf);
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "ECDSA", namedCurve: "P-256" },
    true, // extractable so we can export JWK
    ["sign"]
  );
  const privJwk = await crypto.subtle.exportKey("jwk", privateKey);

  // Public JWK: same as private but without the private scalar (d)
  const pubJwk = { kty: privJwk.kty, crv: privJwk.crv, x: privJwk.x, y: privJwk.y, key_ops: ["verify"] };

  return [privJwk, pubJwk];
}

/**
 * Import a raw P-256 scalar as an ECDH private key.
 * Returns [privateJwk, publicJwk].
 */
async function importP256ScalarEcdh(scalarBuf) {
  const der = scalarToPkcs8(scalarBuf);
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );
  const privJwk = await crypto.subtle.exportKey("jwk", privateKey);

  const pubJwk = { kty: privJwk.kty, crv: privJwk.crv, x: privJwk.x, y: privJwk.y, key_ops: [] };

  return [privJwk, pubJwk];
}
