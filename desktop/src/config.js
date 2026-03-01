// client/src/config.js
// Client-side application constants.
// These are application logic values — not deployment config.
// For relay URLs, see VITE_API_URL / VITE_WS_URL in .env

/** How often to poll the relay for new messages when WebSocket is unavailable (ms) */
export const POLL_INTERVAL_MS = 5_000;

/** How often to republish capability hashes to keep the relay inbox active (ms) */
export const CAP_REPUBLISH_INTERVAL_MS = 30_000;

/** Delay before retrying a WebSocket connection after disconnect (ms) */
export const WS_RECONNECT_DELAY_MS = 3_000;

/** Base delay for send retry backoff on cap_not_allowed (ms × attempt index, 1-indexed) */
export const SEND_RETRY_BASE_DELAY_MS = 1_500;
