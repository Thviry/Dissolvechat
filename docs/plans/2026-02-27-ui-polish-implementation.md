# Dissolve Chat UI Polish — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the v5 client in `admiring-almeida` worktree into a polished, finished product with an editorial dark aesthetic, SVG icons, micro-animations, and clean language.

**Architecture:** Pure CSS + JSX changes only. No changes to crypto, protocol, hooks, or server. A new `Icons.jsx` provides all SVG icons. App.css grows with keyframe animations and new component styles. Each component gets targeted markup changes.

**Tech Stack:** React 18, Vite, vanilla CSS (no Tailwind/styled-components)

**Working directory:** `.claude/worktrees/admiring-almeida/client/`

**Start dev server to verify:** `cd .claude/worktrees/admiring-almeida/client && npm run dev`

---

## Task 1: Create SVG Icon Library

**Files:**
- Create: `client/src/components/Icons.jsx`

**Step 1: Create the file**

```jsx
// client/src/components/Icons.jsx
// Inline SVG icons — all 16×16 viewBox, currentColor, strokeWidth 1.5

export const IconSettings = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <circle cx="8" cy="8" r="2.5" />
    <path d="M8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
  </svg>
);

export const IconLogout = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M6 2.5H3a1 1 0 00-1 1v9a1 1 0 001 1h3" />
    <path d="M10.5 11l3-3-3-3" />
    <path d="M13.5 8H6" />
  </svg>
);

export const IconSend = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M14 2L7 9" />
    <path d="M14 2L9.5 14 7 9 2 6.5 14 2z" />
  </svg>
);

export const IconMore = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
    <circle cx="8" cy="3.5" r="1.2" />
    <circle cx="8" cy="8" r="1.2" />
    <circle cx="8" cy="12.5" r="1.2" />
  </svg>
);

export const IconLock = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <rect x="3" y="7" width="10" height="8" rx="1.5" />
    <path d="M5.5 7V5.5a2.5 2.5 0 015 0V7" />
  </svg>
);

export const IconAlert = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M8 1.5L14.5 13H1.5L8 1.5z" />
    <path d="M8 6v3" />
    <circle cx="8" cy="11" r=".5" fill="currentColor" stroke="none" />
  </svg>
);

export const IconClose = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" {...props}>
    <path d="M12 4L4 12M4 4l8 8" />
  </svg>
);

export const IconBack = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M10 3L5 8l5 5" />
  </svg>
);

export const IconSearch = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L14 14" />
  </svg>
);
```

**Step 2: Verify the file exists**

```bash
ls client/src/components/Icons.jsx
```

Expected: file listed.

**Step 3: Commit**

```bash
git add client/src/components/Icons.jsx
git commit -m "feat: add SVG icon library (Icons.jsx)"
```

---

## Task 2: Update App.css — Animations, Typography & New Component Styles

**Files:**
- Modify: `client/src/App.css`

**Step 1: Add keyframe animations and new variables at the top of App.css, after the closing `:root {}` block**

Find the line `@import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Sans...` and INSERT before it:

```css
/* ============================================================
   Animations
   ============================================================ */
@keyframes msg-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes slide-in-left {
  from { transform: translateX(-100%); }
  to   { transform: translateX(0); }
}

@keyframes toast-slide-in {
  from { opacity: 0; transform: translateX(16px); }
  to   { opacity: 1; transform: translateX(0); }
}

@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Step 2: Update the `.login-screen` and `.login-card` blocks**

Find `.login-card {` and replace the entire login section (from `.login-screen {` through end of `.enroll-actions .btn {}`) with:

```css
/* ============================================================
   Login screen
   ============================================================ */
.login-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: var(--bg-primary);
  background-image:
    radial-gradient(ellipse at 30% 40%, rgba(108, 140, 255, 0.05) 0%, transparent 55%),
    radial-gradient(ellipse at 70% 60%, rgba(108, 140, 255, 0.03) 0%, transparent 55%);
}

.login-card {
  width: 100%;
  max-width: 360px;
  padding: 56px 40px 48px;
  text-align: center;
}

.login-wordmark {
  font-size: 40px;
  font-weight: 300;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-primary);
  margin-bottom: 20px;
  font-family: var(--font-sans);
}

.login-tagline {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.7;
  margin-bottom: 36px;
}

.login-tagline strong {
  display: block;
  color: var(--text-primary);
  font-weight: 500;
  margin-bottom: 4px;
}

.login-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.login-actions .btn {
  width: 100%;
  padding: 13px;
  font-size: 14px;
}

.login-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-tertiary);
  font-size: 11px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin: 2px 0;
}

.login-divider::before,
.login-divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--border);
}

.login-hint {
  color: var(--text-tertiary);
  font-size: 11px;
  margin-top: 6px;
}

/* Enrollment form */
.enroll-header {
  text-align: left;
  margin-bottom: 24px;
}

.enroll-header h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}

.enroll-header p {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.enroll-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: var(--text-tertiary);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  padding: 0;
  margin-bottom: 12px;
  transition: color 0.15s;
}

.enroll-back-btn:hover {
  color: var(--text-primary);
}

.enroll-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  text-align: left;
}

.enroll-form-animate {
  animation: fade-in 0.2s ease;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.form-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-tertiary);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.form-required {
  color: var(--accent);
}

.form-hint {
  font-size: 11px;
  color: var(--text-tertiary);
  min-height: 16px;
  display: flex;
  align-items: center;
  gap: 5px;
}

.form-error {
  font-size: 12px;
  color: var(--danger);
  background: var(--danger-subtle);
  border: 1px solid rgba(248, 113, 113, 0.2);
  border-radius: var(--radius-md);
  padding: 8px 12px;
}

.status-checking { color: var(--text-tertiary); }
.status-available { color: var(--success); }
.status-taken     { color: var(--danger); }
.status-error     { color: var(--warning); }

.enroll-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.enroll-actions .btn {
  flex: 1;
}
```

**Step 3: Replace the sidebar section in App.css**

Find `.sidebar {` and replace from `.sidebar {` through end of `.sidebar-footer {}` block with:

```css
/* ============================================================
   App layout
   ============================================================ */
.app-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* ============================================================
   Sidebar
   ============================================================ */
.sidebar {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 14px 14px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.identity-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.identity-avatar,
.contact-avatar {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-full);
  background: var(--accent-subtle);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
  flex-shrink: 0;
  font-family: var(--font-sans);
}

.identity-details {
  min-width: 0;
}

.identity-name {
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.identity-id {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-header-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

/* Settings overlay — slides over the full sidebar */
.settings-overlay {
  position: absolute;
  inset: 0;
  background: var(--bg-secondary);
  z-index: 10;
  display: flex;
  flex-direction: column;
  animation: slide-in-left 0.2s ease;
}

.settings-overlay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 14px 14px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.settings-overlay-header h3 {
  font-size: 13px;
  font-weight: 600;
  margin: 0;
}

.settings-overlay-body {
  overflow-y: auto;
  flex: 1;
  padding: 8px 0;
}

/* Settings sections */
.settings-section {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
}

.settings-section:last-child {
  border-bottom: none;
}

.settings-section h4 {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 10px;
}

.settings-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  margin-bottom: 8px;
  line-height: 1.4;
}

.toggle-label:last-child {
  margin-bottom: 0;
}

.toggle-label input[type="checkbox"] {
  accent-color: var(--accent);
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.hint-text {
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.4;
}

/* Sidebar scrollable body */
.sidebar-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
}

/* Sidebar sections */
.sidebar-section {
  padding: 12px 16px;
}

.sidebar-section + .sidebar-section {
  padding-top: 0;
}

.section-title {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge {
  background: var(--accent);
  color: var(--text-inverse);
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: var(--radius-full);
}

.empty-state {
  color: var(--text-tertiary);
  font-size: 12px;
}

/* Lookup bar */
.lookup-bar {
  display: flex;
  gap: 6px;
  margin-bottom: 4px;
}

.lookup-bar .input-field {
  flex: 1;
}

.lookup-result {
  margin-top: 8px;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.lookup-result-info strong {
  display: block;
  font-size: 13px;
  font-weight: 500;
}

.lookup-result-id {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-tertiary);
}

/* Contact list */
.contact-list,
.request-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.contact-item-wrap {
  position: relative;
  display: flex;
  align-items: center;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.contact-item-wrap .contact-item {
  flex: 1;
  min-width: 0;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border: none;
  background: none;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  width: 100%;
  font-family: inherit;
  transition: background 0.12s;
  border-radius: var(--radius-md);
  position: relative;
}

.contact-item:hover {
  background: var(--bg-hover);
}

.contact-item.active {
  background: var(--bg-active);
}

/* Left accent bar on active contact */
.contact-accent-bar {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 0;
  height: 60%;
  background: var(--accent);
  border-radius: 0 2px 2px 0;
  transition: width 0.12s ease;
  pointer-events: none;
}

.contact-item.active .contact-accent-bar {
  width: 2px;
}

.contact-info {
  min-width: 0;
  flex: 1;
}

.contact-name {
  font-weight: 500;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.contact-id {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contact-menu-btn {
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.12s;
}

.contact-item-wrap:hover .contact-menu-btn {
  opacity: 0.5;
}

.contact-menu-btn:hover {
  opacity: 1 !important;
}

.contact-actions {
  position: absolute;
  right: 6px;
  top: calc(100% + 2px);
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 4px;
  z-index: 20;
  box-shadow: var(--shadow-md);
  animation: fade-in 0.1s ease;
}

/* Request items */
.request-item {
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
}

.request-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.request-avatar {
  background: rgba(251, 191, 36, 0.12);
  color: var(--warning);
}

.request-preview {
  font-size: 12px;
  color: var(--text-secondary);
  font-style: italic;
  margin-top: 2px;
}

.request-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* Theme picker */
.theme-picker {
  display: flex;
  gap: 8px;
}

.theme-swatch {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s;
}

.theme-swatch:hover {
  transform: scale(1.2);
}

.theme-swatch.active {
  border-color: var(--text-primary);
}

/* Sidebar footer */
.sidebar-footer {
  margin-top: auto;
  padding: 8px 16px 10px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.session-notice {
  font-size: 10px;
  color: var(--text-tertiary);
  line-height: 1.4;
  letter-spacing: 0.01em;
  display: flex;
  align-items: center;
  gap: 5px;
}
```

**Step 4: Replace the Chat panel section**

Find `.chat-panel {` and replace everything from `.chat-panel {` through `.btn-send {}` with:

```css
/* ============================================================
   Chat panel
   ============================================================ */
.chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  min-width: 0;
}

.chat-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  position: relative;
  overflow: hidden;
}

.chat-empty-watermark {
  position: absolute;
  font-size: 160px;
  color: var(--text-primary);
  opacity: 0.025;
  user-select: none;
  pointer-events: none;
  line-height: 1;
}

.chat-empty-text h2 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 4px;
  text-align: center;
}

.chat-empty-text p {
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: center;
}

/* Chat header */
.chat-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
  min-height: var(--header-height);
  flex-shrink: 0;
}

.chat-header-avatar {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-full);
  background: var(--accent-subtle);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 15px;
  flex-shrink: 0;
}

.chat-header-info {
  flex: 1;
  min-width: 0;
}

.chat-header-name {
  font-weight: 600;
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-header-id {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.15s;
  display: flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
}

.chat-header-id:hover {
  color: var(--text-secondary);
}

.chat-id-copied {
  font-size: 10px;
  color: var(--success);
}

/* Status chip (replaces "No cap" jargon) */
.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.status-chip.warning {
  color: var(--warning);
  background: var(--warning-subtle);
}

.status-chip-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

/* Messages */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.chat-no-messages {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--text-tertiary);
  font-size: 13px;
}

.chat-ephemeral-notice {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 10px;
  padding: 5px 14px;
  margin: 0 auto 10px;
  background: var(--accent-muted);
  border-radius: var(--radius-full);
  width: fit-content;
  letter-spacing: 0.02em;
  user-select: none;
}

.chat-ephemeral-notice svg {
  flex-shrink: 0;
  opacity: 0.7;
}

/* Date separator */
.chat-date-separator {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 8px 0;
  color: var(--text-tertiary);
}

.chat-date-separator::before,
.chat-date-separator::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--border-subtle);
}

.chat-date-chip {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  white-space: nowrap;
}

/* Bubbles */
.chat-bubble {
  max-width: 65%;
  padding: 9px 13px;
  border-radius: var(--radius-lg);
  word-wrap: break-word;
  white-space: pre-wrap;
  animation: msg-in 0.15s ease;
}

.chat-bubble.incoming {
  align-self: flex-start;
  background: var(--bg-tertiary);
  border-bottom-left-radius: var(--radius-xs);
}

.chat-bubble.outgoing {
  align-self: flex-end;
  background: var(--accent);
  color: var(--text-inverse);
  border-bottom-right-radius: var(--radius-xs);
}

/* Grouped bubbles — consecutive from same sender */
.chat-bubble.grouped {
  margin-top: -3px;
}

.chat-bubble.incoming.grouped {
  border-top-left-radius: var(--radius-xs);
}

.chat-bubble.outgoing.grouped {
  border-top-right-radius: var(--radius-xs);
}

.chat-bubble-text {
  font-size: 14px;
  line-height: 1.45;
}

.chat-bubble-time {
  font-size: 10px;
  opacity: 0.45;
  margin-top: 3px;
  text-align: right;
}

/* Input area */
.chat-input-area {
  padding: 10px 20px 14px;
  border-top: 1px solid var(--border);
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.chat-error {
  color: var(--danger);
  font-size: 12px;
  margin-bottom: 6px;
}

.chat-input-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.chat-input {
  flex: 1;
  padding: 10px 14px;
  font-family: inherit;
  font-size: 14px;
  color: var(--text-primary);
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  outline: none;
  transition: border-color 0.15s;
  resize: none;
  line-height: 1.45;
}

.chat-input:focus {
  border-color: var(--border-focus);
}

.chat-input::placeholder {
  color: var(--text-tertiary);
}

.chat-input:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-send {
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
```

**Step 5: Replace Scrollbar, Toast, and Modal sections**

Find `/* ============================================================` for Scrollbar section and replace everything from there to end of file with:

```css
/* ============================================================
   Scrollbar
   ============================================================ */
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-tertiary); }

/* ============================================================
   Buttons
   ============================================================ */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.btn:hover {
  background: var(--bg-hover);
  border-color: var(--text-tertiary);
}

.btn:active { transform: scale(0.97); }

.btn:disabled {
  opacity: 0.38;
  cursor: not-allowed;
  transform: none;
}

.btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--text-inverse);
}

.btn-primary:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.btn-secondary {
  background: var(--bg-tertiary);
  border-color: var(--border);
  color: var(--text-secondary);
}

.btn-secondary:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.btn-danger {
  color: var(--danger);
  border-color: transparent;
  background: none;
}

.btn-danger:hover {
  background: var(--danger-subtle);
}

.btn-sm {
  padding: 5px 10px;
  font-size: 12px;
  border-radius: var(--radius-sm);
}

.btn-icon {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px;
  border-radius: var(--radius-sm);
  transition: color 0.15s, background 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.btn-icon:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

/* ============================================================
   Inputs
   ============================================================ */
.input-field {
  width: 100%;
  padding: 8px 12px;
  font-family: inherit;
  font-size: 13px;
  color: var(--text-primary);
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  outline: none;
  transition: border-color 0.15s;
}

.input-field:focus {
  border-color: var(--border-focus);
}

.input-field::placeholder {
  color: var(--text-tertiary);
}

/* ============================================================
   Spinner
   ============================================================ */
.spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ============================================================
   Toast
   ============================================================ */
.toast-container {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-md);
  font-size: 13px;
  max-width: 320px;
  animation: toast-slide-in 0.2s ease;
}

.toast-success { border-left: 3px solid var(--success); }
.toast-error   { border-left: 3px solid var(--danger); }
.toast-warning { border-left: 3px solid var(--warning); }
.toast-info    { border-left: 3px solid var(--accent); }

.toast-icon { font-size: 12px; flex-shrink: 0; }
.toast-message { flex: 1; line-height: 1.4; }

/* ============================================================
   Modals
   ============================================================ */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
  animation: fade-in 0.15s ease;
}

.modal-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 420px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--border-subtle);
}

.modal-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.modal-close {
  color: var(--text-tertiary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  transition: color 0.15s, background 0.15s;
}

.modal-close:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.modal-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0;
}

.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

/* Share modal tabs */
.share-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-subtle);
}

.share-tab {
  flex: 1;
  padding: 10px 16px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  font-family: var(--font-sans);
}

.share-tab:hover { color: var(--text-secondary); }
.share-tab.active { color: var(--accent); border-bottom-color: var(--accent); }

.share-body { padding: 20px; }

.share-description {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0 0 14px;
  line-height: 1.5;
}

.share-link-box {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  margin-bottom: 10px;
  overflow-x: auto;
}

.share-link-text {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-secondary);
  word-break: break-all;
  line-height: 1.5;
}

.share-copy-btn { width: 100%; }

.share-file-actions { display: flex; flex-direction: column; gap: 8px; }
.share-file-actions .btn { width: 100%; }

.share-hint {
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.4;
}

.share-qr-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.share-qr-container {
  background: #fff;
  border-radius: var(--radius-md);
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.share-qr-container svg { max-width: 100%; height: auto; }

.share-qr-fallback {
  font-size: 13px;
  color: var(--text-tertiary);
  text-align: center;
  padding: 24px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
}

/* ============================================================
   Responsive
   ============================================================ */
@media (max-width: 768px) {
  :root { --sidebar-width: 280px; }
}

@media (max-width: 600px) {
  .app-layout { flex-direction: column; }
  .sidebar {
    width: 100%;
    min-width: 100%;
    max-height: 45vh;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
}
```

**Step 6: Verify no syntax errors**

Open dev server:
```bash
cd .claude/worktrees/admiring-almeida/client && npm run dev
```
Expected: Server starts with no errors. Open http://localhost:5173. Login screen should render.

**Step 7: Commit**

```bash
cd .claude/worktrees/admiring-almeida
git add client/src/App.css
git commit -m "style: rebuild App.css with animations, editorial typography, new component styles"
```

---

## Task 3: Redesign LoginScreen.jsx

**Files:**
- Modify: `client/src/components/LoginScreen.jsx`

**Step 1: Add `IconBack` import at the top**

```jsx
import { IconBack } from "./Icons";
```

**Step 2: Replace the entire return statement JSX**

Replace everything inside `return (` through the closing `);` with:

```jsx
  return (
    <div className="login-screen">
      <div className="login-card">

        {!showEnroll ? (
          <>
            <div className="login-wordmark">Dissolve</div>
            <div className="login-tagline">
              <strong>Power to the user, not the platform.</strong>
              Encrypted. Sovereign. No accounts.
            </div>

            <div className="login-actions">
              <button
                className="btn btn-primary"
                onClick={() => setShowEnroll(true)}
              >
                Create New Identity
              </button>

              <div className="login-divider"><span>or</span></div>

              <label className="btn btn-secondary" tabIndex={0}>
                Load Key File
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onLogin(file);
                    e.target.value = "";
                  }}
                />
              </label>

              <p className="login-hint">
                Select your <code>dissolve-*.usbkey.json</code> file
              </p>
            </div>
          </>
        ) : (
          <div className="enroll-form-animate">
            <div className="enroll-header">
              <button className="enroll-back-btn" type="button" onClick={handleBack}>
                <IconBack size={14} />
                Back
              </button>
              <h2>Create your identity</h2>
              <p>Your handle is your public address. Your key file is your login.</p>
            </div>

            <form className="enroll-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="enroll-handle">
                  Handle <span className="form-required">*</span>
                </label>
                <input
                  id="enroll-handle"
                  className="input-field"
                  value={handle}
                  onChange={onHandleChange}
                  placeholder="e.g. alice"
                  maxLength={32}
                  autoFocus
                  autoComplete="username"
                />
                <div className="form-hint">
                  {!handle && "2–32 chars · lowercase, numbers, hyphens, underscores"}
                  {handle && handle.length < 2 && "Too short — need at least 2 characters"}
                  {handleStatus === "checking" && (
                    <>
                      <span className="spinner" aria-hidden="true" />
                      <span className="status-checking">Checking…</span>
                    </>
                  )}
                  {handleStatus === "available" && <span className="status-available">✓ Available</span>}
                  {handleStatus === "taken" && <span className="status-taken">✗ Already taken</span>}
                  {handleStatus === "error" && <span className="status-error">Could not check availability</span>}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="enroll-name">Display Name</label>
                <input
                  id="enroll-name"
                  className="input-field"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={handle || "Optional — defaults to handle"}
                  maxLength={64}
                  autoComplete="name"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="enroll-pass">
                  Passphrase <span className="form-required">*</span>
                </label>
                <input
                  id="enroll-pass"
                  className="input-field"
                  type="password"
                  value={passphrase}
                  onChange={(e) => { setPassphrase(e.target.value); setEnrollError(null); }}
                  placeholder="Encrypts your key file"
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="enroll-confirm">
                  Confirm Passphrase <span className="form-required">*</span>
                </label>
                <input
                  id="enroll-confirm"
                  className="input-field"
                  type="password"
                  value={confirmPass}
                  onChange={(e) => { setConfirmPass(e.target.value); setEnrollError(null); }}
                  placeholder="Type it again"
                  autoComplete="new-password"
                />
                {confirmPass && passphrase !== confirmPass && (
                  <div className="form-hint status-taken">Passphrases don't match</div>
                )}
                {passphrase && passphrase.length < 4 && (
                  <div className="form-hint status-taken">At least 4 characters required</div>
                )}
              </div>

              {enrollError && <div className="form-error">{enrollError}</div>}

              <div className="enroll-actions">
                <button className="btn btn-primary" type="submit" disabled={!canSubmit}>
                  {enrolling ? <><span className="spinner" /> Creating…</> : "Create Identity"}
                </button>
                <button className="btn btn-secondary" type="button" onClick={handleBack}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
```

**Step 3: Verify in browser**

1. Go to http://localhost:5173
2. Confirm "DISSOLVE" renders in large, thin, tracked uppercase
3. Confirm tagline reads "Power to the user, not the platform." bold, then "Encrypted. Sovereign. No accounts."
4. Click "Create New Identity" — enrollment form should fade in
5. "Back" button with left-arrow SVG icon
6. Check handle availability debounce works

**Step 4: Commit**

```bash
cd .claude/worktrees/admiring-almeida
git add client/src/components/LoginScreen.jsx
git commit -m "feat: redesign login screen with editorial wordmark and tagline"
```

---

## Task 4: Redesign Sidebar.jsx

**Files:**
- Modify: `client/src/components/Sidebar.jsx`

**Step 1: Update imports**

Replace the existing imports block:

```jsx
import { useState, useRef } from "react";
import ShareModal from "./ShareModal";
import { saveJson } from "../utils/storage";
import { IconSettings, IconLogout, IconClose, IconMore, IconSearch } from "./Icons";
```

**Step 2: Replace the entire `return (...)` JSX**

```jsx
  return (
    <aside className="sidebar">

      {/* ── Settings overlay (slides over full sidebar) ── */}
      {showSettings && (
        <div className="settings-overlay" role="dialog" aria-label="Settings">
          <div className="settings-overlay-header">
            <h3>Settings</h3>
            <button
              className="btn-icon"
              onClick={() => setShowSettings(false)}
              aria-label="Close settings"
            >
              <IconClose size={16} />
            </button>
          </div>
          <div className="settings-overlay-body">

            <div className="settings-section">
              <h4>Sharing</h4>
              <div className="settings-actions">
                <button className="btn btn-sm btn-primary" onClick={() => { setShowShare(true); setShowSettings(false); }}>
                  Share Contact
                </button>
                <label className="btn btn-sm btn-secondary" tabIndex={0}>
                  Import Contact
                  <input
                    ref={importRef}
                    type="file"
                    accept=".json"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files?.[0]) onImportContact(e.target.files[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button className="btn btn-sm btn-secondary" onClick={onExportKeyfile}>
                  Export Keyfile
                </button>
              </div>
            </div>

            <div className="settings-section">
              <h4>Privacy</h4>
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={identity.archiveEnabled}
                  onChange={(e) => {
                    identity.setArchiveEnabled(e.target.checked);
                    saveJson(`archive:${identity.id}`, { enabled: e.target.checked });
                  }}
                />
                <span>Save messages locally (encrypted)</span>
              </label>
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={identity.discoverable}
                  onChange={(e) => onDiscoverabilityChange(e.target.checked, identity.handle)}
                />
                <span>Discoverable by handle</span>
              </label>
              {identity.discoverable && (
                <div style={{ marginTop: "6px" }}>
                  <input
                    className="input-field"
                    value={identity.handle}
                    onChange={(e) => {
                      const clean = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
                      onDiscoverabilityChange(identity.discoverable, clean);
                    }}
                    placeholder="e.g. alice"
                    maxLength={32}
                  />
                  <div className="hint-text" style={{ marginTop: "4px" }}>
                    Lowercase letters, numbers, hyphens, underscores
                  </div>
                </div>
              )}
            </div>

            <div className="settings-section">
              <h4>Theme</h4>
              <div className="theme-picker" role="radiogroup" aria-label="Color theme">
                {[
                  { id: "",       label: "Midnight", color: "#6c8cff" },
                  { id: "ocean",  label: "Ocean",    color: "#4da6ff" },
                  { id: "forest", label: "Forest",   color: "#4dcc7a" },
                  { id: "ember",  label: "Ember",    color: "#ff8c4d" },
                  { id: "violet", label: "Violet",   color: "#a78bfa" },
                ].map((t) => {
                  const currentTheme = document.documentElement.getAttribute("data-theme") || "";
                  const isActive = currentTheme === t.id;
                  return (
                    <button
                      key={t.id}
                      className={`theme-swatch${isActive ? " active" : ""}`}
                      style={{ background: t.color }}
                      title={t.label}
                      aria-label={t.label}
                      aria-pressed={isActive}
                      onClick={() => {
                        if (t.id) {
                          document.documentElement.setAttribute("data-theme", t.id);
                        } else {
                          document.documentElement.removeAttribute("data-theme");
                        }
                        saveJson(`theme:${identity.id}`, { theme: t.id });
                      }}
                    />
                  );
                })}
              </div>
            </div>

            <div className="settings-section">
              <h4>Relay</h4>
              <input
                className="input-field"
                value={identity.relayUrl || ""}
                onChange={(e) => {
                  identity.setRelayUrl(e.target.value);
                  saveJson(`relay:${identity.id}`, { url: e.target.value });
                }}
                placeholder="Default relay (localhost:3001)"
                style={{ fontSize: "12px" }}
                aria-label="Custom relay URL"
              />
              <div className="hint-text" style={{ marginTop: "4px" }}>
                Optional. e.g. https://relay.example.com
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Identity header ── */}
      <div className="sidebar-header">
        <div className="identity-info">
          <div className="identity-avatar" aria-hidden="true">
            {identity.label.charAt(0).toUpperCase()}
          </div>
          <div className="identity-details">
            <div className="identity-name">{identity.label}</div>
            <div className="identity-id" title={identity.id}>
              {identity.id.slice(0, 16)}…
            </div>
          </div>
        </div>
        <div className="sidebar-header-actions">
          <button
            className="btn-icon"
            onClick={() => setShowSettings(true)}
            title="Settings"
            aria-label="Settings"
          >
            <IconSettings size={16} />
          </button>
          <button
            className="btn-icon"
            onClick={onLogout}
            title="Log out"
            aria-label="Log out"
          >
            <IconLogout size={16} />
          </button>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="sidebar-body">

        {/* Directory lookup */}
        <div className="sidebar-section">
          <div className="lookup-bar">
            <input
              className="input-field"
              value={lookupHandle}
              onChange={(e) => setLookupHandle(e.target.value)}
              placeholder="Find by handle…"
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              aria-label="Look up a handle"
            />
            <button
              className="btn btn-sm"
              onClick={handleLookup}
              disabled={lookupLoading || !lookupHandle.trim()}
              aria-label="Search"
            >
              {lookupLoading ? <span className="spinner" /> : <IconSearch size={14} />}
            </button>
          </div>
          {lookupResult && (
            <div className="lookup-result">
              <div className="lookup-result-info">
                <strong>{lookupResult.label || "(no label)"}</strong>
                <span className="lookup-result-id">{lookupResult.id?.slice(0, 16)}…</span>
              </div>
              <button className="btn btn-sm btn-primary" onClick={handleSendRequest}>
                Add
              </button>
            </div>
          )}
        </div>

        {/* Contacts */}
        <div className="sidebar-section">
          <h3 className="section-title">Contacts</h3>
          {contacts.length === 0 ? (
            <p className="empty-state">No contacts yet</p>
          ) : (
            <div className="contact-list" role="list">
              {contacts.map((c) => (
                <div key={c.id} className="contact-item-wrap" role="listitem">
                  <button
                    className={`contact-item${c.id === activeId ? " active" : ""}`}
                    onClick={() => { onSelectPeer(c.id); setContactMenu(null); }}
                    aria-current={c.id === activeId ? "true" : undefined}
                  >
                    <div className="contact-accent-bar" aria-hidden="true" />
                    <div className="contact-avatar" aria-hidden="true">
                      {(c.label || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="contact-info">
                      <div className="contact-name">{c.label}</div>
                      <div className="contact-id">{c.id.slice(0, 20)}…</div>
                    </div>
                  </button>
                  <button
                    className="btn-icon contact-menu-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setContactMenu(contactMenu === c.id ? null : c.id);
                    }}
                    title="Options"
                    aria-label={`Options for ${c.label}`}
                    aria-expanded={contactMenu === c.id}
                  >
                    <IconMore size={16} />
                  </button>
                  {contactMenu === c.id && (
                    <div className="contact-actions" role="menu">
                      <button
                        className="btn btn-sm btn-danger"
                        role="menuitem"
                        onClick={() => { onBlockPeer(c.id); setContactMenu(null); }}
                      >
                        Block
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Requests */}
        {requests.length > 0 && (
          <div className="sidebar-section">
            <h3 className="section-title">
              Requests
              <span className="badge" aria-label={`${requests.length} pending`}>{requests.length}</span>
            </h3>
            <div className="request-list">
              {requests.map((r) => (
                <div key={r.id} className="request-item">
                  <div className="request-header">
                    <div className="contact-avatar request-avatar" aria-hidden="true">
                      {(r.label || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="contact-info">
                      <div className="contact-name">{r.label}</div>
                      {r.lastMessagePreview && (
                        <div className="request-preview">"{r.lastMessagePreview}"</div>
                      )}
                    </div>
                  </div>
                  <div className="request-actions">
                    <button className="btn btn-sm btn-primary" onClick={() => onAcceptRequest(r.id)}>Accept</button>
                    <button className="btn btn-sm btn-secondary" onClick={() => onRejectRequest(r.id)}>Reject</button>
                    <button className="btn btn-sm btn-danger" onClick={() => onBlockPeer(r.id)}>Block</button>
                    <button className="btn btn-sm btn-secondary" onClick={() => onSelectPeer(r.id)}>View</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>{/* end .sidebar-body */}

      {/* ── Footer ── */}
      <div className="sidebar-footer">
        <div className="session-notice">
          <span aria-hidden="true">◇</span>
          Messages ephemeral · close tab to end session
        </div>
      </div>

      {/* Share modal */}
      {showShare && (
        <ShareModal
          cardData={shareCardData}
          onDownloadCard={onExportCard}
          onDownloadProfile={onExportProfile}
          onClose={() => setShowShare(false)}
        />
      )}
    </aside>
  );
```

**Step 3: Verify in browser**

1. Log in (or create identity)
2. Sidebar shows identity name + SVG gear and logout icons (no emoji)
3. Click gear → settings overlay slides in from left with animation
4. Close settings → slides back
5. Active contact has left accent bar
6. Section headers are small-caps

**Step 4: Commit**

```bash
cd .claude/worktrees/admiring-almeida
git add client/src/components/Sidebar.jsx
git commit -m "feat: rebuild sidebar with settings overlay, SVG icons, accent-bar contact indicator"
```

---

## Task 5: Redesign ChatPanel.jsx

**Files:**
- Modify: `client/src/components/ChatPanel.jsx`

**Step 1: Update imports**

```jsx
import { useState, useRef, useEffect, useMemo } from "react";
import { IconSend, IconLock, IconAlert } from "./Icons";
```

**Step 2: Add `idCopied` state after existing state declarations**

```jsx
const [idCopied, setIdCopied] = useState(false);
```

**Step 3: Add `handleCopyId` handler**

```jsx
const handleCopyId = () => {
  navigator.clipboard.writeText(peer.id).then(() => {
    setIdCopied(true);
    setTimeout(() => setIdCopied(false), 2000);
  }).catch(() => {});
};
```

**Step 4: Replace entire `return` block**

```jsx
  if (!peer) {
    return (
      <main className="chat-panel">
        <div className="chat-empty">
          <div className="chat-empty-watermark" aria-hidden="true">◈</div>
          <div className="chat-empty-text">
            <h2>Select a contact</h2>
            <p>Choose from the sidebar to start a secure conversation</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="chat-panel" onClick={handleChatClick}>
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-avatar" aria-hidden="true">
          {(peer.label || "?").charAt(0).toUpperCase()}
        </div>
        <div className="chat-header-info">
          <div className="chat-header-name">{peer.label}</div>
          <div
            className="chat-header-id"
            onClick={handleCopyId}
            title="Click to copy full ID"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && handleCopyId()}
          >
            {peer.id.slice(0, 8)}…
            {idCopied && <span className="chat-id-copied">✓ copied</span>}
          </div>
        </div>
        {!peer.cap && (
          <div
            className="status-chip warning"
            title="No inbox capability — this contact needs to share their contact card with you"
            role="status"
          >
            <span className="status-chip-dot" aria-hidden="true" />
            Awaiting connection
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="chat-messages" ref={scrollRef} role="log" aria-live="polite">
        <div className="chat-ephemeral-notice" role="note">
          <IconLock size={11} />
          End-to-end encrypted
        </div>

        {messages.length === 0 ? (
          <div className="chat-no-messages">
            <span>No messages yet</span>
            <span>
              {peer.cap ? "Send the first message below" : "Share contact cards to enable messaging"}
            </span>
          </div>
        ) : (
          items.map((item, index) =>
            item.type === "separator" ? (
              <div key={item.key} className="chat-date-separator" aria-label={`Messages from ${item.label}`}>
                <span className="chat-date-chip">{item.label}</span>
              </div>
            ) : (() => {
              const prev = items[index - 1];
              const isGrouped = prev && prev.type === "message" && prev.dir === item.dir;
              return (
                <div
                  key={item.msgId}
                  className={`chat-bubble ${item.dir === "out" ? "outgoing" : "incoming"}${isGrouped ? " grouped" : ""}`}
                >
                  <div className="chat-bubble-text">{item.text}</div>
                  <div className="chat-bubble-time" aria-label={new Date(item.ts).toLocaleString()}>
                    {new Date(item.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              );
            })()
          )
        )}
      </div>

      {/* Input area */}
      <div className="chat-input-area">
        {error && <div className="chat-error" role="alert">{error}</div>}
        <div className="chat-input-row">
          <input
            ref={inputRef}
            className="chat-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={peer.cap ? "Type a message…" : "Request contact information first"}
            disabled={!peer.cap || sending}
            aria-label="Message input"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            className="btn btn-primary btn-send"
            onClick={handleSend}
            disabled={!text.trim() || !peer.cap || sending}
            aria-label="Send message"
            title="Send"
          >
            {sending ? <span className="spinner" aria-hidden="true" /> : <IconSend size={15} />}
          </button>
        </div>
      </div>
    </main>
  );
```

**Step 5: Verify in browser**

1. Select a contact — header shows name and shortened ID
2. Click the ID text → "✓ copied" appears for 2s
3. If contact has no cap, amber `● Awaiting connection` chip appears
4. Ephemeral notice shows lock SVG icon + "End-to-end encrypted"
5. Send button is a circular icon button with arrow SVG
6. Send messages — bubbles animate in; consecutive bubbles from same sender are slightly tighter
7. Empty state shows `◈` as large dim watermark + "Select a contact" when no peer selected

**Step 6: Commit**

```bash
cd .claude/worktrees/admiring-almeida
git add client/src/components/ChatPanel.jsx
git commit -m "feat: redesign chat panel with clickable ID, status chip, bubble grouping, SVG send"
```

---

## Task 6: Update ShareModal and PassphraseModal Icons

**Files:**
- Modify: `client/src/components/ShareModal.jsx`
- Modify: `client/src/components/PassphraseModal.jsx`

**Step 1: ShareModal — add import and replace emoji close button**

Add at top:
```jsx
import { IconClose } from "./Icons";
```

Replace:
```jsx
<button className="btn-icon modal-close" onClick={onClose}>✕</button>
```
With:
```jsx
<button className="btn-icon modal-close" onClick={onClose} aria-label="Close">
  <IconClose size={16} />
</button>
```

**Step 2: PassphraseModal — add import and replace emoji close button**

Add at top:
```jsx
import { IconClose } from "./Icons";
```

Replace:
```jsx
<button
  className="modal-close"
  onClick={onCancel}
  aria-label="Cancel"
  type="button"
>
  ✕
</button>
```
With:
```jsx
<button
  className="btn-icon modal-close"
  onClick={onCancel}
  aria-label="Cancel"
  type="button"
>
  <IconClose size={16} />
</button>
```

**Step 3: Verify in browser**

1. Click Settings → Share Contact → modal opens with SVG ✕ close button
2. Export keyfile → PassphraseModal opens with SVG ✕ close button
3. Both modals close correctly when clicking ✕ or backdrop

**Step 4: Commit**

```bash
cd .claude/worktrees/admiring-almeida
git add client/src/components/ShareModal.jsx client/src/components/PassphraseModal.jsx
git commit -m "style: replace emoji close buttons with SVG IconClose in modals"
```

---

## Task 7: Update App.jsx — Session Restore Screen

**Files:**
- Modify: `client/src/App.jsx`

**Step 1: Find the session-restore loading screen and update it**

Find:
```jsx
  if (!identity.sessionChecked) {
    return (
      <div className="login-screen">
        <div className="login-card" style={{ textAlign: "center" }}>
          <span className="login-logo-icon">◈</span>
          <p style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>Restoring session…</p>
        </div>
        <ToastContainer toasts={toasts} />
      </div>
    );
  }
```

Replace with:
```jsx
  if (!identity.sessionChecked) {
    return (
      <div className="login-screen">
        <div className="login-card" style={{ textAlign: "center" }}>
          <div className="login-wordmark" style={{ marginBottom: "12px" }}>Dissolve</div>
          <p style={{ color: "var(--text-tertiary)", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <span className="spinner" />
            Restoring session…
          </p>
        </div>
        <ToastContainer toasts={toasts} />
      </div>
    );
  }
```

**Step 2: Verify**

Reload the page when logged in — should see the "Dissolve" wordmark with a spinner while session restores.

**Step 3: Commit**

```bash
cd .claude/worktrees/admiring-almeida
git add client/src/App.jsx
git commit -m "style: update session restore screen to use wordmark + spinner"
```

---

## Task 8: Final Review Pass

**Step 1: Do a full visual walkthrough**

Start dev server if not running:
```bash
cd .claude/worktrees/admiring-almeida/client && npm run dev
```

Checklist:
- [ ] Login screen: DISSOLVE wordmark thin uppercase, tagline visible, two buttons
- [ ] Create Identity: form fades in, Back button has arrow icon, handle checking works
- [ ] Sidebar: SVG gear + logout icons, no emoji
- [ ] Settings slide-over: opens/closes with animation, all sections present
- [ ] Active contact: left accent bar visible
- [ ] Section headers: small uppercase tracked
- [ ] Footer: short one-liner
- [ ] Chat header: name + shortened clickable ID + status chip (if no cap)
- [ ] Ephemeral notice: lock icon + "End-to-end encrypted"
- [ ] Messages: fade-in animation visible, bubble grouping visible
- [ ] Send button: circular icon button with arrow SVG
- [ ] Empty state: "◈" dim watermark + "Select a contact"
- [ ] Theme switching still works
- [ ] Relay URL setting still works
- [ ] Share modal opens, close button is SVG ✕
- [ ] Passphrase modal opens, close button is SVG ✕
- [ ] Toast notifications show on success/error

**Step 2: Test all five themes**

In settings, cycle through Midnight → Ocean → Forest → Ember → Violet.
All components should adapt correctly (CSS variables cascade).

**Step 3: Check `prefers-reduced-motion`**

In browser DevTools → Rendering → Emulate CSS prefers-reduced-motion: reduce.
Verify no jarring animations fire (elements appear instantly instead).

**Step 4: Final commit if any small fixes were made**

```bash
cd .claude/worktrees/admiring-almeida
git add -p  # stage only intentional changes
git commit -m "style: final polish pass — review fixes"
```

---

## Done

All 8 tasks complete. The UI is now:
- **Editorial dark aesthetic** with thin uppercase wordmark, tracked section headers
- **SVG icons** throughout — no emoji in interactive elements
- **Micro-animations** on settings overlay, message bubbles, contacts
- **Polished language** — "Awaiting connection", shortened notices, clean copy
- **Bubble grouping** for natural conversation flow
- **Accessible** — aria-labels, aria-live, prefers-reduced-motion
