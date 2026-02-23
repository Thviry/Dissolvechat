# DissolveChat Smoke Test Checklist

Run through each test manually. Mark pass/fail. Both web (browser) and desktop (Tauri) clients should be tested.

**Prerequisites:**
- Server running (`cd server && npm start`)
- Web client open in browser (`cd client && npm run dev`)
- Desktop client open (`cd desktop && npm run tauri:dev`)

---

## 1. Enrollment

- [ p] **Web:** Create new identity (handle + passphrase) → keyfile downloads, lands in chat
- [ p] **Desktop:** Create new identity (different handle) → keyfile downloads, lands in chat
- [ f] **Duplicate handle:** Try enrolling with an already-taken handle → should show "Already taken"

## 2. Login

- [ p] **Web:** Log out, log back in with downloaded keyfile + passphrase → lands in chat
- [ p] **Desktop:** Log out, log back in with keyfile → lands in chat
- [ p] **Wrong passphrase:** Try logging in with wrong passphrase → should show error
- [ p] **Refresh persistence:** Refresh the browser while logged in → should stay logged in
- [ p] **Tab close:** Close browser tab, reopen → should be logged out

## 3. Discoverability & Handle Lookup

- [ p] **Enable discoverability** on one client (Settings → toggle on)
- [ p] **Look up handle** from the other client → should find the user
- [ p] **Send contact request** from lookup result → should say "Request sent"
- [ p] **Receive request** on the other client → should appear in Requests section
- [ p] **Accept request** → contact appears in both clients' contact lists

## 4. Messaging

- [ p] **Web → Desktop:** Send a message → appears on desktop
- [ p] **Desktop → Web:** Send a message → appears in browser
- [ p] **Rapid messages:** Send 5 messages quickly → all arrive in order
- [ p] **Long message:** Send a ~500 character message → arrives intact

## 5. Contact Sharing

- [ p] **Share modal:** Click "Share Contact" in settings → modal opens with 3 tabs
- [ p] **Copy link:** Copy the share link → paste in other client's browser URL bar → contact imports
- [ p/f] **Download file:** Download contact card JSON → import on other client → contact appears
- [ p] **QR code:** QR code renders (visual check only)

## 6. Blocking

- [ f] **Block a contact** → contact removed from list
- [ f] **Blocked user sends message** → message should not arrive (server returns 403)

## 7. System Tray (Desktop only)

- [ f] **Close window** → app hides to tray (not quit)
- [ p] **Tray → Show** → window reappears
- [ f] **Tray → Hide** → window hides
- [ f] **Tray → Quit** → app exits completely

## 8. Server Resilience

- [ ] **Restart server** while clients are connected → clients reconnect and resume
- [ "Failed to fetch"] **Send while server is down** → error message (not a crash)

---

## Results

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| Enrollment | | | |
| Login | | | |
| Discoverability | | | |
| Messaging | | | |
| Contact Sharing | | | |
| Blocking | | | |
| System Tray | | | |
| Server Resilience | | | |

Date tested: _____2/22/2026______
Tester: __JONKY :/_________
Version: v5.14
