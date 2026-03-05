# Onboarding Simplification Design

**Date:** 2026-03-04
**Status:** Approved

## Problem

The current signup flow has 7 steps before a user can send their first message: create identity form (5 fields), seed phrase backup gate (mandatory), and a 4-card onboarding explainer. This causes dropoff. The goal is to get users chatting in ~30 seconds.

## New Signup Flow (3 steps → chat)

### Step 1: Handle + Passphrase form (single screen)

- **Handle** (required, min 2 chars, availability check, lowercase `[a-z0-9_-]`)
- **Passphrase** (required, min 4 chars, with reveal toggle)
- **Confirm Passphrase** (required, must match)
- **Display Name field removed** — defaults to handle. Users can change it later in Settings.
- Submit button: "Create Identity"

### Step 2: Key file auto-downloads silently

- Identity generated (BIP39 mnemonic + derived keys, same crypto as today)
- `.usbkey.json` file auto-downloads to user's Downloads folder
- Toast notification appears: "Key file saved to Downloads — keep it safe."
- Toast auto-dismisses after 5 seconds
- No blocking screen, no user action required

### Step 3: Straight to chat

- User lands directly in the chat view
- No MnemonicScreen
- No OnboardingScreen

## Deferred Backup Nudge

### Persistent banner

- Appears at top of the chat view after signup
- Text: "Back up your recovery phrase in Settings before you lose access."
- Has a dismiss button (X) but returns on next session
- **Disappears permanently** once the user views their recovery phrase in Settings
- Tracked via `localStorage` flag: `backupCompleted: true`

### Recovery phrase in Settings

- New option in Settings: "View Recovery Phrase"
- Requires passphrase confirmation before revealing (security gate)
- Shows the same 12-word grid as the old MnemonicScreen
- Once viewed, sets `backupCompleted` flag → banner disappears forever

## What Gets Removed

- **MnemonicScreen.jsx** — the blocking seed phrase gate (screen deleted)
- **OnboardingScreen.jsx** — the 4-card explainer (screen deleted)
- **App.jsx modes** — remove `"mnemonic"` and `"onboarding"` modes
- **Display Name field** from enrollment form

## What Moves to Settings

- "View Recovery Phrase" (new Settings section)
- The educational content from OnboardingScreen can optionally become a "How Dissolve Works" link or Help section (low priority, can defer)

## Toast Component

- New lightweight toast component (or inline notification)
- Positioned top-right or bottom-right of viewport
- Auto-dismisses after 5 seconds
- Styled consistently with the existing design system (tertiary bg, accent border)

## Files Changed

- `client/src/App.jsx` — remove mnemonic/onboarding modes, skip straight to chat after enroll
- `client/src/components/LoginScreen.jsx` — remove Display Name field from enroll form
- `client/src/components/MnemonicScreen.jsx` — delete file
- `client/src/components/OnboardingScreen.jsx` — delete file
- `client/src/components/ChatPanel.jsx` (or similar) — add persistent backup banner
- `client/src/components/Sidebar.jsx` — add "View Recovery Phrase" to Settings
- `client/src/components/Toast.jsx` — new toast component
- `client/src/App.css` — styles for toast and backup banner
- `client/src/hooks/useIdentity.js` — store mnemonic for deferred access, expose it via Settings
- Desktop mirror: all changes copied to `desktop/src/`

## Security Considerations

- The mnemonic must still be stored in memory/session so Settings can reveal it later
- "View Recovery Phrase" in Settings is gated behind passphrase re-entry
- Key file still auto-downloads as a safety net even if user ignores the banner
- No reduction in cryptographic security — only UX flow changes
