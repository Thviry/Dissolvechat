# Dissolve Landing Page — Design

**Date:** 2026-03-03
**Domain:** dissolve.chat
**Goal:** Drive direct downloads at beta/v1 launch.

---

## Context

DissolveChat is going open source at launch. The landing page is the public face of the project — it needs to convince a privacy-conscious stranger to download in under 30 seconds. It lives at dissolve.chat and links to GitHub Releases for all downloads.

---

## Decisions

- **Tech:** Static HTML + CSS + minimal JS. No framework, no build step.
- **Hosting:** Netlify or Vercel pointed at the `landing/` subdirectory of the monorepo. Custom domain: dissolve.chat.
- **Distribution:** GitHub Releases (public open-source repo). Download buttons link directly to release assets.
- **Platforms:** Windows (.exe), macOS (.dmg), Linux (.AppImage).

---

## File Structure

```
landing/
  index.html
  style.css
  script.js      ← OS detection + GitHub Release URL builder only
```

---

## Page Sections

### 1. Hero
- Headline (Syne 800, large)
- One-liner subheadline
- Primary CTA: "Download for [OS]" — auto-detected via `navigator.platform` / `userAgent`
- Secondary links: other two platform downloads beneath the primary button
- Background: grid-dot pattern (consistent with app login screen)

### 2. Three Pillars
- "Your identity is a file you control"
- "The server is a dumb pipe"
- "You control who can reach you"
- Copy sourced from ONE_PAGER.md — already sharp, no rewrite needed

### 3. How It Works
Four numbered steps:
1. Create an identity — a cryptographic key pair, saved as a portable file
2. Exchange contact cards containing public keys and capability tokens
3. Messages encrypt on your device before leaving it
4. The relay routes the encrypted blob — it never sees plaintext

### 4. Download
Full platform picker — three buttons side by side:
- Windows → GitHub Release `.exe`
- macOS → GitHub Release `.dmg`
- Linux → GitHub Release `.AppImage`

Each button shows the version number pulled from the release tag.

### 5. Footer
- Link to GitHub repo
- "Run your own relay" → SELF_HOSTING.md
- Open source notice (license)
- Tagline: "No accounts. No phone numbers. No platform."

---

## Design System

Inherits the app's existing design system:

| Token | Value |
|-------|-------|
| Background | `#060a12` |
| Sidebar/surface | `#0d1320` |
| Accent | `#38bdf8` |
| Display font | Syne 800 (Google Fonts) |
| Body font | Outfit (Google Fonts) |
| Mono font | JetBrains Mono (Google Fonts) |
| Hero bg texture | Grid-dot pattern (same as app login screen) |
| Signature detail | Accent-right-border on highlighted elements |

---

## Success Criteria

- Stranger lands on dissolve.chat and can download the correct installer for their OS in under 3 clicks
- Page loads fast on a cold visit (no JS frameworks, minimal assets)
- Consistent visual identity with the desktop/web app
- GitHub repo link prominent — open source credibility is part of the pitch
