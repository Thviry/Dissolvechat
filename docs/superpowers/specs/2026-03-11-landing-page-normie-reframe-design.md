# Landing Page Reframe — Design Spec

**Date**: 2026-03-11
**Goal**: Rewrite dissolve.chat landing page to convert non-technical visitors (friends, family, word-of-mouth traffic) who don't already care about privacy.

**Problem**: Current page leads with threat stats and crypto jargon (ECDH, AES-256-GCM, capability-based addressing). Target audience — normies coming from iMessage/WhatsApp — bounces because they don't understand why they'd switch and there's no social proof.

**Approach**: Lead with simplicity and relatability. Move the technical depth lower for those who want it.

---

## Section 1: Hero

**Replaces**: Current hero with "Your conversations are not ~~private~~" + crypto paragraph.

- **Beta tag**: Keep as-is — `OPEN BETA — v[VERSION]` (script.js populates dynamically)
- **Headline**: "No account. No phone number. Just talk."
- **Subtitle**: "Dissolve is a free, open-source chat app that doesn't know who you are."
- **CTA buttons**: "Download for [OS]" (primary) + "View on GitHub" (ghost) — same as current
- **OS alternatives**: Keep Windows / macOS / Linux links below CTAs
- **App screenshot**: Static PNG of the chat UI placed below the CTAs at `landing/screenshot.png`. If the asset doesn't exist yet, render a styled placeholder `<div>` with a dashed accent border and "App preview coming soon" text — the page must work without the screenshot. The user will capture and add the real screenshot before deploying.

**Removed**: The dense paragraph about E2EE, key pairs, cryptographic identity. That content moves to Section 4.

---

## Section 2: How It Works — 3 Steps

**Replaces**: Threat Landscape section (which moves to Section 4).

**Purpose**: Immediately answer "is this hard to use?" with "no."

Three cards in a horizontal row, numbered:

1. **Pick a handle** — "Choose a name. No email, no phone number, no verification."
2. **Share it** — "Send your handle to a friend. They add you by name."
3. **Start talking** — "Messages are encrypted end-to-end. The server never sees them."

**Style**: Matches existing card grid aesthetic (dark glass cards, accent borders). Section tag: `// HOW_IT_WORKS`. HTML `id="how-it-works"`. Keep the terminal feel — monospaced numbers, sharp corners, no rounded-pastel-SaaS vibes.

---

## Section 3: Comparison Table — "Why not just use...?"

**New section**. Placed after "How It Works" to answer the #1 objection from normies.

Compact table comparing Dissolve vs WhatsApp, Signal, and iMessage:

| | Dissolve | WhatsApp | Signal | iMessage |
|---|---|---|---|---|
| Needs phone number | No | Yes | Yes | No* |
| Needs email | No | No | No | Yes |
| Server retains messages | No | Yes | No** | Yes |
| Requires phone number to find contacts | No | Yes | Yes | Yes |
| Open source | Yes | No | Yes | No |
| Run your own server | Yes | No | No | No |

- iMessage "No*" footnote: requires Apple ID (email), not a phone number per se, but still an identity you don't control.
- Signal "No**" footnote: Signal queues encrypted messages temporarily until delivered, but does not retain them long-term.
- All claims must be factually accurate. No spin.
- Styled as a dark table matching the existing grid aesthetic — not a generic HTML table. Accent color for Dissolve column. Monospaced font for the app names header row.
- Section tag: `// WHY_SWITCH`. HTML `id="compare"`.
- **Responsive**: On screens < 700px, table scrolls horizontally with the first column (row labels) sticky. Keep all data visible — don't collapse to cards.

---

## Section 4: Deep Dive (Existing Content, Relocated)

**Moves from**: Current Sections 2 and 3 (Threat Landscape + How We Handle It).

**Changes**:
- Relocate below comparison table — this is now for people who want the full story.
- Trim jargon in feature descriptions. Updated copy for all five cards:
  - **01 "No accounts. No phone numbers."** — Keep as-is. Already clear.
  - **02 "The server is a dumb pipe."** — Replace "Ephemeral keys for forward secrecy on every message. The relay is designed to be untrusted — and replaceable." → "It routes encrypted blobs. It never sees your messages, never stores keys, and can't impersonate anyone. You can even run your own."
  - **03 "You control who reaches you."** — Replace "Capability-based addressing. To message you, someone needs a token you issued." → "To message you, someone needs a token you gave them. Revoke any token instantly — cut off one sender without touching your inbox."
  - **04 "Group chat. Same zero trust."** — Replace "AES-256-GCM symmetric key, wrapped per-member via ECDH." → "Every group message gets its own encryption key. The server never knows a group exists. Same security as 1-to-1."
  - **05 "Open source. Fully auditable."** — Keep as-is. Already clear.
- Keep the feature numbers (01–05) and card layout.
- Threat landscape stats section: keep as-is, it's well-written for people who've scrolled this far.
- Section tags remain `// THREAT_LANDSCAPE` and `// HOW_WE_HANDLE_IT`.

---

## Section 5: Download CTA (Mostly Unchanged)

**Changes**:
- Keep "Power to the user, not the platform." as the CTA headline (it's the project motto).
- Replace the subtitle with: "Free. No account. Takes 30 seconds."
- Keep the three download cards (Windows .exe, macOS .dmg, Linux .AppImage).
- GitHub stars: hardcode a static count (update manually on releases). e.g., "Open source — [X] stars on GitHub". No API calls or shields.io badges.
- Keep "Early adopters and contributors welcome."

---

## Asset Requirements

- **App screenshot**: A PNG of the Dissolve chat UI (showing a conversation with the terminal theme). Placed in `landing/screenshot.png`. The user will need to provide or capture this.

## Files Modified

- `landing/index.html` — restructure sections per above
- `landing/style.css` — add styles for steps cards, comparison table, screenshot container
- `landing/script.js` — no logic changes expected (download links / version detection stay the same)

## What Stays The Same

- Terminal aesthetic (IBM Plex Mono, dark bg, acid green accent, scanlines, noise overlay)
- Nav bar structure (update link targets to match new section IDs):
  - "How" → `#how-it-works`
  - "Compare" → `#compare` (new, replaces "Why")
  - "Download" → `#download`
  - GitHub link stays
- Footer
- Download link logic in script.js
- Scroll-triggered reveal animations
- All existing CSS foundations — extend, don't rewrite

## Design Principles

- No generic SaaS look. Keep the terminal/cypherpunk identity.
- Copy should sound like a person, not a marketing department.
- Every word earns its place. No filler.
- Factual claims only in the comparison table.
- The page should work for someone who's never heard the word "encryption" AND for someone who audits cryptographic protocols — just at different scroll depths.
