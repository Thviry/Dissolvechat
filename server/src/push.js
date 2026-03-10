// server/src/push.js
// APNs silent push notification sender.
// Uses HTTP/2 to communicate with Apple Push Notification service.
// Sends background pushes to wake the app for inbox draining.

const http2 = require("node:http2");
const crypto = require("node:crypto");
const fs = require("node:fs");

const APNS_HOST = process.env.APNS_HOST || "https://api.push.apple.com";
const APNS_KEY_PATH = process.env.APNS_KEY_PATH; // Path to .p8 file
const APNS_KEY_ID = process.env.APNS_KEY_ID;
const APNS_TEAM_ID = process.env.APNS_TEAM_ID;
const APNS_BUNDLE_ID = process.env.APNS_BUNDLE_ID || "chat.dissolve.app";

let cachedJwt = null;
let cachedJwtExpiry = 0;
let apnsKey = null;

function loadKey() {
  if (apnsKey) return apnsKey;
  if (!APNS_KEY_PATH) return null;
  try {
    apnsKey = fs.readFileSync(APNS_KEY_PATH, "utf8");
    return apnsKey;
  } catch {
    console.warn("[PUSH] Failed to load APNs key from", APNS_KEY_PATH);
    return null;
  }
}

function generateApnsJwt() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwtExpiry > now) return cachedJwt;

  const key = loadKey();
  if (!key || !APNS_KEY_ID || !APNS_TEAM_ID) return null;

  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: APNS_KEY_ID })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iss: APNS_TEAM_ID, iat: now })).toString("base64url");
  const signingInput = `${header}.${payload}`;

  const rawSig = crypto.sign(
    "SHA256",
    Buffer.from(signingInput),
    { key, dsaEncoding: "ieee-p1363" }
  ).toString("base64url");

  cachedJwt = `${signingInput}.${rawSig}`;
  cachedJwtExpiry = now + 3000; // Cache for ~50 minutes (APNs allows 60)
  return cachedJwt;
}

async function sendSilentPush(deviceToken) {
  const jwt = generateApnsJwt();
  if (!jwt) return; // APNs not configured

  return new Promise((resolve) => {
    const client = http2.connect(APNS_HOST);
    client.on("error", () => { client.close(); resolve(); });

    const payload = JSON.stringify({ aps: { "content-available": 1 } });

    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": APNS_BUNDLE_ID,
      "apns-push-type": "background",
      "apns-priority": "5",
      "content-type": "application/json",
      "content-length": Buffer.byteLength(payload),
    });

    req.on("response", (headers) => {
      const status = headers[":status"];
      if (status !== 200) {
        console.warn(`[PUSH] APNs returned ${status} for token ${deviceToken.slice(0, 8)}…`);
      }
    });
    req.on("end", () => { client.close(); resolve(); });
    req.on("error", () => { client.close(); resolve(); });

    req.end(payload);
  });
}

module.exports = { sendSilentPush };
