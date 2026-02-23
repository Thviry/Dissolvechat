// server/src/crypto.js
// Server-side cryptographic utilities for relay enforcement.

const crypto = require("crypto");
const canonicalize = require("canonicalize");

/**
 * SHA-256 hash of raw bytes, returned as base64url.
 */
function sha256B64u(buf) {
  return crypto.createHash("sha256").update(buf).digest("base64url");
}

/**
 * Compute capHash from a base64url-encoded capability token.
 * cap is 32 random bytes encoded as base64url; we hash the raw bytes.
 */
function capHashFromCap(capB64u) {
  const buf = Buffer.from(capB64u, "base64url");
  if (buf.length !== 32) throw new Error("cap_wrong_length");
  return sha256B64u(buf);
}

/**
 * Compute the canonical identity ID from an auth public JWK.
 * id = SHA-256(JCS(authPublicJwk)) as base64url.
 */
function computeIdFromAuthPubJwk(authPublicJwk) {
  const canonical = canonicalize(authPublicJwk);
  if (typeof canonical !== "string") throw new Error("canonicalize_failed");
  return sha256B64u(Buffer.from(canonical, "utf-8"));
}

/**
 * Verify an ECDSA P-256 signature over JCS-canonicalized JSON.
 *
 * @param {object} objNoSig - The object without the `sig` field.
 * @param {string} sigB64u  - The signature as base64url.
 * @param {object} authPublicJwk - The signer's ECDSA P-256 public key in JWK format.
 * @returns {Promise<boolean>}
 */
async function verifySignature(objNoSig, sigB64u, authPublicJwk) {
  try {
    const canonical = canonicalize(objNoSig);
    if (typeof canonical !== "string") return false;

    // Import the public key
    const keyObj = crypto.createPublicKey({
      key: {
        kty: authPublicJwk.kty,
        crv: authPublicJwk.crv,
        x: authPublicJwk.x,
        y: authPublicJwk.y,
      },
      format: "jwk",
    });

    const sigBuf = Buffer.from(sigB64u, "base64url");
    const dataBuf = Buffer.from(canonical, "utf-8");

    // WebCrypto ECDSA with SHA-256 produces IEEE P1363 format (r||s, 64 bytes for P-256).
    // Node crypto.verify expects DER by default. We need to convert.
    const derSig = ieeeP1363ToDer(sigBuf);

    return crypto.verify("SHA256", dataBuf, keyObj, derSig);
  } catch {
    return false;
  }
}

/**
 * Convert IEEE P1363 signature (r || s) to DER format for Node's crypto.verify.
 */
function ieeeP1363ToDer(sigBuf) {
  if (sigBuf.length !== 64) throw new Error("Expected 64-byte P1363 signature");
  const r = sigBuf.subarray(0, 32);
  const s = sigBuf.subarray(32, 64);

  function encodeInteger(buf) {
    // Strip leading zeros but ensure high bit isn't set (add 0x00 pad if needed)
    let i = 0;
    while (i < buf.length - 1 && buf[i] === 0) i++;
    const trimmed = buf.subarray(i);
    const needsPad = trimmed[0] & 0x80;
    const len = trimmed.length + (needsPad ? 1 : 0);
    const out = Buffer.alloc(2 + len);
    out[0] = 0x02; // INTEGER tag
    out[1] = len;
    if (needsPad) {
      out[2] = 0x00;
      trimmed.copy(out, 3);
    } else {
      trimmed.copy(out, 2);
    }
    return out;
  }

  const rDer = encodeInteger(r);
  const sDer = encodeInteger(s);
  const seqLen = rDer.length + sDer.length;
  const der = Buffer.alloc(2 + seqLen);
  der[0] = 0x30; // SEQUENCE tag
  der[1] = seqLen;
  rDer.copy(der, 2);
  sDer.copy(der, 2 + rDer.length);
  return der;
}

module.exports = {
  sha256B64u,
  capHashFromCap,
  computeIdFromAuthPubJwk,
  verifySignature,
};
