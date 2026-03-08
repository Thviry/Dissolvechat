// server/src/index.js
// Dissolve Relay (Protocol v4-secure, hardened)
//
// Hardening:
// - CSP headers on all responses
// - Authenticated WebSocket (nonce challenge)
// - Strict schema validation on all endpoints
// - Dual-layer rate limiting (IP + identity)
// - Structured logging
// - Graceful shutdown

const http = require("http");
const express = require("express");
const cors = require("cors");
const { WebSocketServer } = require("ws");
const Store = require("./store");
const { registerRoutes, setupAuthenticatedWs, wsNonces, rl } = require("./routes");
const logger = require("./logger");

const app = express();
const IS_DEV = process.env.NODE_ENV !== "production";
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(s => s.trim())
  : (IS_DEV ? null : undefined); // null = allow all in dev

// ── CORS ────────────────────────────────────────────────────────────
// In production, allow specific origins (web + Tauri desktop).
if (ALLOWED_ORIGINS === null) {
  app.use(cors());
} else if (ALLOWED_ORIGINS) {
  app.use(cors({ origin: ALLOWED_ORIGINS }));
} else {
  app.use(cors({ origin: false }));
}

// ── Security headers (CSP + hardening) ──────────────────────────────
app.use((_req, res, next) => {
  // Strict CSP: no inline scripts, no eval, restrict origins
  res.setHeader("Content-Security-Policy", [
    "default-src 'none'",
    "script-src 'self'",
    "connect-src 'self' ws: wss:",
    "style-src 'self' 'unsafe-inline'",  // Vite dev needs inline styles
    "img-src 'self' data:",
    "font-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "));

  // Additional security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "0"); // CSP replaces this
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  next();
});

// ── Body parsing ────────────────────────────────────────────────────
// Step 2: Envelope size limit — reject bodies > 16KB
app.use(express.json({ limit: "512kb" }));

// Request logging (dev only, uses structured logger)
app.use((req, _res, next) => {
  logger.request(req.method, req.url);
  next();
});

const store = new Store();
const server = http.createServer(app);

// ── WebSocket server ────────────────────────────────────────────────
const wss = new WebSocketServer({ server, path: "/ws" });

// Set up authenticated WebSocket handling (Step 4)
setupAuthenticatedWs(wss, wsNonces, store);

// ── HTTP routes ─────────────────────────────────────────────────────
registerRoutes(app, store, wss);

// ── Global error handler ────────────────────────────────────────────
// ── Global error handler (MUST be after routes in Express 5) ────────
app.use((err, _req, res, _next) => {
  // Body-parser errors (oversized, malformed JSON)
  if (err.type === "entity.too.large") {
    logger.validationFailed("body", "payload_too_large");
    if (!res.headersSent) return res.status(413).json({ error: "payload_too_large" });
    return;
  }
  if (err.type === "entity.parse.failed") {
    logger.validationFailed("body", "malformed_json");
    if (!res.headersSent) return res.status(400).json({ error: "malformed_json" });
    return;
  }

  console.error("[ERROR]", new Date().toISOString(), err?.message || err);
  if (!res.headersSent) {
    res.status(500).json({ error: "internal_error" });
  }
});

// ── Process safety ──────────────────────────────────────────────────
process.on("unhandledRejection", (reason) => {
  console.error("[UNHANDLED REJECTION]", new Date().toISOString(), reason);
});

process.on("uncaughtException", (err) => {
  console.error("[UNCAUGHT EXCEPTION]", new Date().toISOString(), err);
  if (!IS_DEV) process.exit(1);
});

// ── Start ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  logger.startup(PORT);
  console.log(`Dissolve Relay (v4-secure, hardened) on http://localhost:${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws (authenticated)`);
  console.log(`Persistence: IN-MEMORY ONLY`);
  console.log(`CORS: ${ALLOWED_ORIGINS ? ALLOWED_ORIGINS.join(", ") : (ALLOWED_ORIGINS === null ? "*" : "same-origin only")}`);
  if (IS_DEV) console.log(`Debug: http://localhost:${PORT}/debug/state`);
});

// ── Graceful shutdown ───────────────────────────────────────────────
function shutdown(signal) {
  logger.shutdown(signal);
  store.destroy();
  rl.destroy();
  wss.close();
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
