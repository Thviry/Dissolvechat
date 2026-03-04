# Landing Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a static HTML landing page at `landing/` that serves as the public face of Dissolve at dissolve.chat, driving desktop client downloads via GitHub Releases.

**Architecture:** Single-page static site — `index.html`, `style.css`, `script.js`. No build step. JS handles only OS detection and GitHub Release URL construction. Deploy via Netlify pointed at the `landing/` subdirectory of the monorepo.

**Tech Stack:** Vanilla HTML5, CSS3 (custom properties), vanilla JS (ES modules). Google Fonts (Syne, Outfit, JetBrains Mono). No dependencies.

---

## Configuration (fill in before first deploy)

Edit `landing/script.js` after the repo is public:

```js
const GITHUB_REPO = 'YOUR_USERNAME/dissolve';   // e.g. 'jacob/dissolve'
const RELEASE_VERSION = '0.1.0-beta';            // matches git tag
const RELEASE_ASSETS = {
  windows: `Dissolve_${RELEASE_VERSION}_x64-setup.exe`,
  mac:     `Dissolve_${RELEASE_VERSION}_universal.dmg`,
  linux:   `Dissolve_${RELEASE_VERSION}_amd64.AppImage`,
};
```

---

### Task 1: Scaffold the landing/ directory

**Files:**
- Create: `landing/index.html`
- Create: `landing/style.css`
- Create: `landing/script.js`

**Step 1: Create the directory and stub files**

```bash
mkdir landing
```

Create `landing/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dissolve — Encrypted messaging you own</title>
  <meta name="description" content="P2P end-to-end encrypted chat. No phone number. No accounts. Your identity is a file you control." />
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <main>
    <!-- sections added in later tasks -->
  </main>
  <script type="module" src="script.js"></script>
</body>
</html>
```

Create `landing/style.css` — empty file for now.

Create `landing/script.js` — empty file for now.

**Step 2: Verify it opens in browser**

Open `landing/index.html` in a browser. Expect: blank white page, no console errors.

**Step 3: Commit**

```bash
git add landing/
git commit -m "feat(landing): scaffold landing/ directory"
```

---

### Task 2: CSS — Design system and base styles

**Files:**
- Modify: `landing/style.css`

**Step 1: Add design tokens, reset, and base typography**

Copy the CSS variables from `client/src/App.css` (lines 13–77) and add page-level base styles.

Write `landing/style.css`:

```css
@import url("https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Outfit:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap");

/* Design tokens — identical to app */
:root {
  --bg-void:      #060a12;
  --bg-primary:   #090d18;
  --bg-secondary: #0d1320;
  --bg-tertiary:  #131b2e;
  --bg-hover:     #1a2438;
  --bg-active:    #1e2b44;

  --text-primary:   #e0e7f5;
  --text-secondary: #7a8fab;
  --text-tertiary:  #374563;

  --accent:        #38bdf8;
  --accent-hover:  #7dd3fc;
  --accent-deep:   #0ea5e9;
  --accent-subtle: rgba(56, 189, 248, 0.10);
  --accent-glow:   rgba(56, 189, 248, 0.22);

  --success: #34d399;
  --border:        rgba(255, 255, 255, 0.07);
  --border-focus:  rgba(56, 189, 248, 0.55);

  --radius-sm:   6px;
  --radius-md:   10px;
  --radius-lg:   14px;
  --radius-xl:   20px;
  --radius-full: 9999px;

  --shadow-md: 0 4px 24px rgba(0, 0, 0, 0.60);
  --shadow-lg: 0 12px 52px rgba(0, 0, 0, 0.75);

  --font-display: "Syne", system-ui, sans-serif;
  --font-sans:    "Outfit", system-ui, sans-serif;
  --font-mono:    "JetBrains Mono", monospace;

  --t-base: 160ms ease;
  --t-slow: 260ms cubic-bezier(0.4, 0, 0.2, 1);

  --max-width: 960px;
}

/* Reset */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { scroll-behavior: smooth; }

body {
  background: var(--bg-void);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

a { color: var(--accent); text-decoration: none; }
a:hover { color: var(--accent-hover); }

/* Grid-dot hero background */
.grid-bg {
  background-image: radial-gradient(circle, rgba(56, 189, 248, 0.12) 1px, transparent 1px);
  background-size: 28px 28px;
}

/* Section wrapper */
.section {
  width: 100%;
  padding: 80px 24px;
}

.section-inner {
  max-width: var(--max-width);
  margin: 0 auto;
}

/* Section heading */
.section-label {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 12px;
}

.section-title {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  color: var(--text-primary);
  margin-bottom: 16px;
}

.section-body {
  color: var(--text-secondary);
  font-size: 1.05rem;
  max-width: 600px;
}
```

**Step 2: Verify in browser**

Reload `landing/index.html`. Expect: dark `#060a12` background, no console errors.

**Step 3: Commit**

```bash
git add landing/style.css
git commit -m "feat(landing): add design system tokens and base styles"
```

---

### Task 3: Hero section

**Files:**
- Modify: `landing/index.html`
- Modify: `landing/style.css`

**Step 1: Add hero HTML inside `<main>`**

```html
<section class="section hero grid-bg">
  <div class="section-inner hero-inner">
    <div class="hero-badge">
      <span class="hero-badge-dot"></span>
      Open Beta
    </div>
    <h1 class="hero-title">Encrypted messaging<br />you actually own.</h1>
    <p class="hero-subtitle">
      No phone number. No accounts. No platform.
      Your identity is a cryptographic key pair stored on your device —
      not on someone else's server.
    </p>
    <div class="hero-cta">
      <a href="#" class="btn btn-primary" id="hero-download-btn">
        Download for <span id="hero-os">Windows</span>
      </a>
      <div class="hero-alt-links">
        <a href="#" id="alt-windows" class="alt-link">Windows</a>
        <span class="alt-sep">·</span>
        <a href="#" id="alt-mac" class="alt-link">macOS</a>
        <span class="alt-sep">·</span>
        <a href="#" id="alt-linux" class="alt-link">Linux</a>
      </div>
    </div>
    <p class="hero-version" id="hero-version">v0.1.0-beta · Open source</p>
  </div>
</section>
```

**Step 2: Add hero CSS to `style.css`**

```css
/* ── Hero ── */
.hero {
  min-height: 100vh;
  display: flex;
  align-items: center;
  position: relative;
  overflow: hidden;
}

.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(56, 189, 248, 0.08) 0%, transparent 70%);
  pointer-events: none;
}

.hero-inner {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 24px;
  position: relative;
  z-index: 1;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.hero-badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 6px var(--success);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.hero-title {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(2.5rem, 7vw, 4.5rem);
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.hero-subtitle {
  font-size: clamp(1rem, 2vw, 1.2rem);
  color: var(--text-secondary);
  max-width: 560px;
  line-height: 1.65;
}

.hero-cta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
  margin-top: 8px;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 14px 28px;
  border-radius: var(--radius-md);
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all var(--t-base);
  border: none;
  text-decoration: none;
}

.btn-primary {
  background: var(--accent);
  color: #060a12;
  box-shadow: 0 0 32px var(--accent-glow);
}

.btn-primary:hover {
  background: var(--accent-hover);
  color: #060a12;
  transform: translateY(-1px);
  box-shadow: 0 0 48px var(--accent-glow);
}

.hero-alt-links {
  display: flex;
  align-items: center;
  gap: 8px;
}

.alt-link {
  font-size: 0.875rem;
  color: var(--text-secondary);
  transition: color var(--t-base);
}

.alt-link:hover { color: var(--accent); }

.alt-sep { color: var(--text-tertiary); }

.hero-version {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-tertiary);
}
```

**Step 3: Verify in browser**

Reload. Expect: dark full-height hero, large heading, download button, grid-dot background, pulsing green badge. Button is not yet wired up — that's Task 8.

**Step 4: Commit**

```bash
git add landing/index.html landing/style.css
git commit -m "feat(landing): add hero section"
```

---

### Task 4: Three Pillars section

**Files:**
- Modify: `landing/index.html`
- Modify: `landing/style.css`

**Step 1: Add pillars HTML after hero section**

```html
<section class="section pillars">
  <div class="section-inner">
    <p class="section-label">Why Dissolve</p>
    <h2 class="section-title">Built different, by design.</h2>
    <div class="pillars-grid">
      <div class="pillar">
        <div class="pillar-icon">◈</div>
        <h3 class="pillar-heading">Your identity is a file you control.</h3>
        <p class="pillar-body">
          No phone number, no email, no server-side account. Your identity is a
          cryptographic key pair saved on your device. Back it up, move it between
          devices, or run it from a USB drive. If you lose it, no one can recover
          it — and no one can take it from you.
        </p>
      </div>
      <div class="pillar">
        <div class="pillar-icon">⟁</div>
        <h3 class="pillar-heading">The server is a dumb pipe.</h3>
        <p class="pillar-body">
          The relay routes encrypted blobs. It never sees message content, never
          stores private keys, and can't impersonate users. Every message uses
          ephemeral keys for forward secrecy. The relay is designed to be untrusted
          — and replaceable.
        </p>
      </div>
      <div class="pillar">
        <div class="pillar-icon">⌘</div>
        <h3 class="pillar-heading">You control who can reach you.</h3>
        <p class="pillar-body">
          Capability-based addressing: to message you, someone needs a token
          you issued. No token, no delivery. Revoke any individual token instantly
          — cut off a sender without blocking your entire inbox. No other
          messenger gives you this control.
        </p>
      </div>
    </div>
  </div>
</section>
```

**Step 2: Add pillars CSS**

```css
/* ── Pillars ── */
.pillars {
  background: var(--bg-primary);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.pillars-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 32px;
  margin-top: 48px;
}

.pillar {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-right: 2px solid var(--accent);
  border-radius: var(--radius-lg);
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  transition: border-color var(--t-base), box-shadow var(--t-base);
}

.pillar:hover {
  border-right-color: var(--accent-hover);
  box-shadow: var(--shadow-md);
}

.pillar-icon {
  font-size: 1.75rem;
  color: var(--accent);
  line-height: 1;
}

.pillar-heading {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--text-primary);
  line-height: 1.3;
}

.pillar-body {
  color: var(--text-secondary);
  font-size: 0.95rem;
  line-height: 1.65;
}
```

**Step 3: Verify in browser**

Expect: three cards in a grid, dark surfaces, accent right-border (the app's signature detail), icons in sky blue.

**Step 4: Commit**

```bash
git add landing/index.html landing/style.css
git commit -m "feat(landing): add three pillars section"
```

---

### Task 5: How It Works section

**Files:**
- Modify: `landing/index.html`
- Modify: `landing/style.css`

**Step 1: Add how-it-works HTML**

```html
<section class="section how">
  <div class="section-inner">
    <p class="section-label">How it works</p>
    <h2 class="section-title">Simple to use. Hard to compromise.</h2>
    <ol class="steps">
      <li class="step">
        <span class="step-num">01</span>
        <div class="step-content">
          <h3 class="step-heading">Create your identity</h3>
          <p class="step-body">Generate a cryptographic key pair encrypted with a passphrase. Saved as a portable file — no servers, no accounts.</p>
        </div>
      </li>
      <li class="step">
        <span class="step-num">02</span>
        <div class="step-content">
          <h3 class="step-heading">Exchange contact cards</h3>
          <p class="step-body">Share your public key and a capability token with contacts. They do the same. That token is the only thing that lets them reach your inbox.</p>
        </div>
      </li>
      <li class="step">
        <span class="step-num">03</span>
        <div class="step-content">
          <h3 class="step-heading">Messages encrypt on your device</h3>
          <p class="step-body">Before a message leaves your device, it's encrypted end-to-end with a fresh ephemeral key. The relay receives an opaque blob.</p>
        </div>
      </li>
      <li class="step">
        <span class="step-num">04</span>
        <div class="step-content">
          <h3 class="step-heading">The relay routes, nothing more</h3>
          <p class="step-body">The relay validates your capability token and forwards the blob. It never sees plaintext, never stores keys, and can be replaced by any compatible server.</p>
        </div>
      </li>
    </ol>
  </div>
</section>
```

**Step 2: Add how-it-works CSS**

```css
/* ── How It Works ── */
.steps {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-top: 48px;
  border-left: 1px solid var(--border);
  padding-left: 0;
}

.step {
  display: flex;
  align-items: flex-start;
  gap: 32px;
  padding: 32px 0 32px 40px;
  position: relative;
  border-bottom: 1px solid var(--border);
}

.step:last-child { border-bottom: none; }

.step::before {
  content: '';
  position: absolute;
  left: -5px;
  top: 36px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent-glow);
}

.step-num {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--accent);
  min-width: 28px;
  padding-top: 4px;
  letter-spacing: 0.05em;
}

.step-content { display: flex; flex-direction: column; gap: 8px; }

.step-heading {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--text-primary);
}

.step-body {
  color: var(--text-secondary);
  font-size: 0.95rem;
  line-height: 1.65;
  max-width: 560px;
}
```

**Step 3: Verify in browser**

Expect: vertical timeline with four steps, accent dots on the left border, mono step numbers.

**Step 4: Commit**

```bash
git add landing/index.html landing/style.css
git commit -m "feat(landing): add how-it-works section"
```

---

### Task 6: Download section

**Files:**
- Modify: `landing/index.html`
- Modify: `landing/style.css`

**Step 1: Add download HTML**

```html
<section class="section download" id="download">
  <div class="section-inner">
    <p class="section-label">Download</p>
    <h2 class="section-title">Get Dissolve.</h2>
    <p class="section-body">Free. Open source. No account required.</p>
    <div class="download-grid">
      <a href="#" class="download-card" id="dl-windows">
        <span class="dl-icon">⊞</span>
        <span class="dl-platform">Windows</span>
        <span class="dl-format">.exe installer</span>
      </a>
      <a href="#" class="download-card" id="dl-mac">
        <span class="dl-icon">⌘</span>
        <span class="dl-platform">macOS</span>
        <span class="dl-format">.dmg · Universal</span>
      </a>
      <a href="#" class="download-card" id="dl-linux">
        <span class="dl-icon">❯</span>
        <span class="dl-platform">Linux</span>
        <span class="dl-format">.AppImage</span>
      </a>
    </div>
    <p class="download-note">
      All releases on <a href="#" id="dl-github-link" target="_blank" rel="noopener">GitHub</a>.
      Want to run your own relay? <a href="SELF_HOSTING.md" target="_blank">Self-hosting guide →</a>
    </p>
  </div>
</section>
```

**Step 2: Add download CSS**

```css
/* ── Download ── */
.download {
  background: var(--bg-primary);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.download-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-top: 40px;
}

.download-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 24px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  text-align: center;
  transition: all var(--t-base);
  text-decoration: none;
}

.download-card:hover {
  border-color: var(--accent);
  background: var(--bg-hover);
  color: var(--text-primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.dl-icon {
  font-size: 2rem;
  color: var(--accent);
  line-height: 1;
}

.dl-platform {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.1rem;
}

.dl-format {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.download-note {
  margin-top: 28px;
  font-size: 0.875rem;
  color: var(--text-secondary);
}
```

**Step 3: Verify in browser**

Expect: three download cards in a row, hover lifts them slightly, accent border on hover. Links are not wired yet — that's Task 8.

**Step 4: Commit**

```bash
git add landing/index.html landing/style.css
git commit -m "feat(landing): add download section"
```

---

### Task 7: Footer and nav

**Files:**
- Modify: `landing/index.html`
- Modify: `landing/style.css`

**Step 1: Add a minimal nav and footer**

Add before `<main>`:

```html
<nav class="nav">
  <a href="/" class="nav-wordmark">Dissolve</a>
  <div class="nav-links">
    <a href="#download" class="nav-link">Download</a>
    <a href="#" id="nav-github" class="nav-link" target="_blank" rel="noopener">GitHub</a>
  </div>
</nav>
```

Add after `</main>`:

```html
<footer class="footer">
  <div class="footer-inner">
    <span class="footer-wordmark">Dissolve</span>
    <p class="footer-tagline">No accounts. No phone numbers. No platform.</p>
    <div class="footer-links">
      <a href="#" id="footer-github" target="_blank" rel="noopener">GitHub</a>
      <a href="SELF_HOSTING.md" target="_blank">Self-hosting</a>
      <a href="#" id="footer-license">MIT License</a>
    </div>
    <p class="footer-copy">Open source. Build it yourself.</p>
  </div>
</footer>
```

**Step 2: Add nav and footer CSS**

```css
/* ── Nav ── */
.nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 32px;
  background: rgba(6, 10, 18, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}

.nav-wordmark {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.25rem;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.nav-wordmark:hover { color: var(--text-primary); }

.nav-links { display: flex; gap: 24px; align-items: center; }

.nav-link {
  font-size: 0.9rem;
  color: var(--text-secondary);
  transition: color var(--t-base);
}

.nav-link:hover { color: var(--accent); }

/* Offset hero for fixed nav */
.hero { padding-top: 80px; }

/* ── Footer ── */
.footer {
  padding: 60px 24px;
  border-top: 1px solid var(--border);
}

.footer-inner {
  max-width: var(--max-width);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
}

.footer-wordmark {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.5rem;
  color: var(--text-primary);
}

.footer-tagline {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text-secondary);
  letter-spacing: 0.05em;
}

.footer-links {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  justify-content: center;
}

.footer-links a {
  font-size: 0.875rem;
  color: var(--text-secondary);
  transition: color var(--t-base);
}

.footer-links a:hover { color: var(--accent); }

.footer-copy {
  font-size: 0.8rem;
  color: var(--text-tertiary);
}
```

**Step 3: Verify in browser**

Expect: sticky nav at top with backdrop blur, footer with wordmark and links, no layout breaks.

**Step 4: Commit**

```bash
git add landing/index.html landing/style.css
git commit -m "feat(landing): add nav and footer"
```

---

### Task 8: JS — OS detection and GitHub Release URL builder

**Files:**
- Modify: `landing/script.js`

**Step 1: Write `script.js`**

```js
// ── Configuration — update before each release ─────────────────────────────
const GITHUB_REPO    = 'YOUR_USERNAME/dissolve';  // e.g. 'jacob/dissolve'
const RELEASE_VERSION = '0.1.0-beta';
const RELEASE_ASSETS = {
  windows: `Dissolve_${RELEASE_VERSION}_x64-setup.exe`,
  mac:     `Dissolve_${RELEASE_VERSION}_universal.dmg`,
  linux:   `Dissolve_${RELEASE_VERSION}_amd64.AppImage`,
};

// ── Derived URLs ────────────────────────────────────────────────────────────
const BASE = `https://github.com/${GITHUB_REPO}/releases/download/v${RELEASE_VERSION}`;
const GITHUB_RELEASES = `https://github.com/${GITHUB_REPO}/releases`;

const DOWNLOAD_URLS = {
  windows: `${BASE}/${RELEASE_ASSETS.windows}`,
  mac:     `${BASE}/${RELEASE_ASSETS.mac}`,
  linux:   `${BASE}/${RELEASE_ASSETS.linux}`,
};

// ── OS detection ────────────────────────────────────────────────────────────
function detectOS() {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win'))   return 'windows';
  if (ua.includes('mac'))   return 'mac';
  if (ua.includes('linux')) return 'linux';
  return 'windows'; // sensible default
}

// ── Wire up DOM ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const os = detectOS();
  const OS_LABELS = { windows: 'Windows', mac: 'macOS', linux: 'Linux' };

  // Hero primary button
  const heroBtn  = document.getElementById('hero-download-btn');
  const heroOs   = document.getElementById('hero-os');
  const heroVer  = document.getElementById('hero-version');
  if (heroBtn && heroOs) {
    heroOs.textContent  = OS_LABELS[os];
    heroBtn.href        = DOWNLOAD_URLS[os];
  }
  if (heroVer) {
    heroVer.textContent = `v${RELEASE_VERSION} · Open source`;
  }

  // Hero alt links
  const altMap = {
    'alt-windows': 'windows',
    'alt-mac':     'mac',
    'alt-linux':   'linux',
  };
  for (const [id, platform] of Object.entries(altMap)) {
    const el = document.getElementById(id);
    if (el) el.href = DOWNLOAD_URLS[platform];
  }

  // Download section cards
  const dlMap = {
    'dl-windows': 'windows',
    'dl-mac':     'mac',
    'dl-linux':   'linux',
  };
  for (const [id, platform] of Object.entries(dlMap)) {
    const el = document.getElementById(id);
    if (el) el.href = DOWNLOAD_URLS[platform];
  }

  // GitHub links
  for (const id of ['nav-github', 'footer-github', 'dl-github-link']) {
    const el = document.getElementById(id);
    if (el) el.href = GITHUB_RELEASES;
  }

  // Footer license link
  const licenseEl = document.getElementById('footer-license');
  if (licenseEl) {
    licenseEl.href = `https://github.com/${GITHUB_REPO}/blob/main/LICENSE`;
  }
});
```

**Step 2: Verify OS detection in browser**

Open DevTools console and run:
```js
navigator.userAgent
```
Confirm the hero button updates to "Download for Windows" (or your OS). Click each alt link and download card — they should all resolve to GitHub URLs (404 until the repo is public, that's expected).

**Step 3: Commit**

```bash
git add landing/script.js
git commit -m "feat(landing): add OS detection and GitHub Release URL wiring"
```

---

### Task 9: Responsive styles

**Files:**
- Modify: `landing/style.css`

**Step 1: Add mobile breakpoints at the bottom of `style.css`**

```css
/* ── Responsive ── */
@media (max-width: 640px) {
  .nav { padding: 14px 20px; }

  .hero-title { font-size: 2.25rem; }

  .hero-subtitle { font-size: 1rem; }

  .hero-cta { width: 100%; }

  .btn { width: 100%; justify-content: center; }

  .hero-alt-links { justify-content: center; }

  .pillars-grid { grid-template-columns: 1fr; }

  .download-grid { grid-template-columns: 1fr; }

  .step { padding-left: 28px; gap: 20px; }

  .section { padding: 60px 20px; }
}
```

**Step 2: Verify at mobile width**

In DevTools, set viewport to 375px wide. Verify:
- Nav collapses cleanly (links still visible)
- Hero title fits without overflow
- Download button spans full width
- Pillar cards stack vertically

**Step 3: Commit**

```bash
git add landing/style.css
git commit -m "feat(landing): add responsive mobile styles"
```

---

### Task 10: Netlify deploy config

**Files:**
- Create: `landing/netlify.toml`

**Step 1: Create `netlify.toml`**

```toml
[build]
  publish = "."

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "no-referrer"
    Permissions-Policy = "geolocation=(), microphone=(), camera=()"
```

> Note: When connecting to Netlify, set the **base directory** to `landing/` and **publish directory** to `landing/`. The `netlify.toml` above publishes `.` relative to that base.

**Step 2: Verify the toml is valid**

No build step to run. Just confirm the file parses: open `https://www.toml-lint.com/` and paste contents, or `npm exec -- toml-lint landing/netlify.toml` if available.

**Step 3: Commit**

```bash
git add landing/netlify.toml
git commit -m "feat(landing): add Netlify deploy config with security headers"
```

---

## Deploy Checklist (after all tasks complete)

1. Make the GitHub repo public
2. Create a GitHub Release tagged `v0.1.0-beta` with the built installer assets attached
3. Update `GITHUB_REPO` and `RELEASE_VERSION` in `landing/script.js`
4. Connect the repo to Netlify, set base dir to `landing/`
5. Add custom domain `dissolve.chat` in Netlify settings
6. Verify download links resolve correctly

---

## Before Going Live

- [ ] Replace `YOUR_USERNAME/dissolve` in `script.js` with the real repo path
- [ ] Upload actual release assets to GitHub Releases
- [ ] Test all three download links on each OS
- [ ] Check page on mobile
- [ ] Verify nav links scroll correctly
