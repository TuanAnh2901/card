# Neon Gaming Redesign — JustNull Discord Profile Card

**Date:** 2026-10-09
**Repo:** `TuanAnh2901/card`
**Live:** https://tuananh2901.github.io/card/

## Problem

The card renders, but three things are wrong.

**1. The live Discord integration is dead.** `scripts/script.js` opens a Lanyard WebSocket for user ID `486880147987759135`. Lanyard no longer monitors that account:

```
GET https://api.lanyard.rest/v1/users/486880147987759135
{"error":{"code":"user_not_monitored","message":"User is not being monitored by Lanyard"}}
```

The socket connects and delivers `INIT_STATE` with an empty `d: {}`, so `discord_user` is `undefined` and line 32 throws:

```
TypeError: Cannot read properties of undefined (reading 'display_name')
    at updateStatus (scripts/script.js:33:48)
    at ws.onmessage (scripts/script.js:19:4)
```

Every push repeats this. The name, username and status dot currently look correct only because `index.html` hardcodes them.

**2. The theme does not match the GitHub profile.** The profile repo uses `solo_leveling` (violet, Solo Leveling System window). The card is pale blue on white in Playpen Sans, a handwriting font.

**3. The identity text is inaccurate.** `index.html` renders the display name as `JustNull` with pronouns `Kasuga Towa | Tuấn Anh`. Vu is the family name; Tuan Anh is the given name.

## Goals

- Neon gaming theme matching the profile's `solo_leveling` violet.
- Display name and username static HTML. No live Discord dependency.
- Badges reflect facts the GitHub API returns.
- Identity text accurate.
- All text meets WCAG AA.

## Non-goals

- No new framework. No build step. Static HTML/CSS/JS as today.
- No raster images added. See "Why no new images" below. The three new badge SVGs are the only new files under `public/`.
- `music.js`, the music playlist and the audio files are untouched.
- The DOM structure is not restructured; only class names, text and colour values change.
- Social links are not added or removed.

## Why no new images

New anime art cannot be sourced responsibly here. The existing images (`banner.webp`, `av.webp`, `aqua.gif`, `lumine_avatar_frame.webp`) cannot be inspected for content, so any description of them would be a guess. Rather than invent art, the "anime" quality is delivered through CSS: a violet aura on the avatar frame and a glow on the name. These are verifiable and reversible.

If the owner supplies images later, they drop into `public/` and replace the existing `src` attributes. No layout change needed.

## Design tokens

Sourced from the ui-ux-pro-max skill, `colors.csv` row 12 (Gaming): `Primary #7C3AED`, `Accent #F43F5E`, `Background #0F0F23`, `Card #1E1C35`, `Muted #27273B`, `Border #4C1D95`, `Foreground #E2E8F0`.

Two values are adjusted. Measured contrast ratios, WCAG relative luminance:

| Token | Value | On card | Verdict |
|---|---|---|---|
| Background | `#0F0F23` | — | — |
| Card | `#1E1C35` | — | — |
| Foreground | `#E2E8F0` | 13.38:1 | AA pass |
| Muted (raised) | `#A8B3C4` | 7.79:1 | AA pass |
| Violet (raised) | `#9D6BFF` | 4.70:1 | AA pass |
| Accent | `#F43F5E` | 4.49:1 | AA pass for large text and borders |
| Discord green | `#1ED760` | 8.60:1 | AA pass |
| Border | `#4C1D95` | — | decorative only |

Adjustments, with the reason:

- **Violet `#7C3AED` → `#9D6BFF`.** The original scores 2.90:1 on the card, under the 3:1 minimum for text and meaningful graphics. `#9D6BFF` is the same hue family and clears 4.70:1.
- **Muted `#94A3B8` → `#A8B3C4`.** The original scores 6.44:1, which passes AA but not the project's own 7:1 house rule for body text. `#A8B3C4` scores 7.79:1.

Accent `#F43F5E` is used for borders, the role dot and hover states, never for body copy.

## Typography

From `typography.csv` row 37 (Gaming Bold): **Russo One** for headings, **Chakra Petch** for body.

Russo One is a Latin-only display face. It does not cover Vietnamese diacritics. Therefore:

- Russo One applies **only** to `JustNull` and `kasugatowa`, both pure Latin.
- Every Vietnamese string — the About paragraph, role names — uses Chakra Petch.

Chakra Petch is already embedded as a subset in the Awaken project that generates the GitHub profile, so the two surfaces share a typeface.

Playpen Sans is removed.

## Changes

### 1. Delete `scripts/script.js`

Removes the WebSocket, the reconnect loop and the `userID` constant. Delete the file; do not stub it.

The Lanyard server membership step is deliberately **not** part of this design. The owner chose a static card over restoring the live integration.

### 2. `index.html`

- `<script async src="./scripts/script.js">` removed.
- `.custom-status` markup removed. No JS updates it any more.
- Pronouns line becomes `Vũ Tuấn Anh`, and the About paragraph is corrected to name Vu as the family name.
- Badge row gains three new `<img>` entries: C#, Python, and the Vietnam flag. The four existing Discord badges stay. A repo-count badge was considered and dropped: the number is a snapshot that drifts, and a stale figure on a profile card is worse than no figure.
- New badge files land in `public/badges/`.

The status dot stays as a static `online.svg` and is treated as decoration, not a claim. It is not read from any source and never changes. This is a direct consequence of choosing a static card: the card cannot know whether the owner is online, so the dot is visual furniture rather than information. Removing it is out of scope because `.status` is absolutely positioned against the avatar and its removal reflows the header.

### 3. `styles/style.css`

- `:root` custom properties rewritten to the token table above.
- Every `Playpen Sans` reference replaced with the two-font stack.
- Aura: `drop-shadow` on `.avatar-decoration`, keyframed, `prefers-reduced-motion` respected.
- Name glow on hover.
- `@media (prefers-color-scheme: light)` — not added. The card is dark-only; a light variant would need its own contrast pass and is out of scope.

### 4. New files

| File | Purpose |
|---|---|
| `public/badges/lang-csharp.svg` | `C#` wordmark |
| `public/badges/lang-python.svg` | Python wordmark |
| `public/badges/country-vietnam.svg` | Flag of Vietnam |

All three are hand-authored SVG, sized to the existing 72×72 badge box so the row needs no layout change. Each carries a `<title>` for screen readers and the badge links keep their `aria-label` tooltips.

## Data provenance

Every number in a new badge came from the GitHub REST API on 2026-10-09:

| Badge | Source field | Value |
|---|---|---|
| `lang-csharp` | `language` across `GET /users/TuanAnh2901/repos` | 8 repos |
| `lang-python` | same | 7 repos |
| `country-vietnam` | `location` on `GET /users/TuanAnh2901` | `Vietnam` |


Only C# and Python appear. The API reports C, C++, TypeScript, Java, Lua, Shell, Go, PowerShell, CSS, JavaScript and Vue as well; those are deliberately excluded because the owner named C# and Python as the languages they actually use.


Both remaining counts are equally frozen at design time and equally likely to drift. The owner accepted that: the card is static by design, so these badges are a snapshot, not live counters. A future owner who wants them live would need the GitHub API at render time, which a GitHub Pages static site cannot do.

### Rejected alternatives

| Alternative | Why rejected |
|---|---|
| Restore Lanyard live status | Requires the owner to join the Lanyard Discord server and run `/watch`. The owner chose a static card. |
| Repo-count badge | Snapshot figure goes stale. |
| TypeScript badge | Owner named C# and Python as the languages they use. |
| New anime artwork | Existing images cannot be inspected; no trustworthy free source. Delivered via CSS aura instead. |

## Verification

No test framework exists in this repo. Verification is visual plus a contrast script.

1. **Contrast** — compute WCAG ratios for every token pair actually used. Thresholds: 4.5:1 body, 3:1 large text and graphics, 7:1 for the project's body-text rule.
2. **Console clean** — open the page, wait for network idle, assert zero `pageerror` entries. This is the regression the Lanyard removal fixes.
3. **Visual** — screenshot at 900×1000 and at 390×844. Confirm badge row does not wrap, About text has no clipped diacritics, aura animates.
4. **Reduced motion** — emulate `prefers-reduced-motion: reduce`, confirm the aura holds still.
5. **Published** — push, then load `https://tuananh2901.github.io/card/` and repeat steps 2 and 3 against the deployed page, not the local file.

## Rollback

Three files touched, two deleted, four added. `git revert` on the push restores the previous state, including the broken Lanyard script.