# DissolveChat Mobile App — Design Document

**Date:** 2026-03-08
**Status:** Draft
**Platform:** iOS (React Native)
**Target:** v0.2.0-beta

---

## Overview

Native iOS app for DissolveChat built with React Native. Shares crypto and protocol logic with the web/desktop clients. Maintains the Terminal brand identity with native iOS navigation patterns. Includes device linking via QR code for seamless desktop-to-mobile migration.

## Goals

1. A user can install the iOS app, create an identity or link an existing one, and send/receive E2EE messages
2. The app receives push notifications when backgrounded without compromising the zero-knowledge relay model
3. The app feels native on iOS while maintaining the DissolveChat visual identity
4. A desktop user can transfer their full identity (keys, contacts, groups) to mobile by scanning a QR code

## Non-Goals (v1)

- Android support (follow-up after iOS ships)
- Voice/video calls
- iPad-specific layouts
- Apple Watch companion
- iCloud backup of keyfile

---

## Architecture

### Framework: Expo (React Native)

Expo SDK with EAS Build for cloud iOS compilation. Enables full iOS development from Windows — no Mac required. Expo's SDK covers all required native APIs (Keychain, APNs, Face ID, SQLite, camera). EAS Build compiles on cloud Macs and delivers TestFlight/App Store builds.

### Code Reuse

```
packages/dissolve-core/     100% reused — crypto primitives (pure JS + WebCrypto)
client/src/protocol/        ~95% reused — relay.js, envelopes.js, groupEnvelopes.js
client/src/hooks/           ~80% reused — useMessaging, useContacts, useGroups logic
                            useIdentity needs platform-specific storage adapter
client/src/components/      0% reused — rewritten with React Native primitives
client/src/utils/           ~30% reused — storage.js, messageStore.js, notifications.js all replaced
```

### Monorepo Integration

New `mobile/` directory at the repo root, alongside `client/`, `desktop/`, `server/`:

```
mobile/
  ios/                  Xcode project, native modules
  src/
    screens/            React Native screens (navigation stack)
    components/         React Native UI components
    adapters/           Platform-specific adapters
      storage.js        iOS Keychain + AsyncStorage wrapper
      messageStore.js   SQLite encrypted archive
      notifications.js  Native push notifications
      camera.js         QR code scanner
    theme/              Terminal design system for React Native
    App.tsx             Root component + navigation
  package.json
```

Shared code imported via pnpm workspace:
- `"dissolve-core": "workspace:*"` (crypto)
- Hooks and protocol imported from `client/src/` via package.json aliases or symlinks

---

## Device Linking (QR Code Flow)

### Flow

1. **Desktop**: User clicks "Link to Mobile" in Settings
   - Desktop generates an ephemeral X25519 keypair
   - Desktop generates a random 6-character session ID
   - Desktop POSTs `{ sessionId, publicKey }` to relay `POST /link-session`
   - Desktop displays QR code containing: `dissolve://link?sid={sessionId}&pk={base64url_publicKey}`
   - Desktop polls `GET /link-session/{sessionId}` for mobile's response

2. **Mobile**: User taps "Link Device" and scans QR code
   - Mobile parses the QR payload
   - Mobile generates its own ephemeral X25519 keypair
   - Mobile derives shared secret via X25519 DH (mobile private + desktop public)
   - Mobile POSTs `{ sessionId, publicKey }` to relay `POST /link-session/{sessionId}/respond`

3. **Desktop**: Detects mobile response
   - Desktop derives same shared secret via X25519 DH (desktop private + mobile public)
   - Desktop encrypts full keyfile blob with AES-256-GCM using shared secret
   - Desktop POSTs encrypted blob to `POST /link-session/{sessionId}/transfer`

4. **Mobile**: Receives encrypted keyfile
   - Mobile polls `GET /link-session/{sessionId}/transfer`
   - Mobile decrypts with shared secret
   - Mobile prompts for passphrase to unlock keyfile
   - Mobile activates session, imports contacts and groups

5. **Cleanup**: Both sides discard ephemeral keys. Relay deletes session after transfer or 5-minute TTL.

### New Relay Endpoints

```
POST   /link-session                    Create session (desktop)
POST   /link-session/:sid/respond       Respond with mobile public key
POST   /link-session/:sid/transfer      Upload encrypted keyfile
GET    /link-session/:sid               Poll for session state
DELETE /link-session/:sid               Cleanup
```

Sessions are in-memory only (consistent with relay's zero-persistence model). Auto-expire after 5 minutes. Rate-limited to prevent abuse.

### Security Properties

- Relay never sees keyfile contents — only an encrypted blob
- Ephemeral X25519 keypair provides forward secrecy
- Session ID is short-lived and single-use
- QR code must be physically visible (proximity requirement)
- Passphrase still required to unlock the keyfile after transfer
- No new trust assumptions — relay remains untrusted courier

---

## Push Notifications

### Architecture

```
[Relay] --silent push--> [APNs] --wake--> [iOS App] --fetch--> [Relay]
```

### Implementation

1. Mobile app requests notification permission on first launch
2. On successful registration, iOS returns a device token
3. App sends device token to relay: `POST /push-token` (signed, authenticated like all requests)
4. Relay stores `{ identityId → deviceToken }` in memory (lost on restart, like caps)
5. When relay receives an envelope for an identity with a registered push token and no active WebSocket:
   - Send a **silent push** (content-available: 1) via APNs
   - Push payload: `{ "aps": { "content-available": 1 } }` — no text, no metadata, no sender info
6. iOS wakes app in background, app connects to relay, drains inbox
7. App generates local notification with decrypted message preview (or just "New message" for privacy)

### Privacy

- APNs payload is empty — Apple sees nothing about the message
- Device token is stored in-memory only on relay (lost on restart)
- Device token is app-specific, rotates periodically, not linkable across apps
- No more identifying than the IP address already exposed to the relay

### Relay Changes

- New endpoint: `POST /push-token` (register/update token, signed request)
- New endpoint: `DELETE /push-token` (deregister on logout)
- `store.js`: Add `pushTokens` map alongside existing `caps` and `pending`
- `routes/send.js`: After queuing envelope, check for push token, fire silent APNs push
- New dependency: `apn` or `node-apn` (or HTTP/2 client for APNs directly)
- APNs auth key (.p8 file) stored as relay environment variable

---

## Storage Layer

### Key Storage — iOS Keychain

Replace `sessionStorage` (browser) with iOS Keychain Services:

| Browser | iOS |
|---------|-----|
| `sessionStorage` (encrypted session) | Keychain `kSecClassGenericPassword` with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` |
| Non-extractable CryptoKey objects | Same — WebCrypto CryptoKey in React Native JSC/Hermes |
| `localStorage` (preferences) | `@react-native-async-storage/async-storage` |
| `localStorage` (contacts, groups) | AsyncStorage (JSON serialized, same format) |

### Message Archive — SQLite

Replace IndexedDB with `react-native-sqlite-storage` or `expo-sqlite`:

```sql
CREATE TABLE messages (
  msgId TEXT PRIMARY KEY,
  convKey TEXT NOT NULL,
  ts INTEGER NOT NULL,
  iv BLOB NOT NULL,
  ct BLOB NOT NULL
);
CREATE INDEX idx_conv ON messages(convKey);
CREATE INDEX idx_ts ON messages(ts);
```

Encryption: Same AES-256-GCM scheme — `deriveArchiveKey(identityId)` from dissolve-core. Encrypted blobs stored in SQLite, decrypted in app memory.

### Replay Protection

Sequence counters move from `localStorage` to AsyncStorage. Same key format: `seq:{myId}:{convId}`.

---

## UI / UX

### Design System

Maintain Terminal brand identity with iOS-native patterns:

- **Colors**: Same palette — `#0a0a0a` void, `#161616` secondary, `#39ff14` acid green accent
- **Fonts**: IBM Plex Mono for headings, Inter for body (bundled with app, not Google Fonts)
- **Radii**: 4px base (matching desktop)
- **5 themes**: Terminal (default), Ocean, Forest, Ember, Violet — same theme system
- **Dark mode only**: Matches the brand; no light mode

### Navigation (iOS native patterns)

```
Tab Bar (bottom)
├── Chats          — conversation list (1-to-1 + groups)
├── Contacts       — contact list + requests
└── Settings       — identity, themes, security, presence, linking

Chat Screen        — push onto navigation stack from Chats tab
Group Info          — push from chat header
Create Group       — modal from Contacts tab
Add Contact        — modal from Contacts tab
Link Device        — QR scanner, pushed from Settings
```

- Standard iOS swipe-back navigation
- Native keyboard avoidance (KeyboardAvoidingView)
- Native scroll behavior (bounce, momentum)
- Haptic feedback on send

### Key Screens

1. **Welcome Screen**: Create Identity / Log In / Link Device / Recover from Seed Phrase
2. **Chat List**: Conversations sorted by last message, unread badges, presence dots
3. **Chat Screen**: Message bubbles (outgoing = dark glass + green right border), input bar, file attachment
4. **Contact List**: Contacts + pending requests, add contact button
5. **Settings**: Identity info, theme picker, security (recovery phrase, export keyfile), presence toggle, notification toggle, link device
6. **QR Scanner**: Camera view with overlay frame, scans dissolve:// deep links

### Gestures

- Swipe left on conversation → archive/delete
- Long press message → copy text
- Pull to refresh on chat list (manual inbox drain)
- Swipe back → pop screen

---

## Platform Adaptations

### Config Adjustments

```javascript
POLL_INTERVAL_MS = 10_000             // 10s (save battery vs desktop's 5s)
WS_RECONNECT_DELAY_MS = 5_000        // 5s (less aggressive reconnect)
CAP_REPUBLISH_INTERVAL_MS = 30_000   // Same as desktop
MAX_INLINE_FILE_SIZE = 5_242_880     // 5MB (same as desktop)
```

### Background Behavior

- App backgrounded: WebSocket disconnects after ~30s (iOS kills it)
- Push notification wakes app for ~30s of background execution
- App drains inbox, generates local notifications, goes back to sleep
- Caps republished on every foreground event

### Deep Linking

- URL scheme: `dissolve://`
- `dissolve://link?sid={}&pk={}` — device linking QR
- `dissolve://contact?data={}` — contact import (replaces URL fragment approach)
- Universal Links: `https://dissolve.chat/link/...` as fallback

---

## Dependencies

### Expo + React Native Packages

```
expo                            Expo SDK
expo-router                     File-based navigation (built on React Navigation)
expo-secure-store               iOS Keychain access
expo-sqlite                     SQLite message archive
expo-camera                     QR code scanning
expo-notifications              APNs push + local notifications
expo-local-authentication       Face ID / Touch ID
expo-document-picker            Keyfile import
expo-sharing                    Keyfile export
expo-file-system                File system access
expo-haptics                    Haptic feedback
expo-crypto                     Native crypto utilities
@react-native-async-storage/async-storage  Preferences (Expo-compatible)
```

### Build & Deploy

```
eas-cli                         EAS Build + Submit CLI
```

- EAS Build compiles iOS on cloud Macs (no local Xcode needed)
- EAS Submit pushes to TestFlight / App Store
- Development builds install on physical iPhone for testing over network

### Crypto

- `dissolve-core` (workspace package) — all crypto primitives
- `react-native-quick-crypto` for WebCrypto polyfill on Hermes engine
- `@scure/bip39` and `@noble/curves` already work in React Native

---

## Implementation Phases

### Phase A: Project Setup + Core Integration
- Initialize React Native project in `mobile/`
- Configure pnpm workspace
- Verify dissolve-core crypto works on iOS (WebCrypto polyfill if needed)
- Set up iOS Keychain storage adapter
- Set up AsyncStorage adapter

### Phase B: Identity + Authentication
- Welcome screen (Create / Log In / Recover)
- useIdentity hook with Keychain storage backend
- Keyfile import via document picker
- Seed phrase recovery flow
- Session persistence across app restarts

### Phase C: Messaging
- Relay connection (HTTP + WebSocket)
- useMessaging hook integration
- Chat list screen
- Chat screen with message bubbles
- File sharing (camera roll + document picker)
- SQLite message archive

### Phase D: Contacts + Groups
- Contact list screen
- Add contact / handle search
- Contact requests (incoming/outgoing)
- Group creation, group chat, group management
- Group info screen

### Phase E: Device Linking
- New relay endpoints for link sessions
- Desktop "Link to Mobile" UI in Settings
- Mobile QR scanner
- Encrypted keyfile transfer flow
- Contact + group import on link

### Phase F: Push Notifications
- APNs integration on relay
- Push token registration from mobile
- Silent push → background fetch → local notification
- Notification permissions flow

### Phase G: Polish + App Store
- All 5 themes
- Haptic feedback
- Deep linking
- App icon + launch screen
- App Store screenshots + description
- Export compliance declaration (encryption)
- TestFlight beta → App Store submission

---

## Resolved Decisions

1. **Push notification previews**: "New message" only — no sender name, no content. Privacy first.
2. **iCloud Keychain backup**: No — storing keys on Apple's servers contradicts the security model.
3. **Multi-relay on mobile**: Yes — relay.js already handles it, no extra work.
4. **Face ID / Touch ID**: Yes, opt-in. Runs entirely on-device (Secure Enclave), biometric data never leaves the phone. Convenience shortcut to unlock the locally stored session — passphrase remains the real key. Store session key in Keychain with `kSecAccessControlBiometryCurrentSet` protection flag.

---

*Design document for DissolveChat mobile app (iOS, React Native)*
