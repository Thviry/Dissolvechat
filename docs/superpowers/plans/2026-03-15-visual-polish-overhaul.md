# Visual Polish Overhaul Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full visual overhaul of Dissolve — gradient glass bubbles, rich sidebar with timestamps and glowing badges, identity hub empty state, animations on message send/receive/view transitions, and polish across every screen.

**Architecture:** CSS-first approach. New design tokens in `:root` using `color-mix()` for theme-safe accent derivatives. Keyframe animations defined in CSS, triggered by CSS classes applied in JSX. Component changes are minimal (class names, a few new props, markup for empty state). All CSS changes go in both `client/src/App.css` and `desktop/src/App.css`.

**Tech Stack:** React 19, CSS3 (color-mix, keyframes, transitions), Vite

**Spec:** `docs/superpowers/specs/2026-03-15-visual-polish-overhaul-design.md`

---

## Chunk 1: Foundation — Design Tokens, Keyframes, Reduced Motion

### Task 1: Add new design tokens to `:root`

**Files:**
- Modify: `client/src/App.css:13-77` (`:root` block)

- [ ] **Step 1: Add new tokens after existing `--accent-muted` line (line ~35)**

Add these tokens inside the `:root` block, after `--accent-muted`:

```css
  /* Accent derivatives (theme-aware via color-mix) */
  --accent-4:  color-mix(in srgb, var(--accent) 4%, transparent);
  --accent-6:  color-mix(in srgb, var(--accent) 6%, transparent);
  --accent-12: color-mix(in srgb, var(--accent) 12%, transparent);
  --accent-15: color-mix(in srgb, var(--accent) 15%, transparent);
  --accent-20: color-mix(in srgb, var(--accent) 20%, transparent);
  --accent-40: color-mix(in srgb, var(--accent) 40%, transparent);

  /* Radius — bubble */
  --radius-bubble: 16px;

  /* Elevation shadows */
  --shadow-raised: 0 2px 12px rgba(0, 0, 0, 0.2);
  --shadow-floating: 0 12px 52px rgba(0, 0, 0, 0.8);
  --shadow-avatar: 0 2px 8px rgba(0, 0, 0, 0.3);
```

- [ ] **Step 2: Verify no existing token names conflict**

Run: `grep -n "accent-4\|accent-6\|accent-12\|accent-15\|accent-20\|accent-40\|radius-bubble\|shadow-raised\|shadow-floating\|shadow-avatar" client/src/App.css`
Expected: Only the lines you just added.

- [ ] **Step 3: Commit**

```bash
git add client/src/App.css
git commit -m "style: add design tokens for v4 visual overhaul — accent derivatives, bubble radius, elevation shadows"
```

---

### Task 2: Add keyframe animations

**Files:**
- Modify: `client/src/App.css` (keyframes section, around line ~162)

- [ ] **Step 1: Add new keyframes after existing `@keyframes banner-slide-down` block (around line ~238)**

```css
/* ── v4 Visual Polish animations ── */
@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes scalePop {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}

@keyframes staggerFadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes modalBackdropIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes modalBodyIn {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}

@keyframes modalBackdropOut {
  from { opacity: 1; }
  to   { opacity: 0; }
}

@keyframes modalBodyOut {
  from { opacity: 1; transform: scale(1); }
  to   { opacity: 0; transform: scale(0.95); }
}

@keyframes glowPulse {
  0%, 100% { opacity: 0.3; transform: scale(0.95); }
  50%      { opacity: 0.6; transform: scale(1.05); }
}

@keyframes toggleBounce {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.1); }
  100% { transform: scale(1); }
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/App.css
git commit -m "style: add v4 keyframe animations — fadeSlideUp, scalePop, modal transitions, glowPulse"
```

---

### Task 3: Update reduced motion media query

**Files:**
- Modify: `client/src/App.css` (`@media (prefers-reduced-motion: reduce)` block, around line ~245)

- [ ] **Step 1: Replace the existing reduced motion block with an expanded version**

Find the existing `@media (prefers-reduced-motion: reduce)` block and replace it with:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0ms !important;
    animation-delay: 0ms !important;
    transition-duration: 0ms !important;
    transition-delay: 0ms !important;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/App.css
git commit -m "style: expand prefers-reduced-motion to disable all animations and transitions"
```

---

### Task 4: Add global transition baselines

**Files:**
- Modify: `client/src/App.css`

- [ ] **Step 1: Add transition properties to existing selectors**

Add to `.btn` (around line ~280):
```css
  transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
```

Add to `.btn-primary` (around line ~1885):
```css
  transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
```

Add to `.input-field` (around line ~1960):
```css
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
```

Add to `.chat-input` (around line ~1665):
```css
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
```

- [ ] **Step 2: Commit**

```bash
git add client/src/App.css
git commit -m "style: add transition baselines to buttons and inputs"
```

---

### Task 5: Mirror all token/keyframe/transition changes to desktop

**Files:**
- Modify: `desktop/src/App.css`

- [ ] **Step 1: Apply the exact same changes from Tasks 1-4 to `desktop/src/App.css`**

The desktop App.css mirrors the client one. Apply the same token additions, keyframes, reduced motion block, and transition baselines.

- [ ] **Step 2: Commit**

```bash
git add desktop/src/App.css
git commit -m "style(desktop): mirror v4 design tokens, keyframes, and transition baselines"
```

---

## Chunk 2: Message Bubbles & Chat Area

### Task 6: Update bubble CSS — gradient glass treatment

**Files:**
- Modify: `client/src/App.css` (`.chat-bubble` rules, around line ~1499-1560)

- [ ] **Step 1: Update `.chat-bubble.incoming` (around line ~1513)**

Replace the existing incoming bubble styles with:
```css
.chat-bubble.incoming {
  align-self: flex-start;
  background: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-sm) var(--radius-bubble) var(--radius-bubble) var(--radius-sm);
  box-shadow: var(--shadow-raised);
}
```

- [ ] **Step 2: Update `.chat-bubble.outgoing` (around line ~1522)**

Replace the existing outgoing bubble styles with:
```css
.chat-bubble.outgoing {
  align-self: flex-end;
  background: linear-gradient(135deg, var(--accent-12), var(--accent-4));
  border: 1px solid var(--accent-15);
  border-radius: var(--radius-bubble) var(--radius-sm) var(--radius-sm) var(--radius-bubble);
  box-shadow: 0 2px 12px var(--accent-6);
}
```

This removes the old `border-right: 2px solid var(--accent)` signature element — the gradient + glow replaces it.

- [ ] **Step 3: Update `.chat-bubble.is-new` animation (around line ~1508)**

Replace:
```css
.chat-bubble.is-new {
  animation: msg-in 0.2s ease-out;
}
```

With separate animations for incoming vs outgoing:
```css
.chat-bubble.incoming.is-new {
  animation: fadeSlideUp 200ms ease-out;
}

.chat-bubble.outgoing.is-new {
  animation: scalePop 180ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

- [ ] **Step 4: Commit**

```bash
git add client/src/App.css
git commit -m "style: gradient glass bubbles with depth shadows and new send/receive animations"
```

---

### Task 7: Add grouped message position classes (CSS)

**Files:**
- Modify: `client/src/App.css` (after existing `.chat-bubble.grouped` rules, around line ~1532)

- [ ] **Step 1: Replace existing grouped bubble CSS with position-aware classes**

Keep the existing `.chat-bubble.grouped` margin rules, then add:

```css
/* Grouped bubble radius — stacked feel */
.chat-bubble.incoming.msg-group-first {
  border-radius: var(--radius-sm) var(--radius-bubble) var(--radius-bubble) var(--radius-sm);
}
.chat-bubble.incoming.msg-group-middle {
  border-radius: var(--radius-sm) var(--radius-sm) var(--radius-sm) var(--radius-sm);
}
.chat-bubble.incoming.msg-group-last {
  border-radius: var(--radius-sm) var(--radius-sm) var(--radius-bubble) var(--radius-sm);
}

.chat-bubble.outgoing.msg-group-first {
  border-radius: var(--radius-bubble) var(--radius-sm) var(--radius-sm) var(--radius-bubble);
}
.chat-bubble.outgoing.msg-group-middle {
  border-radius: var(--radius-sm) var(--radius-sm) var(--radius-sm) var(--radius-sm);
}
.chat-bubble.outgoing.msg-group-last {
  border-radius: var(--radius-sm) var(--radius-sm) var(--radius-sm) var(--radius-bubble);
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/App.css
git commit -m "style: add grouped message position classes for stacked bubble radius"
```

---

### Task 8: Update ChatPanel grouping logic to compute first/middle/last

**Files:**
- Modify: `client/src/components/ChatPanel.jsx:236-258` (the `items` useMemo)

- [ ] **Step 1: Extend the grouping logic**

Replace the existing `items` useMemo (lines ~236-258) with:

```jsx
  const items = useMemo(() => {
    const result = [];
    let lastDateStr = null;
    let prevSender = null;
    let prevTs = 0;
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const d = new Date(msg.ts);
      const dateStr = d.toDateString();
      if (dateStr !== lastDateStr) {
        result.push({ type: "separator", key: `sep-${dateStr}`, label: formatDateChip(d) });
        lastDateStr = dateStr;
        prevSender = null;
      }
      const sender = msg.dir === "out" ? "__self__" : (msg.senderId || msg.dir);
      const grouped = sender === prevSender && (msg.ts - prevTs) < 120000;

      // Look ahead to determine group position
      const nextMsg = messages[i + 1];
      const nextSender = nextMsg ? (nextMsg.dir === "out" ? "__self__" : (nextMsg.senderId || nextMsg.dir)) : null;
      const nextGrouped = nextMsg && sender === nextSender && (nextMsg.ts - msg.ts) < 120000;
      const nextDateStr = nextMsg ? new Date(nextMsg.ts).toDateString() : null;
      const nextIsNewDay = nextMsg && nextDateStr !== dateStr;

      let groupPos = null;
      if (grouped && (nextGrouped && !nextIsNewDay)) groupPos = "middle";
      else if (grouped && (!nextGrouped || nextIsNewDay)) groupPos = "last";
      else if (!grouped && (nextGrouped && !nextIsNewDay)) groupPos = "first";

      result.push({ type: "message", grouped, groupPos, ...msg });
      prevSender = sender;
      prevTs = msg.ts;
    }
    return result;
  }, [messages]);
```

- [ ] **Step 2: Update the bubble className to include groupPos**

Find the `<div className={...chat-bubble...}>` line (around line ~374) and update it:

```jsx
                className={`chat-bubble ${item.dir === "out" ? "outgoing" : "incoming"}${item.status === "failed" ? " failed" : ""}${!seenRef.current?.has(item.msgId) ? " is-new" : ""}${item.grouped ? " grouped" : ""}${item.groupPos ? ` msg-group-${item.groupPos}` : ""}`}
```

- [ ] **Step 3: Verify the app renders correctly**

Run: `cd client && npm run dev`
Open in browser, send messages in a conversation. Verify:
- Single messages have round corners on the non-sender side
- Consecutive same-sender messages stack with tighter radius on connecting edges
- Animations play on new messages

- [ ] **Step 4: Commit**

```bash
git add client/src/components/ChatPanel.jsx client/src/App.css
git commit -m "feat: grouped message position classes (first/middle/last) for stacked bubble radius"
```

---

### Task 9: Update chat header and input area CSS

**Files:**
- Modify: `client/src/App.css`

- [ ] **Step 1: Update `.chat-header` (around line ~1318)**

Add/update these properties:
```css
  border-bottom: 1px solid transparent;
  border-image: linear-gradient(90deg, transparent, var(--border), transparent) 1;
```

Remove any existing `border-bottom: 1px solid var(--border)` if present.

- [ ] **Step 2: Update `.chat-input-area` (around line ~1646)**

Add gradient top border:
```css
  border-top: 1px solid transparent;
  border-image: linear-gradient(90deg, transparent, var(--border), transparent) 1;
```

- [ ] **Step 3: Update `.chat-input:focus` (around line ~1683)**

Replace with:
```css
.chat-input:focus {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 2px var(--accent-15);
  outline: none;
}
```

- [ ] **Step 4: Update send button `.btn-send` or the send button styles (around line ~1697)**

Add gradient and glow on hover. Find the send button CSS and add:
```css
  background: linear-gradient(135deg, var(--accent), var(--accent-deep));
  transition: background 0.15s ease, box-shadow 0.15s ease;
```
And on hover:
```css
  box-shadow: 0 0 12px var(--accent-40);
```

- [ ] **Step 5: Commit**

```bash
git add client/src/App.css
git commit -m "style: gradient fade borders on chat header/input, enhanced focus glow, send button polish"
```

---

### Task 10: Mirror bubble/chat CSS changes to desktop

**Files:**
- Modify: `desktop/src/App.css`

- [ ] **Step 1: Apply changes from Tasks 6, 7, 9 to `desktop/src/App.css`**

- [ ] **Step 2: Commit**

```bash
git add desktop/src/App.css
git commit -m "style(desktop): mirror bubble gradient glass, grouped positions, and chat area polish"
```

---

## Chunk 3: Sidebar Overhaul

### Task 11: Update sidebar header CSS

**Files:**
- Modify: `client/src/App.css` (`.sidebar-header`, around line ~684)

- [ ] **Step 1: Update `.sidebar-header` styles**

Ensure the header avatar area is styled for 40px with gradient:
```css
.sidebar-header .contact-avatar {
  width: 40px;
  height: 40px;
  font-size: 16px;
  box-shadow: var(--shadow-avatar);
}
```

Add separator below header:
```css
.sidebar-header {
  border-bottom: 1px solid var(--border-subtle);
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/App.css
git commit -m "style: sidebar header — larger avatar with shadow, separator line"
```

---

### Task 12: Update contact row CSS — rich treatment

**Files:**
- Modify: `client/src/App.css` (`.contact-item` and related, around line ~1001-1140)

- [ ] **Step 1: Update avatar size and gradient**

```css
.contact-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  flex-shrink: 0;
  box-shadow: var(--shadow-avatar);
}

.contact-avatar[data-hue] {
  background: linear-gradient(135deg, hsl(var(--avatar-hue), 60%, 30%), hsl(var(--avatar-hue), 50%, 20%));
}
```

- [ ] **Step 2: Update group avatar to rounded square**

```css
.group-avatar {
  border-radius: 8px;
  background: linear-gradient(135deg, var(--accent-12), var(--accent-4));
}
```

- [ ] **Step 3: Update presence dot with glow**

```css
.presence-dot {
  width: 10px;
  height: 10px;
  border: 2px solid var(--bg-primary);
  box-shadow: 0 0 6px var(--accent-40);
}
```

- [ ] **Step 4: Update unread badge with gradient + glow**

```css
.unread-badge {
  min-width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--accent-deep));
  color: var(--text-inverse);
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 8px var(--accent-40);
}
```

- [ ] **Step 5: Update active contact state**

```css
.contact-item.active {
  background: var(--accent-4);
  border-left: 2px solid var(--accent);
}
```

- [ ] **Step 6: Commit**

```bash
git add client/src/App.css
git commit -m "style: rich sidebar — gradient avatars, glowing presence/unread badges, accent active state"
```

---

### Task 13: Add timestamps to sidebar contact rows

**Files:**
- Modify: `client/src/components/Sidebar.jsx:518-568` (contact list rendering)

- [ ] **Step 1: Add `formatRelativeTime` helper at top of Sidebar.jsx**

```jsx
function formatRelativeTime(ts) {
  if (!ts) return "";
  const now = new Date();
  const d = new Date(ts);
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);

  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
```

- [ ] **Step 2: Update contact row JSX to show timestamp**

In the contact item button, after `<div className="contact-info">`, update to include timestamp:

```jsx
<div className="contact-info">
  <div className="contact-name-row">
    <div className="contact-name">{c.label}</div>
    {lastMessages[c.id]?.ts && (
      <span className="contact-time">{formatRelativeTime(lastMessages[c.id].ts)}</span>
    )}
  </div>
  {lastMessages[c.id]
    ? <div className="contact-preview">{lastMessages[c.id].text}</div>
    : <div className="contact-id">{c.id.slice(0, 20)}…</div>
  }
</div>
```

- [ ] **Step 3: Do the same for group rows**

Update group contact rows similarly, using `lastMessages[g.groupId]?.ts` for timestamp and adding sender name prefix to preview.

- [ ] **Step 4: Add CSS for timestamp and name row**

In `client/src/App.css`:
```css
.contact-name-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.contact-time {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-tertiary);
  white-space: nowrap;
  flex-shrink: 0;
}
```

- [ ] **Step 5: Commit**

```bash
git add client/src/components/Sidebar.jsx client/src/App.css
git commit -m "feat: timestamps on sidebar contact rows — relative time formatting"
```

---

### Task 14: Update sidebar empty states

**Files:**
- Modify: `client/src/components/Sidebar.jsx`
- Modify: `client/src/App.css`

- [ ] **Step 1: Update "No contacts" empty state in Sidebar.jsx**

Replace:
```jsx
<p className="empty-state">No contacts yet — look up a handle above</p>
```

With:
```jsx
<div className="empty-state-rich">
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="empty-state-icon">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
  <p>Look up a handle to start chatting</p>
</div>
```

- [ ] **Step 2: Update "No groups" empty state in Sidebar.jsx**

Replace:
```jsx
<p className="empty-state" style={{ padding: "0 16px" }}>No groups yet</p>
```

With:
```jsx
<div className="empty-state-rich">
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="empty-state-icon">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
  <p>Create a group to chat with multiple people</p>
</div>
```

- [ ] **Step 3: Add CSS for rich empty states**

```css
.empty-state-rich {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 16px;
  color: var(--text-tertiary);
}

.empty-state-rich .empty-state-icon {
  color: var(--accent);
  opacity: 0.4;
}

.empty-state-rich p {
  font-size: 12px;
  text-align: center;
}
```

- [ ] **Step 4: Commit**

```bash
git add client/src/components/Sidebar.jsx client/src/App.css
git commit -m "style: rich empty states in sidebar — icon + action text for contacts and groups"
```

---

### Task 15: Mirror sidebar CSS changes to desktop

**Files:**
- Modify: `desktop/src/App.css`

- [ ] **Step 1: Apply CSS from Tasks 11, 12, 13 (CSS parts), 14 to `desktop/src/App.css`**

- [ ] **Step 2: Commit**

```bash
git add desktop/src/App.css
git commit -m "style(desktop): mirror sidebar overhaul — rich avatars, timestamps, empty states"
```

---

## Chunk 4: Empty State — Identity Hub

### Task 16: Pass new props to ChatPanel from App.jsx

**Files:**
- Modify: `client/src/App.jsx:604-636` (both ChatPanel usages)
- Modify: `desktop/src/App.jsx` (same locations)

- [ ] **Step 1: Add identity, contactCount, groupCount props to both ChatPanel instances in client/src/App.jsx**

For the group ChatPanel (around line ~605):
```jsx
          <ChatPanel
            className={isMobile && mobileView === "contacts" ? "mobile-hidden" : ""}
            isMobile={isMobile}
            onBack={() => setMobileView("contacts")}
            group={activeGroup}
            messages={activeGroupMessages}
            onSend={(_, text, file) => messaging.sendGroupMsg(activeGroupId, text, file)}
            onGroupInfo={() => setShowGroupInfo(true)}
            identityId={identity.id}
            identity={identity}
            contactCount={contactsMgr.contacts.length}
            groupCount={groupsMgr.groups.length}
          />
```

For the peer ChatPanel (around line ~616):
```jsx
          <ChatPanel
            ...existing props...
            identity={identity}
            contactCount={contactsMgr.contacts.length}
            groupCount={groupsMgr.groups.length}
          />
```

- [ ] **Step 2: Apply the same changes to `desktop/src/App.jsx`**

- [ ] **Step 3: Commit**

```bash
git add client/src/App.jsx desktop/src/App.jsx
git commit -m "feat: pass identity/contactCount/groupCount props to ChatPanel for empty state"
```

---

### Task 17: Rewrite empty state in ChatPanel — Identity Hub

**Files:**
- Modify: `client/src/components/ChatPanel.jsx:46,260-273` (props destructure + empty state markup)

- [ ] **Step 1: Add new props to the ChatPanel destructure**

Update the function signature (line ~46) to include:
```jsx
export default function ChatPanel({ className, isMobile, onBack, peer, group, messages, onSend, onGroupInfo, onRetry, onDismiss, identityId, onStartCall, callState, identity, contactCount, groupCount }) {
```

- [ ] **Step 2: Replace the empty state JSX**

Replace the existing empty state block (lines ~260-273):

```jsx
  if (!peer && !group) {
    const avatarHue = (() => {
      try {
        const profile = JSON.parse(localStorage.getItem(`profile:${identityId}`) || "{}");
        if (profile.avatarColor && profile.avatarColor !== "auto") {
          const COLORS = { red: 0, orange: 30, amber: 45, green: 140, teal: 175, cyan: 190, blue: 220, indigo: 245, purple: 270, pink: 330 };
          return COLORS[profile.avatarColor] ?? idToHue(identityId);
        }
      } catch {}
      return idToHue(identityId);
    })();

    return (
      <main className={`chat-panel ${className || ""}`}>
        <div className="chat-empty identity-hub">
          <div className="identity-hub-glow" aria-hidden="true" />
          <div className="identity-hub-avatar" style={{ "--avatar-hue": avatarHue }}>
            {(identity?.handle || identity?.label || "?").charAt(0).toUpperCase()}
          </div>
          <div className="identity-hub-handle" style={{ animationDelay: "80ms" }}>
            {identity?.handle || identity?.label || "Anonymous"}
          </div>
          <div className="identity-hub-stats" style={{ animationDelay: "160ms" }}>
            {contactCount ?? 0} contact{contactCount !== 1 ? "s" : ""} · {groupCount ?? 0} group{groupCount !== 1 ? "s" : ""}
          </div>
          <div className="identity-hub-tags" style={{ animationDelay: "240ms" }}>
            <span className="identity-hub-tag accent">Encrypted</span>
            <span className="identity-hub-tag">P2P</span>
            <span className="identity-hub-tag">Anonymous</span>
          </div>
          <div className="identity-hub-motto" style={{ animationDelay: "320ms" }}>
            Power to the user, not the platform.
          </div>
        </div>
      </main>
    );
  }
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ChatPanel.jsx
git commit -m "feat: identity hub empty state — avatar, handle, stats, tags, motto"
```

---

### Task 18: Add Identity Hub CSS

**Files:**
- Modify: `client/src/App.css` (replace existing `.chat-empty` block, around line ~1237)

- [ ] **Step 1: Replace existing `.chat-empty` and related rules with Identity Hub styles**

```css
/* Empty state — Identity Hub */
.chat-empty.identity-hub {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  position: relative;
  overflow: hidden;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.01) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.01) 1px, transparent 1px);
  background-size: 48px 48px;
}

.identity-hub-glow {
  position: absolute;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--accent-6) 0%, transparent 70%);
  animation: glowPulse 4s ease-in-out infinite;
  pointer-events: none;
}

.identity-hub-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, hsl(var(--avatar-hue), 60%, 30%), hsl(var(--avatar-hue), 50%, 20%));
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-sans);
  font-size: 28px;
  font-weight: 600;
  color: var(--text-primary);
  border: 2px solid var(--accent-15);
  box-shadow: var(--shadow-avatar);
  animation: staggerFadeIn 200ms ease-out both;
}

.identity-hub-handle {
  font-family: var(--font-sans);
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
  animation: staggerFadeIn 200ms ease-out both;
}

.identity-hub-stats {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
  animation: staggerFadeIn 200ms ease-out both;
}

.identity-hub-tags {
  display: flex;
  gap: 8px;
  animation: staggerFadeIn 200ms ease-out both;
}

.identity-hub-tag {
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  font-family: var(--font-display);
  font-size: 9px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.identity-hub-tag.accent {
  background: var(--accent-4);
  border-color: var(--accent-15);
  color: var(--accent);
  opacity: 0.7;
}

.identity-hub-motto {
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--text-tertiary);
  opacity: 0.4;
  margin-top: 8px;
  animation: staggerFadeIn 200ms ease-out both;
}
```

Keep the old `.chat-empty` base rule (without `.identity-hub`) for the general flex layout, but the identity hub overrides it.

- [ ] **Step 2: Commit**

```bash
git add client/src/App.css
git commit -m "style: identity hub CSS — gradient avatar, glow pulse, staggered fade-in, tag pills"
```

---

### Task 19: Mirror empty state CSS to desktop

**Files:**
- Modify: `desktop/src/App.css`

- [ ] **Step 1: Apply Identity Hub CSS from Task 18 to `desktop/src/App.css`**

- [ ] **Step 2: Commit**

```bash
git add desktop/src/App.css
git commit -m "style(desktop): mirror identity hub empty state CSS"
```

---

## Chunk 5: Login Screen, Settings, Modals, Toasts, and Final Polish

### Task 20: Login screen polish

**Files:**
- Modify: `client/src/App.css` (`.login-screen` and related, around line ~332)
- Modify: `client/src/components/LoginScreen.jsx`

- [ ] **Step 1: Add fade-in animation to login screen CSS**

```css
.login-screen {
  animation: fadeSlideUp 300ms ease-out;
}
```

- [ ] **Step 2: Update primary button styling for login**

The `.btn-primary` styles (around line ~1885) should get gradient treatment:
```css
.btn-primary {
  background: linear-gradient(135deg, var(--accent), var(--accent-deep));
  color: var(--text-inverse);
  font-weight: 600;
  border: none;
  transition: background 0.15s ease, box-shadow 0.15s ease;
}

.btn-primary:hover {
  background: linear-gradient(135deg, var(--accent-hover), var(--accent));
  box-shadow: 0 0 12px var(--accent-40);
}
```

- [ ] **Step 3: Add glow pulse behind the login wordmark**

In the `.login-brand` or wordmark area CSS, add:
```css
.login-brand {
  position: relative;
}

.login-brand::before {
  content: "";
  position: absolute;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--accent-6) 0%, transparent 70%);
  animation: glowPulse 4s ease-in-out infinite;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 0;
}
```

- [ ] **Step 4: Commit**

```bash
git add client/src/App.css
git commit -m "style: login screen polish — fade-in, gradient buttons, wordmark glow"
```

---

### Task 21: Settings panel polish

**Files:**
- Modify: `client/src/App.css` (`.settings-overlay` and related, around line ~779)

- [ ] **Step 1: Add section header accent bar**

```css
.settings-section h4 {
  padding-left: 10px;
  border-left: 2px solid var(--accent-20);
}
```

- [ ] **Step 2: Add toggle bounce animation**

```css
.toggle-label input[type="checkbox"]:active {
  animation: toggleBounce 150ms ease;
}
```

- [ ] **Step 3: Style action buttons with gradient**

The settings action buttons that use `.btn-primary` already inherit the gradient from Task 20.

- [ ] **Step 4: Commit**

```bash
git add client/src/App.css
git commit -m "style: settings panel — accent section bars, toggle bounce animation"
```

---

### Task 22: Modal animations (enter + exit)

**Files:**
- Modify: `client/src/App.css` (`.modal-overlay`, around line ~2085)
- Modify: `client/src/components/CreateGroupModal.jsx`
- Modify: `client/src/components/GroupInfoPanel.jsx`
- Modify: `client/src/components/PassphraseModal.jsx`
- Modify: `client/src/components/ShareModal.jsx`
- Modify: `client/src/components/LinkDeviceModal.jsx`

- [ ] **Step 1: Update `.modal-overlay` CSS**

```css
.modal-overlay {
  animation: modalBackdropIn 150ms ease-out;
  border-radius: 0;
}

.modal-overlay.exiting {
  animation: modalBackdropOut 150ms ease-in forwards;
}

.modal-overlay > :first-child {
  animation: modalBodyIn 200ms ease-out;
  border-radius: 12px;
  background: linear-gradient(180deg, #1a1a1a, #141414);
  box-shadow: var(--shadow-floating);
  border: none;
}

.modal-overlay.exiting > :first-child {
  animation: modalBodyOut 150ms ease-in forwards;
}
```

- [ ] **Step 2: Add exit animation pattern to each modal component**

For each modal (CreateGroupModal, GroupInfoPanel, PassphraseModal, ShareModal, LinkDeviceModal), add the `exiting` state pattern. Example for CreateGroupModal:

```jsx
export default function CreateGroupModal({ contacts, onClose, onCreate }) {
  const [exiting, setExiting] = useState(false);

  const handleClose = () => {
    setExiting(true);
    setTimeout(onClose, 150);
  };

  // ... replace all onClose calls with handleClose
  // Add exiting class to overlay:
  return (
    <div className={`modal-overlay${exiting ? " exiting" : ""}`} onClick={handleClose}>
```

Apply this same pattern to all 5 modal components. Replace direct `onClose` calls with the `handleClose` wrapper that sets `exiting` first.

- [ ] **Step 3: Commit**

```bash
git add client/src/App.css client/src/components/CreateGroupModal.jsx client/src/components/GroupInfoPanel.jsx client/src/components/PassphraseModal.jsx client/src/components/ShareModal.jsx client/src/components/LinkDeviceModal.jsx
git commit -m "feat: modal enter/exit animations — scale + fade with 150ms exit delay"
```

---

### Task 23: Toast polish

**Files:**
- Modify: `client/src/App.css` (`.toast` rules, around line ~2008)

- [ ] **Step 1: Update toast enter animation**

Find the `@keyframes toast-enter` and update:
```css
@keyframes toast-enter {
  from { opacity: 0; transform: translateX(20px) scale(0.96); }
  to   { opacity: 1; transform: translateX(0) scale(1); }
}
```

- [ ] **Step 2: Add type-specific left border and shadow**

```css
.toast {
  box-shadow: var(--shadow-raised);
}

.toast-success {
  border-left: 2px solid var(--accent);
}

.toast-error {
  border-left: 2px solid var(--danger);
}

.toast-warning {
  border-left: 2px solid var(--warning);
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/App.css
git commit -m "style: toast polish — pronounced slide, type-colored left borders, depth shadow"
```

---

### Task 24: EmojiPicker fade-in

**Files:**
- Modify: `client/src/App.css` (`.emoji-picker`, around line ~3020)

- [ ] **Step 1: Add fade-in animation**

```css
.emoji-picker {
  animation: scalePop 150ms ease-out;
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/App.css
git commit -m "style: emoji picker fade-in animation"
```

---

### Task 25: Scroll-to-bottom FAB animation

**Files:**
- Modify: `client/src/App.css` (`.scroll-fab`, around line ~2714)

- [ ] **Step 1: Update scroll FAB show/hide**

```css
.scroll-fab {
  opacity: 0;
  transform: scale(0.8);
  transition: opacity 0.2s ease, transform 0.2s ease;
  pointer-events: none;
}

.scroll-fab.visible {
  opacity: 1;
  transform: scale(1);
  pointer-events: auto;
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/App.css
git commit -m "style: scroll-to-bottom FAB — smooth scale + fade transition"
```

---

### Task 26: Error and empty state copy improvements

**Files:**
- Modify: `client/src/components/ChatPanel.jsx`

- [ ] **Step 1: Update "Cannot send" message**

Find `"Cannot send — no inbox capability"` and replace with `"Waiting for connection..."`.

Find `"No inbox capability — request one first"` and replace with `"Waiting for connection..."`.

- [ ] **Step 2: Commit**

```bash
git add client/src/components/ChatPanel.jsx
git commit -m "fix: softer error copy — 'Waiting for connection' instead of 'no inbox capability'"
```

---

### Task 27: Mirror all remaining CSS changes to desktop

**Files:**
- Modify: `desktop/src/App.css`

- [ ] **Step 1: Apply CSS from Tasks 20-25 to `desktop/src/App.css`**

Login polish, settings polish, modal animations, toast polish, emoji picker, scroll FAB.

- [ ] **Step 2: Commit**

```bash
git add desktop/src/App.css
git commit -m "style(desktop): mirror final polish — login, settings, modals, toasts, emoji, FAB"
```

---

### Task 28: Contact switch crossfade

**Files:**
- Modify: `client/src/App.css`
- Modify: `client/src/components/ChatPanel.jsx`

- [ ] **Step 1: Add crossfade CSS to `.chat-panel`**

```css
.chat-panel {
  animation: fadeSlideUp 150ms ease-out;
}
```

Note: Since ChatPanel re-renders (not remounts) on contact switch, we need a key-based approach. In `client/src/App.jsx`, add a `key` prop to both ChatPanel instances so React remounts on target change:

For the group ChatPanel: `key={activeGroupId}`
For the peer ChatPanel: `key={activePeer?.id}`

This triggers the CSS animation on each contact switch.

- [ ] **Step 2: Apply same key props in `desktop/src/App.jsx`**

- [ ] **Step 3: Commit**

```bash
git add client/src/App.css client/src/App.jsx desktop/src/App.jsx
git commit -m "feat: chat panel crossfade on contact switch via key-based remount"
```

---

### Task 29: Settings panel slide animation

**Files:**
- Modify: `client/src/App.css` (`.settings-overlay`, around line ~779)

- [ ] **Step 1: The existing `@keyframes slide-in-left` (line ~184) already provides the entrance animation**

Verify `.settings-overlay` already uses `animation: slide-in-left`. If not, add:
```css
.settings-overlay {
  animation: slide-in-left 200ms ease-out;
}
```

- [ ] **Step 2: Add exit animation for settings**

Add a new keyframe and exiting class:
```css
@keyframes slide-out-left {
  from { transform: translateX(0); opacity: 1; }
  to   { transform: translateX(-100%); opacity: 0; }
}

.settings-overlay.exiting {
  animation: slide-out-left 200ms ease-in forwards;
}
```

- [ ] **Step 3: Add exiting state to Sidebar.jsx settings toggle**

In `client/src/components/Sidebar.jsx`, add exit animation pattern for settings:
- Add `const [settingsExiting, setSettingsExiting] = useState(false);`
- Create `closeSettings`: `setSettingsExiting(true); setTimeout(() => { setShowSettings(false); setSettingsExiting(false); }, 200);`
- Apply `exiting` class: `className={`settings-overlay${settingsExiting ? " exiting" : ""}`}`
- Replace `setShowSettings(false)` calls in the settings overlay close button with `closeSettings()`

- [ ] **Step 4: Apply same pattern for profile panel slide-in/out**

The profile panel overlay uses the same slide pattern. Add `animation: slide-in-left 200ms ease-out` to the profile overlay CSS and the same exit animation pattern.

- [ ] **Step 5: Mirror CSS to `desktop/src/App.css`**

- [ ] **Step 6: Commit**

```bash
git add client/src/App.css desktop/src/App.css client/src/components/Sidebar.jsx
git commit -m "feat: settings and profile panel slide-in/out animations"
```

---

### Task 30: Copy message checkmark fade

**Files:**
- Modify: `client/src/App.css` (`.chat-bubble-copy`, around line ~3220)

- [ ] **Step 1: Add transition to copy button icon swap**

```css
.chat-bubble-copy svg {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.chat-bubble-copy.copied svg {
  animation: scalePop 180ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

- [ ] **Step 2: Mirror to `desktop/src/App.css`**

- [ ] **Step 3: Commit**

```bash
git add client/src/App.css desktop/src/App.css
git commit -m "style: copy message checkmark fade animation"
```

---

### Task 31: File send failure friendlier copy

**Files:**
- Modify: `client/src/components/ChatPanel.jsx`

- [ ] **Step 1: Find file send failure messages and soften them**

Search for error messages related to file sending (e.g., "Failed to send", "File too large") and soften the language. For example:
- "Failed to send file" → "Couldn't send file — try again"
- Any raw error messages → user-friendly equivalents

- [ ] **Step 2: Commit**

```bash
git add client/src/components/ChatPanel.jsx
git commit -m "fix: friendlier file send failure copy"
```

---

### Task 32: Fix redundant transition additions

**Note for implementer:** Task 4 mentions adding transitions to `.btn`, `.btn-primary`, `.chat-input`, and `.input-field`. Before adding these:
- `.btn` already has `transition: background var(--t-base), border-color var(--t-base), box-shadow var(--t-base)` — **skip, already sufficient**
- `.chat-input` already has `transition: border-color var(--t-base), box-shadow var(--t-base)` — **skip, already sufficient**
- `.btn-primary` inherits from `.btn` — **skip**
- `.input-field` — check if it already has a transition. If so, skip. If not, add `transition: border-color 0.15s ease, box-shadow 0.15s ease`

Also for Task 6: ensure `.chat-bubble.incoming` and `.chat-bubble.outgoing` retain `color: var(--text-primary)` from the existing styles.

Also for Task 25: the existing `.scroll-fab` uses `transform: translateY(8px) scale(0.9)`. The plan changes it to `scale(0.8)` which removes the translateY. Keep the existing translateY: use `transform: translateY(8px) scale(0.8)` instead.

No commit needed — these are notes for the implementer to follow during Tasks 4, 6, and 25.

---

### Task 33: Toast.jsx note

**Note for implementer:** The spec lists `Toast.jsx` as an affected file, but all toast animation changes are CSS-only (Task 23). No JSX changes needed for Toast.jsx — the existing `toast-enter`/`toast-exit` keyframe names and `toast-exiting` class are already wired up.

---

### Task 34: Manual theme verification

- [ ] **Step 1: Start the dev server**

Run: `cd client && npm run dev`

- [ ] **Step 2: Test each theme**

Switch through all 5 themes (Terminal, Ocean, Forest, Ember, Violet) in Settings and verify:
- Bubble gradients use the correct accent color
- Unread badges glow in the correct theme color
- Presence dots use theme accent
- Identity hub tag uses theme accent
- Buttons use theme accent gradient
- No hardcoded green values visible in non-Terminal themes

- [ ] **Step 3: Fix any theme issues found**

- [ ] **Step 4: Run existing tests**

Run: `npx vitest run`
Expected: All tests pass (CSS changes shouldn't break tests, but verify).

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: theme compatibility — ensure all accent derivatives work across themes"
```

---

### Task 35: Final desktop App.jsx sync

**Files:**
- Modify: `desktop/src/App.jsx`

- [ ] **Step 1: Verify desktop App.jsx has the same ChatPanel props as client**

Ensure `identity`, `contactCount`, `groupCount` are passed to both ChatPanel instances in `desktop/src/App.jsx`, matching what was done in Task 16.

- [ ] **Step 2: Commit if changes needed**

```bash
git add desktop/src/App.jsx
git commit -m "fix(desktop): sync App.jsx ChatPanel props for identity hub"
```
