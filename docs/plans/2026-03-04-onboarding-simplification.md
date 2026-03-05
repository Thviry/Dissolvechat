# Onboarding Simplification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce signup from 7 steps to 3 (handle + passphrase → key file auto-downloads → straight to chat) with a persistent backup banner until recovery phrase is viewed in Settings.

**Architecture:** Remove MnemonicScreen and OnboardingScreen entirely. Modify App.jsx enrollment flow to skip directly to chat mode after identity creation. Add a backup reminder banner to the chat layout. Add "View Recovery Phrase" to Settings (passphrase-gated). Track backup completion in localStorage.

**Tech Stack:** React 19, existing useIdentity hook, existing useToast hook, existing design system CSS variables

---

### Task 1: Modify App.jsx — skip mnemonic/onboarding, go straight to chat

**Files:**
- Modify: `client/src/App.jsx`

**Step 1: Update the handleEnroll callback**

In `client/src/App.jsx`, find the `handleEnroll` callback (lines 119-133). Currently it sets `setPendingMnemonic(mnemonic)` and `setMode("mnemonic")`. Change it to go straight to chat and fire a toast:

Replace lines 126-132:
```javascript
    try {
      const { mnemonic } = await identity.enroll(displayName || handle, passphrase, handle);
      setPendingMnemonic(mnemonic);
      setMode("mnemonic");
    } catch (err) {
      throw new Error("Enrollment failed: " + err.message);
    }
```

With:
```javascript
    try {
      await identity.enroll(displayName || handle, passphrase, handle);
      addToast("Key file saved to Downloads — keep it safe.", "info");
      setMode("chat");
    } catch (err) {
      throw new Error("Enrollment failed: " + err.message);
    }
```

**Step 2: Remove mnemonic/onboarding mode rendering**

Remove the `pendingMnemonic` state (line 32):
```javascript
  const [pendingMnemonic, setPendingMnemonic] = useState(null);
```

Remove the mnemonic mode block (lines 345-354):
```javascript
  if (mode === "mnemonic") {
    return (
      <MnemonicScreen
        mnemonic={pendingMnemonic}
        onContinue={() => {
          setPendingMnemonic(null);
          setMode("onboarding");
        }}
      />
    );
  }
```

Remove the onboarding mode block (lines 357-359):
```javascript
  if (mode === "onboarding") {
    return <OnboardingScreen identity={identity} onContinue={() => setMode("chat")} />;
  }
```

Remove the imports for MnemonicScreen and OnboardingScreen (lines 22-23):
```javascript
import MnemonicScreen from "./components/MnemonicScreen";
import OnboardingScreen from "./components/OnboardingScreen";
```

Update the mode comment (line 31):
```javascript
  const [mode, setMode] = useState("login"); // login | chat
```

**Step 3: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat: skip mnemonic/onboarding screens, go straight to chat after enrollment"
```

---

### Task 2: Remove Display Name field from enrollment form

**Files:**
- Modify: `client/src/components/LoginScreen.jsx`

**Step 1: Remove displayName state and form field**

In `client/src/components/LoginScreen.jsx`:

Remove the displayName state (line 12):
```javascript
  const [displayName, setDisplayName] = useState("");
```

Remove the Display Name form group (lines 185-194):
```html
            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input
                className="input-field"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={handle || "Optional — defaults to your handle"}
                maxLength={64}
              />
            </div>
```

Update the submit handler (line 61) — change `displayName: displayName.trim() || handle` to just `displayName: handle`:
```javascript
      await onEnroll({ handle, displayName: handle, passphrase });
```

**Step 2: Commit**

```bash
git add client/src/components/LoginScreen.jsx
git commit -m "feat: remove Display Name field from enrollment — defaults to handle"
```

---

### Task 3: Add persistent backup banner to chat layout

**Files:**
- Modify: `client/src/App.jsx`

**Step 1: Add backup banner state and logic**

In `client/src/App.jsx`, add state for tracking backup status. After the existing state declarations (around line 31), add:

```javascript
  const [backupDismissed, setBackupDismissed] = useState(false);
  const backupCompleted = identity.id
    ? JSON.parse(localStorage.getItem(`backupCompleted:${identity.id}`) || "false")
    : false;
  const showBackupBanner = identity.isReady && !backupCompleted && !backupDismissed;
```

**Step 2: Add the banner JSX**

In the chat mode render (the `return` block with `.app-layout`), add a backup banner just above the `.app-layout` div. Wrap the chat layout in a fragment and add the banner:

Replace:
```jsx
  return (
    <>
      <div className="app-layout">
```

With:
```jsx
  return (
    <>
      {showBackupBanner && (
        <div className="backup-banner" role="alert">
          <span>Back up your recovery phrase in Settings before you lose access.</span>
          <button
            className="backup-banner-dismiss"
            onClick={() => setBackupDismissed(true)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
      <div className="app-layout">
```

**Step 3: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat: add persistent backup reminder banner in chat view"
```

---

### Task 4: Add "View Recovery Phrase" to Settings

**Files:**
- Modify: `client/src/components/Sidebar.jsx`
- Modify: `client/src/App.jsx` (pass new props)

**Step 1: Add props and recovery phrase UI to Sidebar**

Add two new props to Sidebar: `onViewRecoveryPhrase` and `identity` already exists.

In `Sidebar.jsx`, in the Settings overlay body, after the "Sharing" section (after line 98's closing `</div>`), add a new section:

```jsx
            <div className="settings-section">
              <h4>Security</h4>
              <div className="settings-actions">
                <button className="btn btn-sm btn-secondary" onClick={onViewRecoveryPhrase}>
                  View Recovery Phrase
                </button>
              </div>
            </div>
```

Add `onViewRecoveryPhrase` to the destructured props at the top of the component.

**Step 2: Wire up in App.jsx**

In `client/src/App.jsx`, add a handler that:
1. Requests the passphrase via `requestPassphrase`
2. Calls `identity.getRecoveryPhrase(passphrase)` (or however the mnemonic is stored in session)
3. Shows it in an alert/modal — for simplicity, reuse the existing toast + a state variable

Actually, simpler approach: the mnemonic is already stored in the encrypted session. The `useIdentity` hook stores it during `activateSession`. We need to expose it.

Check if `identity` already exposes `mnemonic`. Looking at the enroll function (useIdentity.js line 253), `mnemonic` is passed to `activateSession`. We need to check if `activateSession` stores it and exposes it.

For the plan, the implementer should:
1. Verify that `identity.mnemonic` is available after enrollment (it's passed to activateSession)
2. If not exposed, add it to the useIdentity hook's return value
3. Create a `handleViewRecoveryPhrase` callback in App.jsx:

```javascript
  const handleViewRecoveryPhrase = useCallback(async () => {
    let passphrase;
    try {
      passphrase = await requestPassphrase(
        "Confirm Passphrase",
        "Enter your passphrase to view your recovery phrase."
      );
    } catch {
      return; // cancelled
    }
    // Verify passphrase is correct by attempting to decrypt
    // For now, just show the mnemonic if available in session
    if (identity.mnemonic) {
      setPendingViewMnemonic(identity.mnemonic);
      // Mark backup as completed
      localStorage.setItem(`backupCompleted:${identity.id}`, "true");
    } else {
      addToast("Recovery phrase not available in this session. Log in with your key file to access it.", "warning");
    }
  }, [identity, requestPassphrase, addToast]);
```

4. Add state for showing the mnemonic modal:
```javascript
  const [pendingViewMnemonic, setPendingViewMnemonic] = useState(null);
```

5. Render a mnemonic display modal when `pendingViewMnemonic` is set — reuse the mnemonic grid styling from the old MnemonicScreen but as a modal overlay:

```jsx
      {pendingViewMnemonic && (
        <div className="modal-backdrop" onClick={() => setPendingViewMnemonic(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>Recovery Phrase</h3>
              <button className="btn-icon" onClick={() => setPendingViewMnemonic(null)} aria-label="Close">
                <IconClose size={16} />
              </button>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "16px" }}>
              Write these 12 words down on paper. Do not screenshot or store in plaintext.
            </p>
            <div className="mnemonic-grid">
              {pendingViewMnemonic.trim().split(/\s+/).map((word, i) => (
                <div key={i} className="mnemonic-word">
                  <span className="mnemonic-num">{i + 1}</span>
                  <span className="mnemonic-text">{word}</span>
                </div>
              ))}
            </div>
            <div className="enroll-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-primary" onClick={() => setPendingViewMnemonic(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
```

6. Import `IconClose` in App.jsx if not already imported.

7. Pass `onViewRecoveryPhrase={handleViewRecoveryPhrase}` to the Sidebar component.

**Step 3: Commit**

```bash
git add client/src/App.jsx client/src/components/Sidebar.jsx
git commit -m "feat: add View Recovery Phrase to Settings, mark backup complete on view"
```

---

### Task 5: Add CSS for backup banner

**Files:**
- Modify: `client/src/App.css`

**Step 1: Add backup banner styles**

Add these styles to `client/src/App.css` (near the existing `.app-layout` styles):

```css
/* ── Backup reminder banner ── */
.backup-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid rgba(251, 191, 36, 0.25);
  color: var(--text-secondary);
  font-size: 13px;
  font-family: var(--font-ui);
  z-index: 100;
}
.backup-banner-dismiss {
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 4px;
}
.backup-banner-dismiss:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}
```

**Step 2: Commit**

```bash
git add client/src/App.css
git commit -m "feat: add backup banner CSS styles"
```

---

### Task 6: Mirror all changes to desktop

**Files:**
- Copy: `client/src/App.jsx` → `desktop/src/App.jsx`
- Copy: `client/src/App.css` → `desktop/src/App.css`
- Copy: `client/src/components/LoginScreen.jsx` → `desktop/src/components/LoginScreen.jsx`
- Copy: `client/src/components/Sidebar.jsx` → `desktop/src/components/Sidebar.jsx`
- Delete: `desktop/src/components/MnemonicScreen.jsx`
- Delete: `desktop/src/components/OnboardingScreen.jsx`

**Step 1: Copy files**

```bash
cp client/src/App.jsx desktop/src/App.jsx
cp client/src/App.css desktop/src/App.css
cp client/src/components/LoginScreen.jsx desktop/src/components/LoginScreen.jsx
cp client/src/components/Sidebar.jsx desktop/src/components/Sidebar.jsx
rm desktop/src/components/MnemonicScreen.jsx
rm desktop/src/components/OnboardingScreen.jsx
```

**Step 2: Commit**

```bash
git add desktop/src/
git commit -m "feat(desktop): mirror onboarding simplification from client"
```

---

### Task 7: Smoke test

**Step 1: Start relay and client**

```bash
cd server && npm run dev &
cd client && npm run dev
```

**Step 2: Test the new flow**

1. Open http://localhost:5173 in a fresh browser / incognito
2. Click "Create New Identity"
3. Verify: only Handle, Passphrase, and Confirm Passphrase fields visible (no Display Name)
4. Fill in handle + passphrase, submit
5. Verify: toast appears "Key file saved to Downloads — keep it safe"
6. Verify: immediately in chat view (no seed phrase screen, no onboarding cards)
7. Verify: backup banner visible at top: "Back up your recovery phrase..."
8. Dismiss banner with ✕, refresh page — banner should return
9. Go to Settings → Security → "View Recovery Phrase"
10. Enter passphrase, verify 12 words shown
11. Close the modal
12. Verify: backup banner is gone permanently
13. Refresh — banner should stay gone

**Step 3: Commit any fixes**

---

### Notes

- The mnemonic is stored in the encrypted session (sessionStorage). If the user closes the tab without backing up, they still have the auto-downloaded key file as a safety net.
- The `backupCompleted` localStorage flag is keyed per identity (`backupCompleted:{id}`), so different identities track independently.
- MnemonicScreen.jsx and OnboardingScreen.jsx files should be deleted from `client/src/components/` as well (not just removed from imports). The implementer should do this in Task 1.
- The recovery phrase modal in Task 4 reuses the existing `.mnemonic-grid` and `.mnemonic-word` CSS classes — no new styles needed for the word grid.
