// server/src/schemas.js
// Strict Zod schemas for every relay endpoint.
//
// Design principles:
// - Reject unknown fields (.strict() on all objects)
// - Enforce max lengths on all strings
// - Enforce numeric bounds on all numbers
// - The relay is metadata-minimal: it validates structure, not content
// - Encrypted payloads are opaque blobs — we validate shape, not inner content

const { z } = require("zod");

// ── Shared types ────────────────────────────────────────────────────

// Base64url string (URL-safe base64 without padding)
const b64u = (maxLen) => z.string().min(1).max(maxLen).regex(/^[A-Za-z0-9_-]+$/);

// JWK public key (ECDSA P-256 or ECDH P-256)
const jwkPublicKey = z.object({
  kty: z.literal("EC"),
  crv: z.literal("P-256"),
  x: b64u(64),
  y: b64u(64),
  key_ops: z.array(z.string()).optional(),
  ext: z.boolean().optional(),
}).strict();

// Encrypted payload (ephemeral ECDH + AES-GCM)
const encryptedPayload = z.object({
  alg: z.string().max(64),
  epk: z.object({
    kty: z.literal("EC"),
    crv: z.literal("P-256"),
    x: b64u(64),
    y: b64u(64),
    key_ops: z.array(z.string()).optional(),
    ext: z.boolean().optional(),
  }).passthrough(), // JWK may have extra fields from WebCrypto
  iv: b64u(24),       // 12 bytes = 16 base64 chars, allow margin
  ct: b64u(8_000_000), // max ~6MB base64 ciphertext (supports 5MB file payloads)
}).strict();

// Identity ID (SHA-256 of JCS(authPubJwk), base64url = 43 chars)
const identityId = b64u(64);

// Capability token (32 random bytes, base64url = 43 chars)
const capToken = b64u(64);

// Signature (ECDSA P-256, 64 bytes IEEE P1363 = ~86 base64url chars)
const signature = b64u(128);

// Timestamp (reasonable range: not before 2024, not more than 5min in future)
const timestamp = z.number().int().min(1700000000000).refine(
  (ts) => ts <= Date.now() + 300_000,
  { message: "Timestamp too far in the future" }
);

// ── Endpoint schemas ────────────────────────────────────────────────

// POST /send — metadata-minimal message delivery
const sendSchema = z.object({
  p: z.literal(4),
  to: identityId,
  cap: capToken,
  ch: z.enum(["msg", "req"]),
  authPub: jwkPublicKey,
  payload: encryptedPayload,
  sig: signature,
}).strict();

// PUT /caps/:toId and /requestCaps/:toId — register inbox capabilities
const capsUpdateSchema = z.object({
  p: z.literal(4),
  t: z.literal("CapsUpdate"),
  ts: timestamp,
  from: identityId,
  to: identityId,
  body: z.object({
    authPub: jwkPublicKey,
    capHashes: z.array(b64u(64)).min(1).max(16),
    replace: z.boolean(),
  }).strict(),
  sig: signature,
}).strict();

// POST /inbox/:toId and /requests/inbox/:toId — authenticated drain
const inboxDrainSchema = z.object({
  ts: timestamp,
  authPub: jwkPublicKey,
  sig: signature,
}).strict();

// POST /block/:toId
const blockSchema = z.object({
  fromId: identityId,
  capHash: b64u(64).optional(),
  authPub: jwkPublicKey,
  sig: signature,
}).strict();

// POST /revokeCap/:toId
const revokeCapSchema = z.object({
  capHash: b64u(64),
  authPub: jwkPublicKey,
  sig: signature,
}).strict();

// POST /directory/publish
const directoryPublishSchema = z.object({
  handle: z.string().min(1).max(32).regex(/^[a-z0-9_-]+$/),
  profile: z.object({
    dissolveProtocol: z.literal(4),
    v: z.literal(4),
    id: identityId,
    label: z.string().max(64).optional(),
    authPublicJwk: jwkPublicKey,
    e2eePublicJwk: jwkPublicKey,
    requestCap: capToken.optional(),
    requestCapHash: b64u(64).optional(),
    discoverable: z.boolean().optional(),
    showPresence: z.boolean().optional(),
  }).strict(),
  sig: signature,
}).strict();

// GET /directory/lookup (query params validated separately)
const directoryLookupQuery = z.object({
  handle: z.string().min(1).max(32).regex(/^[a-z0-9_-]+$/),
});

// ── Validation helper ───────────────────────────────────────────────

/**
 * Validate a request body against a schema.
 * Returns { ok: true, data } or { ok: false, error: string }.
 */
function validate(schema, body) {
  const result = schema.safeParse(body);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  // Build a human-readable but non-leaky error message
  const issues = result.error.issues.map(
    (i) => `${i.path.join(".")}: ${i.message}`
  ).slice(0, 3); // limit to 3 issues to avoid info leaks
  return { ok: false, error: `validation_failed: ${issues.join("; ")}` };
}

module.exports = {
  sendSchema,
  capsUpdateSchema,
  inboxDrainSchema,
  blockSchema,
  revokeCapSchema,
  directoryPublishSchema,
  directoryLookupQuery,
  validate,
};
