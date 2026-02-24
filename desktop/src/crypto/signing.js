// client/src/crypto/signing.js
// ECDSA P-256 signing and verification over JCS-canonicalized JSON.

import canonicalize from "canonicalize";
import { b64uFromBytes, bytesFromB64u, enc } from "./encoding";

export function jcs(obj) {
  const s = canonicalize(obj);
  if (typeof s !== "string") throw new Error("canonicalize_failed");
  return s;
}

async function importEcdsaPrivateKey(jwk) {
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function importEcdsaPublicKey(jwk) {
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]);
}

/**
 * Sign an object (without the `sig` field) using ECDSA P-256 + SHA-256.
 * Returns the signature as base64url.
 */
export async function signObject(objNoSig, authPrivateJwk) {
  const priv = await importEcdsaPrivateKey(authPrivateJwk);
  const data = enc.encode(jcs(objNoSig));
  const sigBytes = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, priv, data)
  );
  return b64uFromBytes(sigBytes);
}

/**
 * Verify a signature over JCS-canonicalized JSON.
 */
export async function verifyObject(objNoSig, sigB64u, authPublicJwk) {
  const pub = await importEcdsaPublicKey(authPublicJwk);
  const data = enc.encode(jcs(objNoSig));
  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    pub,
    bytesFromB64u(sigB64u),
    data
  );
}
