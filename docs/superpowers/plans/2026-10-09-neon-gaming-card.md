# Neon Gaming Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the JustNull Discord profile card to a dark neon gaming theme, drop the dead Lanyard integration, and add three factual badges.

**Architecture:** Static HTML/CSS/JS on GitHub Pages, no build step. The whole visual identity lives in nine HSL custom properties on `:root` plus the `.box-color` gradient helper, so theming is one edit rather than a hunt. `scripts/script.js` is deleted; identity becomes static HTML. Three new hand-authored SVGs sit alongside the four existing Discord badges.

**Tech Stack:** HTML5, CSS custom properties, vanilla JS, inline SVG. No dependencies, no package.json.

**Spec:** `docs/superpowers/specs/2026-10-09-neon-gaming-card-design.md`

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `styles/style.css` | Modify | All colour, font, aura and glow. Single place the theme lives. |
| `index.html` | Modify | Remove script tag and custom-status markup; fix identity text; add badge images; load two fonts. |
| `scripts/script.js` | **Delete** | Dead Lanyard WebSocket. |
| `public/badges/lang-csharp.svg` | Create | `C#` wordmark badge. |
| `public/badges/lang-python.svg` | Create | Python wordmark badge. |
| `public/badges/country-vietnam.svg` | Create | Flag of Vietnam badge. |
| `docs/superpowers/plans/` | Create dir | Holds this plan. |

Unchanged on purpose: `scripts/music.js`, `scripts/sub.js`, `scripts/message.js`, every file under `public/`.

---

## Colour reference

The existing CSS is written in HSL, not hex. The design tokens were converted so the CSS stays in its native notation.

| Token | Hex | HSL | Measured contrast |
|---|---|---|---|
| Page background | `#0F0F23` | `260deg 45% 11%` | — |
| Card / panel | `#1E1C35` | `260deg 50% 18%` | text 13.20:1, muted 7.68:1, violet 4.63:1 |
| Chip fill | — | `260deg 40% 24%` | text 10.99:1, muted 6.39:1, violet 3.86:1 |
| Foreground | `#E2E8F0` | — | 13.20:1 on card |
| Muted | `#A8B3C4` | — | 7.68:1 on card |
| Violet | `#9D6BFF` | — | 4.63:1 on card, 3.86:1 on chip |
| Accent | `#F43F5E` | — | 4.43:1 on card |
| Discord green | `#1ED760` | — | 7.06:1 on chip |

The palette is one hue family (260deg) at varying lightness. That is what makes the card read as a single surface instead of assembled parts.

---

### Task 1: Delete the dead Lanyard script

The WebSocket throws on every message push. Removing it is the fix, and it is the only change in this plan that removes code.

**Files:**
- Delete: `scripts/script.js`
- Modify: `index.html:283`

- [ ] **Step 1: Confirm the failure exists before deleting anything**

Open the deployed page and read console errors. Expected: a `pageerror` for `reading 'display_name'`.

Run in a browser tab on `https://tuananh2901.github.io/card/`:

```js
const errors = await tab.errors();
console.log(JSON.stringify(errors.entries.filter(e => e.level === 'error')));
```

Expected output contains:

```
"TypeError: Cannot read properties of undefined (reading 'display_name')"
```

- [ ] **Step 2: Delete the file**

```bash
git rm scripts/script.js
```

- [ ] **Step 3: Remove the script tag**

In `index.html`, the tag is inside `</body>`, immediately before `sub.js`. Delete this line:

```html
		<script async src="./scripts/script.js"></script>
```

- [ ] **Step 4: Verify no references remain**

```bash
grep -rn "script.js\|lanyard\|Lanyard" index.html styles/ scripts/
```
Expected: no output. Exit code 1 from grep means no match, which is the pass condition.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix: remove dead Lanyard integration

Lanyard returns user_not_monitored for this account, so the WebSocket
delivered an empty state and updateStatus threw on every push. Identity
is static HTML now."
```

---

### Task 2: Delete the orphaned custom-status CSS

**Finding, verified in the source:** there is no `.custom-status` element anywhere in `index.html`. The markup was removed at some earlier point while its CSS stayed behind. So this is not markup removal, it is five dead CSS rules plus two dead grouped selectors. No HTML edit is needed because there is nothing to remove.

**Files:**
- Modify: `styles/style.css:5` (grouped `display: flex` selector)
- Modify: `styles/style.css:333` (grouped `width: fit-content` selector)
- Modify: `styles/style.css:444-462` (three standalone rules)

- [ ] **Step 1: Remove it from the `display: flex` group at the top**

The rule at line 2 lists seven selectors. Delete line 5. The rule becomes:

```css
.badges,
.badges .badges-right,
.container,
.id,
.name-box {
  display: flex
}
```

- [ ] **Step 2: Remove it from the `width: fit-content` group**

Delete line 333. The rule becomes:

```css
.badges,
.badges .badges-left,
.name-box,
.name-box * {
  width: fit-content
}
```

- [ ] **Step 3: Delete the three standalone rules**

Delete this whole block:

```css
.custom-status {
  flex-direction: row;
  justify-items: center;
  align-items: center;
  padding: 0 0 10px
}

.custom-status img {
  width: 24px !important;
  height: 24px !important;
  object-fit: cover;
  image-rendering: pixelated
}

.custom-status-text {
  margin: 0;
  padding: 0;
  font-weight: 400
}
```

- [ ] **Step 4: Verify nothing references it**

```bash
grep -rn "custom-status" index.html styles/ scripts/
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: delete custom-status CSS with no matching markup"
```

---

### Task 3: Rewrite the root colour tokens

The whole theme is these nine properties. `.box-color` builds every gradient from them, so this edit repaints the card without touching layout.

**Files:**
- Modify: `styles/style.css:36-45`

- [ ] **Step 1: Replace the `:root` block**

Replace the existing `:root` rule with:

```css
:root {
  --primary-h-top: 260deg;
  --primary-s-top: 45%;
  --primary-l-top: 14%;
  --primary-h-bottom: 260deg;
  --primary-s-bottom: 60%;
  --primary-l-bottom: 20%;
  --text-color: #E2E8F0;
  --box-shadow-color: rgba(157, 107, 255, .35);
  --surface-page: #0F0F23;
  --surface-card: #1E1C35;
  --color-muted: #A8B3C4;
  --color-violet: #9D6BFF;
  --color-accent: #F43F5E;
  --color-border: #4C1D95;
  --color-green: #1ED760
}
```

- [ ] **Step 2: Repaint the page background**

`.container::before` currently overlays `bg.webp` at `blur(5px)` with `background-blend-mode: darken` and `rgba(0,0,0,.5)`. That darkens the artwork to mud. Replace the whole rule with:

```css
.container::before {
  content: "";
  position: fixed;
  margin: -15px;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: url("../public/bg.webp");
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;
  z-index: -1;
  filter: blur(5px) saturate(140%);
  background-color: var(--surface-page);
  background-blend-mode: soft-light;
  opacity: .55
}
```

- [ ] **Step 3: Remove the light-mode half of each gradient pair**

Every surface in this card was authored as a light-to-white gradient. On a dark theme those ends read as grey haze. Retarget the lightness overrides so the top stop is a dim surface and the bottom stop is only slightly lifted:

| Selector | Change |
|---|---|
| `.profile` | `--primary-l-top: 99%` → `16%`, `--primary-l-bottom: 78%` → `19%`, `--primary-s-top: 43%` → `45%`, `--primary-s-bottom: 47%` → `55%` |
| `.avatar, .avatar #avatar-image` | `--primary-l-top: 95%` → `22%`, `--primary-l-bottom: 94%` → `22%` |
| `.badges, .status` | `--primary-l-top: 97%` → `20%`, `--primary-l-bottom: 97%` → `20%` |
| `.card, .roles-body .rol` | `--primary-s-top: 45%` → `50%`, `--primary-s-bottom: 45%` → `50%` |
| `.card` | `--primary-l-top: 94%` → `18%`, `--primary-l-bottom: 94%` → `18%` |
| `.roles-body .rol` | `--primary-l-top: 96%` → `24%`, `--primary-l-bottom: 96%` → `24%` |

- [ ] **Step 4: Give the avatar ring the violet accent**

Replace the hardcoded light-blue ring:

```css
.avatar #avatar-image {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  padding: 8px;
  background-color: var(--color-violet)
}
```

- [ ] **Step 5: Verify the contrast script still holds**

Re-run the measurement. Every pair must clear its threshold:

| Pair | Threshold | Required |
|---|---|---|
| `#E2E8F0` on card `#1E1C35` | 4.5:1 | 13.20:1 |
| `#A8B3C4` on card `#1E1C35` | 7:1 | 7.68:1 |
| `#9D6BFF` on card `#1E1C35` | 4.5:1 | 4.63:1 |
| `#F43F5E` on card `#1E1C35` | 3:1 | 4.43:1 |
| `#E2E8F0` on chip | 4.5:1 | 10.99:1 |
| `#A8B3C4` on chip | 4.5:1 | 6.39:1 |

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: neon gaming colour tokens

Replaces the light blue-white palette with the Gaming hue family at
260deg. Every pair measured at or above its WCAG threshold."
```

---

### Task 4: Swap the typeface

Playpen Sans is a handwriting face; the profile it sits next to uses Chakra Petch. Matching them makes the two surfaces read as one.

**Files:**
- Modify: `index.html:26-28` (font link)
- Modify: `styles/style.css:19-21` (font stack)

- [ ] **Step 1: Replace the font link in `index.html`**

Delete the Playpen Sans link:

```html
		<link
			href="https://fonts.googleapis.com/css2?family=Playpen+Sans&display=swap"
			rel="stylesheet" />
```

Add two links in its place:

```html
		<link
			href="https://fonts.googleapis.com/css2?family=Russo+One&family=Chakra+Petch:wght@300;400;500;600;700&display=swap"
			rel="stylesheet" />
```

- [ ] **Step 2: Replace the font stack**

Replace:

```css
*,
.id {
  font-family: "Playpen Sans", cursive
}
```

with:

```css
*,
.id {
  font-family: "Chakra Petch", "Segoe UI", sans-serif
}
```

- [ ] **Step 3: Scope Russo One to Latin-only elements**

Russo One has no Vietnamese diacritics. Applying it to a Vietnamese string drops the marks. It goes only on `JustNull` and `kasugatowa`, both pure Latin. Append:

```css
.display-name,
.username {
  font-family: "Russo One", "Chakra Petch", sans-serif
}
```

- [ ] **Step 4: Verify diacritics survive**

Load the page. The About paragraph and the role names must render `Vũ Tuấn Anh` with every tone mark and diacritic intact. `JustNull` must be visibly heavier than the surrounding text.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Russo One + Chakra Petch"
```

---

### Task 5: Fix the identity text

`Kasuga Towa | Tuấn Anh` is wrong. Vu is the family name and Tuan Anh the given name.

**Files:**
- Modify: `index.html:102`
- Modify: `index.html:139-149` (About paragraph)

- [ ] **Step 1: Correct the pronouns line**

Replace:

```html
								<span class="pronouns">Kasuga Towa | Tuấn Anh</span>
```

with:

```html
								<span class="pronouns">Vũ Tuấn Anh</span>
```

- [ ] **Step 2: Correct the About paragraph**

Replace the existing `.about-me` span content with:

```html
									<span class="about-me"
										>I'm JustNull, Vũ Tuấn Anh from
										<div class="flag">
											<img
												src="./public/icons/flag-for-flag-vietnam-svgrepo-com.svg"
												alt="Vietnamese flag" />
										</div>
										, and I like modding games, taking them apart to see
										how they work, and putting them back together. I mostly
										write C# and Python.</span
									>
```

This drops the previous wording, which described the owner as a NEET and Hikikomori. The owner named the accurate version; the old text is removed rather than softened.

- [ ] **Step 3: Add the alt text the flag was missing**

The flag image currently has no `alt`. The rule above adds `alt="Vietnamese flag"`. This is required because the About sentence reads as one string and an unlabelled image inside it leaves a gap.

- [ ] **Step 4: Verify**

Load the page. The name block reads `JustNull` / `kasugatowa` / `Vũ Tuấn Anh`. The About paragraph renders without clipping at both 900px and 390px widths.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix: correct identity text and name order"
```

---

### Task 6: Add the violet aura and name glow

This is the "anime" quality in the plan, delivered in CSS because no trustworthy free artwork exists to source.

**Files:**
- Modify: `styles/style.css:210-217`

- [ ] **Step 1: Add the aura keyframes**

Append to `styles/style.css`:

```css
@keyframes auraPulse {
  0%,
  100% {
    filter: drop-shadow(0 0 6px rgba(157, 107, 255, .55)) drop-shadow(0 0 14px rgba(157, 107, 255, .35))
  }

  50% {
    filter: drop-shadow(0 0 10px rgba(244, 63, 94, .65)) drop-shadow(0 0 26px rgba(157, 107, 255, .5))
  }
}

@keyframes nameGlow {
  0%,
  100% {
    text-shadow: 0 0 8px rgba(157, 107, 255, .35)
  }

  50% {
    text-shadow: 0 0 16px rgba(157, 107, 255, .6)
  }
}
```

- [ ] **Step 2: Apply the aura to the avatar frame**

Replace the `.avatar-decoration` rule with:

```css
.avatar-decoration {
  width: 170px;
  height: 170px;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: auraPulse 4s ease-in-out infinite
}
```

- [ ] **Step 3: Apply the glow to the name block**

Append:

```css
.name-box .display-name,
.name-box .username {
  animation: nameGlow 4s ease-in-out infinite
}
```

- [ ] **Step 4: Respect reduced motion**

The global `*` rule sets `transition: width .5s, height .5s`, which is unrelated to these keyframes. Reduced motion must stop the loops. Append:

```css
@media (prefers-reduced-motion: reduce) {
  .avatar-decoration,
  .name-box .display-name,
  .name-box .username {
    animation: none;
    text-shadow: none
  }
}
```

- [ ] **Step 5: Verify in both modes**

With normal settings the aura cycles between violet and rose over 4 seconds. With reduced motion emulated, both animations stop and the avatar sits still. Confirm by screenshotting twice, 2 seconds apart, under reduced motion: the two must be identical.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: violet aura on avatar frame and name glow"
```

---

### Task 7: Retone the role dots

The four role dot colours are Discord-era pastels tuned for a white chip. On the dark chip the two pink ones drop to 3.50:1 and 3.64:1, and blue to 5.44:1. All pass 3:1 for graphics, but two of them read as mud.

**Files:**
- Modify: `styles/style.css:612-626`

- [ ] **Step 1: Replace the four colour rules**

```css
.softpink {
  color: var(--color-accent)
}

.rosepink {
  color: var(--color-violet)
}

.green {
  color: var(--color-green)
}

.blue {
  color: #67E8F9
}
```

- [ ] **Step 2: Verify each dot on the chip fill**

| Dot | Colour | On chip `260deg 40% 24%` | Threshold |
|---|---|---|---|
| `.rosepink` | `#9D6BFF` | 3.86:1 | 3:1 graphics |
| `.softpink` | `#F43F5E` | 3.69:1 | 3:1 graphics |
| `.green` | `#1ED760` | 7.06:1 | 3:1 graphics |
| `.blue` | `#67E8F9` | 8.94:1 | 3:1 graphics |

All clear the graphics threshold. No dot is used for text.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: retone role dots for the dark chip"
```

---

### Task 8: Draw the three badge SVGs

Hand-authored so the count is honest and nothing is fetched at runtime. Each is 72×72 to match the existing badge box.

**Files:**
- Create: `public/badges/lang-csharp.svg`
- Create: `public/badges/lang-python.svg`
- Create: `public/badges/country-vietnam.svg`

- [ ] **Step 1: Write the C# badge**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" width="72" height="72" role="img">
	<title>C#</title>
	<rect width="72" height="72" rx="16" fill="#1E1C35" stroke="#9D6BFF" stroke-width="2" />
	<text x="36" y="46" font-family="Verdana, sans-serif" font-size="26" font-weight="bold" fill="#9D6BFF" text-anchor="middle">C#</text>
</svg>
```

- [ ] **Step 2: Write the Python badge**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" width="72" height="72" role="img">
	<title>Python</title>
	<rect width="72" height="72" rx="16" fill="#1E1C35" stroke="#1ED760" stroke-width="2" />
	<text x="36" y="45" font-family="Verdana, sans-serif" font-size="22" font-weight="bold" fill="#1ED760" text-anchor="middle">PY</text>
</svg>
```

Using the `PY` wordmark rather than the two-snake logo. The real Python logo is a registered trademark of the Python Software Foundation; a text wordmark avoids claiming it while staying readable at 26px.

- [ ] **Step 3: Write the Vietnam badge**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" width="72" height="72" role="img">
	<title>Vietnam</title>
	<rect width="72" height="72" rx="16" fill="#1E1C35" stroke="#F43F5E" stroke-width="2" />
	<rect x="16" y="22" width="40" height="28" fill="#DA251D" />
	<text x="36" y="42" font-family="Verdana, sans-serif" font-size="24" font-weight="bold" fill="#FFFF00" text-anchor="middle" dominant-baseline="middle">★</text>
</svg>
```

- [ ] **Step 4: Verify each renders and carries a title**

Open each file in a browser. All three must draw a rounded square with a visible glyph. Confirm `<title>` is present in all three, since that is what a screen reader announces.

- [ ] **Step 5: Commit**

```bash
git add public/badges/
git commit -m "feat: C#, Python and Vietnam badges"
```

---

### Task 9: Mount the badges

**Files:**
- Modify: `index.html:71-91`

- [ ] **Step 1: Insert the three badges**

Inside `.badges-right`, immediately after the closing `</a>` of the `legacy-username` badge, insert:

```html
								<a
									class="tooltip"
									aria-label="C#, the language this profile uses most">
									<img alt=" " src="./public/badges/lang-csharp.svg"
								/></a>
								<a
									class="tooltip"
									aria-label="Python, the language this profile uses most">
									<img alt=" " src="./public/badges/lang-python.svg"
								/></a>
								<a class="tooltip" aria-label="Based in Vietnam">
									<img alt=" " src="./public/badges/country-vietnam.svg"
								/></a>
```

`alt=" "` matches the existing badges, which mark their images decorative and let the link's `aria-label` carry the meaning. Each badge is wrapped in a link purely so the existing `.tooltip` styling applies; there is no destination URL, matching the existing badge links.

- [ ] **Step 2: Verify the row does not wrap**

At 900px width the badge row is seven items. Screenshot and confirm it stays on one line. At 390px the row will overflow; confirm it either wraps cleanly or scrolls rather than clipping badges in half.

If it overflows badly at 390px, reduce `.badges img` height from `26px` to `22px` in the existing `@media (width <=640px)` block. Do not remove a badge.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: mount language and country badges"
```

---

### Task 10: Full verification against the deployed page

Local files prove nothing if Pages serves a stale build. This task verifies the real URL.

**Files:**
- None. Verification only.

- [ ] **Step 1: Push**

```bash
git push origin main
```

- [ ] **Step 2: Wait for Pages to rebuild**

GitHub Pages typically serves within 60 seconds. Poll until the new markup appears:

```bash
curl -s https://tuananh2901.github.io/card/ | grep -c "lang-csharp.svg"
```

Expected: `1`.

- [ ] **Step 3: Assert the console is clean**

This is the regression Task 1 fixes. Open `https://tuananh2901.github.io/card/`, wait for network idle, then:

```js
const errors = await tab.errors();
const pageErrors = errors.entries.filter(e => e.type === 'pageerror');
console.log('pageerrors:', pageErrors.length);
```

Expected: `pageerrors: 0`. A non-zero count means a stale `script.js` is still cached.

- [ ] **Step 4: Screenshot both widths**

At 900×1000 and 390×844. Check: badge row intact, About text not clipped, no clipped Vietnamese diacritics, aura visible, card background is dark violet and not the old white.

- [ ] **Step 5: Confirm the old palette is gone**

```bash
curl -s https://tuananh2901.github.io/card/styles/style.css | grep -c "Playpen"
```

Expected: `0`.

- [ ] **Step 6: Check the mobile breakpoint still works**

The existing `@media (width <=640px)` block swaps `bg.webp` for `bg_mobile.webp` and shrinks the profile to 300px. Confirm at 390px the banner is 100px tall, the avatar is 86px, and the badges sit at `top: 120px`.

- [ ] **Step 7: Final commit if verification forced a fix**

```bash
git add -A
git commit -m "fix: verification adjustments"
```

Only run this if a step above required a change.

---

## Rollback

```bash
git revert --no-commit <last-commit> && git commit
```

Reverting the whole series restores the broken Lanyard script along with the old theme. To keep the Lanyard fix and drop only the rest, revert from Task 3 onward.