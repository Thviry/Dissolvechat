# Codebase Structure

**Analysis Date:** 2026-03-08 (updated from 2026-02-27)

## Directory Layout

```
DCv5.16/
├── client/                          # Web/browser client (React + Vite)
│   ├── src/
│   │   ├── components/              # UI components (shared with desktop via alias)
│   │   ├── hooks/                   # State management hooks (shared)
│   │   ├── protocol/                # Envelope building, relay communication (shared)
│   │   ├── utils/                   # Storage, QR codes, message archive, notifications (shared)
│   │   ├── config.js                # Centralized timing constants (shared)
│   │   ├── App.jsx                  # Root component
│   │   ├── App.css                  # Full design system
│   │   ├── main.jsx                 # Entry point
│   │   └── index.css                # Global styles
│   ├── public/                      # Static assets
│   ├── vite.config.js               # Vite config with @-aliases
│   └── package.json                 # Dependencies (React, Vite, dissolve-core)
│
├── desktop/                         # Desktop app (Tauri wrapper)
│   ├── src/                         # Entry points only (shared code via Vite aliases)
│   │   ├── App.jsx                  # Root component (imports via @components, @hooks, etc.)
│   │   ├── App.css                  # Design system (separate copy for future desktop overrides)
│   │   ├── main.jsx                 # Entry point
│   │   └── index.css                # Global styles
│   ├── src-tauri/                   # Rust/Tauri backend
│   │   ├── src/
│   │   │   └── lib.rs               # Tauri setup, system tray, close-to-tray
│   │   ├── tauri.conf.json          # Tauri app config (devUrl: localhost:5174)
│   │   ├── Cargo.toml               # Rust deps (tauri with tray-icon feature)
│   │   └── icons/                   # App icons
│   ├── vite.config.js               # Vite config with aliases → ../client/src/
│   └── package.json                 # Dependencies (Tauri, Vite, dissolve-core)
│
├── packages/
│   └── dissolve-core/               # Shared crypto + hooks package (pnpm workspace)
│       ├── src/
│       │   ├── crypto/
│       │   │   ├── encoding.js      # Base64url, SHA-256, random ID/cap
│       │   │   ├── signing.js       # JCS + EdDSA signature verification
│       │   │   ├── e2ee.js          # ECDH ephemeral + AES-GCM
│       │   │   ├── keyfile.js       # Encrypt/decrypt key material
│       │   │   ├── seed.js          # BIP-39 mnemonic, identity derivation
│       │   │   ├── group.js         # AES-256-GCM group key gen/encrypt/decrypt/wrap
│       │   │   └── index.js         # Barrel export
│       │   └── hooks/
│       │       ├── useToast.js      # Toast notification hook
│       │       └── index.js         # Barrel export
│       └── package.json             # Workspace package config
│
├── server/                          # Relay server (Express + WebSocket)
│   ├── src/
│   │   ├── index.js                 # Server entry, middleware, CORS setup
│   │   ├── routes.js                # HTTP + WebSocket endpoints (~621 lines)
│   │   ├── store.js                 # In-memory data (inbox, caps, directory, pending)
│   │   ├── schemas.js               # Zod validation schemas
│   │   ├── ratelimit.js             # Token bucket rate limiter (IP + identity)
│   │   ├── logger.js                # Structured logging
│   │   └── crypto.js                # Server-side Ed25519, SHA-256, ID computation
│   ├── test-flow.js                 # Manual E2EE test scenario runner
│   └── package.json                 # Dependencies (Express, ws, Zod)
│
├── landing/                         # Public landing page (dissolve.chat)
│   ├── index.html                   # Security manifesto aesthetic
│   ├── styles.css                   # Dark theme, acid green accent
│   └── script.js                    # GitHub release fetcher, scroll reveals
│
├── docs/plans/                      # Design docs and implementation plans
├── .planning/                       # GSD planning (roadmap, phases, codebase map)
├── pnpm-workspace.yaml              # Workspace: packages/*, client, desktop
└── .github/workflows/release.yml    # CI: tag-triggered Tauri build (Win/Mac/Linux)
```

## Directory Purposes

**client/src/components/**
- Purpose: React UI components (shared with desktop via Vite alias)
- Key files:
  - `App.jsx`: Root component orchestrating state + routing
  - `ChatPanel.jsx`: Message display, send input (handles both 1-to-1 and group)
  - `Sidebar.jsx`: Contact list, requests, groups, settings, directory search, theme picker
  - `LoginScreen.jsx`: Enrollment and keyfile login
  - `CreateGroupModal.jsx`: Group creation with member selection
  - `GroupInfoPanel.jsx`: Group info, member management, admin controls
  - `PassphraseModal.jsx`: Custom prompt replacement for passphrase entry
  - `ShareModal.jsx`: QR/link sharing for contact cards
  - `Icons.jsx`: SVG icon components (Settings, Send, Close, Group, Crown, Plus, Leave, Trash, Eye, etc.)
  - `Toast.jsx`: Notification container

**client/src/hooks/**
- Purpose: React hooks for state management and side effects
- Key files:
  - `useIdentity.js`: Enroll, login, logout; session encryption; mnemonic exposure
  - `useContacts.js`: Add/remove/accept contacts; request management
  - `useMessaging.js`: Send/receive 1-to-1 and group messages; polling/WebSocket; archive
  - `useGroups.js`: Group state (create, update, delete); localStorage persistence
  - `useGroupActions.js`: Group admin ops (invite, add/remove members, promote, leave, rename)

**client/src/protocol/**
- Purpose: Protocol envelope building and relay communication
- Key files:
  - `envelopes.js`: Build signed 1-to-1 envelopes (Message, ContactRequest, ContactGrant, CapsUpdate, DirectoryPublish, InboxDrain)
  - `groupEnvelopes.js`: Build group envelopes (7 types: Message, Invite, MemberAdded/Removed, AdminChange, Leave, NameChange)
  - `relay.js`: HTTP/WS relay integration, multi-relay support (broadcast writes, first-reachable drain), WebSocket auth

**client/src/utils/**
- Purpose: Utility functions for storage, notifications, QR codes, message archiving
- Key files:
  - `storage.js`: downloadJson, saveJson, loadJson, checkAndUpdateReplay (localStorage)
  - `messageStore.js`: IndexedDB-backed encrypted message archive (AES-256-GCM, key derived from identity secret)
  - `notifications.js`: Web Audio API two-tone ping + title flash for incoming messages
  - `qrcode.js`: QR code SVG generation for contact sharing

**client/src/config.js**
- Purpose: Centralized timing constants
- Contains: `POLL_INTERVAL_MS`, `CAP_REPUBLISH_INTERVAL_MS`, `SEND_RETRY_BASE_DELAY_MS`, `WS_RECONNECT_DELAY_MS`

**packages/dissolve-core/src/crypto/**
- Purpose: Shared cryptographic primitives (used by both client and desktop)
- Key files:
  - `encoding.js`: Base64url, SHA-256, random ID/cap generation, JCS canonicalization
  - `signing.js`: JCS + EdDSA signature creation/verification
  - `e2ee.js`: ECDH ephemeral key exchange + AES-GCM (with bucket padding)
  - `keyfile.js`: Encrypt/decrypt key material with passphrase (AES-256-GCM + PBKDF2)
  - `seed.js`: BIP-39 mnemonic generation, identity key derivation from seed phrase
  - `group.js`: AES-256-GCM symmetric key generation, group encrypt/decrypt, key wrap/unwrap via E2EE

**server/src/**
- Purpose: Relay server implementation
- Key files:
  - `index.js`: Express app setup, CORS, CSP headers, graceful shutdown
  - `routes.js`: All endpoints (/send, /drain-inbox, /caps-update, /directory/publish, /ws-challenge, /health, /presence)
  - `store.js`: In-memory maps (inbox, caps, directory, pending queue max 200)
  - `schemas.js`: Zod schema definitions
  - `ratelimit.js`: Token bucket rate limiter (IP + identity layers)

**landing/**
- Purpose: Public-facing product page (dissolve.chat)
- Hosted by Caddy on IONOS VPS, no build step
- Contains download links to GitHub releases

## Key File Locations

**Entry Points:**
- `client/src/main.jsx`: DOM mount for web client
- `desktop/src/main.jsx`: DOM mount for desktop (Tauri wraps it)
- `server/src/index.js`: Express server initialization
- `landing/index.html`: Landing page

**Configuration:**
- `client/vite.config.js`: Vite config with `@-` aliases
- `desktop/vite.config.js`: Vite config with aliases → `../client/src/`
- `desktop/src-tauri/tauri.conf.json`: Tauri app metadata, window config
- `client/src/config.js`: Client timing constants
- `pnpm-workspace.yaml`: Monorepo workspace definition

**Vite Aliases (both configs):**
- `@components` → `client/src/components/`
- `@hooks` → `client/src/hooks/`
- `@protocol` → `client/src/protocol/`
- `@utils` → `client/src/utils/`
- `@config` → `client/src/config.js`

## Naming Conventions

**Files:**
- Components: PascalCase (`ChatPanel.jsx`, `CreateGroupModal.jsx`)
- Utilities: camelCase (`messageStore.js`, `notifications.js`)
- Hooks: prefix `use` + PascalCase (`useIdentity.js`, `useGroupActions.js`)
- Envelopes: camelCase (`envelopes.js`, `groupEnvelopes.js`)

**Directories:**
- Functional domains: lowercase (`crypto`, `protocol`, `components`, `hooks`, `utils`)

**Variables/Constants:**
- Identity fields: camelCase with suffixes (`*PrivJwk`, `*PubJwk`, `*Cap`)
- Config constants: SCREAMING_SNAKE_CASE (`POLL_INTERVAL_MS`)

## Where to Add New Code

**New Feature:**
- Hook: `client/src/hooks/useFeature.js`
- Component: `client/src/components/Feature.jsx`
- Server endpoint: `server/src/routes.js` + `server/src/schemas.js`
- Both web and desktop get it automatically (Vite aliases)

**New Crypto Primitive:**
- Add to `packages/dissolve-core/src/crypto/` and export from `index.js`
- Both clients import via `dissolve-core/crypto`

**Desktop-Specific Code:**
- Only in `desktop/src-tauri/` (Rust) or `desktop/src/App.jsx` (if conditional)
- Never add desktop-only files to `client/src/`

**CSS Changes:**
- `client/src/App.css` for shared styles
- `desktop/src/App.css` needs manual sync (only file still duplicated)

## Desktop vs Web

**Shared (via Vite alias):**
- All of `components/`, `hooks/`, `protocol/`, `utils/`, `config.js`

**Desktop-only:**
- `desktop/src-tauri/`: Rust backend, system tray, close-to-tray
- `desktop/src/App.css`: Separate copy (allows future desktop overrides)

**Web-only:**
- CORS handling (server-side, not needed in desktop/Tauri)

---

*Structure analysis: 2026-03-08*
