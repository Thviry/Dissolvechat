# Design: Desktop/Client Unification via Vite Alias

**Date:** 2026-03-08
**Status:** Approved

## Problem

`desktop/src/` is a manual copy of `client/src/`. Every change to components, hooks, protocol, or utils must be manually copied. Only one file diverges: `messageStore.js` (3 lines). This is the #1 velocity drag on the project.

## Approach: Vite Alias (Approach C)

Desktop stops owning duplicated source. Instead, its Vite config aliases `@components`, `@hooks`, `@protocol`, `@utils` to resolve from `../client/src/`. Client gets matching aliases pointing to its own `src/`. All imports are rewritten from relative paths to aliased paths.

## What changes

### Desktop `src/` shrinks to entry points only
- `desktop/src/main.jsx` — kept (own Vite entry point)
- `desktop/src/App.jsx` — kept (allows future Tauri-specific hooks)
- `desktop/src/App.css` — kept (allows future desktop-specific styling)
- Everything else deleted: `components/`, `hooks/`, `protocol/`, `utils/`

### Vite aliases added to both configs

**desktop/vite.config.js:**
```js
resolve: {
  alias: {
    '@components': path.resolve(__dirname, '../client/src/components'),
    '@hooks': path.resolve(__dirname, '../client/src/hooks'),
    '@protocol': path.resolve(__dirname, '../client/src/protocol'),
    '@utils': path.resolve(__dirname, '../client/src/utils'),
  }
}
```

**client/vite.config.js:**
```js
resolve: {
  alias: {
    '@components': path.resolve(__dirname, 'src/components'),
    '@hooks': path.resolve(__dirname, 'src/hooks'),
    '@protocol': path.resolve(__dirname, 'src/protocol'),
    '@utils': path.resolve(__dirname, 'src/utils'),
  }
}
```

### All imports rewritten to use aliases
```js
// Before
import ChatPanel from './components/ChatPanel'
import { useMessaging } from './hooks/useMessaging'

// After
import ChatPanel from '@components/ChatPanel'
import { useMessaging } from '@hooks/useMessaging'
```

### Fix messageStore.js divergence
Desktop version updated to use `identitySecret` for archive key derivation (client version is canonical). After this fix, the file is identical and only lives in `client/src/utils/`.

## What doesn't change
- `desktop/src-tauri/` (Rust, Cargo.toml, tauri.conf.json)
- `packages/dissolve-core/` (already shared)
- `client/src/` file locations (source of truth)
- Build commands, ports, pnpm workspace config

## Risk
Low. Vite alias is well-supported. If desktop ever needs platform-specific overrides, a desktop-only file can conditionally import.
