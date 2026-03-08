# File/Image Sharing — Design

## Overview

Add encrypted file and image sharing to DissolveChat. Two transfer modes: direct peer-to-peer (WebRTC) by default, with an opt-in inline relay fallback for offline recipients. Files are fully E2EE — the relay never sees content, names, types, or captions.

## Transfer Modes

### P2P Mode (default)

- WebRTC data channel for direct file transfer between peers
- Relay handles only tiny JSON signaling messages (SDP offers/answers, ICE candidates)
- Works for any file size — no server-side limit
- Requires both peers to be online simultaneously
- DTLS encryption on the wire (WebRTC built-in)

### Inline Mode (opt-in)

- Files <= 256KB (after encryption + base64) embedded in the existing encrypted envelope
- Works for offline recipients — file sits in relay inbox like a normal message
- Toggle in Settings > Security: "Allow offline file delivery"
  - Off by default
  - Subtext: "Small files (under 256KB) can be sent through the relay when the recipient is offline. The relay sees encrypted data only."
- Privacy cost: relay can infer approximate blob size (same class of metadata it already handles for text)

### Fallback behavior

1. Attempt P2P transfer (WebRTC signaling via relay)
2. If peer is offline and sender has inline mode enabled and file <= 256KB: auto-fallback to inline delivery
3. Otherwise: show "Recipient offline — try again later"

## Encryption

### 1-to-1 DMs

File bytes + filename + caption + MIME type all go into the `inner` payload object, encrypted with ECDH ephemeral + AES-GCM. Same encryption path as text messages.

### Group chats

File bytes encrypted with AES-256-GCM group key (inner layer), then per-member ECDH wrap (outer layer). Same two-layer model as group text messages. Fan-out to each member, same as group text.

Group P2P: sender initiates a separate WebRTC transfer to each online member. Offline members receive inline delivery if enabled and file is under 256KB.

## Envelope Format

```js
// Inside the encrypted inner payload (inline mode):
{
  t: "Message",           // same type as text messages
  text: "optional caption",
  file: {
    name: "photo.jpg",
    type: "image/jpeg",
    size: 102400,
    data: "<base64>"      // inline mode only — omitted for P2P
  },
  // ... existing fields (from, senderLabel, authPub, e2eePub, etc.)
}
```

For P2P mode, `file.data` is omitted from the message envelope. The file bytes transfer directly over WebRTC.

## WebRTC Signaling

New envelope types routed through the existing relay message path (all under 16KB):

- `t: "FileOffer"` — WebRTC SDP offer + file metadata (name, size, type, msgId). No file data.
- `t: "FileAnswer"` — SDP answer from recipient
- `t: "ICECandidate"` — ICE candidate exchange

Flow:
1. Sender creates RTCPeerConnection, generates SDP offer
2. Sends FileOffer envelope through relay (encrypted, like any message)
3. Recipient receives offer, creates RTCPeerConnection, generates SDP answer
4. Sends FileAnswer envelope back through relay
5. ICE candidates exchanged via relay
6. Data channel opens — file bytes stream directly peer-to-peer
7. On completion, message appears in chat with file attached

Group P2P: sender repeats this flow for each online group member.

## Server Changes

- Raise `express.json({ limit })` from `"16kb"` to `"512kb"` (headroom for 256KB file + base64 overhead + envelope JSON)
- No new endpoints
- No file storage
- No new server state

## Client UI

### Attach button
- Paperclip icon, left side of chat input row (next to text input)
- Opens native OS file picker (`<input type="file">`)
- Any file type accepted

### Pre-send preview
- Appears above the input row when a file is selected
- Images: thumbnail preview
- Non-images: file card showing name + size
- "X" button to cancel/remove the attached file
- User can type an optional text caption alongside

### In-chat display
- **Images**: render inline, max ~300px wide. Click to view full size in a lightbox/modal. Download button.
- **Non-images**: download card with filename, size, and download button
- **P2P transfers**: progress bar on the chat bubble during transfer

### Download
- Every file (image or not) has a download action
- Triggers native "Save As" dialog via Blob URL

### Offline/error states
- P2P transfer pending: "Waiting for recipient to come online..."
- Fallback to inline: automatic if enabled + file small enough
- No fallback available: "Recipient offline — try again later"

## Archive (local history)

If "Save messages locally" is enabled:
- Files are saved to IndexedDB alongside message text
- Encrypted at rest with AES-256-GCM (same as text message archive)
- Images/files persist across refreshes, same as chat history
- Archive disabled: files are ephemeral (lost on refresh)

## Settings

New toggle in Settings > Security:
- **"Allow offline file delivery"** — default OFF
- Lives alongside "Discoverable by handle" and "Show online presence"

## File type handling

No file type restrictions. The content is E2EE — restricting types is security theater when the relay never sees the content. Client-side logic:
- Can preview? (image/jpeg, image/png, image/gif, image/webp) -> render inline
- Everything else -> download card

## What this does NOT include

- Voice/video calls (separate feature)
- File size limit for P2P mode (practical limit is connection stability)
- Thumbnails for video files
- File forwarding between conversations
