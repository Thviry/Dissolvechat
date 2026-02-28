# Codebase Structure

**Analysis Date:** 2026-02-27

## Directory Layout

```
.claude/worktrees/admiring-almeida/
├── client/                          # Web/browser client (React + Vite)
│   ├── src/
│   │   ├── components/              # UI components
│   │   ├── crypto/                  # Cryptographic operations
│   │   ├── hooks/                   # State management (identity, messaging, contacts)
│   │   ├── protocol/                # Envelope building, relay communication
│   │   ├── utils/                   # Storage, QR codes, message archive
│   │   ├── App.jsx                  # Root component
│   │   ├── main.jsx                 # Entry point
│   │   └── index.css                # Global styles
│   ├── public/                      # Static assets
│   ├── vite.config.js               # Vite configuration
│   └── package.json                 # Dependencies (React, Vite)
│
├── desktop/                         # Desktop app (Tauri wrapper around web client)
│   ├── src/                         # Identical to client/src (symlinked or duplicated)
│   │   └── [same structure as client/src]
│   ├── src-tauri/                   # Rust/Tauri backend
│   │   ├── src/
│   │   │   └── main.rs              # Tauri window setup
│   │   ├── tauri.conf.json          # Tauri app config
│   │   └── icons/                   # App icons
│   ├── vite.config.js               # Vite + Tauri plugin
│   └── package.json                 # Dependencies (Tauri, Vite)
│
└── server/                          # Relay server (Express + WebSocket)
    ├── src/
    │   ├── index.js                 # Server entry, middleware setup
    │   ├── routes.js                # HTTP + WebSocket endpoint handlers
    │   ├── store.js                 # In-memory data structures (inbox, caps, directory)
    │   ├── schemas.js               # Zod validation schemas
    │   ├── ratelimit.js             # Rate limiting implementation
    │   ├── logger.js                # Structured logging
    │   └── crypto.js                # Server-side crypto utilities
    ├── test-flow.js                 # Manual test scenario runner
    └── package.json                 # Dependencies (Express, ws, Zod)
```

## Directory Purposes

**client/src/components/**
- Purpose: React UI components
- Contains: JSX files for views and reusable elements
- Key files:
  - `App.jsx`: Root component orchestrating state + routing
  - `ChatPanel.jsx`: Message display and send input
  - `Sidebar.jsx`: Contact list, requests, settings, directory search
  - `LoginScreen.jsx`: Enrollment and keyfile login
  - `PassphraseModal.jsx`: Custom prompt replacement for passphrase entry
  - `ShareModal.jsx`: QR/link sharing for contact cards
  - `Toast.jsx`: Notification container

**client/src/crypto/**
- Purpose: Cryptographic primitives and operations
- Contains: Encoding, signing, E2EE, key generation
- Key files:
  - `encoding.js`: Base64url, SHA-256, random ID/cap generation
  - `signing.js`: JCS + EdDSA signature verification
  - `e2ee.js`: ECDH ephemeral key exchange + AES-GCM
  - `keyfile.js`: Encrypt/decrypt key material for export
  - `index.js`: Barrel export

**client/src/hooks/**
- Purpose: React hooks for state management and side effects
- Contains: Identity, contacts, messaging, UI notification logic
- Key files:
  - `useIdentity.js`: Enroll, login, logout; session encryption
  - `useContacts.js`: Add/remove/accept contacts; request management
  - `useMessaging.js`: Send/receive messages; polling/WebSocket; message decryption
  - `useToast.js`: Toast stack management

**client/src/protocol/**
- Purpose: Protocol envelope building and relay communication
- Contains: Signed envelope construction, HTTP/WebSocket relay integration
- Key files:
  - `envelopes.js`: Build signed messages, requests, grants, caps updates, directory publishes
  - `relay.js`: fetch() wrappers for /send, /drain-inbox, /directory/lookup, WebSocket connection

**client/src/utils/**
- Purpose: Utility functions for storage, QR codes, message archiving
- Contains: IndexedDB, localStorage, QR code generation
- Key files:
  - `storage.js`: downloadJson, saveJson, loadJson (localStorage wrapper)
  - `messageStore.js`: IndexedDB-backed encrypted message archive
  - `qrcode.js`: QR code generation for contact sharing

**server/src/**
- Purpose: Relay server implementation
- Contains: HTTP routes, WebSocket handling, data persistence, validation
- Key files:
  - `index.js`: Express app setup, middleware (CORS, CSP, body-parser), server startup
  - `routes.js`: All HTTP endpoints (/send, /drain-inbox, /caps-update, /directory/publish, /ws-challenge, /health)
  - `store.js`: In-memory maps (inbox, caps, directory, rate limits)
  - `schemas.js`: Zod schema definitions for request validation
  - `ratelimit.js`: Token bucket rate limiter (IP + identity layers)
  - `logger.js`: Structured logging (request, validationFailed, rateLimited, shutdown)
  - `crypto.js`: Server-side Ed25519 verification, SHA-256, ID computation

**desktop/src-tauri/src/**
- Purpose: Tauri native backend
- Contains: Window creation, platform-specific features
- Key files:
  - `main.rs`: Tauri window setup and lifecycle

## Key File Locations

**Entry Points:**
- `client/src/main.jsx`: DOM mount for web client
- `desktop/src/main.jsx`: Same as client (Tauri wraps it)
- `server/src/index.js`: Express server initialization

**Configuration:**
- `client/vite.config.js`: Vite build config for web
- `desktop/vite.config.js`: Vite + Tauri build config for desktop
- `desktop/src-tauri/tauri.conf.json`: Tauri app metadata, window dimensions, icons

**Core Logic:**
- `client/src/App.jsx`: State orchestration (identity, contacts, messaging)
- `server/src/routes.js`: All endpoint implementations

**Testing:**
- `server/test-flow.js`: Manual E2EE test scenario (enroll, contact request, message exchange)

## Naming Conventions

**Files:**
- Components: PascalCase (e.g., `ChatPanel.jsx`)
- Utilities: camelCase (e.g., `messageStore.js`)
- Hooks: prefix `use` + PascalCase (e.g., `useIdentity.js`)

**Directories:**
- Functional domains: lowercase (e.g., `crypto`, `protocol`, `components`)
- Build output: ignored via `.gitignore`

**Variables/Constants:**
- Identity fields: camelCase with suffixes:
  - `*PrivJwk`: private key (JWK format)
  - `*PubJwk`: public key (JWK format)
  - `*Cap`: capability token
- Server maps: English plurals (e.g., `caps`, `inbox`, `directory`)

## Where to Add New Code

**New Feature (messaging, settings):**
- Primary code: `client/src/hooks/useFeature.js` (state) + `client/src/components/Feature.jsx` (UI)
- Server-side: `server/src/routes.js` (new endpoint) + `server/src/schemas.js` (validation)
- Tests: `server/test-flow.js` (if E2EE scenario)

**New Component/Module:**
- UI component: `client/src/components/MyComponent.jsx`
- Protocol function: `client/src/protocol/myfunction.js`
- Crypto utility: `client/src/crypto/myfunction.js`
- Hook: `client/src/hooks/useMyFeature.js`

**Utilities:**
- Shared client helpers: `client/src/utils/myutil.js`
- Shared server helpers: `server/src/myutil.js`
- Per-app (web vs desktop): Keep in respective client trees; do NOT put in shared location

## Special Directories

**client/public/ and desktop/public/**
- Purpose: Static assets (favicon, manifest, etc.)
- Generated: No (handmade)
- Committed: Yes

**client/node_modules/ and desktop/node_modules/**
- Purpose: Installed dependencies
- Generated: Yes (by npm install)
- Committed: No (ignored via .gitignore)

**desktop/src-tauri/gen/**
- Purpose: Tauri-generated Rust bindings
- Generated: Yes (by tauri build)
- Committed: No (ignored)

**.planning/codebase/**
- Purpose: GSD analysis documents (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: No (hand-written by agent)
- Committed: Yes

## Module Organization

**Crypto module** (`client/src/crypto/index.js`):
- Barrel export: clients import from `../crypto` not `../crypto/encoding`
- Why: Keeps crypto implementation detail-hidden; easier to swap algorithms

**Protocol module** (`client/src/protocol/envelopes.js`, `relay.js`):
- Separate files for envelope building vs relay communication
- Why: Envelopes are pure functions; relay is I/O; easier to test/mock

**Hooks**:
- One hook per feature (useIdentity, useContacts, useMessaging)
- Why: Isolation; each manages its own state + cleanup
- Dependencies: hooks call each other (messaging uses identity + contacts)

## Desktop vs Web Differences

**Shared:**
- All of `src/components`, `src/crypto`, `src/hooks`, `src/protocol`, `src/utils`

**Desktop-only:**
- `desktop/src-tauri/`: Rust backend
- Window management (Tauri API)

**Web-only:**
- CORS handling (handled server-side, not needed in desktop)

**Why duplication:** Desktop's `src/` is independent; can be later refactored to symlink client/src.

---

*Structure analysis: 2026-02-27*
