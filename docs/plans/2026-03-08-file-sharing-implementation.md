# File/Image Sharing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add encrypted file/image sharing to DissolveChat with inline relay delivery (Phase 1) and WebRTC P2P direct transfer (Phase 2).

**Architecture:** Files are encrypted inside the existing E2EE envelope payload. Phase 1 embeds file bytes (base64) directly in the message for offline delivery. Phase 2 adds WebRTC data channels for large/online transfers with relay-based signaling. Both phases use the same UI and message format — the only difference is whether `file.data` is inline or transferred via WebRTC.

**Tech Stack:** React 19, Web Crypto API, WebRTC (Phase 2), IndexedDB, Express.js

---

## Phase 1: Inline File Sharing

### Task 1: Raise server body limit

**Files:**
- Modify: `server/src/index.js:63`

**Step 1: Change the body limit**

In `server/src/index.js`, change line 63 from:
```js
app.use(express.json({ limit: "16kb" }));
```
to:
```js
app.use(express.json({ limit: "512kb" }));
```

This gives headroom for 256KB file + base64 overhead (~33%) + envelope JSON metadata.

**Step 2: Commit**

```bash
git add server/src/index.js
git commit -m "feat: raise relay body limit to 512kb for file sharing"
```

---

### Task 2: Add file sharing constants and config

**Files:**
- Modify: `client/src/config.js`

**Step 1: Add constants**

Append to `client/src/config.js`:
```js
/** Maximum file size for inline relay delivery (bytes, before base64) */
export const MAX_INLINE_FILE_SIZE = 256 * 1024; // 256KB

/** Image MIME types that render inline in chat */
export const INLINE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
```

**Step 2: Commit**

```bash
git add client/src/config.js
git commit -m "feat: add file sharing constants"
```

---

### Task 3: Add file-related icons

**Files:**
- Modify: `client/src/components/Icons.jsx`

**Step 1: Add IconAttach, IconDownload, and IconFile icons**

Append to `client/src/components/Icons.jsx`:
```jsx
export const IconAttach = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M13.5 7.5l-5.8 5.8a3.2 3.2 0 01-4.5-4.5L9.5 2.5a2.1 2.1 0 013 3L6.2 11.8a1.1 1.1 0 01-1.5-1.5L10.5 4.5" />
  </svg>
);

export const IconDownload = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M8 2v8.5M4.5 7.5L8 11l3.5-3.5" />
    <path d="M2.5 12.5v1a1 1 0 001 1h9a1 1 0 001-1v-1" />
  </svg>
);

export const IconFile = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M9 1.5H4a1.5 1.5 0 00-1.5 1.5v10A1.5 1.5 0 004 14.5h8a1.5 1.5 0 001.5-1.5V6L9 1.5z" />
    <path d="M9 1.5V6h4.5" />
  </svg>
);
```

**Step 2: Commit**

```bash
git add client/src/components/Icons.jsx
git commit -m "feat: add attach, download, and file icons"
```

---

### Task 4: Create file utility functions

**Files:**
- Create: `client/src/utils/fileUtils.js`

**Step 1: Write the file utility module**

```js
// client/src/utils/fileUtils.js
// Utilities for reading, encoding, and downloading files.

/**
 * Read a File object into a base64 string.
 * @param {File} file
 * @returns {Promise<string>} base64-encoded file content
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // result is "data:<mime>;base64,<data>" — extract just the base64 part
      const b64 = reader.result.split(",")[1];
      resolve(b64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Convert a base64 string back to a Blob.
 * @param {string} b64 - base64-encoded data
 * @param {string} mimeType - MIME type for the blob
 * @returns {Blob}
 */
export function base64ToBlob(b64, mimeType) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/**
 * Trigger a browser download for a Blob.
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Format a byte count as a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

**Step 2: Commit**

```bash
git add client/src/utils/fileUtils.js
git commit -m "feat: add file utility functions (base64, download, formatting)"
```

---

### Task 5: Add offline file delivery setting to useIdentity

**Files:**
- Modify: `client/src/hooks/useIdentity.js`

**Step 1: Add state and persistence for offlineFiles setting**

In `useIdentity.js`, add alongside the other settings state (after line 126):
```js
const [offlineFiles, setOfflineFiles] = useState(false);
```

In `activateSession`, after the `showPresence` pref load (after line 175):
```js
const offlineFilesPref = loadJson(`offlineFiles:${data.id}`, { enabled: false });
setOfflineFiles(!!offlineFilesPref.enabled);
```

In the return object (around line 378), add to the State section:
```js
offlineFiles, setOfflineFiles,
```

**Step 2: Commit**

```bash
git add client/src/hooks/useIdentity.js
git commit -m "feat: add offlineFiles setting to useIdentity"
```

---

### Task 6: Add offline file delivery toggle to Settings UI

**Files:**
- Modify: `client/src/components/Sidebar.jsx`

**Step 1: Add the toggle**

In `Sidebar.jsx`, in the Privacy settings section (after the "Discoverable by handle" toggle block, around line 175), add:
```jsx
<label className="toggle-label">
  <input
    type="checkbox"
    checked={identity.offlineFiles}
    onChange={(e) => {
      identity.setOfflineFiles(e.target.checked);
      saveJson(`offlineFiles:${identity.id}`, { enabled: e.target.checked });
    }}
  />
  <span>Allow offline file delivery</span>
</label>
{identity.offlineFiles && (
  <div className="hint-text" style={{ marginTop: "2px", marginBottom: "8px", paddingLeft: "24px" }}>
    Small files (under 256 KB) can be sent through the relay when the recipient is offline. The relay sees encrypted data only.
  </div>
)}
```

**Step 2: Commit**

```bash
git add client/src/components/Sidebar.jsx
git commit -m "feat: add offline file delivery toggle in settings"
```

---

### Task 7: Extend buildMessage to support file attachments

**Files:**
- Modify: `client/src/protocol/envelopes.js`

**Step 1: Add optional file parameter to buildMessage**

Change the `buildMessage` function signature (line 68) to accept an optional `file` parameter:
```js
export async function buildMessage(
  myId, myLabel, myAuthPubJwk, myAuthPrivJwk, myE2eePubJwk,
  myInboxCap, peer, plaintext, file
) {
```

In the `inner` object (line 77), add the file field conditionally:
```js
const inner = {
  t: "Message",
  from: myId,
  senderLabel: myLabel,
  senderCap: myInboxCap,
  e2eePub: myE2eePubJwk,
  authPub: myAuthPubJwk,
  convId,
  seq,
  msgId,
  text: plaintext,
  ts: Date.now(),
  ...(file ? { file } : {}),
};
```

No other changes needed — the rest of the function (e2eeEncrypt, signing) works on the serialized inner object.

**Step 2: Commit**

```bash
git add client/src/protocol/envelopes.js
git commit -m "feat: extend buildMessage to support file attachments"
```

---

### Task 8: Extend buildGroupMessage to support file attachments

**Files:**
- Modify: `client/src/protocol/groupEnvelopes.js`

**Step 1: Add optional file parameter to buildGroupMessage**

Change the function signature (line 21) to accept an optional `file` parameter:
```js
export async function buildGroupMessage(
  myId, myLabel, myAuthPubJwk, myAuthPrivJwk, myE2eePubJwk,
  myInboxCap, groupId, groupKeyB64, members, text, file
) {
```

In the `inner` object (line 29), add:
```js
const inner = {
  t: "GroupMessage",
  groupId,
  from: myId,
  senderLabel: myLabel,
  senderCap: myInboxCap,
  e2eePub: myE2eePubJwk,
  authPub: myAuthPubJwk,
  msgId,
  text,
  seq,
  ts,
  ...(file ? { file } : {}),
};
```

**Step 2: Commit**

```bash
git add client/src/protocol/groupEnvelopes.js
git commit -m "feat: extend buildGroupMessage to support file attachments"
```

---

### Task 9: Extend useMessaging to send and receive file messages

**Files:**
- Modify: `client/src/hooks/useMessaging.js`

**Step 1: Update sendMsg to accept optional file**

Change the `sendMsg` callback (around line 510) to accept a file parameter and pass it through:

```js
const sendMsg = useCallback(async (peerId, text, file) => {
  const peer = contactsRef.current.find((c) => c.id === peerId) ||
               requestsRef.current.find((r) => r.id === peerId);
  if (!peer) throw new Error("Peer not found");
  if (typeof peer.cap !== "string") {
    throw new Error("This contact has no inbox capability. Re-import their contact card.");
  }

  const { envelope, msgId, ts } = await buildMessage(
    myId, myLabel, authPubJwk, authPrivJwk, e2eePubJwk,
    inboxCap, peer, text.trim(), file || undefined
  );

  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const resp = await sendEnvelope(envelope);
    if (resp.ok) {
      if (resp.status === 202) {
        console.warn("[Dissolve] Message queued on relay — recipient caps not yet registered");
      }
      const outMsg = { dir: "out", peerId, text: text.trim(), ts, msgId, file: file || undefined };
      setMessages((prev) => [...prev, outMsg]);
      archiveRef.current?.save(myId, outMsg);
      return;
    }

    let errData;
    try { errData = await resp.json(); } catch { errData = {}; }
    lastError = errData.error || `${resp.status}`;
    console.warn(`[Dissolve] Send attempt ${attempt + 1} failed:`, lastError);

    if (errData.error === "cap_not_allowed" || errData.error === "request_cap_not_allowed") {
      await new Promise((r) => setTimeout(r, SEND_RETRY_BASE_DELAY_MS * (attempt + 1)));
      continue;
    }

    break;
  }

  throw new Error(`Send failed: ${lastError}`);
}, [myId, myLabel, authPubJwk, authPrivJwk, e2eePubJwk, inboxCap, contactsRef, requestsRef]);
```

**Step 2: Update handleIncoming to extract file from incoming messages**

In the `handleIncoming` callback, in the "Show in chat" section for `inner.t === "Message"` (around line 176), include the file:
```js
if (inner.t === "Message") {
  const msg = {
    dir: "in", peerId: inner.from, text: inner.text, ts: inner.ts,
    msgId: inner.msgId || randomId(),
    file: inner.file || undefined,
  };
  setMessages((prev) => [...prev, msg]);
  archiveRef.current?.save(myId, msg);
  if (soundRef.current) notifyIncoming(); else flashTitle();
}
```

**Step 3: Update handleIncoming for GroupMessage to include file**

In the `inner.t === "GroupMessage"` section (around line 184), include file:
```js
if (inner.t === "GroupMessage") {
  if (inner.from === myId) return;
  const msg = {
    dir: "in",
    from: inner.from,
    senderLabel: inner.senderLabel,
    text: inner.text,
    ts: inner.ts,
    msgId: inner.msgId,
    file: inner.file || undefined,
  };
  // ... rest stays the same
```

**Step 4: Update sendGroupMsg to accept optional file**

Change `sendGroupMsg` (around line 574) to accept and pass file:
```js
const sendGroupMsg = useCallback(async (groupId, text, file) => {
  if (!groupsMgr) return;
  const group = groupsMgr.findGroup(groupId);
  if (!group) return;

  const { envelopes, msgId, ts } = await buildGroupMessage(
    myId, myLabel, authPubJwk, authPrivJwk, e2eePubJwk,
    inboxCap, groupId, group.groupKey, group.members, text.trim(), file || undefined
  );

  const results = await Promise.allSettled(
    envelopes.map(({ envelope }) => sendEnvelope(envelope))
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.warn(`[Dissolve] Group send: ${failures.length}/${envelopes.length} failed`);
  }

  const msg = { dir: "out", from: myId, senderLabel: myLabel, text: text.trim(), ts, msgId, file: file || undefined };
  // ... rest stays the same
```

**Step 5: Commit**

```bash
git add client/src/hooks/useMessaging.js
git commit -m "feat: extend useMessaging for file send/receive in DMs and groups"
```

---

### Task 10: Update ChatPanel UI — attach button and pre-send preview

**Files:**
- Modify: `client/src/components/ChatPanel.jsx`

**Step 1: Add imports and file state**

At the top of `ChatPanel.jsx`, update imports:
```js
import { useState, useRef, useEffect, useMemo } from "react";
import { IconSend, IconAttach, IconClose, IconDownload, IconFile } from "./Icons";
import { fileToBase64, base64ToBlob, downloadBlob, formatFileSize } from "@utils/fileUtils";
import { MAX_INLINE_FILE_SIZE, INLINE_IMAGE_TYPES } from "@config";
```

Inside the component function, after the existing state declarations (after line 28), add:
```js
const [pendingFile, setPendingFile] = useState(null); // { name, type, size, data, previewUrl }
const fileInputRef = useRef(null);
```

**Step 2: Add file selection handler**

After the `handleChatClick` function, add:
```js
const handleFileSelect = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  e.target.value = ""; // reset so same file can be re-selected

  try {
    const data = await fileToBase64(file);
    const previewUrl = INLINE_IMAGE_TYPES.has(file.type)
      ? URL.createObjectURL(file)
      : null;
    setPendingFile({ name: file.name, type: file.type, size: file.size, data, previewUrl });
  } catch (err) {
    setError("Failed to read file: " + err.message);
  }
};

const clearPendingFile = () => {
  if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
  setPendingFile(null);
};
```

**Step 3: Update handleSend to include file**

Replace the `handleSend` function:
```js
const handleSend = async () => {
  const hasText = !!text.trim();
  const hasFile = !!pendingFile;
  const canSendMsg = group ? (hasText || hasFile) : ((hasText || hasFile) && !!peer);
  if (!canSendMsg || sending) return;

  if (hasFile && pendingFile.size > MAX_INLINE_FILE_SIZE) {
    setError(`File too large for offline delivery (max ${formatFileSize(MAX_INLINE_FILE_SIZE)}). Recipient must be online for P2P transfer.`);
    return;
  }

  setError(null);
  setSending(true);
  try {
    const filePayload = hasFile
      ? { name: pendingFile.name, type: pendingFile.type, size: pendingFile.size, data: pendingFile.data }
      : undefined;
    await onSend(group ? group.groupId : peer.id, text, filePayload);
    setText("");
    clearPendingFile();
  } catch (err) {
    setError(err.message);
  } finally {
    setSending(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }
};
```

**Step 4: Add the hidden file input and attach button in the input area**

Replace the chat-input-row div (around line 195) with:
```jsx
<div className="chat-input-row">
  <input
    ref={fileInputRef}
    type="file"
    style={{ display: "none" }}
    onChange={handleFileSelect}
  />
  <button
    className="btn-icon btn-attach"
    onClick={() => fileInputRef.current?.click()}
    disabled={!canSend || sending}
    aria-label="Attach file"
    title="Attach file"
  >
    <IconAttach size={16} />
  </button>
  <input
    ref={inputRef}
    className="chat-input"
    value={text}
    onChange={(e) => setText(e.target.value)}
    placeholder={canSend ? "Type a message…" : "Cannot send — no inbox capability"}
    disabled={!canSend || sending}
    aria-label="Message input"
    onKeyDown={(e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    }}
  />
  <button
    className="btn btn-primary btn-send"
    onClick={handleSend}
    disabled={(!text.trim() && !pendingFile) || !canSend || sending}
    aria-label="Send message"
  >
    {sending ? <span className="spinner" aria-hidden="true" /> : <IconSend size={15} />}
  </button>
</div>
```

**Step 5: Add pre-send file preview above the input row**

Just before the `chat-input-row` div, inside `chat-input-area`, add:
```jsx
{pendingFile && (
  <div className="file-preview-bar">
    {pendingFile.previewUrl ? (
      <img src={pendingFile.previewUrl} alt={pendingFile.name} className="file-preview-thumb" />
    ) : (
      <div className="file-preview-icon"><IconFile size={20} /></div>
    )}
    <div className="file-preview-info">
      <span className="file-preview-name">{pendingFile.name}</span>
      <span className="file-preview-size">{formatFileSize(pendingFile.size)}</span>
    </div>
    <button className="btn-icon" onClick={clearPendingFile} aria-label="Remove attachment">
      <IconClose size={14} />
    </button>
  </div>
)}
```

**Step 6: Commit**

```bash
git add client/src/components/ChatPanel.jsx
git commit -m "feat: add file attach button and pre-send preview in ChatPanel"
```

---

### Task 11: Render file messages in chat (inline images + download cards)

**Files:**
- Modify: `client/src/components/ChatPanel.jsx`

**Step 1: Add file download handler**

After the `clearPendingFile` function, add:
```js
const handleDownload = (file) => {
  const blob = base64ToBlob(file.data, file.type);
  downloadBlob(blob, file.name);
};
```

**Step 2: Update the message rendering**

In the message bubble rendering (inside the `items.map` callback), replace the existing chat-bubble content with file-aware rendering. Replace the current bubble JSX:

```jsx
<div
  key={item.msgId}
  className={`chat-bubble ${item.dir === "out" ? "outgoing" : "incoming"}${!seenRef.current?.has(item.msgId) ? " is-new" : ""}`}
>
  {group && item.dir === "in" && (
    <span className="group-msg-sender">{item.senderLabel}</span>
  )}
  {item.file && INLINE_IMAGE_TYPES.has(item.file.type) && item.file.data && (
    <div className="chat-file-image">
      <img
        src={`data:${item.file.type};base64,${item.file.data}`}
        alt={item.file.name}
        className="chat-inline-image"
        onClick={() => {
          // Open full-size image in new tab
          const blob = base64ToBlob(item.file.data, item.file.type);
          window.open(URL.createObjectURL(blob), "_blank");
        }}
      />
      <button
        className="btn-icon file-download-btn"
        onClick={() => handleDownload(item.file)}
        aria-label={`Download ${item.file.name}`}
        title="Download"
      >
        <IconDownload size={14} />
      </button>
    </div>
  )}
  {item.file && !INLINE_IMAGE_TYPES.has(item.file.type) && item.file.data && (
    <div className="chat-file-card" onClick={() => handleDownload(item.file)}>
      <IconFile size={20} />
      <div className="chat-file-card-info">
        <span className="chat-file-card-name">{item.file.name}</span>
        <span className="chat-file-card-size">{formatFileSize(item.file.size)}</span>
      </div>
      <IconDownload size={16} />
    </div>
  )}
  {item.text && <div className="chat-bubble-text">{item.text}</div>}
  <div className="chat-bubble-time" aria-label={new Date(item.ts).toLocaleString()}>
    {new Date(item.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
  </div>
</div>
```

Note: The original `<div className="chat-bubble-text">{item.text}</div>` is now conditional on `item.text` being truthy, so file-only messages (no caption) don't render an empty text div.

**Step 3: Commit**

```bash
git add client/src/components/ChatPanel.jsx
git commit -m "feat: render inline images and file download cards in chat"
```

---

### Task 12: Add CSS for file sharing UI

**Files:**
- Modify: `client/src/App.css`

**Step 1: Add file sharing styles**

Find the `.chat-input-area` section in App.css and add these styles after it (or at the end of the chat-related CSS block):

```css
/* ── File attach button ─────────────────────────────────────── */
.btn-attach {
  flex-shrink: 0;
  color: var(--text-secondary);
  transition: color 0.15s;
}
.btn-attach:hover:not(:disabled) {
  color: var(--accent);
}

/* ── Pre-send file preview bar ──────────────────────────────── */
.file-preview-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-radius: 4px;
  margin-bottom: 8px;
}
.file-preview-thumb {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 4px;
}
.file-preview-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary, rgba(255,255,255,0.05));
  border-radius: 4px;
  color: var(--text-secondary);
}
.file-preview-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.file-preview-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-preview-size {
  font-size: 11px;
  color: var(--text-secondary);
}

/* ── Inline image in chat bubble ────────────────────────────── */
.chat-file-image {
  position: relative;
  margin-bottom: 4px;
}
.chat-inline-image {
  max-width: 300px;
  max-height: 300px;
  border-radius: 4px;
  cursor: pointer;
  display: block;
}
.chat-file-image .file-download-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  background: rgba(0,0,0,0.6);
  border-radius: 4px;
  color: #fff;
  opacity: 0;
  transition: opacity 0.15s;
  padding: 4px;
}
.chat-file-image:hover .file-download-btn {
  opacity: 1;
}

/* ── File download card in chat bubble ──────────────────────── */
.chat-file-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: rgba(255,255,255,0.05);
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 4px;
  transition: background 0.15s;
  color: var(--text-secondary);
}
.chat-file-card:hover {
  background: rgba(255,255,255,0.08);
}
.chat-file-card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.chat-file-card-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chat-file-card-size {
  font-size: 11px;
  color: var(--text-secondary);
}
```

**Step 2: Commit**

```bash
git add client/src/App.css
git commit -m "feat: add CSS for file sharing UI (preview, inline images, download cards)"
```

---

### Task 13: Wire file sending through App.jsx

**Files:**
- Modify: `client/src/App.jsx` (if needed — check how `onSend` is wired)

**Step 1: Fix group chat onSend wrapper**

In `client/src/App.jsx`, line 561, the group chat `onSend` wrapper drops the file parameter:
```jsx
// BEFORE (drops file):
onSend={(_, text) => messaging.sendGroupMsg(activeGroupId, text)}
```

Change to:
```jsx
// AFTER (passes file through):
onSend={(_, text, file) => messaging.sendGroupMsg(activeGroupId, text, file)}
```

The DM path (line 568) passes `messaging.sendMsg` directly, which already accepts `(peerId, text, file)` — no change needed there.

**Step 2: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat: wire file parameter through App.jsx to sendGroupMsg"
```

---

### Task 14: Test the complete inline file sharing flow

**Step 1: Start relay and client**

```bash
cd server && npm run dev &
cd client && npm run dev
```

**Step 2: Test manually**

1. Open two browser tabs, log in as two different users
2. Add each other as contacts
3. In one tab, click the attach button (paperclip), select a small image (<256KB)
4. Verify the preview appears above the input
5. Optionally type a caption
6. Click send
7. Verify: the image appears inline in both tabs
8. Hover over the image in the receiving tab — verify download button appears
9. Click download — verify the file downloads correctly
10. Test with a non-image file (e.g., a .txt or .pdf) — verify it shows as a download card
11. Test in a group chat — verify file appears for all group members
12. Test file-only message (no caption text)
13. Test the X button to cancel a pending file before sending

**Step 3: Test size limit**

1. Try attaching a file >256KB
2. Verify the error message appears: "File too large for offline delivery..."

---

## Phase 2: WebRTC P2P Transfer (Future)

> Phase 2 adds WebRTC data channels for large file transfer when both peers are online.
> This phase depends on Phase 1 being complete and tested.
> Implementation deferred — Phase 1 provides full functionality for files under 256KB.

### Overview of Phase 2 tasks (to be detailed when ready):

1. **WebRTC signaling envelopes** — Add `FileOffer`, `FileAnswer`, `ICECandidate` envelope types
2. **useFileTransfer hook** — Manage RTCPeerConnection lifecycle, data channels, file chunking
3. **Signaling through relay** — Route WebRTC signaling through existing message path
4. **Transfer progress UI** — Progress bar on chat bubble during P2P transfer
5. **Fallback logic** — Attempt P2P first, fall back to inline if peer offline + file small enough + setting enabled
6. **Group P2P fan-out** — Initiate separate WebRTC transfer per online group member

### Key design decisions for Phase 2:
- File chunking: 16KB chunks over data channel
- ICE servers: use public STUN servers (no TURN for now — privacy tradeoff)
- Timeout: if WebRTC connection not established within 10s, fall back to inline (if applicable) or show error
- No persistence of WebRTC state — if page refreshes during transfer, it's lost
