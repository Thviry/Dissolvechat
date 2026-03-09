// Mobile relay adapter
// React Native has native fetch and WebSocket — relay.js works as-is.
// We re-export everything and provide mobile-specific config overrides.

export {
  getRelayUrl,
  getRelayWsUrl,
  setRelayUrls,
  setRelayUrl,
  resetRelayUrl,
  publishCaps,
  publishRequestCaps,
  sendEnvelope,
  drainInbox,
  drainRequestInbox,
  blockOnRelay,
  publishDirectoryEntry,
  lookupDirectory,
  checkHandleAvailable,
  connectWebSocket,
} from '../../client/src/protocol/relay';

// Mobile-specific config — more conservative for battery
export const MOBILE_POLL_INTERVAL_MS = 10_000;       // 10s (vs 5s web)
export const MOBILE_WS_RECONNECT_DELAY_MS = 5_000;   // 5s (vs 3s web)
export const MOBILE_CAP_REPUBLISH_INTERVAL_MS = 60_000; // 60s (vs 30s web)
