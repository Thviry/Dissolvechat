# Visual Polish Overhaul — Design Spec

**Date**: 2026-03-15
**Goal**: Transform Dissolve from functional-but-flat to visually appealing and alive. Every surface of the app gets depth, animation, and intentional polish so it feels like a premium product worth recommending to friends.

**Scope**: Full overhaul — empty state, message bubbles, sidebar, login screen, settings, modals, toasts, error states, animations.

**Files affected**:
- `client/src/App.css` (primary — all CSS changes, new design tokens)
- `desktop/src/App.css` (mirror all CSS changes)
- `client/src/App.jsx` (pass identity, contacts, groups props to ChatPanel)
- `desktop/src/App.jsx` (same prop updates as client App.jsx)
- `client/src/components/ChatPanel.jsx` (empty state rewrite, bubble markup, animation classes, grouped message classes)
- `client/src/components/Sidebar.jsx` (contact row markup, timestamps, empty states, relative time formatting)
- `client/src/components/LoginScreen.jsx` (animation on mount)
- `client/src/components/CreateGroupModal.jsx` (modal animation classes)
- `client/src/components/GroupInfoPanel.jsx` (modal animation classes)
- `client/src/components/PassphraseModal.jsx` (modal animation classes)
- `client/src/components/ShareModal.jsx` (modal animation classes)
- `client/src/components/LinkDeviceModal.jsx` (modal animation classes)
- `client/src/components/Toast.jsx` (slide-in animation)
- `client/src/components/EmojiPicker.jsx` (fade-in animation, NOT modal-style — positioned dropdown)

---

## 1. Design Language Upgrade

### Depth System
Three elevation layers applied consistently:
- **Flat**: Sidebar background, chat background (`var(--bg-primary)`, no shadow)
- **Raised**: Bubbles, contact rows on hover, cards (`box-shadow: 0 2px 12px rgba(0,0,0,0.2)`)
- **Floating**: Modals, overlays, dropdowns (`box-shadow: 0 12px 52px rgba(0,0,0,0.8)`)

### Gradients
Replace flat `rgba` backgrounds with `linear-gradient(135deg, ...)` on all interactive elements:
- Bubbles, avatars, buttons, cards, modal backgrounds
- Gradients are subtle (5-10% opacity variance) — not colorful, just dimensional

### Theme-Aware Accent Colors
The codebase already uses `color-mix()` (e.g., toast backgrounds). All accent-derived colors must use `color-mix(in srgb, var(--accent) N%, transparent)` instead of hardcoded `rgba(57,255,20,...)`. New design tokens to add to `:root` and each theme:

```css
--accent-12: color-mix(in srgb, var(--accent) 12%, transparent);
--accent-6: color-mix(in srgb, var(--accent) 6%, transparent);
--accent-4: color-mix(in srgb, var(--accent) 4%, transparent);
--accent-15: color-mix(in srgb, var(--accent) 15%, transparent);
--accent-gradient-from: color-mix(in srgb, var(--accent) 12%, transparent);
--accent-gradient-to: color-mix(in srgb, var(--accent) 4%, transparent);
--accent-glow-sm: 0 0 6px color-mix(in srgb, var(--accent) 40%, transparent);
--accent-glow-md: 0 2px 12px color-mix(in srgb, var(--accent) 6%, transparent);
--accent-border-15: color-mix(in srgb, var(--accent) 15%, transparent);
```

These tokens are theme-aware automatically since they derive from `var(--accent)`.

### Glow Accents
Elements that use accent glow (`var(--accent-glow-sm)`):
- Unread badges
- Presence dots
- Active contact state
- Primary buttons on hover
- Focus rings on inputs

### Border Refinement
- Remove hard borders where shadow provides enough separation
- Keep borders on inputs and subtle dividers
- Modal borders → remove, rely on shadow

### Radius Updates
Add new token: `--radius-bubble: 16px` (no existing token matches 16px).

- Message bubbles: asymmetric `var(--radius-sm)`/`var(--radius-bubble)` (flat on sender side, round on other)
- Grouped messages: `var(--radius-sm)` on connecting edges for stacked feel
- Avatars: remain circular (50%)
- Group avatars: rounded square (8px)
- Modals: 12px
- Buttons: keep existing

---

## 2. Animations

### Global Baseline
Interactive elements get specific property transitions (not `transition: all` which can cause issues with height/width changes on textarea, scroll performance, etc.):
- Buttons, contact rows: `transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease`
- Inputs: `transition: border-color 0.15s ease, box-shadow 0.15s ease`

### Reduced Motion
Add `@media (prefers-reduced-motion: reduce)` block that disables all animations and transitions for accessibility. Set all animation durations to 0ms and transition durations to 0ms.

### Message Animations
- **Incoming arrive** (`fadeSlideUp`): `translateY(8px) → 0`, `opacity: 0 → 1`, 200ms ease-out
- **Outgoing send** (`scalePop`): `scale(0.95) → 1.0`, `opacity: 0 → 1`, 180ms `cubic-bezier(0.34, 1.56, 0.64, 1)`
- Only animate messages not already rendered (use existing `seenRef` mechanism in ChatPanel)

### View Transitions
- **Contact switch**: Chat panel crossfade, 150ms
- **Settings open**: Slide-in from left (`translateX(-100%) → 0`), 200ms ease-out (settings renders inside sidebar, which is on the left)
- **Modal open**: Backdrop fade (150ms) + body scale-up (`scale(0.95) → 1.0`, 200ms)
- **Modal close**: Reverse — scale down + fade out
- **Profile panel**: Same slide-in as settings

### Micro-interactions
- **Hover states**: Smooth background transition on sidebar contacts (already exists, keep)
- **Toggle switches**: Brief scale bounce on toggle (1.0 → 1.1 → 1.0, 150ms)
- **Copy message**: Checkmark fades in/out instead of instant swap
- **Scroll-to-bottom FAB**: Fade + scale on appear/disappear
- **Toast**: Slide in from top-right, slide out on dismiss

### Empty State Entrance
- Staggered fade-in: avatar (0ms) → handle (80ms) → stats (160ms) → tags (240ms) → motto (320ms)
- Each element: `opacity: 0 → 1`, `translateY(6px) → 0`, 200ms ease-out

### Login Screen
- Fade-in on mount: `opacity: 0 → 1`, 300ms

---

## 3. Sidebar Overhaul

### Header
- Avatar: 40px with gradient + shadow, clickable for profile panel
- Handle: Inter medium weight
- Subtle separator below

### Contact Rows
- Avatar: 36px, `linear-gradient(135deg, ...)` using existing `idToHue()`, `box-shadow: 0 2px 8px rgba(0,0,0,0.3)`
- Presence dot: 10px, accent glow `box-shadow: 0 0 6px rgba(57,255,20,0.4)`, 2px border matching sidebar bg
- Timestamp: right-aligned, JetBrains Mono 9px, tertiary color (relative: "9:42 PM", "Yesterday", "2d ago")
- Message preview: 11px, secondary color, truncated with ellipsis
- Group previews show sender: "alice: pushed the new build"
- Active: left border 2px accent + `rgba(57,255,20,0.04)` background
- Unread badge: `linear-gradient(135deg, #39ff14, #32e612)`, glow shadow, bold count, dark text

### Empty States
- "No contacts yet" → subtle person-outline icon in accent + "Look up a handle to start chatting"
- "No groups yet" → similar with group icon + "Create a group to chat with multiple people"

### Group Avatars
- Rounded square (8px radius) instead of circle
- Accent-tinted gradient background

### Timestamps on Contact Rows
Add timestamp data to sidebar. Source: `lastMessages` already has the message object — extract `ts` field and format as relative time ("9:42 PM" for today, "Yesterday", "Mon", or "Mar 5" for older). Create a `formatRelativeTime(ts)` helper — can extend the existing `formatDateChip()` in ChatPanel.jsx (lines 11-27) which does similar logic, or create a shared utility in `client/src/utils/`.

---

## 4. Message Bubbles & Chat Area

### Incoming Bubbles
```css
background: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
border: 1px solid rgba(255,255,255,0.08);
border-radius: 4px 16px 16px 4px;
box-shadow: 0 2px 12px rgba(0,0,0,0.2);
```

### Outgoing Bubbles
```css
background: linear-gradient(135deg, rgba(57,255,20,0.12), rgba(57,255,20,0.04));
border: 1px solid rgba(57,255,20,0.15);
border-radius: 16px 4px 4px 16px;
box-shadow: 0 2px 12px rgba(57,255,20,0.06);
```
**Design identity change**: Remove the current `border-right: 2px solid var(--accent)` on outgoing. This was a v3 "Terminal" signature element, but with the new gradient + glow treatment, the accent border becomes visually redundant. The outgoing gradient itself now serves as the brand differentiator — this is an intentional evolution from v3 → v4.

### Grouped Messages
Consecutive same-sender within 2min: connecting edges use 4px radius instead of 16px for a stacked feel. The existing grouping logic in ChatPanel uses a boolean `.grouped` class. Extend this to compute position: add `.msg-group-first` (has gap above, flat bottom-edge on sender side), `.msg-group-middle` (flat top and bottom on sender side), `.msg-group-last` (flat top-edge on sender side). The JSX grouping logic (ChatPanel lines ~237-258) needs to be extended: track previous and next message sender to determine first/middle/last position, then apply the appropriate class alongside `.grouped`.

### Timestamps & Status
- Below outgoing: JetBrains Mono 9px, right-aligned, "9:42 PM · Delivered"
- Delivery status icons: accent color when delivered, tertiary when pending/sending

### Chat Header
- Avatar: 28px with gradient treatment
- Name: Inter medium
- Bottom border: gradient fade (solid center, transparent edges) using `linear-gradient(90deg, transparent, var(--border), transparent)`

### Chat Input Area
- Top border: gradient fade matching header
- Focus glow: `box-shadow: 0 0 0 2px rgba(57,255,20,0.15)`
- Send button: accent gradient background with glow on hover

---

## 5. Empty State — Identity Hub

Displayed in chat panel when no conversation is selected.

### Layout (centered)
- Avatar: 72px, gradient + shadow, `border: 2px solid rgba(57,255,20,0.15)`
- Handle: Inter 16px medium, primary text color
- Stats: "3 contacts · 2 groups" — JetBrains Mono 11px, tertiary
- Tag pills: "Encrypted" (accent-tinted bg + border), "P2P" (neutral), "Anonymous" (neutral) — IBM Plex Mono 9px uppercase
- Background: keep subtle grid pattern + add soft radial glow pulse animation (4s ease-in-out infinite)
- Motto: "Power to the user, not the platform." — Inter 12px, tertiary, opacity 0.4

### Data Sources
- Avatar color: from `profile:{identityId}` localStorage (existing)
- Handle: `identity.handle`
- Contact count: `contacts.length`
- Group count: `groups.length`
- Props needed in ChatPanel: `identity`, `contacts`, `groups` (contacts/groups just for `.length`)

---

## 6. Login Screen

- Input fields: gradient + shadow treatment on focus
- Primary buttons: `linear-gradient(135deg, #39ff14, #32e612)` with glow on hover
- Fade-in on mount: opacity 0 → 1, 300ms
- Dissolve wordmark area: add gentle radial glow pulse behind it

---

## 7. Settings Panel

- **Open**: Slide-in from left (`translateX(-100%) → 0`, 200ms ease-out) — settings renders inside the sidebar which is on the left
- **Close**: Reverse slide-out to left
- Section headers: subtle left accent bar (2px, accent at 20% opacity)
- Toggle switches: scale bounce on toggle (1.0 → 1.1 → 1.0, 150ms)
- Action buttons: gradient treatment matching primary buttons

---

## 8. Modals

Applies to: CreateGroupModal, GroupInfoPanel, PassphraseModal, ShareModal, LinkDeviceModal. (EmojiPicker is a positioned dropdown, not a modal — it gets a simple fade-in, handled separately in its component.)

- **Backdrop**: fade-in `opacity: 0 → 1`, 150ms
- **Body**: `scale(0.95) → 1.0` + `opacity: 0 → 1`, 200ms
- **Close**: Add `exiting` state + 150ms timeout before unmount (same pattern as existing Toast.jsx `toast-exiting` class). Apply reverse scale-down + fade-out during the exit delay.
- Border radius: 12px
- Background: `linear-gradient(180deg, #1a1a1a, #141414)`
- Remove hard borders, rely on shadow

---

## 9. Toasts

- **Enter**: Keep existing subtle slide (`translateX(12px) scale(0.96) → identity`) but make it slightly more pronounced: `translateX(20px) scale(0.96) → identity`, 200ms
- **Exit**: Reverse slide out, 150ms
- Success: green left border (2px solid var(--accent))
- Error: red left border (2px solid var(--danger))
- Add subtle shadow for depth

---

## 10. Error & Empty States

- "Cannot send — no inbox capability" → "Waiting for connection..."
- File send failures: friendlier copy + subtle warning icon
- Connection issues: softer language throughout
- All empty states get a subtle icon + helpful action text (not just "No X yet")

---

## 11. Theme Compatibility

All changes must work across all 5 themes (Terminal, Ocean, Forest, Ember, Violet). Key considerations:
- Gradients use `var(--accent)` derivatives, not hardcoded green
- Glow shadows use accent color variables
- Test each theme after implementation
- The `rgba(57,255,20,...)` values in gradients must be replaced with theme-aware equivalents where they reference the accent color

---

## 12. Desktop Sync

All CSS changes go in both `client/src/App.css` and `desktop/src/App.css`. Component changes only in `client/src/components/` (desktop shares via Vite alias). Desktop `App.jsx` may need prop updates if new data is passed to ChatPanel (identity, contacts.length, groups.length for empty state).
