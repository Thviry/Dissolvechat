# Technology Stack

**Analysis Date:** 2026-02-27

## Languages

**Primary:**
- JavaScript (ES6+) - Client and server code, cryptographic operations
- JSX - React component definitions in `client/src` and `desktop/src`
- Rust - Desktop application backend (Tauri runtime)

**Secondary:**
- JSON - Configuration and data serialization

## Runtime

**Environment:**
- Node.js (version not specified, assumed 18+) - Server and build tooling

**Package Manager:**
- npm - Dependency management for all three packages
- Lockfiles: `package-lock.json` present for client, server, and desktop

## Frameworks

**Core:**
- React 19.2.0 - UI framework for both web and desktop clients
- Express 5.2.1 - HTTP server and API routing in `server/src/index.js`
- Tauri 2.0 - Desktop application framework with Rust backend, Electron alternative
- Vite 7.3.1 - Build tool and dev server for React applications

**Cryptography:**
- WebCrypto API (browser native) - ECDH P-256, ECDSA P-256, AES-GCM, SHA-256
- No external crypto library - all operations via `crypto.subtle`

**WebSocket:**
- ws 8.16.0 - WebSocket server for authenticated push notifications

**Validation:**
- Zod 3.23.0 - Schema validation for all API endpoints in `server/src/schemas.js`

**Utilities:**
- canonicalize 2.0.0 - JCS (JSON Canonicalization Scheme) for deterministic JSON serialization
- cors 2.8.6 - CORS middleware for Express server
- tauri-plugin-shell 2.0 - Shell command execution in desktop app

**Development:**
- @vitejs/plugin-react 5.1.1 - JSX and React Fast Refresh support
- @tauri-apps/cli 2.0 - CLI for Tauri desktop builds

## Key Dependencies

**Critical:**
- ws 8.16.0 - WebSocket server essential for authenticated push notifications and real-time relay functionality
- zod 3.23.0 - Strict schema validation is core security measure, all endpoints validated
- canonicalize 2.0.0 - JCS canonicalization ensures deterministic JSON for signature verification

**Infrastructure:**
- express 5.2.1 - HTTP server for relay endpoints, CORS handling, security headers
- react 19.2.0 - UI framework for both client platforms
- tauri 2.0 - Native desktop wrapper with sandboxed webview, system tray support

## Configuration

**Environment:**
- Client configured via `VITE_API_URL` and `VITE_WS_URL` environment variables
- See `client/.env.example` for default configuration
- Server configured via `NODE_ENV` (development vs production) and `ALLOWED_ORIGIN`
- Server `DIRECTORY_FILE` env var specifies directory persistence location

**Build:**
- `vite.config.js` - Vite configuration for web and desktop clients
  - Web client: dev server on port 5173
  - Desktop client: dev server on port 5174 with strict port, relative base path for Tauri
- Tauri build config: `desktop/src-tauri/tauri.conf.json`
  - Frontend dist path: `../dist` (built Vite output)
  - Dev URL: `http://localhost:5174`
  - CSP policy restricts scripts, connects to localhost and external HTTPS/WSS

## Platform Requirements

**Development:**
- Node.js 18+ (npm installed)
- For desktop: Rust toolchain, Tauri CLI
- Modern browser supporting WebCrypto API (Chrome 37+, Firefox 34+, Safari 11+)

**Production:**
- **Server:** Node.js runtime, runs as standalone HTTP/WebSocket server on configurable port (default 3001)
- **Web client:** Any modern browser with WebCrypto support
- **Desktop client:** Windows, macOS, or Linux native binary (built via Tauri)

## Project Structure

**Three separate npm packages:**
- `client/` - Web application (React + Vite)
- `desktop/` - Desktop application (React + Vite + Tauri)
- `server/` - Relay server (Express.js + ws)

Each has independent `package.json` and lockfile.

---

*Stack analysis: 2026-02-27*
