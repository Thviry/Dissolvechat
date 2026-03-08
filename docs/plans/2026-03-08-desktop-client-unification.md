# Desktop/Client Unification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate duplicated source between `client/src/` and `desktop/src/` so changes only need to be made once.

**Architecture:** Desktop's Vite config aliases `@components`, `@hooks`, `@protocol`, `@utils`, and `@config` to resolve from `../client/src/`. Client gets matching aliases pointing to its own `src/`. All cross-directory imports are rewritten from relative paths to aliased paths. Within-directory imports (`./Icons`, `./envelopes`) stay relative. Desktop's `src/` is reduced to entry points only (`main.jsx`, `App.jsx`, `App.css`, `index.css`).

**Tech Stack:** Vite (resolve.alias), React, pnpm workspaces

---

### Task 1: Fix messageStore.js divergence

**Files:**
- Modify: `desktop/src/utils/messageStore.js:50,53,63`

**Step 1: Update desktop messageStore.js to match client**

In `desktop/src/utils/messageStore.js`, change 3 lines to match client version:

```js
// Line 50: change parameter name
async function deriveArchiveKey(identitySecret) {
// Line 53: change encode argument
    te.encode(identitySecret),
// Line 63: change info
      info: te.encode("dissolve-archive"),
```

**Step 2: Verify files are identical**

Run: `diff client/src/utils/messageStore.js desktop/src/utils/messageStore.js`
Expected: No output (files identical)

**Step 3: Commit**

```bash
git add desktop/src/utils/messageStore.js
git commit -m "fix: align desktop messageStore.js with client (use identitySecret for archive key)"
```

---

### Task 2: Add Vite aliases to client

**Files:**
- Modify: `client/vite.config.js`

**Step 1: Update client vite.config.js**

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      "@components": path.resolve(__dirname, "src/components"),
      "@hooks": path.resolve(__dirname, "src/hooks"),
      "@protocol": path.resolve(__dirname, "src/protocol"),
      "@utils": path.resolve(__dirname, "src/utils"),
      "@config": path.resolve(__dirname, "src/config.js"),
    },
  },
});
```

**Step 2: Verify client dev server starts**

Run: `cd client && npx vite --host 127.0.0.1 & sleep 3 && curl -s http://127.0.0.1:5173/ | head -5; kill %1 2>/dev/null`
Expected: HTML output (Vite serves the app)

**Step 3: Commit**

```bash
git add client/vite.config.js
git commit -m "feat: add Vite path aliases to client config"
```

---

### Task 3: Add Vite aliases to desktop (pointing to client/src)

**Files:**
- Modify: `desktop/vite.config.js`

**Step 1: Update desktop vite.config.js**

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5174,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  base: "./",
  resolve: {
    alias: {
      "@components": path.resolve(__dirname, "../client/src/components"),
      "@hooks": path.resolve(__dirname, "../client/src/hooks"),
      "@protocol": path.resolve(__dirname, "../client/src/protocol"),
      "@utils": path.resolve(__dirname, "../client/src/utils"),
      "@config": path.resolve(__dirname, "../client/src/config.js"),
    },
  },
});
```

**Step 2: Commit**

```bash
git add desktop/vite.config.js
git commit -m "feat: add Vite path aliases to desktop config (pointing to client/src)"
```

---

### Task 4: Rewrite imports in App.jsx (both client and desktop)

**Files:**
- Modify: `client/src/App.jsx:12-30`
- Modify: `desktop/src/App.jsx:12-30`

**Step 1: Rewrite client/src/App.jsx imports**

Replace lines 12-30 with:

```js
import { useIdentity } from "@hooks/useIdentity";
import { useContacts } from "@hooks/useContacts";
import { useMessaging } from "@hooks/useMessaging";
import { useToast } from "dissolve-core/hooks";
import { capHashFromCap } from "dissolve-core/crypto";
import { signObject } from "dissolve-core/crypto/signing";
import { downloadJson, saveJson } from "@utils/storage";
import { lookupDirectory as relayLookup, blockOnRelay, getRelayUrl } from "@protocol/relay";
import { buildBlockRequest, buildDirectoryPublish } from "@protocol/envelopes";
import useGroups from "@hooks/useGroups";
import useGroupActions from "@hooks/useGroupActions";
import LoginScreen from "@components/LoginScreen";
import Sidebar from "@components/Sidebar";
import ChatPanel from "@components/ChatPanel";
import CreateGroupModal from "@components/CreateGroupModal";
import GroupInfoPanel from "@components/GroupInfoPanel";
import ToastContainer from "@components/Toast";
import PassphraseModal from "@components/PassphraseModal";
import { IconClose } from "@components/Icons";
```

**Step 2: Copy the same imports to desktop/src/App.jsx**

Desktop's App.jsx lines 12-30 get the exact same aliased imports.

**Step 3: Verify client still loads**

Run: `cd client && npx vite --host 127.0.0.1 & sleep 3 && curl -s http://127.0.0.1:5173/ | head -5; kill %1 2>/dev/null`
Expected: HTML output

**Step 4: Commit**

```bash
git add client/src/App.jsx desktop/src/App.jsx
git commit -m "refactor: rewrite App.jsx imports to use Vite aliases"
```

---

### Task 5: Rewrite imports in hooks (client only — desktop copies will be deleted)

**Files:**
- Modify: `client/src/hooks/useMessaging.js:16,27,35-40`
- Modify: `client/src/hooks/useGroupActions.js:13-14`
- Modify: `client/src/hooks/useContacts.js:5`
- Modify: `client/src/hooks/useGroups.js:5`
- Modify: `client/src/hooks/useIdentity.js:31`

**Step 1: Rewrite useMessaging.js imports**

Replace the relative imports (lines 16, 27, 35-40):

```js
// Line 16: change from "../protocol/groupEnvelopes"
import { buildGroupMessage } from "@protocol/groupEnvelopes";
// Lines 27-28: change from "../protocol/relay"
import {
  drainInbox, drainRequestInbox, publishCaps,
  publishRequestCaps, sendEnvelope, connectWebSocket,
  disconnectWebSocket,
} from "@protocol/relay";
// Lines 35-36: change from "../protocol/envelopes" and "../utils/storage"
import {
  buildMessage, buildAcceptRequest, parseIncoming,
  buildRequestEnvelope, nextSeq,
} from "@protocol/envelopes";
import { checkAndUpdateReplay } from "@utils/storage";
// Line 37: change from "../utils/notifications"
import { notifyIncoming, flashTitle } from "@utils/notifications";
// Line 39: change from "../utils/messageStore"
import { createMessageStore } from "@utils/messageStore";
// Line 40: change from "../config"
import { POLL_INTERVAL_MS, CAP_REPUBLISH_INTERVAL_MS, SEND_RETRY_BASE_DELAY_MS } from "@config";
```

**Step 2: Rewrite useGroupActions.js imports**

```js
// Lines 13-14: change from "../protocol/groupEnvelopes" and "../protocol/relay"
import {
  buildGroupInvite, buildGroupMemberAdded, buildGroupMemberRemoved,
  buildGroupAdminChange, buildGroupLeave, buildGroupNameChange,
} from "@protocol/groupEnvelopes";
import { sendEnvelope } from "@protocol/relay";
```

**Step 3: Rewrite useContacts.js import**

```js
// Line 5: change from "../utils/storage"
import { loadJson, saveJson } from "@utils/storage";
```

**Step 4: Rewrite useGroups.js import**

```js
// Line 5: change from "../utils/storage"
import { loadJson, saveJson } from "@utils/storage";
```

**Step 5: Rewrite useIdentity.js import**

```js
// Line 31: change from "../utils/storage"
import { downloadJson, loadJson, saveJson } from "@utils/storage";
```

**Step 6: Commit**

```bash
git add client/src/hooks/
git commit -m "refactor: rewrite hook imports to use Vite aliases"
```

---

### Task 6: Rewrite imports in components (client only)

**Files:**
- Modify: `client/src/components/Sidebar.jsx:4`
- Modify: `client/src/components/ShareModal.jsx:3`

Note: Within-component imports (e.g., `./Icons` in ChatPanel, LoginScreen, etc.) stay relative — they resolve within the same directory. Only cross-directory imports need aliasing.

**Step 1: Rewrite Sidebar.jsx import**

```js
// Line 4: change from "../utils/storage"
import { saveJson } from "@utils/storage";
```

**Step 2: Rewrite ShareModal.jsx import**

```js
// Line 3: change from "../utils/qrcode"
import { generateQRSvg } from "@utils/qrcode";
```

**Step 3: Commit**

```bash
git add client/src/components/Sidebar.jsx client/src/components/ShareModal.jsx
git commit -m "refactor: rewrite component imports to use Vite aliases"
```

---

### Task 7: Rewrite imports in protocol (client only)

**Files:**
- Modify: `client/src/protocol/relay.js:12`

**Step 1: Rewrite relay.js import**

```js
// Line 12: change from "../config"
import { WS_RECONNECT_DELAY_MS } from "@config";
```

**Step 2: Commit**

```bash
git add client/src/protocol/relay.js
git commit -m "refactor: rewrite protocol imports to use Vite aliases"
```

---

### Task 8: Delete duplicated directories from desktop/src

**Files:**
- Delete: `desktop/src/components/` (entire directory)
- Delete: `desktop/src/hooks/` (entire directory)
- Delete: `desktop/src/protocol/` (entire directory)
- Delete: `desktop/src/utils/` (entire directory)
- Delete: `desktop/src/config.js`

**Step 1: Verify desktop App.jsx uses aliased imports**

Run: `grep -c '@components\|@hooks\|@protocol\|@utils' desktop/src/App.jsx`
Expected: A count > 0 (confirms aliases are in place)

**Step 2: Delete duplicated directories**

```bash
rm -rf desktop/src/components desktop/src/hooks desktop/src/protocol desktop/src/utils desktop/src/config.js
```

**Step 3: Verify desktop/src only has entry points**

Run: `ls desktop/src/`
Expected: `App.css  App.jsx  index.css  main.jsx` (only entry points remain)

**Step 4: Commit**

```bash
git add -A desktop/src/
git commit -m "refactor: remove duplicated source from desktop/src (now resolved via Vite aliases)"
```

---

### Task 9: Smoke test both apps

**Step 1: Verify client dev server starts without errors**

Run: `cd client && npx vite --host 127.0.0.1 2>&1 | head -20 &`
Expected: Vite dev server starts on port 5173 with no import errors

**Step 2: Verify desktop dev server starts without errors**

Run: `cd desktop && npx vite --host 127.0.0.1 2>&1 | head -20 &`
Expected: Vite dev server starts on port 5174 with no import errors

**Step 3: Kill dev servers**

```bash
kill %1 %2 2>/dev/null
```

**Step 4: Verify client production build**

Run: `cd client && npx vite build 2>&1 | tail -10`
Expected: Build succeeds with no errors

**Step 5: Verify desktop production build**

Run: `cd desktop && npx vite build 2>&1 | tail -10`
Expected: Build succeeds with no errors

**Step 6: Commit (if any fixes were needed)**

---

### Task 10: Update MEMORY.md

**Files:**
- Modify: `C:\Users\jacob\.claude\projects\C--Users-jacob-DCv5-16\memory\MEMORY.md`

**Step 1: Update the "Important: desktop mirrors client" section**

Replace the old note about manual copying with:

```
## Desktop shares client source (Vite alias)
`desktop/src/` only contains entry points (`main.jsx`, `App.jsx`, `App.css`, `index.css`).
All components, hooks, protocol, and utils resolve to `client/src/` via Vite aliases (`@components`, `@hooks`, `@protocol`, `@utils`, `@config`).
Changes to shared code only need to be made in `client/src/` — desktop picks them up automatically.
Desktop-specific code lives in `desktop/src-tauri/` (Rust) and `desktop/vite.config.js`.
```
