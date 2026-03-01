# Phase 2: Architecture (Shared Core) - Research

**Researched:** 2026-03-01
**Domain:** pnpm workspaces monorepo, shared ESM package extraction, multi-relay broadcast/drain pattern
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ARCH-01 | `crypto/` and `hooks/` modules extracted to a `packages/dissolve-core` shared package consumed by both `client/` and `desktop/` | Package scaffold pattern, exports field, import path rewriting documented in Architecture Patterns and Code Examples |
| ARCH-02 | pnpm workspaces monorepo configured so both clients import from `dissolve-core` | pnpm-workspace.yaml format, workspace:* protocol, Vite symlink handling documented in Standard Stack and Code Examples |
| ARCH-03 | Client supports multiple relay URLs — capability registrations broadcast to all, inboxes drained from whichever is reachable | Multi-relay broadcast and first-reachable drain pattern documented in Architecture Patterns |
</phase_requirements>

---

## Summary

Phase 2 has three tightly coupled tasks: (1) convert the flat npm monorepo to pnpm workspaces, (2) extract the shared crypto and hooks files into a new `packages/dissolve-core` package, and (3) extend relay.js to support an array of relay URLs with broadcast writes and first-reachable reads. All three tasks are purely structural refactors — no protocol changes, no new external dependencies, no server changes.

The codebase audit reveals the full picture: the main branch is missing several files relative to the worktrees (encoding.js, signing.js, keyfile.js, crypto/index.js, protocol/envelopes.js, utils/storage.js, utils/messageStore.js, useContacts.js). The worktrees represent the post-Phase-1 state of the code. Phase 2 starts from the worktree state. Before extracting files to dissolve-core, the planner must verify which files exist in the working tree at execution time.

The shared package needs to be a plain ESM package (type: "module", no TypeScript, no build step). Vite can import from workspace symlinks directly by source — no compilation needed. The key insight is that `dissolve-core` only needs a package.json with `"main"` and `"exports"` pointing to raw `.js` source files, and Vite bundles it as part of each client's build. This avoids any dual-build complexity (CJS/ESM interop) that applies to published npm packages.

**Primary recommendation:** Create `packages/dissolve-core/` as a pure-ESM workspace package with no build step. Set `"exports": {"./crypto": "./src/crypto/index.js", "./hooks": "./src/hooks/index.js"}` in its package.json. Reference it as `"dissolve-core": "workspace:*"` in each client. Rewrite relative crypto/hooks imports in each client to use `dissolve-core/crypto` and `dissolve-core/hooks`. For multi-relay, replace the single `_apiUrl`/`_wsUrl` module-level state in relay.js with an array, fan out writes to all URLs, and drain the first successful response.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pnpm workspaces | 9.x (already installed) | Monorepo package linking | Built-in to pnpm; no extra tooling required; symlinks workspace packages into node_modules |
| pnpm-workspace.yaml | n/a (config file) | Declares workspace package globs | Required by pnpm to recognize workspaces |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| workspace:* protocol | pnpm built-in | Link local packages | Any internal package reference |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pnpm workspaces | npm workspaces | Already using pnpm; npm workspaces lacks the workspace:* safety guarantee |
| pnpm workspaces | Turborepo / Nx | overkill for a 3-package repo; adds a build orchestrator that isn't needed |
| no-build-step shared package | Build step (tsc/rollup) | Build step adds complexity; Vite processes sources directly, so a build step is unnecessary |
| exports field | Vite path alias | Aliases require touching both vite.config.js files; exports field is the canonical approach |

**Installation (root):**
```bash
# pnpm is already the package manager target (per PROJECT.md)
# Create pnpm-workspace.yaml at the repo root
# Then install from root:
pnpm install
```

---

## Architecture Patterns

### Recommended Monorepo Structure
```
DCv5.16/                         # repo root
├── pnpm-workspace.yaml          # workspace package globs
├── package.json                 # root package (private:true, no deps)
├── packages/
│   └── dissolve-core/           # new shared package
│       ├── package.json         # name: "dissolve-core", type: "module"
│       └── src/
│           ├── crypto/          # moved from client/src/crypto/
│           │   ├── index.js
│           │   ├── e2ee.js
│           │   ├── encoding.js
│           │   ├── signing.js
│           │   ├── keyfile.js
│           │   └── seed.js
│           └── hooks/           # moved from client/src/hooks/
│               ├── index.js
│               ├── useIdentity.js
│               ├── useMessaging.js
│               ├── useContacts.js
│               └── useToast.js
├── client/                      # unchanged structure; updated imports
│   └── package.json             # adds "dissolve-core": "workspace:*"
└── desktop/                     # unchanged structure; updated imports
    └── package.json             # adds "dissolve-core": "workspace:*"
```

### Pattern 1: pnpm-workspace.yaml Format

**What:** Root config file declaring which directories are workspace packages.
**When to use:** Required — must exist at repo root for pnpm workspaces to function.

```yaml
# pnpm-workspace.yaml (repo root)
packages:
  - 'packages/*'
  - 'client'
  - 'desktop'
  - 'server'
```

Source: [pnpm.io/pnpm-workspace_yaml](https://pnpm.io/pnpm-workspace_yaml) (HIGH confidence)

### Pattern 2: dissolve-core package.json

**What:** Minimal package.json for the shared package. No build step. Exports map for subpath imports.
**When to use:** Any shared pure-ESM package in a Vite monorepo.

```json
{
  "name": "dissolve-core",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./crypto": "./src/crypto/index.js",
    "./crypto/*": "./src/crypto/*.js",
    "./hooks": "./src/hooks/index.js",
    "./hooks/*": "./src/hooks/*.js"
  }
}
```

Source: pnpm official docs + Vite monorepo guides (MEDIUM confidence — exports subpath pattern is standard; specific glob subpath requires Node 12.7+ / pnpm >= 8)

**Key decision:** `private: true` prevents accidental publish. No `devDependencies` on Vite or React — those live only in each client. The shared package has zero runtime npm dependencies (it uses only WebCrypto, which is browser-native, and imports from peer packages like `@scure/bip39` and `canonicalize` that are already in each client's package.json). If dissolve-core needs those deps itself (for Vite to resolve them from the workspace), they should be listed as `peerDependencies` or added to each client's package.json.

### Pattern 3: Client package.json — referencing the workspace package

```json
{
  "name": "dissolvechat-client",
  "dependencies": {
    "dissolve-core": "workspace:*",
    "@scure/bip39": "^2.0.1",
    "canonicalize": "^2.0.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  }
}
```

Source: [pnpm.io/workspaces](https://pnpm.io/workspaces) — workspace:* protocol (HIGH confidence)

### Pattern 4: Import rewriting in client source files

**What:** All relative crypto/hooks imports replaced with package imports.
**When to use:** After dissolve-core is created and linked.

```javascript
// BEFORE (relative, within-client):
import { sha256B64u, randomCap } from "../crypto";
import { signObject } from "../crypto/signing";
import { e2eeDecrypt } from "../crypto/e2ee";

// AFTER (package import):
import { sha256B64u, randomCap } from "dissolve-core/crypto";
import { signObject } from "dissolve-core/crypto/signing";
import { e2eeDecrypt } from "dissolve-core/crypto/e2ee";
```

**Note on hooks:** The hooks (useIdentity, useMessaging, useContacts) import from `react` which must be deduped. Vite handles this automatically when hoisting peer deps — no extra vite.config changes needed for React deduplication in this setup (confirmed: pnpm hoists React to the root node_modules by default for monorepos).

### Pattern 5: Multi-relay support in relay.js

**What:** Replace single `_apiUrl`/`_wsUrl` module globals with arrays. Broadcast to all on writes; try each in order on reads.
**When to use:** ARCH-03 — any call that publishes data (caps, envelopes, directory) fans out; any call that reads data (drainInbox, drainRequestInbox) succeeds on first 200.

```javascript
// relay.js — multi-relay state
let _relayUrls = [DEFAULT_API];  // array, not scalar

export function setRelayUrls(urls) {
  _relayUrls = urls.filter(Boolean).map(u => u.replace(/\/+$/, ""));
}

// BROADCAST: all relays (caps publish, envelope send)
export async function publishCaps(toId, signedBody) {
  const results = await Promise.allSettled(
    _relayUrls.map(base =>
      relayFetch(base, `/caps/${encodeURIComponent(toId)}`, {
        method: "PUT",
        body: JSON.stringify(signedBody),
      })
    )
  );
  // Return first successful response (or last error)
  const ok = results.find(r => r.status === "fulfilled" && r.value.ok);
  return ok ? ok.value : results[results.length - 1].value;
}

// DRAIN: first reachable relay wins
export async function drainInbox(toId, signedBody) {
  for (const base of _relayUrls) {
    try {
      const resp = await relayFetch(base, `/inbox/${encodeURIComponent(toId)}`, {
        method: "POST",
        body: JSON.stringify(signedBody),
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      return Array.isArray(data.items) ? data.items : [];
    } catch { continue; }
  }
  return [];
}
```

### Pattern 6: WebSocket multi-relay connection

**What:** Connect a WebSocket to each configured relay; any notification triggers fetchMessages.
**When to use:** connectWebSocket must be extended to manage N connections.

```javascript
// One WS per relay URL
export function connectWebSocket(myId, authPubJwk, authPrivJwk, onNotify) {
  const handles = _relayUrls.map(base => {
    const wsUrl = base.replace(/^http/, "ws") + "/ws";
    return connectSingleWS(wsUrl, myId, authPubJwk, authPrivJwk, onNotify);
  });
  return {
    close() { handles.forEach(h => h.close()); }
  };
}
```

### Anti-Patterns to Avoid

- **Installing dissolve-core deps in the package itself:** @scure/bip39 and canonicalize are already in each client's package.json. Adding them as deps of dissolve-core would create two copies in node_modules. Use peerDependencies or rely on each client's install.
- **Adding a build step to dissolve-core:** Vite processes workspace symlinks directly. A build step adds CI complexity for no benefit in this monorepo.
- **Using Vite path aliases instead of exports field:** Aliases require matching updates to both client and desktop vite.config.js; the exports field is self-contained in the package and is the canonical mechanism.
- **Copying files instead of moving them:** The goal is one canonical location. Both clients must delete their local copies and import from the package; keeping local copies defeats ARCH-01.
- **Sending envelopes to all relays for drain:** Drain is inbox-read — fan-out is wrong here. Read from the first reachable relay only (otherwise you'd process the same envelope twice).
- **Deduplicating envelopes client-side after multi-drain:** If drain returns duplicates across relays (relay A and relay B both received a message), the existing replay protection (checkAndUpdateReplay) already handles this. Don't add extra dedup logic.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Workspace linking | Custom symlink scripts | pnpm-workspace.yaml + workspace:* | pnpm manages symlinks atomically, handles cross-package hoisting, lockfile |
| Package publish gating | Custom check | private: true in package.json | Prevents accidental npm publish in one line |
| Import resolution for workspace packages | Vite aliases | exports field in package.json | exports is Node-standard; aliases need per-vite-config duplication |
| Multi-relay broadcast | Promise.race | Promise.allSettled | Promise.race stops on first result; allSettled collects all outcomes, needed for caps broadcast |

**Key insight:** The exports field + workspace:* combination is the minimal working solution. It requires zero Vite plugins, zero build steps, and zero path alias configuration. Vite follows the exports field when resolving bare module specifiers.

---

## Common Pitfalls

### Pitfall 1: React duplicate instance with workspace packages

**What goes wrong:** If dissolve-core lists `react` as a dependency (not peerDependency), Vite may bundle two copies of React — one from each package's node_modules. React hooks throw "invalid hook call" errors at runtime.

**Why it happens:** pnpm's strict mode does not hoist packages by default unless they are listed as peers. If a package installs its own copy of React, it gets a separate instance.

**How to avoid:** Do not list `react` in dissolve-core's dependencies. List it as peerDependencies if needed for documentation, but leave the actual install to client and desktop. Vite will resolve React from the nearest node_modules that contains it (the app's own).

**Warning signs:** "Hooks can only be called inside of a function component" error in the browser console after linking dissolve-core.

### Pitfall 2: Vite symlink resolution with pnpm

**What goes wrong:** Vite (via Rollup) may not follow pnpm's symlinks for workspace packages in all configurations, causing "Module not found" or stale cache errors.

**Why it happens:** pnpm uses symlinks from `node_modules/dissolve-core` → `packages/dissolve-core`. Vite's file watcher follows symlinks by default but may have edge cases with nested symlinks.

**How to avoid:** The standard pattern works — no extra config needed for Vite 7.x with pnpm workspaces. If issues arise, adding `resolve.dedupe: ['react']` to each vite.config.js forces React deduplication. Do not set `resolve.preserveSymlinks: true` unless specifically debugging — it changes module identity resolution in unexpected ways.

**Warning signs:** "Failed to resolve import" or unexpected module caching after `pnpm install`.

### Pitfall 3: Missing exports subpath causes import failure

**What goes wrong:** `import { signObject } from "dissolve-core/crypto/signing"` fails with "Package subpath './crypto/signing' is not defined by exports".

**Why it happens:** The `exports` field in package.json gates ALL subpath access. If `./crypto/signing` is not listed, Node (and Vite) will refuse the import.

**How to avoid:** Use the wildcard subpath export `"./crypto/*": "./src/crypto/*.js"` to allow any file within the directory. Test each import path used in the codebase against the exports map before declaring the migration done.

**Warning signs:** Import works in dev (because Vite resolves via filesystem before exports in some modes) but fails in production build.

### Pitfall 4: Multi-relay draining same envelope twice

**What goes wrong:** A contact sends a message to relay A and relay B. Client drains both and shows the message twice.

**Why it happens:** If both relays receive the same envelope (senders also broadcast), drain of both will return the same envelope.

**How to avoid:** The existing `checkAndUpdateReplay(myId, inner.from, convId, seq, inner.t)` in useMessaging.js already rejects messages with seen convId+seq combinations. Drain first-reachable is the correct approach for inbox reads anyway — don't implement multi-drain for inboxes.

**Warning signs:** Duplicate messages appearing in the chat panel.

### Pitfall 5: pnpm-workspace.yaml not at repo root

**What goes wrong:** `pnpm install` from root does not link workspace packages; each client installs independently.

**Why it happens:** pnpm looks for `pnpm-workspace.yaml` at the directory where `pnpm install` is run. The current repo root has a `package-lock.json` (npm) but no `package.json` suitable for pnpm workspace root.

**How to avoid:** Create both `pnpm-workspace.yaml` AND a root `package.json` (with `"private": true`, no deps) at the repo root. Run `pnpm install` from the repo root. Verify symlinks appear in `node_modules/dissolve-core` within each client after install.

**Warning signs:** `pnpm ls -r` does not show dissolve-core as a workspace package.

### Pitfall 6: Tauri build fails after pnpm workspace migration

**What goes wrong:** `pnpm tauri build` or `pnpm tauri:dev` fails because Tauri CLI tries to detect the package manager and may fall back to npm.

**Why it happens:** Known issue: `tauri add` and related CLI commands may use npm instead of pnpm in workspace directories (GitHub issue #12706 in tauri-apps/tauri).

**How to avoid:** Use `pnpm tauri:dev` (the npm script in package.json) rather than invoking `tauri` directly. The npm scripts use the workspace's node_modules/.bin which is pnpm-managed. The Tauri build itself (Vite → dist → Tauri embed) is not affected — only the CLI plugin-management commands are affected.

**Warning signs:** "npm install" appearing in Tauri CLI output when pnpm is expected.

---

## Code Examples

### Root package.json (new file)
```json
{
  "name": "dissolvechat",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "install:all": "pnpm install"
  }
}
```

Source: standard pnpm workspace root pattern (HIGH confidence)

### pnpm-workspace.yaml (new file at repo root)
```yaml
packages:
  - 'packages/*'
  - 'client'
  - 'desktop'
  - 'server'
```

Source: [pnpm.io/pnpm-workspace_yaml](https://pnpm.io/pnpm-workspace_yaml) (HIGH confidence)

### dissolve-core/package.json (new file)
```json
{
  "name": "dissolve-core",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./crypto": "./src/crypto/index.js",
    "./crypto/*": "./src/crypto/*.js",
    "./hooks": "./src/hooks/index.js",
    "./hooks/*": "./src/hooks/*.js"
  },
  "peerDependencies": {
    "react": ">=18.0.0",
    "@scure/bip39": ">=2.0.0",
    "canonicalize": ">=2.0.0"
  }
}
```

### dissolve-core/src/hooks/index.js (new barrel)
```javascript
// dissolve-core/src/hooks/index.js
export { useIdentity } from "./useIdentity.js";
export { useMessaging } from "./useMessaging.js";
export { useContacts } from "./useContacts.js";
export { useToast } from "./useToast.js";
```

### Updated client/package.json dependency
```json
{
  "dependencies": {
    "dissolve-core": "workspace:*",
    "@scure/bip39": "^2.0.1",
    "canonicalize": "^2.0.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  }
}
```

### Multi-relay initialization (useMessaging.js usage)
```javascript
// In useIdentity or wherever relayUrl preference is stored:
// Before: setRelayUrlGlobal(relayUrl.trim())
// After: supports array (split on comma or newline, trim each)
const urls = relayUrl.split(/[\n,]/).map(u => u.trim()).filter(Boolean);
setRelayUrlsGlobal(urls.length ? urls : [DEFAULT_API]);
```

### Verifying workspace links after pnpm install
```bash
# From repo root:
pnpm ls -r --depth 0
# Should show dissolve-core, dissolvechat-client, dissolvechat-desktop, server

# Verify symlink:
ls -la client/node_modules/dissolve-core
# Should show -> ../../../packages/dissolve-core
```

---

## File Inventory: What Goes Into dissolve-core

Based on the codebase audit (worktree state represents the post-Phase-1 codebase):

**Move to `packages/dissolve-core/src/crypto/`:**
- `encoding.js` — base64url, SHA-256, random cap/ID
- `signing.js` — ECDSA P-256 + JCS sign/verify
- `e2ee.js` — ECDH ephemeral + AES-GCM encrypt/decrypt (includes Phase 1 bucket padding)
- `keyfile.js` — PBKDF2 + AES-GCM keyfile encrypt/decrypt
- `seed.js` — BIP39 mnemonic generation and identity derivation
- `index.js` — barrel re-export of all above

**Move to `packages/dissolve-core/src/hooks/`:**
- `useIdentity.js` — identity lifecycle (enroll, login, logout, session)
- `useMessaging.js` — message send/receive, polling, WebSocket
- `useContacts.js` — contact management
- `useToast.js` — toast notification stack
- `index.js` — barrel (new file to create)

**Stay in each client (NOT moved):**
- `config.js` — timing constants (client-specific, already identical copies per Phase 1 decision)
- `protocol/relay.js` — relay HTTP/WS client (will be modified for multi-relay, stays in each client)
- `protocol/envelopes.js` — envelope builders (stays in each client; client-specific protocol layer)
- `utils/storage.js`, `utils/messageStore.js`, `utils/qrcode.js` — client utilities (stay per client)
- All `components/` — UI (stays duplicated per ARCH-V2-01 deferral)

**Note on internal imports within dissolve-core:** After moving, the files' internal relative imports (e.g., `import { enc } from "./encoding"`) remain valid and unchanged. Only the imports in the consuming client files change (from relative to package paths).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| npm workspaces | pnpm workspaces (workspace:* protocol) | pnpm 7+ | Stricter linking; no phantom dependencies; faster installs |
| Relative path imports across packages | exports field + workspace:* | Node 12.7+ | Self-contained resolution; no per-app alias config |
| TypeScript required for shared packages | Plain ESM works fine with Vite | Vite 2+ | No build step needed when Vite processes sources directly |

**Not applicable here:**
- Turborepo / Nx task orchestration: overkill for 3-package repo
- Changesets for versioning: all packages are private, no publish workflow needed
- Path aliases (vite.config resolve.alias): superseded by exports field for this use case

---

## Open Questions

1. **Does the working tree (main branch) have all files, or only the worktree state?**
   - What we know: The main branch appears to be missing encoding.js, signing.js, keyfile.js, crypto/index.js, protocol/envelopes.js, utils/storage.js, utils/messageStore.js, useContacts.js compared to the worktrees. The worktrees represent the post-Phase-1 state.
   - What's unclear: Whether the Phase 1 execution was committed to main or only to a worktree branch.
   - Recommendation: At execution start, run `git log --oneline -5` and `find client/src -name "*.js" | sort` to confirm the actual working tree state before planning which files to move. The Phase 2 sub-task plans must reference the files that actually exist.

2. **Should relay.js stay per-client or also move to dissolve-core?**
   - What we know: The Phase 2 goal says "crypto/ and hooks/ live in one place" — relay.js is in protocol/, not crypto/ or hooks/. PROJECT.md key decisions confirm only crypto/ and hooks/ are shared pre-v1.0. The STATE.md notes "Multi-relay in same phase as shared core — relay.js moves to shared package anyway."
   - What's unclear: "relay.js moves to shared package anyway" (from STATE.md decisions) conflicts with the explicit scope constraint (only crypto/ and hooks/ shared). The requirement (ARCH-01, ARCH-02) says "crypto/ and hooks/".
   - Recommendation: Keep relay.js in each client's protocol/ directory for now, consistent with the explicit ARCH-01/02 scope. Modify both copies in parallel for multi-relay (02-03). This avoids scope creep and is consistent with the "limit refactor risk pre-v1.0" decision.

3. **How should multi-relay URLs be configured by users?**
   - What we know: Currently `relayUrl` is stored as a single string in localStorage per-identity. useIdentity.js has `const [relayUrl, setRelayUrl] = useState("")`. The multi-relay change needs to store/restore multiple URLs.
   - What's unclear: Whether to change the storage format (comma-separated string vs JSON array) or add a new key.
   - Recommendation: Store as comma-separated string in localStorage (e.g. "https://relay1.example.com,https://relay2.example.com"). Parse at use time. Backward compatible with existing single-URL setting. No localStorage schema migration needed.

---

## Sources

### Primary (HIGH confidence)
- [pnpm.io/workspaces](https://pnpm.io/workspaces) — workspace:* protocol, sharedWorkspaceLockfile, linkWorkspacePackages
- [pnpm.io/pnpm-workspace_yaml](https://pnpm.io/pnpm-workspace_yaml) — exact YAML format with packages glob array

### Secondary (MEDIUM confidence)
- [React Monorepo Setup Tutorial with pnpm and Vite](https://dev.to/lico/react-monorepo-setup-tutorial-with-pnpm-and-vite-react-project-ui-utils-5705) — Vite + pnpm workspace package import pattern; workspace:* usage
- [Ultimate Guide: Frontend Monorepo with Vite, pnpm, and Shared UI Libraries](https://medium.com/@hibamalhiss/ultimate-guide-how-to-set-up-a-frontend-monorepo-with-vite-pnpm-and-shared-ui-libraries-4081585c069e) — exports field, React deduplication, symlink handling
- [Mastering pnpm Workspaces](https://blog.glen-thomas.com/software%20engineering/2025/10/02/mastering-pnpm-workspaces-complete-guide-to-monorepo-management.html) — peerDependencies, duplicate React pitfall

### Tertiary (LOW confidence)
- [Tauri Issue #12706](https://github.com/tauri-apps/tauri/issues/12706) — tauri add CLI uses npm in pnpm workspaces; needs validation against actual Tauri 2.x version in use

---

## Metadata

**Confidence breakdown:**
- pnpm workspaces setup: HIGH — official docs confirm format and workspace:* semantics
- dissolve-core package.json pattern: HIGH — confirmed pattern; exports field is Node standard
- Vite symlink/workspace resolution: MEDIUM — standard pattern works per guides; edge cases exist
- Multi-relay broadcast/drain pattern: HIGH — pure application logic; no external dependencies
- Tauri + pnpm workspace interaction: LOW — one known issue (tauri add CLI) from GitHub; actual dev/build flow unaffected

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (stable tooling; pnpm and Vite APIs change rarely)
