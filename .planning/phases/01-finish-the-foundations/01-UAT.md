---
status: complete
phase: 01-finish-the-foundations
source: 01-01-SUMMARY.md, 01-02-SUMMARY.md
started: 2026-03-01T18:10:00Z
updated: 2026-03-01T18:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. E2EE Round-Trip
expected: Send a message to a contact. The message should arrive correctly on the receiving end — no garbled text, no decryption error. Both short messages (under 512 bytes) and longer ones should work.
result: pass
note: Verified locally via Node.js crypto.subtle — 5/5 cases passed (short, medium, boundary, overflow, unicode). Ciphertext sizes exactly match expected buckets.

### 2. Ciphertext Size Bucketing
expected: In the browser DevTools Network tab, WebSocket frames carrying encrypted messages should show uniform payload sizes — a short "hi" and a medium paragraph should produce the same-sized ciphertext (both padded to the 512-byte bucket, so ~528 bytes with the AES-GCM tag).
result: pass
note: Verified locally — "hi" (2 bytes) and "x"×300 (300 bytes) both produce 528-byte ciphertext. "b"×600 steps up to 1040-byte ciphertext. Bucketing confirmed.

### 3. App Connects and Reconnects
expected: The app connects to the relay on load. If you temporarily disable/re-enable your network or close/reopen the tab, the app reconnects automatically within a few seconds (WS_RECONNECT_DELAY_MS = 3s). No manual page refresh needed.
result: pass

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
