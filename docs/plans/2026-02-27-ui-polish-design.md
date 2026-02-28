# Dissolve Chat — UI Polish Design
**Date:** 2026-02-27
**Worktree:** `.claude/worktrees/admiring-almeida/client/`
**Direction:** Distinctive / editorial — dark minimal base, experimental, protocol-identity aesthetic

---

## Goal

Transform the v5 client UI from functional-but-rough into a polished, finished product ready for real users. Approach: Component Redesign (Option B) — substantially rebuild layouts, add micro-animations, replace emoji icons with SVG, refine language, and tighten typography.

---

## Design Decisions

### Visual Direction
- Dark minimal base (keep existing color tokens)
- Lean into the protocol/crypto identity: monospace accents, uppercase tracking, editorial feel
- "Experimental but trustworthy" — not generic SaaS

### Tagline / Messaging
- Primary: **"Power to the user, not the platform."**
- Secondary: "Encrypted. Sovereign. No accounts."

---

## Section 1 — Login Screen

### Layout
- `DISSOLVE` wordmark: uppercase, `font-weight: 300`, `font-size: 40px`, `letter-spacing: 0.18em`
- Tagline block:
  - Line 1: "Power to the user, not the platform."
  - Line 2: "Encrypted. Sovereign. No accounts."
- Two full-width buttons (48px height): Create New Identity (primary), Load Key File (secondary)
- Hint text: `Select your dissolve-*.usbkey.json`
- Enrollment form: smooth slide-in via CSS `max-height` / `opacity` transition, same card

### Background
- Very subtle radial gradient from accent color at 3% opacity

---

## Section 2 — Sidebar

### Layout restructure
- **Identity row (pinned top):** compact — name + abbreviated ID + SVG icon buttons
- **Body (scrollable):**
  - Find-by-handle bar at top of body (always visible)
  - Section: CONTACTS (with left-accent-bar active indicator)
  - Section: REQUESTS (only when requests exist, with badge)
- **Settings:** slides in as full-sidebar overlay from left using `transform: translateX`
- **Footer:** Single line — `◇ Messages ephemeral · close tab to end session`

### Active contact indicator
- 2px left accent bar, animates from `width: 0` to `width: 2px` on activation (120ms ease)
- Active item: `background: var(--bg-active)`

### Section headers
- `font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-tertiary)`

---

## Section 3 — Chat Panel

### Header
- Contact name: 16px, weight 600
- Below: first 8 chars of ID + `…` in monospace — click-to-copy with toast feedback
- "No cap" replaced by: `● Awaiting connection` amber status chip with tooltip

### Message area
- Encrypted notice: SVG lock icon + `End-to-end encrypted` — shorter pill, centered
- Bubble grouping: consecutive messages from same sender get 2px gap (vs 6px), connector corner tightened
- Empty state (no peer selected): bold `Select a contact`, `◈` as 80px dim (3% opacity) background watermark

### Input area
- Send button: SVG arrow icon (no text label visible, aria-label="Send message")
- Disabled placeholder: `Request contact information first` (replaces jargon)

---

## Section 4 — Icons, Animations, Typography

### Icons (new `Icons.jsx` component)
Inline SVG, 16×16 viewBox, `currentColor` fill/stroke:
- `IconSettings` — gear
- `IconLogout` — power
- `IconSend` — arrow
- `IconMore` — vertical ellipsis
- `IconLock` — padlock
- `IconAlert` — warning triangle
- `IconClose` — ×
- `IconBack` — ←
- `IconSearch` — magnifier

### Animations (CSS only, respects `prefers-reduced-motion`)
- Settings panel slide-over: `translateX(-100%)` → `translateX(0)`, 200ms ease
- Contact hover: left accent bar 0 → 2px, 120ms ease
- Message bubbles: `opacity: 0 + translateY(4px)` → visible, 150ms ease
- Toast: slide in from top-right, 200ms
- Button active: `scale(0.97)`, 80ms

### Typography
- Login wordmark: `font-size: 40px; font-weight: 300; letter-spacing: 0.18em`
- Section headers: `10px; weight 700; tracking 0.1em; uppercase`
- Identity name in sidebar: `13px; weight 600`
- Base line-height: 1.45 (tighter from 1.5)

### Language cleanups
| Before | After |
|--------|-------|
| `⚠ No cap` | `● Awaiting connection` |
| `No contacts yet — look up a handle above` | `No contacts yet` |
| `⚙` button emoji | SVG gear icon |
| `⏻` button emoji | SVG power/logout icon |
| Chat input disabled placeholder (jargon) | `Request contact information first` |

---

## Files to Modify

| File | Changes |
|------|---------|
| `client/src/components/Icons.jsx` | **New** — SVG icon library |
| `client/src/components/LoginScreen.jsx` | Wordmark, tagline, smooth enrollment form |
| `client/src/components/Sidebar.jsx` | New layout, settings slide-over, SVG icons, contact accent bar |
| `client/src/components/ChatPanel.jsx` | Header clickable ID, status chip, bubble grouping, send icon, empty state |
| `client/src/components/ShareModal.jsx` | SVG close button, tighter layout |
| `client/src/components/PassphraseModal.jsx` | SVG close button |
| `client/src/App.css` | Animations, typography tokens, new component styles |

---

## Non-Goals
- No changes to crypto, protocol, or hooks
- No changes to server
- No new features — purely UI/UX polish
