# DissolveChat Desktop

Native desktop client built with [Tauri v2](https://v2.tauri.app/). Wraps the same React client in a secure, sandboxed native window.

## Why Desktop?

| | Web (browser) | Desktop (Tauri) |
|---|---|---|
| **Security** | Browser extensions can inject scripts | Sandboxed webview, no extensions |
| **Anonymity** | Browser fingerprinting, shared cookies | No fingerprint surface, isolated process |
| **Autonomy** | Depends on browser vendor | Standalone binary, no app store required |
| **CSP** | Enforced by headers (bypassable) | Enforced by Tauri runtime (not bypassable) |
| **Key storage** | sessionStorage (tab-scoped) | Future: OS keychain via Tauri plugin |

## Prerequisites

1. **Rust** — Install from https://rustup.rs
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Node.js** — v18+ (you already have this)

3. **System dependencies** (Linux only):
   ```bash
   sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
     libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
   ```
   Windows and macOS: no extra deps needed.

## Setup

```bash
cd desktop
npm install
```

Make sure your relay is running:
```bash
cd ../server
npm install
npm start
```

## Development

```bash
cd desktop
npm run tauri:dev
```

This starts Vite dev server + opens the Tauri window. Hot-reload works — edit the React code in `client/src/` and see changes instantly.

## Production Build

```bash
cd desktop
npm run tauri:build
```

Output:
- **Windows:** `src-tauri/target/release/bundle/msi/DissolveChat_5.13.0_x64_en-US.msi`
- **macOS:** `src-tauri/target/release/bundle/dmg/DissolveChat_5.13.0_aarch64.dmg`
- **Linux:** `src-tauri/target/release/bundle/appimage/DissolveChat_5.13.0_amd64.AppImage`

## Architecture

```
desktop/
├── src-tauri/
│   ├── src/main.rs          # Rust backend (minimal — no IPC commands)
│   ├── Cargo.toml            # Rust dependencies
│   ├── tauri.conf.json       # Security config + window settings
│   └── icons/                # App icons
├── src -> ../client/src      # Symlink to shared React code
├── public -> ../client/public
├── index.html                # Webview entry point
├── vite.config.js            # Vite config (Tauri-aware)
└── package.json              # Node deps + Tauri CLI
```

The `src/` symlink means **desktop and web share the exact same client code**. No fork, no divergence. A bug fix in `client/src/` applies to both.

## Security Configuration

The Tauri security config (`tauri.conf.json`) enforces:

- **CSP**: `script-src 'self'` — no inline scripts, no eval
- **Prototype freeze**: `freezePrototype: true` — prevents prototype pollution
- **No navigation**: webview cannot navigate to external URLs
- **No IPC by default**: Rust backend exposes zero commands
- **form-action 'none'**: prevents form-based data exfiltration

## Relay Configuration

Create `desktop/.env.local`:
```
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001/ws
```

To point at a remote relay:
```
VITE_API_URL=https://relay.example.com
VITE_WS_URL=wss://relay.example.com/ws
```

## Roadmap

- [ ] System tray with notification badge
- [ ] OS keychain storage for encrypted keys (replaces sessionStorage)
- [ ] Auto-update via Tauri's built-in updater
- [ ] Native file dialogs for keyfile import/export
- [ ] Deep link handling (`dissolvechat://contact=...`)
