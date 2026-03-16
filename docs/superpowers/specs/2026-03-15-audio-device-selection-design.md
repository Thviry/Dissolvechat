# Audio Device Selection — Design Spec

## Overview

Add audio input (microphone) and output (speaker) device selection to DissolveChat voice calls. Users can set persistent defaults in Settings and switch devices mid-call from the CallBar.

## Motivation

Users with multiple audio devices (headphones, external mic, speakers) have no way to choose which device is used for calls. The app currently uses the system default for both input and output, which may not be the desired device.

## Design

### 1. Settings Panel — "Audio" Section

A new **Audio** section in the Settings overlay, placed between the Privacy and Theme sections.

**Contents:**
- **Microphone** — `<select>` dropdown listing available audio input devices
- **Speaker** — `<select>` dropdown listing available audio output devices
- Each list includes a "Default" option at the top (uses system default, value `""`)
- Device labels come from `navigator.mediaDevices.enumerateDevices()`, filtered by `kind === "audioinput"` / `kind === "audiooutput"`

**Storage:**
- localStorage key: `audioDevices:{identityId}`
- Value: `{ inputId: string, outputId: string }` (JSON)
- Empty string `""` means "use system default"

**Permission gating:**
- `enumerateDevices()` returns device IDs but not labels until `getUserMedia` permission is granted
- If labels are empty (permission not yet granted), show a "Grant microphone access" button that calls `getUserMedia({ audio: true })` then re-enumerates
- After permission is granted, labels populate automatically

**Device change listener:**
- Listen for `navigator.mediaDevices.addEventListener('devicechange', ...)` to refresh the device list when devices are plugged/unplugged
- If the currently selected device disappears, reset selection to "Default"

### 2. CallBar — In-Call Device Switching

**Microphone picker:**
- Small dropdown caret/arrow next to the existing mute/unmute mic button
- Clicking opens a dropdown listing available input devices
- Selected device highlighted; clicking another device switches immediately

**Speaker picker:**
- New speaker icon with dropdown caret next to the hangup button
- Same dropdown pattern as microphone picker
- Only shown if `HTMLMediaElement.prototype.setSinkId` is available (not supported in Firefox)

**Mid-call switching mechanics:**

*Input (microphone):*
1. Call `getUserMedia({ audio: { deviceId: { exact: newDeviceId } } })`
2. Get the new audio track from the stream
3. Find the audio sender on the RTCPeerConnection via `pc.getSenders()`
4. Call `sender.replaceTrack(newTrack)` — no renegotiation needed
5. Stop the old track
6. Update the saved preference in localStorage

*Output (speaker):*
1. Call `remoteAudioElement.setSinkId(newDeviceId)`
2. Update the saved preference in localStorage

### 3. Hook Changes — `useVoiceCall.js`

**New state/refs:**
- `audioDevices` — list of `{ deviceId, label, kind }` from `enumerateDevices()`
- `selectedInput` / `selectedOutput` — current device IDs

**Modified behavior:**
- `getUserMedia` call uses saved `inputId` preference: `{ audio: { deviceId: { exact: savedInputId } } }` (omit `exact` constraint if `""` / default)
- After call connects, apply saved `outputId` via `setSinkId()` on the remote audio element
- Expose `switchInputDevice(deviceId)` and `switchOutputDevice(deviceId)` functions
- Listen for `devicechange` events; if active device disappears mid-call, fall back to default and refresh device list

**Fallback behavior:**
- If the saved device ID fails (device unplugged since last use), catch the error and fall back to default device
- Log a warning but don't block the call

### 4. Component Changes

**`Sidebar.jsx`:**
- New "Audio" section with two `<select>` elements
- Reads/writes `audioDevices:{identityId}` from localStorage
- "Grant microphone access" button when labels are unavailable
- Device list refreshes on `devicechange` event

**`CallBar.jsx`:**
- Dropdown menus on mic icon and speaker icon
- Receives `audioDevices`, `selectedInput`, `selectedOutput`, `switchInputDevice`, `switchOutputDevice` as props from parent
- Dropdown closes on outside click or device selection
- Highlight currently active device

**`App.jsx`:**
- Pass new voice call props down to CallBar
- Apply `setSinkId()` on the remote `<audio>` ref when output device changes

**`App.css` (both client and desktop):**
- `.audio-device-select` — styled `<select>` for Settings
- `.callbar-device-picker` — dropdown container on CallBar
- `.callbar-device-option` — individual device option
- `.callbar-device-option.active` — highlight for current device
- `.callbar-device-trigger` — the clickable caret/icon button

### 5. Edge Cases

| Scenario | Behavior |
|----------|----------|
| No microphone available | Call button disabled, tooltip explains |
| Saved device unplugged before call | Fall back to default, log warning |
| Device unplugged mid-call | `devicechange` fires → fall back to default, refresh list, continue call |
| `setSinkId` not supported (Firefox) | Hide output device selector entirely (both Settings and CallBar) |
| Permission not yet granted | Settings shows "Grant microphone access" button; call flow requests permission naturally |
| Only one input/output device | Dropdown still shown but with one option (consistent UX) |

### 6. Files Modified

| File | Change |
|------|--------|
| `client/src/hooks/useVoiceCall.js` | Device enumeration, saved preferences, mid-call switching |
| `client/src/components/Sidebar.jsx` | New Audio settings section |
| `client/src/components/CallBar.jsx` | Device picker dropdowns |
| `client/src/App.jsx` | Pass device props to CallBar, setSinkId on audio element |
| `client/src/App.css` | New styles for device selectors |
| `desktop/src/App.css` | Mirror new styles |

### 7. Out of Scope

- Audio quality/bitrate settings
- Noise suppression / echo cancellation toggles (browser defaults are fine)
- Audio level meters / volume controls
- Video device selection
- Device selection for ringtone output (uses same output device as call)
