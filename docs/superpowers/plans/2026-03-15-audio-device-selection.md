# Audio Device Selection Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add microphone and speaker device selection — persistent defaults in Settings plus mid-call switching from the CallBar.

**Architecture:** Device enumeration and switching logic lives in `useVoiceCall.js`. Settings UI in `Sidebar.jsx` reads/writes localStorage preferences. `CallBar.jsx` gets dropdown pickers for mid-call switching. Output device uses `setSinkId()` on the remote `<audio>` element (hidden when unsupported).

**Tech Stack:** WebRTC (`getUserMedia`, `enumerateDevices`, `replaceTrack`, `setSinkId`), React hooks, localStorage

---

## Chunk 1: Core device logic + Settings UI

### Task 1: Add speaker icon to Icons.jsx

**Files:**
- Modify: `client/src/components/Icons.jsx`

- [ ] **Step 1: Add IconSpeaker and IconChevronDown components**

In `client/src/components/Icons.jsx`, add after the `IconMicOff` export (around line 228):

```jsx
export const IconSpeaker = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

export const IconChevronDown = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/Icons.jsx
git commit -m "feat: add IconSpeaker and IconChevronDown icons"
```

---

### Task 2: Add device enumeration and switching to useVoiceCall

**Files:**
- Modify: `client/src/hooks/useVoiceCall.js`

- [ ] **Step 1: Add device state, enumeration, and devicechange listener**

At the top of `useVoiceCall`, after the existing refs (around line 48), add:

```js
const [audioDevices, setAudioDevices] = useState([]);
const [selectedInput, setSelectedInput] = useState("");
const [selectedOutput, setSelectedOutput] = useState("");
const selectedInputRef = useRef("");
const selectedOutputRef = useRef("");
```

Keep refs in sync with state (add after the existing `stateRef` sync effect around line 51):

```js
useEffect(() => { selectedInputRef.current = selectedInput; }, [selectedInput]);
useEffect(() => { selectedOutputRef.current = selectedOutput; }, [selectedOutput]);
```

After the existing `useEffect` blocks (after line 73), add a new effect for device enumeration:

```js
// Load saved device preferences
useEffect(() => {
  if (!identity?.id) return;
  try {
    const saved = JSON.parse(localStorage.getItem(`audioDevices:${identity.id}`) || "{}");
    if (saved.inputId) setSelectedInput(saved.inputId);
    if (saved.outputId) setSelectedOutput(saved.outputId);
  } catch { /* ignore */ }
}, [identity?.id]);

// Enumerate audio devices and listen for changes
useEffect(() => {
  const enumerate = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audio = devices
        .filter(d => d.kind === "audioinput" || d.kind === "audiooutput")
        .map(d => ({ deviceId: d.deviceId, label: d.label, kind: d.kind }));
      setAudioDevices(audio);
    } catch (err) {
      console.warn("[Voice] Failed to enumerate devices:", err.message);
    }
  };

  enumerate();
  navigator.mediaDevices.addEventListener("devicechange", enumerate);
  return () => navigator.mediaDevices.removeEventListener("devicechange", enumerate);
}, []);
```

- [ ] **Step 2: Add helper to save device preferences**

Add this helper inside the hook, after the `enumerate` effect:

```js
const saveDevicePref = useCallback(() => {
  if (!identity?.id) return;
  localStorage.setItem(`audioDevices:${identity.id}`, JSON.stringify({
    inputId: selectedInputRef.current,
    outputId: selectedOutputRef.current,
  }));
}, [identity?.id]);
```

Note: `saveDevicePref` reads from refs instead of taking parameters. This eliminates cross-dependency between `switchInputDevice` and `switchOutputDevice`.

- [ ] **Step 3: Modify getUserMedia calls to use saved input device**

In the `startCall` function (around line 212), replace:
```js
const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
```
with:
```js
const audioConstraints = selectedInput
  ? { deviceId: selectedInput }
  : true;
const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
```

Do the same in the `acceptCall` function (around line 304), replace:
```js
const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
```
with:
```js
const audioConstraints = selectedInput
  ? { deviceId: selectedInput }
  : true;
const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
```

- [ ] **Step 4: Apply setSinkId on remote audio after connection**

In `setupPcHandlers`, modify the `pc.ontrack` handler (around line 150) to apply the saved output device. **Use `selectedOutputRef.current`** (not the state variable) to avoid stale closure capture and unnecessary dependency chain changes:

```js
pc.ontrack = (event) => {
  if (remoteAudioRef.current && event.streams[0]) {
    remoteAudioRef.current.srcObject = event.streams[0];
    // Apply saved output device (read from ref to avoid stale closure)
    const outputId = selectedOutputRef.current;
    if (outputId && typeof remoteAudioRef.current.setSinkId === "function") {
      remoteAudioRef.current.setSinkId(outputId).catch(err => {
        console.warn("[Voice] Failed to set output device:", err.message);
      });
    }
  }
};
```

**Do NOT add `selectedOutput` to the `setupPcHandlers` dependency array** — using the ref avoids this entirely and prevents unnecessary recreation of `startCall`/`acceptCall`.

- [ ] **Step 5: Add switchInputDevice function**

Add after the `unmute` function (around line 406):

```js
const switchInputDevice = useCallback(async (deviceId) => {
  setSelectedInput(deviceId);
  saveDevicePref();

  // If in a call, hot-swap the audio track
  if (pcRef.current && localStreamRef.current) {
    try {
      const constraints = deviceId
        ? { audio: { deviceId: { exact: deviceId } }, video: false }
        : { audio: true, video: false };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newTrack = newStream.getAudioTracks()[0];
      const sender = pcRef.current.getSenders().find(s => s.track?.kind === "audio");
      if (sender) {
        await sender.replaceTrack(newTrack);
      }
      // Stop old tracks
      for (const track of localStreamRef.current.getAudioTracks()) {
        track.stop();
      }
      // Update localStreamRef so mute/unmute still works
      localStreamRef.current = newStream;
      // Preserve mute state on the new track
      const currentlyMuted = localStreamRef.current.getAudioTracks()[0];
      if (currentlyMuted) currentlyMuted.enabled = !stateRef.current.includes("muted");
      // Read isMuted from a simple check instead of depending on state
    } catch (err) {
      console.warn("[Voice] Failed to switch input device:", err.message);
    }
  }
}, [saveDevicePref]);
```

Note: We avoid depending on `isMuted` state by reading `localStreamRef` directly. For mute state preservation, a simpler approach — just check `isMuted` ref or keep it simple:

Actually, the simplest correct approach is to add an `isMutedRef` (like `stateRef`). Add to the refs section:

```js
const isMutedRef = useRef(false);
```

And sync it:
```js
useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
```

Then in `switchInputDevice`, replace the mute preservation with:
```js
if (isMutedRef.current) {
  newTrack.enabled = false;
}
```

This keeps the dependency array clean: `[saveDevicePref]` only.

- [ ] **Step 6: Add switchOutputDevice function**

```js
const switchOutputDevice = useCallback(async (deviceId) => {
  setSelectedOutput(deviceId);
  saveDevicePref();

  // If in a call, switch the audio output
  if (remoteAudioRef.current && typeof remoteAudioRef.current.setSinkId === "function") {
    try {
      await remoteAudioRef.current.setSinkId(deviceId);
    } catch (err) {
      console.warn("[Voice] Failed to switch output device:", err.message);
    }
  }
}, [saveDevicePref]);
```

- [ ] **Step 7: Add devicechange fallback for mid-call device loss**

Inside the existing `enumerate` function (from Step 1), add device-loss detection after `setAudioDevices(audio)`:

```js
// If selected input disappeared, fall back to default
setSelectedInput(prev => {
  if (prev && !audio.some(d => d.kind === "audioinput" && d.deviceId === prev)) {
    // Mid-call: re-acquire default mic
    if (pcRef.current && localStreamRef.current) {
      navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(newStream => {
          const newTrack = newStream.getAudioTracks()[0];
          const sender = pcRef.current?.getSenders().find(s => s.track?.kind === "audio");
          if (sender) sender.replaceTrack(newTrack);
          for (const track of localStreamRef.current.getAudioTracks()) track.stop();
          localStreamRef.current = newStream;
        })
        .catch(err => {
          console.warn("[Voice] Fallback mic failed, ending call:", err.message);
          // No mic available — end call gracefully
          endCall("error");
        });
    }
    return "";
  }
  return prev;
});

// If selected output disappeared, fall back to default
setSelectedOutput(prev => {
  if (prev && !audio.some(d => d.kind === "audiooutput" && d.deviceId === prev)) {
    if (remoteAudioRef.current && typeof remoteAudioRef.current.setSinkId === "function") {
      remoteAudioRef.current.setSinkId("").catch(() => {});
    }
    return "";
  }
  return prev;
});
```

- [ ] **Step 8: Add requestMicPermission function for Settings**

```js
const requestMicPermission = useCallback(async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Stop immediately — we only needed permission
    for (const track of stream.getTracks()) track.stop();
    // Re-enumerate to get labels
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audio = devices
      .filter(d => d.kind === "audioinput" || d.kind === "audiooutput")
      .map(d => ({ deviceId: d.deviceId, label: d.label, kind: d.kind }));
    setAudioDevices(audio);
    return true;
  } catch {
    return false;
  }
}, []);
```

- [ ] **Step 9: Update the return object**

Update the return statement (around line 416) to include the new exports:

```js
return {
  callState, callPeer, callId, isMuted, callDuration,
  startCall, acceptCall, declineCall, hangup, mute, unmute,
  handleIncomingOffer, handleIncomingAnswer, handleIncomingIce, handleIncomingEnd,
  remoteAudioRef,
  // Audio device selection
  audioDevices, selectedInput, selectedOutput,
  switchInputDevice, switchOutputDevice, requestMicPermission,
};
```

- [ ] **Step 10: Commit**

```bash
git add client/src/hooks/useVoiceCall.js
git commit -m "feat: audio device enumeration, preferences, and mid-call switching"
```

---

### Task 3: Add Audio section to Settings in Sidebar.jsx

**Files:**
- Modify: `client/src/components/Sidebar.jsx`

- [ ] **Step 1: Add voiceCall prop to Sidebar**

Add `voiceCall` to the destructured props of the `Sidebar` component (around line 40):

```js
export default function Sidebar({
  // ... existing props ...
  voiceCall,
}) {
```

- [ ] **Step 2: Check if setSinkId is supported**

At the top of the component body (after the state declarations, around line 88):

```js
const supportsSinkId = typeof HTMLMediaElement !== "undefined" &&
  typeof HTMLMediaElement.prototype.setSinkId === "function";
```

- [ ] **Step 3: Add the Audio section**

Insert a new settings section between the Privacy section (ends around line 234) and the Theme section (starts around line 236). Add this block:

```jsx
<div className="settings-section">
  <h4>Audio</h4>
  {voiceCall.audioDevices.some(d => d.label) ? (
    <>
      <label className="settings-label">Microphone</label>
      <select
        className="input-field audio-device-select"
        value={voiceCall.selectedInput}
        onChange={(e) => voiceCall.switchInputDevice(e.target.value)}
      >
        <option value="">Default</option>
        {voiceCall.audioDevices
          .filter(d => d.kind === "audioinput")
          .map(d => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
            </option>
          ))}
      </select>

      {supportsSinkId && (
        <>
          <label className="settings-label" style={{ marginTop: "8px" }}>Speaker</label>
          <select
            className="input-field audio-device-select"
            value={voiceCall.selectedOutput}
            onChange={(e) => voiceCall.switchOutputDevice(e.target.value)}
          >
            <option value="">Default</option>
            {voiceCall.audioDevices
              .filter(d => d.kind === "audiooutput")
              .map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Speaker ${d.deviceId.slice(0, 8)}`}
                </option>
              ))}
          </select>
        </>
      )}
    </>
  ) : (
    <>
      <button
        className="btn btn-sm btn-secondary"
        onClick={async () => {
          const ok = await voiceCall.requestMicPermission();
          if (!ok) addToast("Microphone access denied", "error");
        }}
      >
        Grant Microphone Access
      </button>
      <div className="hint-text" style={{ marginTop: "4px" }}>
        Required to see available audio devices
      </div>
    </>
  )}
</div>
```

- [ ] **Step 4: Add addToast to Sidebar props**

`addToast` is used in Sidebar's relay URL onBlur (line 324) but is NOT currently a prop — this is a pre-existing bug. Add `addToast` to the destructured props:

```js
export default function Sidebar({
  // ... existing props ...
  voiceCall,
  addToast,
}) {
```

This fixes the pre-existing bug and enables the mic permission toast. Task 4 will pass `addToast` from App.jsx.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/Sidebar.jsx
git commit -m "feat: audio device selection in Settings panel"
```

---

### Task 4: Pass voiceCall to Sidebar from App.jsx

**Files:**
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Pass voiceCall prop to Sidebar**

Find where `<Sidebar` is rendered in App.jsx. Add the `voiceCall` prop:

```jsx
<Sidebar
  // ... existing props ...
  voiceCall={voiceCall}
/>
```

Also pass `addToast` if not already passed:
```jsx
  addToast={addToast}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat: wire voiceCall and addToast to Sidebar"
```

---

## Chunk 2: CallBar device pickers + CSS

### Task 5: Add device picker dropdowns to CallBar

**Files:**
- Modify: `client/src/components/CallBar.jsx`

- [ ] **Step 1: Update CallBar props and add state**

Replace the entire `CallBar.jsx` with:

```jsx
import { useState, useRef, useEffect } from "react";
import { IconPhoneOff, IconMic, IconMicOff, IconSpeaker, IconChevronDown } from "./Icons";
import { formatCallDuration } from "@utils/callHelpers";

function DevicePicker({ devices, selectedId, onSelect, label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (devices.length === 0) return null;

  return (
    <div className="callbar-device-picker" ref={ref}>
      <button
        className="btn-icon callbar-device-trigger"
        onClick={() => setOpen(!open)}
        title={`Select ${label}`}
        aria-label={`Select ${label}`}
        aria-expanded={open}
      >
        <IconChevronDown size={10} />
      </button>
      {open && (
        <div className="callbar-device-menu" role="listbox" aria-label={label}>
          <div
            className={`callbar-device-option${!selectedId ? " active" : ""}`}
            role="option"
            aria-selected={!selectedId}
            onClick={() => { onSelect(""); setOpen(false); }}
          >
            Default
          </div>
          {devices.map(d => (
            <div
              key={d.deviceId}
              className={`callbar-device-option${d.deviceId === selectedId ? " active" : ""}`}
              role="option"
              aria-selected={d.deviceId === selectedId}
              onClick={() => { onSelect(d.deviceId); setOpen(false); }}
            >
              {d.label || `${label} ${d.deviceId.slice(0, 8)}`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CallBar({
  peerLabel, duration, isMuted, onMute, onUnmute, onHangup, onNavigate,
  audioDevices = [], selectedInput, selectedOutput,
  onSwitchInput, onSwitchOutput,
}) {
  const inputDevices = audioDevices.filter(d => d.kind === "audioinput");
  const outputDevices = audioDevices.filter(d => d.kind === "audiooutput");
  const supportsSinkId = typeof HTMLMediaElement !== "undefined" &&
    typeof HTMLMediaElement.prototype.setSinkId === "function";

  return (
    <div className="call-bar" onClick={onNavigate}>
      <div className="call-bar-info">
        <span className="call-bar-label">{peerLabel}</span>
        <span className="call-bar-duration">{formatCallDuration(duration)}</span>
      </div>
      <div className="call-bar-actions" onClick={(e) => e.stopPropagation()}>
        <div className="callbar-action-group">
          <button
            className={`btn-icon call-bar-btn ${isMuted ? "call-bar-muted" : ""}`}
            onClick={isMuted ? onUnmute : onMute}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <IconMicOff size={16} /> : <IconMic size={16} />}
          </button>
          {inputDevices.length > 0 && (
            <DevicePicker
              devices={inputDevices}
              selectedId={selectedInput}
              onSelect={onSwitchInput}
              label="Microphone"
            />
          )}
        </div>

        {supportsSinkId && outputDevices.length > 0 && (
          <div className="callbar-action-group">
            <button className="btn-icon call-bar-btn" title="Speaker">
              <IconSpeaker size={16} />
            </button>
            <DevicePicker
              devices={outputDevices}
              selectedId={selectedOutput}
              onSelect={onSwitchOutput}
              label="Speaker"
            />
          </div>
        )}

        <button className="btn-icon call-bar-btn call-bar-end" onClick={onHangup} title="End call">
          <IconPhoneOff size={16} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/CallBar.jsx
git commit -m "feat: device picker dropdowns in CallBar"
```

---

### Task 6: Update CallBar usage in App.jsx

**Files:**
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Pass device props to CallBar**

Find the `<CallBar` render in App.jsx (around line 563) and update it:

```jsx
{voiceCall.callState === "connected" && (
  <CallBar
    peerLabel={voiceCall.callPeer?.label}
    duration={voiceCall.callDuration}
    isMuted={voiceCall.isMuted}
    onMute={voiceCall.mute}
    onUnmute={voiceCall.unmute}
    onHangup={() => voiceCall.hangup()}
    onNavigate={() => handleSelectPeer(voiceCall.callPeer?.id)}
    audioDevices={voiceCall.audioDevices}
    selectedInput={voiceCall.selectedInput}
    selectedOutput={voiceCall.selectedOutput}
    onSwitchInput={voiceCall.switchInputDevice}
    onSwitchOutput={voiceCall.switchOutputDevice}
  />
)}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat: wire device selection props to CallBar"
```

---

### Task 7: Add CSS for device selectors

**Files:**
- Modify: `client/src/App.css`
- Modify: `desktop/src/App.css`

- [ ] **Step 1: Add styles to client/src/App.css**

Find the existing `.call-bar` styles. After the `.call-bar` block, add:

```css
/* ── Audio device pickers (CallBar) ── */

.callbar-action-group {
  display: flex;
  align-items: center;
  position: relative;
}

.callbar-device-trigger {
  width: 16px !important;
  height: 24px !important;
  padding: 0 !important;
  margin-left: -4px;
  opacity: 0.6;
}

.callbar-device-trigger:hover {
  opacity: 1;
}

.callbar-device-picker {
  position: relative;
}

.callbar-device-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 200px;
  max-width: 300px;
  background: var(--bg-secondary, #1e1e1e);
  border: 1px solid var(--border, #333);
  border-radius: 8px;
  padding: 4px 0;
  z-index: 100;
  box-shadow: var(--shadow-floating, 0 8px 32px rgba(0,0,0,0.5));
  animation: fadeSlideUp 0.15s ease;
}

.callbar-device-option {
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text-secondary, #aaa);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background 0.1s, color 0.1s;
}

.callbar-device-option:hover {
  background: var(--accent-8, rgba(57, 255, 20, 0.08));
  color: var(--text-primary, #e0e0e0);
}

.callbar-device-option.active {
  color: var(--accent, #39ff14);
  font-weight: 500;
}

/* ── Audio device select (Settings) ── */

.audio-device-select {
  width: 100%;
  font-size: 12px;
  margin-top: 4px;
}

.settings-label {
  display: block;
  font-size: 11px;
  color: var(--text-secondary, #aaa);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 2px;
}
```

- [ ] **Step 2: Copy the same styles to desktop/src/App.css**

Add the exact same CSS block to `desktop/src/App.css`, in the same location (after the `.call-bar` styles).

- [ ] **Step 3: Commit**

```bash
git add client/src/App.css desktop/src/App.css
git commit -m "style: audio device picker and settings styles"
```

---

### Task 8: Manual testing

- [ ] **Step 1: Test Settings — Audio section**

1. Run `cd client && npm run dev`
2. Log in, open Settings
3. Verify "Audio" section appears between Privacy and Theme
4. If microphone permission not granted: verify "Grant Microphone Access" button appears and works
5. After permission granted: verify Microphone and Speaker dropdowns show device labels
6. Select a non-default device, close and reopen Settings — verify selection persists

- [ ] **Step 2: Test CallBar — mid-call device switching**

1. Start a call between two clients
2. Verify CallBar shows chevron dropdown next to mic icon (only if >1 input device)
3. Click chevron — verify dropdown lists input devices with current highlighted
4. Switch to a different mic — verify audio continues on new device
5. If `setSinkId` supported: verify speaker icon + dropdown appears when >1 output device
6. Switch output device — verify audio plays through new speaker

- [ ] **Step 3: Test edge cases**

1. Unplug a device mid-call — verify graceful fallback to default
2. Plug in new device — verify it appears in dropdown
3. Set a preferred device, unplug it, start a new call — verify call uses default (no error)

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: audio device selection — settings + mid-call switching"
```
