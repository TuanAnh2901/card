# Council Memo — LiquidGlass text destruction on the JustNull card

## Question
How do we build LiquidGlass on the card at `E:/card-work` so it looks like iOS 26 Liquid Glass / the archisvaze demo **and** never degrades the DOM text inside the glass surfaces?

## Scope
- Static HTML/CSS/JS, GitHub Pages, no new dependencies.
- Existing: one WebGL refract shader, a CSS glass mode with 4 injected bezel rings, 3 themes.
- Already deleted at owner request: 16-ring CSS mode, CSS rain layer.
- Non-goals: no Three.js, no restoring removed modes, no layout/content redesign.

## Roster, passes, fallbacks

| Advisor | Profile | Context | Passes |
|---|---|---|---|
| GlassDiagnosis | `scout` | runtime-default | 1 (complete) |
| GlassCorrectness | `reviewer` | runtime-default | 1 (complete) |

No `council-*` profile exists in `~/.agents`, `~/.pi`, or the project dirs; no `oracle` profile either. Filled with `scout` + `reviewer` per the fallback rule, both read-only. Pass cap 2; **Pass 2 was not run** — both advisors converged on the same mechanism and the single disputed claim was settled by parent measurement below, not by advisor evidence.

## Recommendation

**Delete the fullscreen-canvas refract mode. Rebuild the glass as a dedicated backdrop layer painted below the text.**

Concretely, in order:

1. **Remove the `.lg-canvas` full-screen overlay entirely** (delete `startGL`/`stopGL`, the canvas CSS, and the `refract` mode). A fixed full-viewport canvas can never sit behind specific DOM text while staying above that text's own background — it is one atomic layer at one z-position. This is not a tuning problem.
2. **Replace the 4 `backdrop-filter` rings with a single non-filtering masked rim** (same `mask-composite: exclude` geometry, a real background colour instead of `backdrop-filter`). The rings' blur provably cannot reach the real backdrop, so it buys nothing.
3. **Put the refraction, if wanted, on a `::after` at `z-index: -1`** inside each `isolation: isolate` host, using `backdrop-filter: url(#svgFilter)` with `feDisplacementMap`.
4. **Remove `backdrop-filter: blur(10px)` from `.profile`.** It makes `.profile` a backdrop root, so nested glass can never sample the page background.

## Rationale

Both advisors independently confirmed both reported bugs by exact citation and to spec:

- **Bug B (text erased in refract)** — `.lg-canvas` is `position:fixed;inset:0;z-index:5` on `body` while `.profile` is `z-index:1`, so the pane covers every glyph in the card. The reviewer cited filter-effects-2 §backdrop-filter-operation: an element's background paints before its children, and an external layer at a single z-position cannot be split between the two. WebGL cannot sample live DOM either — it only ever distorts a static texture.
- **Bug A mechanism (rings blur their own text)** — rings are `position:absolute` children appended *after* the text, so they paint in the positioned-element layer above the inline text, and their `backdrop-filter` takes that text as input. A child with `backdrop-filter` does not spare its own host's content.

Parent measurement settled the disputed claim and the open acceptance gate:

| Test | Result |
|---|---|
| `backdrop-filter` on the glass element, text is a child | **848 ink / 144 glyph edges** — pixel-identical to no filter |
| Ring with `backdrop-filter` painted over the same text | **0 ink / 0 edges** — text destroyed |
| `backdrop-filter: url(#disp)` with `feDisplacementMap` only (no blur) | **848 ink / 144 edges** — sharp, *and* the backdrop geometry measurably bent (red-column profile differs from unfiltered) |
| Glass inside a parent that has `backdrop-filter` | **96.5% flat** — page background unreachable |
| Glass inside a parent without `backdrop-filter` | **23% cyan + 50% pink page hues show through** |

So the refracted-backdrop-only mechanism works and preserves text exactly, and the backdrop-root constraint is real and is what currently stops the glass from seeing the page.

## Accepted feedback

- **Both root causes are structural, not tuning.** The prior fix (translucent `.profile`/`.card`, shader `col *= .45`) matched luminance means and left both paint-order bugs in place. It did not validate the architecture.
- **The `isolation:isolate` on `[data-lg="glass"] [data-glass]` traps the rings** so they sample the host's own backdrop and can never reach the page. The reviewer disputes that this specific property bounds the ring (filter-effects-2 §3 lists no `isolation`), but agrees the host's own `backdrop-filter` is a backdrop root. Either way the ring cannot refract what we want.
- **The reviewer's `changeMyMind` is accepted:** a non-filtering masked rim is strictly better than 4 `backdrop-filter` rings, and is a 3-line swap.
- **The reviewer's challenge that the ring's mask confines blur to the rim band is accepted**, with the correction below.

## Rejected feedback

- **Keep the WebGL refract mode by moving the canvas below the card.** Rejected: it would then only distort the static `bg.webp`, never the card content, and `.profile`'s blur destroys the shader's 7–30px lens offsets. A mode whose quality ceiling is "decorative background warp" is not worth its code.
- **Adopt `backdrop-filter: url(#svg)` as the primary path.** Rejected *for now* on Chromium-only support (open WebKit bug 245510; the reference repo's own SVG version is Chromium-only). It is the right mechanism and is measured working here, so it is the correct follow-up once a blur fallback exists. Listed as an owner decision.

## Correction to advisor evidence

The reviewer argued the ring's blur is confined to the rim band, so the middle text is safe — implying Bug A is minor. **Measured on the live site, Bug A does not reproduce at all:** the playlist has `rings = 0` in every mode, because `applyLayers()` runs at boot while the playlist is closed (`height < 30` → early return) and never re-runs when it opens. Playlist glyph edges: off 247, glass 244, refract 246. The owner's blurred-playlist screenshot is from the previous build (the now-deleted 16-ring mode, which gave the playlist 16 covering rings) or a stale cache. **Bug A's mechanism is real and proven, but it is not currently firing on the live site.**

## Owner decisions

1. **Drop `refract` entirely, or keep it as a decorative background-only pass behind the card?** The council recommends dropping it; it cannot refract live DOM.
2. **Accept Chromium-only `backdrop-filter: url(#svg)` refraction with a plain-blur fallback for Firefox/Safari, or stay on plain blur cross-browser?** The measured mechanism works in Chromium.
3. **Is removing `.profile`'s `backdrop-filter: blur(10px)` acceptable?** It is required for nested glass to reach the page background, but it changes the whole-card feel.
4. **Scope the lens to one hero surface (the music player) or all `[data-glass]` hosts?** Per-host SVG filter maps must be regenerated on resize; cost scales with host count.

## Evidence and run ids

Parent-measured, first-hand, in this session:

- Glyph-edge census (probe page, three glass variants): A `backdrop-filter` on element = 848 ink / 144 edges; B ring over text = 0 / 0; C unfiltered reference = 784 ink / 144 edges.
- `backdrop-filter: url(#disp)` + `feDisplacementMap` only: 848 ink / 144 edges (text sharp); backdrop red-column profile `[31,30,29,25,24,32,46,57,61,55,50,41,34,25]` vs unfiltered `[47,47,47,49,47,43,43,38,35,31,32,30,28,26]` (backdrop genuinely bent).
- Backdrop root: parent with `backdrop-filter` → 96.5% flat, 0.3% cyan, 3.2% pink; parent without → 23.1% cyan, 49.7% pink, 27.2% flat.
- Live site, text inside glass regions (glyph edges): off = chip 80 / platform 198; glass = 80 / 197; **refract = 0 / 0** with canvas `z-index: 5`.

Advisor runs: `GlassDiagnosis` (scout), `GlassCorrectness` (reviewer). Full payloads at `agent://GlassDiagnosis` and `agent://GlassCorrectness`.

## Confidence

**High** on the diagnosis and the deletion of refract — the erased text is reproduced on the live site with a 0-edge measurement, and the spec citation is unambiguous.

**Medium** on the replacement path, because it has not been implemented yet. The single measurement that would change the recommendation is the one the scout flagged and the parent has since run: if a live render of `backdrop-filter: url(#svg)` showed measurable text softening, the `z-index: -1` design would need re-deriving. It did not show softening (144 edges, unchanged), so the recommendation stands.
