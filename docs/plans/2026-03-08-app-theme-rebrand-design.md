# App Theme Rebrand — Match Landing Page

**Date**: 2026-03-08
**Goal**: Make the default app theme match the landing page aesthetic so first launch feels like the same product.

## Changes

### Default theme (`:root`) — new values
- Backgrounds: pure blacks (#0a0a0a, #111111, #161616, #1a1a1a, #222222, #2a2a2a, #0d0d0d)
- Text: #e8e8e8 primary, #888888 secondary, #555555 tertiary, #0a0a0a inverse
- Accent: acid green #39ff14 (hover: #4dff33, deep: #32e612, subtle/glow/muted adjusted)
- Borders: rgba(255,255,255,0.06), subtle rgba(255,255,255,0.03)
- Border focus: rgba(57,255,20,0.55)
- Fonts: IBM Plex Mono (display), Inter (body), JetBrains Mono (code)
- Radii: sharper (4px base instead of 10px)

### Alternate themes
- Ocean, Forest, Ember, Violet — keep as-is, no changes

### Files
- `client/src/App.css` — update :root tokens + font import
- `desktop/src/App.css` — mirror identical changes
