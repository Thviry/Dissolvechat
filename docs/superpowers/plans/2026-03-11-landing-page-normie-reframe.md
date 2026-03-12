# Landing Page Normie Reframe — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the dissolve.chat landing page to convert non-technical visitors by leading with simplicity, adding a comparison table, and pushing crypto details lower.

**Architecture:** Static HTML/CSS/JS landing page. No build tools, no frameworks. Three files: `landing/index.html`, `landing/style.css`, `landing/script.js`. Changes are structural (new HTML sections, new CSS, updated nav targets). script.js needs no logic changes — only the DOM IDs it wires up must remain stable.

**Tech Stack:** HTML, CSS, vanilla JS. Hosted via Caddy on IONOS VPS at `/opt/dissolve/landing`.

**Spec:** `docs/superpowers/specs/2026-03-11-landing-page-normie-reframe-design.md`

---

## Chunk 1: HTML Restructure

### Task 1: Rewrite hero section

**Files:**
- Modify: `landing/index.html:28-60` (hero section)

- [ ] **Step 1: Replace hero content**

Replace the entire `<section class="hero" id="hero">` with:

```html
<!-- Hero -->
<section class="hero" id="hero">
  <div class="hero-inner">
    <div class="hero-tag">
      <span class="blink">_</span> OPEN BETA — v<span id="hero-version-num">0.1.6</span>
    </div>
    <h1 class="hero-title">
      <span class="reveal-line">No account.</span>
      <span class="reveal-line">No phone number.</span>
      <span class="reveal-line accent-line">Just talk.</span>
    </h1>
    <p class="hero-sub reveal-fade">
      Dissolve is a free, open-source chat app that doesn't know who you are.
    </p>
    <div class="hero-ctas reveal-fade">
      <a href="#" class="btn btn-primary" id="hero-download-btn">
        Download for <span id="hero-os">Windows</span>
      </a>
      <a href="#" id="nav-github-hero" class="btn btn-ghost" target="_blank" rel="noopener">
        View on GitHub
      </a>
    </div>
    <div class="hero-alt reveal-fade">
      <a href="#" id="alt-windows" class="alt-link">Windows</a>
      <span class="alt-sep">/</span>
      <a href="#" id="alt-mac" class="alt-link">macOS</a>
      <span class="alt-sep">/</span>
      <a href="#" id="alt-linux" class="alt-link">Linux</a>
    </div>
    <div class="hero-screenshot reveal-fade">
      <img src="screenshot.png" alt="Dissolve chat interface" class="hero-screenshot-img"
           onerror="this.parentElement.innerHTML='<div class=\'screenshot-placeholder\'>App preview coming soon</div>'" />
    </div>
  </div>
</section>
```

- [ ] **Step 2: Verify DOM IDs preserved**

Confirm these IDs still exist (script.js depends on them): `hero-version-num`, `hero-download-btn`, `hero-os`, `nav-github-hero`, `alt-windows`, `alt-mac`, `alt-linux`.

- [ ] **Step 3: Commit**

```bash
git add landing/index.html
git commit -m "feat(landing): rewrite hero — simple hook, screenshot placeholder"
```

---

### Task 2: Update nav links

**Files:**
- Modify: `landing/index.html:17-25` (nav)

- [ ] **Step 1: Update nav link text and hrefs**

Replace the nav links:

```html
<nav class="nav">
  <a href="/" class="nav-wordmark">[DISSOLVE]</a>
  <div class="nav-links">
    <a href="#how-it-works" class="nav-link">How</a>
    <a href="#compare" class="nav-link">Compare</a>
    <a href="#download" class="nav-link">Download</a>
    <a href="#" id="nav-github" class="nav-link" target="_blank" rel="noopener">GitHub</a>
  </div>
</nav>
```

- [ ] **Step 2: Commit**

```bash
git add landing/index.html
git commit -m "feat(landing): update nav links for new section structure"
```

---

### Task 3: Add "How It Works" section

**Files:**
- Modify: `landing/index.html` (insert after hero, before threats)

- [ ] **Step 1: Add the how-it-works section**

Insert after the closing `</section>` of the hero and before the threats section:

```html
<!-- How It Works -->
<section class="how-it-works" id="how-it-works">
  <div class="section-inner">
    <p class="section-tag reveal-fade">// HOW_IT_WORKS</p>
    <h2 class="section-title reveal-fade">Three steps. That's it.</h2>
    <div class="steps-grid">
      <div class="step-card reveal-fade">
        <span class="step-num">01</span>
        <h3 class="step-title">Pick a handle</h3>
        <p class="step-body">Choose a name. No email, no phone number, no verification.</p>
      </div>
      <div class="step-card reveal-fade">
        <span class="step-num">02</span>
        <h3 class="step-title">Share it</h3>
        <p class="step-body">Send your handle to a friend. They add you by name.</p>
      </div>
      <div class="step-card reveal-fade">
        <span class="step-num">03</span>
        <h3 class="step-title">Start talking</h3>
        <p class="step-body">Messages are encrypted end-to-end. The server never sees them.</p>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Commit**

```bash
git add landing/index.html
git commit -m "feat(landing): add how-it-works 3-step section"
```

---

### Task 4: Add comparison table section

**Files:**
- Modify: `landing/index.html` (insert after how-it-works, before threats)

- [ ] **Step 1: Add the comparison section**

Insert after the how-it-works section:

```html
<!-- Comparison -->
<section class="compare" id="compare">
  <div class="section-inner">
    <p class="section-tag reveal-fade">// WHY_SWITCH</p>
    <h2 class="section-title reveal-fade">Why not just use...?</h2>
    <div class="compare-wrap reveal-fade">
      <table class="compare-table">
        <thead>
          <tr>
            <th></th>
            <th class="compare-dissolve">Dissolve</th>
            <th>WhatsApp</th>
            <th>Signal</th>
            <th>iMessage</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="compare-label">Needs phone number</td>
            <td class="compare-dissolve compare-yes">No</td>
            <td class="compare-no">Yes</td>
            <td class="compare-no">Yes</td>
            <td>No<sup>*</sup></td>
          </tr>
          <tr>
            <td class="compare-label">Needs email</td>
            <td class="compare-dissolve compare-yes">No</td>
            <td class="compare-yes">No</td>
            <td class="compare-yes">No</td>
            <td class="compare-no">Yes</td>
          </tr>
          <tr>
            <td class="compare-label">Server retains messages</td>
            <td class="compare-dissolve compare-yes">No</td>
            <td class="compare-no">Yes</td>
            <td>No<sup>**</sup></td>
            <td class="compare-no">Yes</td>
          </tr>
          <tr>
            <td class="compare-label">Phone number to find contacts</td>
            <td class="compare-dissolve compare-yes">No</td>
            <td class="compare-no">Yes</td>
            <td class="compare-no">Yes</td>
            <td class="compare-no">Yes</td>
          </tr>
          <tr>
            <td class="compare-label">Open source</td>
            <td class="compare-dissolve compare-yes">Yes</td>
            <td class="compare-no">No</td>
            <td class="compare-yes">Yes</td>
            <td class="compare-no">No</td>
          </tr>
          <tr>
            <td class="compare-label">Run your own server</td>
            <td class="compare-dissolve compare-yes">Yes</td>
            <td class="compare-no">No</td>
            <td class="compare-no">No</td>
            <td class="compare-no">No</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="compare-footnotes reveal-fade">
      <span>* iMessage requires an Apple ID (email) — still an identity you don't control.</span><br />
      <span>** Signal queues encrypted messages temporarily until delivered, but does not retain them long-term.</span>
    </p>
  </div>
</section>
```

- [ ] **Step 2: Commit**

```bash
git add landing/index.html
git commit -m "feat(landing): add comparison table vs WhatsApp/Signal/iMessage"
```

---

### Task 5: Update feature card copy (trim jargon)

**Files:**
- Modify: `landing/index.html` (features section, cards 02, 03, 04)

- [ ] **Step 1: Update card 02 body text**

Find the feature card with `<h3 class="feature-title">The server is a dumb pipe.</h3>` and replace its `<p class="feature-body">` content with:

```
It routes encrypted blobs. It never sees your messages, never stores
keys, and can't impersonate anyone. You can even run your own.
```

- [ ] **Step 2: Update card 03 body text**

Find the feature card with `<h3 class="feature-title">You control who reaches you.</h3>` and replace its `<p class="feature-body">` content with:

```
To message you, someone needs a token you gave them. Revoke any
token instantly — cut off one sender without touching your inbox.
```

- [ ] **Step 3: Update card 04 body text**

Find the feature card with `<h3 class="feature-title">Group chat. Same zero trust.</h3>` and replace its `<p class="feature-body">` content with:

```
Every group message gets its own encryption key. The server never
knows a group exists. Same security as 1-to-1.
```

- [ ] **Step 4: Commit**

```bash
git add landing/index.html
git commit -m "feat(landing): trim crypto jargon from feature cards"
```

---

### Task 6: Update download CTA copy

**Files:**
- Modify: `landing/index.html:174-203` (cta-section)

- [ ] **Step 1: Update CTA subtitle**

Replace the `<p class="cta-sub">` content:

```html
<p class="cta-sub reveal-fade">
  Free. No account. Takes 30 seconds.<br />
  Open beta — things may break. Ship fast, fix fast.
</p>
```

- [ ] **Step 2: Add GitHub stars line to CTA note**

Replace the `<p class="cta-note">` content:

```html
<p class="cta-note reveal-fade">
  Open source — <a href="#" id="dl-github-link" target="_blank" rel="noopener">view on GitHub</a>.
  Early adopters and contributors welcome.
</p>
```

Note: The `dl-github-link` ID is preserved for script.js wiring.

- [ ] **Step 3: Commit**

```bash
git add landing/index.html
git commit -m "feat(landing): simplify download CTA copy"
```

---

## Chunk 2: CSS Additions

### Task 7: Add hero screenshot styles

**Files:**
- Modify: `landing/style.css` (after hero-alt styles, around line 245)

- [ ] **Step 1: Add screenshot and placeholder CSS**

Add after the `.alt-sep` rule (line 245):

```css
/* ── Hero screenshot ── */
.hero-screenshot {
  margin-top: 48px;
  max-width: 720px;
}

.hero-screenshot-img {
  width: 100%;
  border-radius: 4px;
  border: 1px solid var(--border);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.screenshot-placeholder {
  width: 100%;
  padding: 80px 32px;
  border: 1px dashed var(--border-accent);
  border-radius: 4px;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--text-muted);
}
```

- [ ] **Step 2: Commit**

```bash
git add landing/style.css
git commit -m "feat(landing): add hero screenshot and placeholder styles"
```

---

### Task 8: Add "How It Works" step card styles

**Files:**
- Modify: `landing/style.css` (after screenshot styles)

- [ ] **Step 1: Add step section CSS**

Add after the screenshot styles:

```css
/* ── How It Works ── */
.how-it-works {
  padding: 100px 0;
  border-top: 1px solid var(--border);
}

.how-it-works .section-title {
  margin-bottom: 40px;
}

.steps-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.step-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 28px 24px 24px;
  transition: border-color 200ms, background 200ms;
}
.step-card:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-accent);
}

.step-num {
  display: block;
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 1.6rem;
  color: var(--accent);
  opacity: 0.4;
  line-height: 1;
  margin-bottom: 16px;
}

.step-title {
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text);
  margin-bottom: 8px;
}

.step-body {
  font-size: 0.88rem;
  color: var(--text-dim);
  line-height: 1.65;
}
```

- [ ] **Step 2: Commit**

```bash
git add landing/style.css
git commit -m "feat(landing): add how-it-works step card styles"
```

---

### Task 9: Add comparison table styles

**Files:**
- Modify: `landing/style.css` (after step card styles)

- [ ] **Step 1: Add comparison section CSS**

```css
/* ── Comparison table ── */
.compare {
  padding: 100px 0;
  border-top: 1px solid var(--border);
}

.compare .section-title {
  margin-bottom: 40px;
}

.compare-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin-bottom: 20px;
}

.compare-table {
  width: 100%;
  min-width: 580px;
  border-collapse: collapse;
  font-family: var(--font-mono);
  font-size: 0.82rem;
}

.compare-table th,
.compare-table td {
  padding: 14px 16px;
  text-align: center;
  border-bottom: 1px solid var(--border);
}

.compare-table th {
  font-weight: 600;
  font-size: 0.78rem;
  color: var(--text-muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding-bottom: 12px;
  border-bottom-color: var(--border-accent);
}

.compare-table th.compare-dissolve {
  color: var(--accent);
}

.compare-table td:first-child {
  text-align: left;
  font-weight: 500;
  color: var(--text-dim);
}

.compare-table td.compare-dissolve {
  color: var(--accent);
  font-weight: 600;
}

.compare-table td.compare-yes {
  color: var(--accent);
}

.compare-table td.compare-no {
  color: var(--text-muted);
}

.compare-table tbody tr {
  transition: background 150ms;
}
.compare-table tbody tr:hover {
  background: var(--bg-card);
}

.compare-table sup {
  font-size: 0.65rem;
  color: var(--text-muted);
}

.compare-footnotes {
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.8;
}
```

- [ ] **Step 2: Commit**

```bash
git add landing/style.css
git commit -m "feat(landing): add comparison table styles"
```

---

### Task 10: Add responsive rules for new sections

**Files:**
- Modify: `landing/style.css` (inside the `@media (max-width: 700px)` block)

- [ ] **Step 1: Add responsive rules**

Add inside the existing `@media (max-width: 700px)` block:

```css
  .hero-screenshot { margin-top: 32px; }

  .how-it-works { padding: 60px 0; }
  .steps-grid { grid-template-columns: 1fr; }

  .compare { padding: 60px 0; }
  .compare-table td:first-child {
    position: sticky;
    left: 0;
    background: var(--bg);
    z-index: 1;
    white-space: nowrap;
  }
  .compare-table tbody tr:hover td:first-child {
    background: var(--bg-card);
  }
```

- [ ] **Step 2: Commit**

```bash
git add landing/style.css
git commit -m "feat(landing): responsive rules for steps and comparison table"
```

---

## Chunk 3: Verification

### Task 11: Open locally and verify

**Files:**
- Check: `landing/index.html` (open in browser)

- [ ] **Step 1: Verify page renders correctly**

Open `landing/index.html` in a browser. Verify:
- Hero shows new headline, subtitle, screenshot placeholder
- Nav links scroll to correct sections
- "How It Works" shows 3 cards in a row (1 column on mobile)
- Comparison table renders with accent on Dissolve column, footnotes below
- Threat landscape and feature sections appear below comparison
- Download CTA shows updated copy with motto preserved as headline
- All download links work (script.js wires them up)
- Scroll reveal animations trigger on each section
- Mobile view (resize to <700px): steps stack, table scrolls horizontally with sticky labels

- [ ] **Step 2: User reviews the page before final commit**

Let the user open the file locally and approve the visual result before deploying.
