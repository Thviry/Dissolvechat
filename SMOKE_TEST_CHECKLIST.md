# DissolveChat Smoke Test Checklist

Run through each test manually. Mark pass/fail. Both web (browser) and desktop (Tauri) clients should be tested.

**Prerequisites:**
- Server running (`cd server && npm start`)
- Web client open in browser (`cd client && npm run dev`)
- Desktop client open (`cd desktop && npm run tauri:dev`)

---

## 1. Enrollment

- [ ] **Web:** Create new identity (handle + passphrase) → keyfile downloads, lands in chat
- [ ] **Desktop:** Create new identity (different handle) → keyfile downloads, lands in chat
- [ ] **Duplicate handle:** Try enrolling with an already-taken handle → should show "Already taken"

## 2. Login

- [ ] **Web:** Log out, log back in with downloaded keyfile + passphrase → lands in chat
- [ ] **Desktop:** Log out, log back in with keyfile → lands in chat
- [ ] **Wrong passphrase:** Try logging in with wrong passphrase → should show error
- [ ] **Refresh persistence:** Refresh the browser while logged in → should stay logged in
- [ ] **Tab close:** Close browser tab, reopen → should be logged out

## 3. Discoverability & Handle Lookup

- [ ] **Enable discoverability** on one client (Settings → toggle on)
- [ ] **Look up handle** from the other client → should find the user
- [ ] **Send contact request** from lookup result → should say "Request sent"
- [ ] **Receive request** on the other client → should appear in Requests section
- [ ] **Accept request** → contact appears in both clients' contact lists

## 4. Messaging

- [ ] **Web → Desktop:** Send a message → appears on desktop
- [ ] **Desktop → Web:** Send a message → appears in browser
- [ ] **Rapid messages:** Send 5 messages quickly → all arrive in order
- [ ] **Long message:** Send a ~500 character message → arrives intact

## 5. Contact Sharing

- [ ] **Share modal:** Click "Share Contact" in settings → modal opens with 3 tabs
- [ ] **Copy link:** Copy the share link → paste in other client's browser URL bar → contact imports
- [ ] **Download file:** Download contact card JSON → import on other client → contact appears
- [ ] **QR code:** QR code renders (visual check only)

## 6. Blocking

- [ ] **Block a contact** → contact removed from list
- [ ] **Blocked user sends message** → message should not arrive (server returns 403)

## 7. System Tray (Desktop only)

- [ ] **Close window** → app hides to tray (not quit)
- [ ] **Tray → Show** → window reappears
- [ ] **Tray → Hide** → window hides
- [ ] **Tray → Quit** → app exits completely

## 8. Server Resilience

- [ ] **Restart server** while clients are connected → clients reconnect and resume
- [ ] **Send while server is down** → error message (not a crash)

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

Date tested: ___________
Tester: ___________
Version: v5.14
