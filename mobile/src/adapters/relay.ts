// Mobile relay adapter
// React Native has native fetch and WebSocket — relay.js works as-is.
// We re-export everything and provide mobile-specific config overrides.

// Polyfill localStorage for React Native (used by nextSeq in envelopes.js)
// In-memory store — sequence numbers reset on app restart, which is fine
// since they only need to be monotonically increasing within a session.
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  };
}

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

export {
  buildMessage,
  buildContactRequest,
  buildContactGrant,
  buildBlockRequest,
  buildInboxDrain,
  buildCapsUpdate,
  buildDirectoryPublish,
} from '../../client/src/protocol/envelopes';

export {
  buildGroupMessage,
  buildGroupInvite,
  buildGroupMemberAdded,
  buildGroupMemberRemoved,
  buildGroupLeave,
} from '../../client/src/protocol/groupEnvelopes';

// Mobile-specific config — more conservative for battery
export const MOBILE_POLL_INTERVAL_MS = 10_000;       // 10s (vs 5s web)
export const MOBILE_WS_RECONNECT_DELAY_MS = 5_000;   // 5s (vs 3s web)
export const MOBILE_CAP_REPUBLISH_INTERVAL_MS = 60_000; // 60s (vs 30s web)
