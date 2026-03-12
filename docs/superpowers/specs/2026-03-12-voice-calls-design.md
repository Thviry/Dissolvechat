# Voice Calls — Design Spec

**Date**: 2026-03-12
**Scope**: 1-to-1 voice calls with forced TURN relay, E2EE signaling
**Goal**: Add real-time voice calling to DissolveChat without compromising privacy or introducing new server dependencies beyond coturn.

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | 1-to-1 voice only (no video, no group) | Ship fast, solid foundation. Architecture extensible for future additions. |
| WebRTC approach | Raw `RTCPeerConnection` API | Zero dependencies, full control, aligns with project ethos. |
| Signaling | Existing WS + E2EE envelope system | Relay never knows a call is happening. No new server routes for signaling. |
| TURN policy | Always forced (`iceTransportPolicy: 'relay'`) | Guarantees peer IPs never exposed. ~50-100ms latency cost is negligible for voice. |
| Call button | Chat header (next to contact name) | Standard placement, visible but not intrusive. |
| Incoming call UI | Full-screen overlay → persistent bar on connect | Can't miss a call; can keep chatting once connected. |
| Missed calls | System message in chat history | Useful context, goes through existing archive pipeline. |
| Ring timeout | 30 seconds | Standard across most apps. |

---

## 1. Signaling Protocol

Four new envelope types sent through the existing E2EE envelope system. The relay treats them as normal encrypted messages — no awareness of voice calls.

### Envelope Types

| Type | Direction | Inner Payload |
|------|-----------|---------------|
| `VoiceOffer` | Caller → Callee | `callId` (UUID), `sdp` (SDP offer string) |
| `VoiceAnswer` | Callee → Caller | `callId`, `sdp` (SDP answer string) |
| `VoiceIce` | Bidirectional | `callId`, `candidate` (ICE candidate object) |
| `VoiceEnd` | Bidirectional | `callId`, `reason` (`hangup` \| `decline` \| `timeout` \| `missed`) |

### Signaling Flow

1. Caller generates SDP offer via `RTCPeerConnection.createOffer()`
2. Caller builds `VoiceOffer` envelope (encrypted with recipient's e2ee public key, signed with caller's auth key — same as a regular message)
3. Sent via existing `POST /send` to relay
4. Recipient receives via WS notification → drains inbox → decrypts → sees `t: "VoiceOffer"`
5. If accepted, callee generates SDP answer → sends `VoiceAnswer` envelope back
6. ICE candidates trickle through `VoiceIce` envelopes in both directions
7. `VoiceEnd` terminates from either side

### Envelope Builder Conventions

All voice envelopes follow the existing v4-secure envelope pattern:
- Outer: protocol `p: 4`, `to`, `cap`, `ch: "msg"`, `authPub`, encrypted `payload`, `sig`
- Inner: `t` (type), `from`, `senderLabel`, `senderCap`, `e2eePub`, `authPub`, `convId`, `msgId`, `ts`, plus voice-specific fields (`callId`, `sdp`/`candidate`/`reason`)

New file: `client/src/protocol/voiceEnvelopes.js` with builders:
- `buildVoiceOffer(callId, sdp, ...keys)`
- `buildVoiceAnswer(callId, sdp, ...keys)`
- `buildVoiceIce(callId, candidate, ...keys)`
- `buildVoiceEnd(callId, reason, ...keys)`

---

## 2. WebRTC Connection Layer

New module: `client/src/protocol/voiceCall.js`

### RTCPeerConnection Configuration

```
iceServers: [{ urls: "turn:relay.dissolve.chat:3478", username, credential }]
iceTransportPolicy: "relay"
```

TURN credentials are short-lived HMAC tokens fetched from the relay immediately before call setup (see Section 3).

### Call State Machine

```
idle → offering → ringing → connected → ended
                → declined → ended
                → timeout (30s) → ended
idle → incoming → connected → ended
                → declined → ended
```

### Module API

- `createCall(peerId, sendEnvelope)` — initiates outbound call, returns call controller
- `handleOffer(offer, sendEnvelope)` — handles inbound call, returns call controller

**Call controller interface**:
- `accept()` — accept incoming call (callee only)
- `decline()` — decline incoming call (callee only)
- `hangup()` — end active call (either party)
- `mute()` / `unmute()` — toggle local mic
- `onStateChange(callback)` — subscribe to state transitions
- `onRemoteStream(callback)` — receive remote audio stream

### Audio Handling

- `getUserMedia({ audio: true, video: false })` requested on call start (caller) or accept (callee)
- Remote audio attached to a hidden `<audio>` element with `autoplay` attribute
- All local streams and tracks stopped on call end (release mic immediately)

### Timeouts

- **Ring timeout**: 30 seconds on caller side — auto-sends `VoiceEnd` with reason `timeout`
- **ICE connection timeout**: 15 seconds — if no media path established, end call with error toast

### Cleanup

All streams, tracks, and the `RTCPeerConnection` are closed and disposed on call end regardless of how it ended (hangup, decline, timeout, ICE failure, error).

---

## 3. TURN Server (coturn)

Runs on the existing IONOS VPS (`74.208.170.22`) alongside the relay server.

### Installation & Configuration

- Package: `apt install coturn`
- Ports: 3478 (TURN/STUN over TCP+UDP), 49152-65535 (media relay UDP range)
- Firewall: UFW rules for 3478/tcp, 3478/udp, 49152-65535/udp
- Systemd service: `coturn.service`

### Authentication

- **Method**: Time-limited HMAC credentials (RFC 5389 long-term, ephemeral variant)
- **Shared secret**: Environment variable shared between relay server and coturn config
- **New server endpoint**: `GET /turn-credentials` (authenticated — requires valid auth signature)
  - Returns: `{ username, credential, ttl: 300, urls: ["turn:relay.dissolve.chat:3478"] }`
  - Username format: `<expiry-timestamp>:<identity-id>` (coturn ephemeral user convention)
  - Credential: HMAC-SHA1 of username with shared secret
  - TTL: 5 minutes (sufficient for call setup; TURN session persists after credential expiry)
- Client fetches credentials immediately before creating `RTCPeerConnection`

### Privacy & Hardening

- Media relay logging disabled (no peer IPs in logs)
- `no-cli` — disable coturn admin CLI
- `no-multicast-peers` — prevent multicast relay
- No persistent state — credentials expire, sessions are ephemeral

### Resource Limits

- Max sessions per user: 1 (one active call at a time)
- Per-session bandwidth cap: 256kbps (generous ceiling for voice-only)
- Total bandwidth governed by VPS plan (IONOS included bandwidth)

### Cost

Zero additional — runs on the existing VPS. coturn is lightweight (~20MB RAM idle). At the current scale (<50 concurrent calls), the VPS bandwidth allocation is more than sufficient.

---

## 4. UI Components

All styles added to existing `App.css` (both `client/src/` and `desktop/src/`). No new CSS files.

### 4.1 Call Button (ChatPanel Header)

- Phone icon button in the chat header, next to the contact name
- Disabled (greyed out) when already in a call
- Hidden for group conversations (v1 is 1-to-1 only)
- Uses existing `.btn-icon` pattern

### 4.2 Incoming Call Overlay

- Full-screen dark backdrop (reuses `.modal-backdrop` pattern)
- Centered content: caller's hue-coded avatar (`idToHue()`), caller's handle
- Two circular buttons: Accept (green/accent) and Decline (red)
- Ringtone: Web Audio API oscillator pulse (similar pattern to existing notification sound in `utils/notifications.js`)
- Auto-dismisses after 30-second ring timeout

### 4.3 In-Call Overlay → Persistent Bar Transition

- On connect: brief full-screen overlay showing peer avatar + "Connected" → fades to persistent bar after ~1 second
- **Persistent call bar**: thin bar pinned at top of `.app-layout`, above chat header
  - Shows: peer handle, elapsed time (MM:SS), mute toggle button, end call button
  - Click bar → navigates back to the call conversation
  - Visible across all conversations while call is active
  - Accent-colored left border (consistent with app design language)

### 4.4 Call History Entries

- Rendered as system messages in chat history (same pattern as group event messages)
- Outbound answered: phone icon + "Voice call — 2m 34s"
- Inbound answered: phone icon + "Voice call — 2m 34s"
- Missed (inbound): missed-call icon + "Missed voice call"
- Missed (outbound): phone icon + "No answer"
- Declined: phone icon + "Call declined"
- Styled with existing `.system-message` CSS class

---

## 5. Integration & Data Flow

### New Hook: `useVoiceCall.js`

Lives in `client/src/hooks/`. Manages all call state and WebRTC lifecycle.

**Exports**:
- `startCall(peerId)` — initiate outbound call
- `acceptCall()` — accept current incoming call
- `declineCall()` — decline current incoming call
- `hangup()` — end active call
- `mute()` / `unmute()` — toggle mic
- `callState` — current state (`idle` | `offering` | `ringing` | `incoming` | `connected` | `ended`)
- `callPeer` — peer ID of current/incoming call
- `callDuration` — elapsed seconds (updates every second while connected)
- `isMuted` — boolean

**Internal responsibilities**:
- Fetches TURN credentials from `GET /turn-credentials` before creating connections
- Creates/manages `RTCPeerConnection` via `voiceCall.js` module
- Sends signaling envelopes via `voiceEnvelopes.js` builders + existing `sendEnvelope`
- Handles ring timeout (30s timer)
- Tracks call duration (1-second interval while connected)
- Inserts call history entry into `useMessaging` on call end

### Message Routing (useMessaging.js)

The existing `handleIncoming` function routes messages by `inner.t` type. Add four new cases:

- `VoiceOffer` → delegate to `useVoiceCall.handleIncomingOffer(inner)`
- `VoiceAnswer` → delegate to `useVoiceCall.handleIncomingAnswer(inner)`
- `VoiceIce` → delegate to `useVoiceCall.handleIncomingIce(inner)`
- `VoiceEnd` → delegate to `useVoiceCall.handleIncomingEnd(inner)`

These do NOT get stored as regular messages — they're transient signaling.

### Call History in Chat

On call end, `useVoiceCall` inserts a synthetic message into `useMessaging` state:
```
{ t: "CallEvent", callId, duration, reason, direction: "inbound"|"outbound", ts }
```
- Stored in message state and archived to IndexedDB (if archiving enabled)
- `ChatPanel` renders these with the system message pattern (Section 4.4)

### Envelope Builders

New file: `client/src/protocol/voiceEnvelopes.js`

Follows identical pattern to `envelopes.js`:
- Accepts same key parameters (`e2eePriv`, `e2eePub`, `authPriv`, `authPub`, recipient's `e2eePub`, `cap`)
- Encrypts inner payload with ECDH-P256 + AES-256-GCM
- Signs outer envelope with auth key
- Uses protocol version 4, channel `"msg"`

### Server Changes

**One new route**: `GET /turn-credentials`
- Requires authentication (signed request, same as other authenticated endpoints)
- Reads `TURN_SECRET` from environment
- Generates ephemeral HMAC credential pair
- Returns JSON: `{ username, credential, ttl, urls }`

**Environment variables** (added to systemd service and `.env`):
- `TURN_SECRET` — shared HMAC secret between relay and coturn

No other server changes. Signaling flows through existing `/send` and inbox drain.

### Tauri / Desktop

- WebRTC and `getUserMedia` work in Tauri v2's WebView out of the box
- CSP `connect-src` in `tauri.conf.json`: may need `turn:relay.dissolve.chat:3478` added (verify during implementation)
- No Rust-side changes needed
- Desktop picks up all shared component/hook/protocol changes via Vite aliases

---

## 6. File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `client/src/protocol/voiceEnvelopes.js` | Envelope builders for voice signaling |
| `client/src/protocol/voiceCall.js` | WebRTC connection management module |
| `client/src/hooks/useVoiceCall.js` | React hook for call state and lifecycle |
| `client/src/components/IncomingCallOverlay.jsx` | Full-screen incoming call UI |
| `client/src/components/CallBar.jsx` | Persistent in-call bar |

### Modified Files
| File | Changes |
|------|---------|
| `client/src/hooks/useMessaging.js` | Route voice envelope types to useVoiceCall callbacks |
| `client/src/components/ChatPanel.jsx` | Call button in header, CallEvent rendering in messages |
| `client/src/components/App.jsx` | Wire useVoiceCall hook, render IncomingCallOverlay + CallBar |
| `client/src/components/Icons.jsx` | Add phone/call icons |
| `client/src/App.css` | Call overlay, call bar, call button, call history styles |
| `desktop/src/App.css` | Same styles (kept in sync) |
| `server/src/routes.js` | Add `GET /turn-credentials` endpoint |
| `desktop/src-tauri/tauri.conf.json` | CSP update for TURN server (if needed) |

### Server Deployment
| Item | Details |
|------|---------|
| coturn installation | `apt install coturn` on IONOS VPS |
| coturn config | `/etc/turnserver.conf` — shared secret, ports, hardening |
| UFW rules | 3478/tcp+udp, 49152-65535/udp |
| systemd | `coturn.service` enabled |
| relay env | Add `TURN_SECRET` to `dissolve-relay.service` |

---

## 7. Security Properties

| Property | How It's Achieved |
|----------|-------------------|
| **Signaling E2EE** | Voice envelopes encrypted with ECDH-P256 + AES-256-GCM (same as messages) |
| **Media E2EE** | WebRTC DTLS-SRTP between peers (TURN server relays opaque encrypted packets) |
| **IP privacy** | `iceTransportPolicy: "relay"` — peers never learn each other's IP |
| **No server recording** | TURN relays encrypted streams it cannot decrypt. Relay server never touches media. |
| **No call metadata on server** | Signaling looks like normal messages to the relay. No call-specific logging. |
| **Ephemeral credentials** | TURN credentials expire in 5 minutes. No long-lived secrets on client. |
| **Mic release** | All audio tracks explicitly stopped on call end |

---

## 8. Future Extensions (Not In Scope)

These are explicitly out of scope for v1 but the architecture supports them:

- **Video calls**: Add `video: true` to `getUserMedia`, new UI for video stream. Same signaling.
- **Group voice calls**: Would require SFU (Selective Forwarding Unit) or mesh topology. Signaling extensible via group envelope fan-out pattern.
- **Call quality indicators**: Monitor `RTCPeerConnection.getStats()` for packet loss, jitter.
- **Push notifications for calls**: When recipient is offline / app backgrounded (requires push infrastructure).
