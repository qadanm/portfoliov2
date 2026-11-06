# CarSpotter portfolio — replacement artwork brief

Two boards on `/work/car-spotter/` still show the **pre-1.4 identity** (the Saturn
station wagon, `#C8FF00` lime, the old stacked `CAR / SPOTTER` type, 1.2–1.3 era
screens). Everything else on the page was refreshed to v1.4.

This file gives: the exact prompts, where the current files live, the composite
step that has to follow any generated image, and the full list of everything else
CarSpotter-related in the portfolio that is stale or unreferenced.

---

## 0. Read this before generating

A diffusion model **cannot** reproduce a logo, a hex value, or real app UI
faithfully. If you ask for "the CarSpotter headlamp mark" you will get a
plausible-looking lime squiggle that is not the mark, and shipping that is worse
than the stale board.

So the prompt below generates the **plate** — ground, geometry, type hierarchy,
lighting, swatch blocks, screen *bezel* shadows — and the real assets are
composited on top afterwards:

| Layer | Source of truth |
|---|---|
| The mark | `apps/mobile/assets/brand/mark.png` (1024×1024) or `apps/web/public/brand/symbol-lime.svg` |
| The wordmark | `apps/mobile/assets/brand/packet/lockup-dark.svg` (475×104) |
| The app screens | the genuine v1.4 captures listed in §3 |
| Colours | `packages/design-tokens/src/tokens.ts` — never eyeballed |
| Type | Oswald 700 (display) / Inter (body) for app surfaces; Anybody / Inter / Martian Mono on the portfolio |

Composite with ImageMagick (`magick`) or DesignCraft, export the 640/960/1600/2560
ladder, and the board is both accurate and sharper than any generated image would
be.

---

## 1. Board A — the identity board (replaces `04-carspotter-brand-system`)

**Current file, 2560×1500 (1.7067:1):**
- https://qadan.co/images/car-spotter/2026-10/artwork/04-carspotter-brand-system-2560.webp
- https://qadan.co/images/car-spotter/2026-10/artwork/04-carspotter-brand-system-1600.webp
- https://qadan.co/images/car-spotter/2026-10/artwork/04-carspotter-brand-system-960.webp
- https://qadan.co/images/car-spotter/2026-10/artwork/04-carspotter-brand-system-640.webp

**What it currently says:** `THE IDENTITY / FROM MARK TO PRODUCT`, then three
columns — `01 / RECOGNISABLE MARK` (a cream Saturn wagon illustration), `02 / A
SMALL, REPEATABLE PALETTE` (three swatches: LIME #C8FF00, ASPHALT #0E0F11, CHALK
#E7E9EC), `03 / THE HOME SCREEN` (the old home). Footer: *"A Saturn wagon gives a
familiar car game its own identity. The palette carries through the product and
its marketing."*

**Decision you have to make first.** This figure is introduced in the copy as
*"the earlier identity as it shipped in the October 2026 home iteration"* — it is
on the page as **historical evidence**, deliberately. If you replace it with a
current-identity board, you must also rewrite two paragraphs in
`src/pages/work/[slug].astro` (~lines 935–945) and the `<figcaption>`, or the page
will claim a board is old while showing the new one. Two honest options:

- **Option 1 (recommended):** keep the old board as history, and *add* a second
  board for the current identity. The identity chapter then reads "here is where
  it started, here is where it landed" — which is the stronger story and costs
  one new asset instead of a rewrite.
- **Option 2:** replace it and rewrite the section to be about the current
  identity only, losing the before/after.

### The prompt (Option 1 — a *current identity* board, 2048×1200)

> A brand-system presentation plate for a car-identification mobile game, landscape
> 2048×1200, dark editorial layout, no photographic subject.
>
> **Ground:** near-black `#0E0F11` with a very subtle charcoal `#16181C` radial
> lift in the upper-left third; a 1px hairline rule `#2A2D33` running the full width
> 6% from the top, another 10% from the bottom. No vignette, no glow, no gradient
> mesh.
>
> **Header band (inside the top rule):** small mono label in `#7A8089` reading
> `THE IDENTITY` at left; a second mono label at right reading `2026 · v1.4`. Lots
> of empty space between them — this band is 4% of the plate height.
>
> **Three columns**, equal width, a 4% gutter, occupying the middle 70% of the
> plate. Each column: a small mono number `01` / `02` / `03` in `#C8FF00` above a
> mono caption in `#A6ADB7` (`THE MARK`, `THE PALETTE`, `THE GATE`), then a large
> empty rectangle of `#1F2227` reserved for a composited asset, then two lines of
> small `#A6ADB7` body copy space.
>
> **Column 1** reserved rectangle is square, 1:1. **Column 2** shows three stacked
> horizontal swatch bars with generous vertical gaps — chartreuse, near-black,
> chalk white — each with a hairline `#2A2D33` outline and a small mono hex label
> to its right. **Column 3** reserved rectangle is a tall 3:4 phone-shaped door,
> slightly rounded 12px corners, filled flat `#101313`.
>
> **Footer band** (below the lower rule): one line of body copy space at left
> occupying half the width; at right a small mono label `CARSPOTTER` in `#E7E9EC`.
>
> **Feel:** an automotive workshop manual or a Swiss type specimen, not a startup
> slide. Flat surfaces, no drop shadows except a 1px inner hairline, no 3D, no
> bevels, no glows. Absolutely no car illustration, no photography, no clip art, no
> fake app UI, no invented logos, no lorem text. Leave every text region empty —
> type is set afterwards.

Then composite, left to right:

1. `mark.png` (the chartreuse headlamp "C") at 1:1, centred in column 1.
2. Three swatch labels in Martian Mono: `LIME #C8FF00`, `ASPAT #0E0F11`,
   `CHALK #E7E9EC` — **use the real tokens**, not the old `#C8FF00`-only set: the
   shipped accent is `#C8FF00` / bright `#D9FF45`, ground `#0E0F11` → `#16181C` →
   `#1F2227`, type `#E7E9EC` / `#A6ADB7`.
3. `v1.4/iphone-home-720.webp` into column 3's door, edge-to-edge.
4. Footer copy: *"A chartreuse headlamp. The mark is the first thing a player
   reads, and the same accent is spent only where an action matters."*

---

## 2. Board B — the store creative studies (replaces `05-carspotter-store-studies`)

**Current file, 2560×1520 (1.6842:1):**
- https://qadan.co/images/car-spotter/2026-10/artwork/05-carspotter-store-studies-2560.webp
- https://qadan.co/images/car-spotter/2026-10/artwork/05-carspotter-store-studies-1600.webp
- https://qadan.co/images/car-spotter/2026-10/artwork/05-carspotter-store-studies-960.webp
- https://qadan.co/images/car-spotter/2026-10/artwork/05-carspotter-store-studies-640.webp

**What it currently says:** `APP STORE / CREATIVE STUDIES`, a headline `SHOW THE
GUESS. THEN THE PAYOFF.`, then three vertical panels headed `NAME THAT CAR.` /
`THE FULL REVEAL.` / `GO FIVE FOR FIVE.`, each holding a phone with a 1.2-era
screen and a lime diagonal ribbon. Footer: *"Creative examples. These images are
not evidence of conversion lift."*

**This one is a straight replacement** — the section copy is about the current
store artwork and makes no historical claim. No prose changes needed.

### The prompt (2048×1216)

> A store-artwork contact sheet for a dark car-identification mobile game,
> landscape 2048×1216.
>
> **Ground:** flat `#0E0F11`. A 1px `#2A2D33` rule 7% from the top, one 8% from
> the bottom.
>
> **Header:** small mono `APP STORE / CREATIVE STUDIES` in `#7A8089` at left, and
> `2026` at right.
>
> **Headline:** space reserved for one line of very large condensed uppercase type,
> full width, cap height about 9% of the plate. Leave it empty.
>
> **Three vertical panels** evenly spaced across the middle, each 3:4 portrait,
> 16px corner radius, filled flat `#101313` with a 1px `#262A30` outline, and a
> subtle 8% chartreuse bleed at the left edge of each panel running vertically
> (a thin bright rail, not a diagonal ribbon). Each panel gets a wide empty strip
> beneath it for a mono label and a two-line caption.
>
> **Feel:** an Apple App Store preview sheet — restrained, mostly empty, letting
> three tall objects carry the page. Flat vector, no 3D mockup perspective, no
> reflections, no device bezels drawn in, no glow, no bokeh. No invented UI, no
> text of any kind inside the panels.

Then composite:

- Headline: `SPOT THE CAR. THEN THE REVEAL.`
- Three real captures, in this order: `v1.4/iphone-question-720.webp`,
  `v1.4/iphone-reveal-720.webp`, `v1.4/iphone-progress-720.webp`.
- Panel labels + captions, using the **real** shipped 1.4.0 store headlines so the
  board describes artwork that exists: `01 / MAKE THE CALL`, `02 / INSTANT
  REVEAL`, `03 / TRACK YOUR RUN` — those are three of the nine live posters in
  `social/output/appstore-posters/iphone-6.9/`.
- Footer: *"The same three beats as the store sheet, the reveal card and the run
  summary. No conversion claim is attached to these images."*

---

## 3. Reference assets to attach to the generation

Real captures, all in the portfolio repo:

```
public/images/car-spotter/v1.4/iphone-home-720.webp        720×1565
public/images/car-spotter/v1.4/iphone-question-720.webp    720×1565
public/images/car-spotter/v1.4/iphone-reveal-720.webp      720×1565
public/images/car-spotter/v1.4/iphone-practice-720.webp    720×1565
public/images/car-spotter/v1.4/iphone-progress-720.webp    720×1565
public/images/car-spotter/v1.4/ipad-question-1376.webp    1376×1032
public/images/car-spotter/v1.4/ipad-practice-1376.webp    1376×1032
```

Brand masters, in the app monorepo:

```
apps/mobile/assets/brand/mark.png                      1024×1024  the headlamp "C"
apps/mobile/assets/brand/packet/lockup-dark.svg         475×104   horizontal lockup
apps/web/public/brand/symbol-lime.svg                             mark, vector
packages/design-tokens/src/tokens.ts                              the palette
```

The **shipped 1.4.0 store posters** (real, in review), for headline reference:

```
social/output/appstore-posters/iphone-6.9/
  01-meet-carspotter.png   02-spot-the-car.png    03-make-the-call.png
  04-race-the-clock.png    05-instant-reveal.png  06-still-get-the-reveal.png
  07-finish-the-daily.png  08-track-your-run.png  09-show-up-daily.png
social/output/appstore-pro/1-hero.png 2-core-loop.png 3-features.png   1440×1080
```

---

## 4. Everything else CarSpotter-related in the portfolio

Ordered by what I would actually fix. "Used" means it renders on a live page.

### A. Stale or wrong, and on the page

| # | Thing | Where | Why it matters |
|---|---|---|---|
| 1 | `hero-2026/carspotter-detail-*.webp` + `carspotter-reveal-*.webp` | home page hero, `components/home-hero/WorkReveal.astro` | **These are a Pexels stock photo of a red Toyota Camry**, and the component's own comment says *"this is a study image, not a CarSpotter game asset"*. The portfolio's front door illustrates the product with someone else's photograph. 4 rungs × 2 states, 640/960/1280/1600. Re-crop from `v1.4/iphone-question` + `iphone-reveal` instead, or shoot the real Camry-in-app pair. |
| 2 | `04-carspotter-brand-system` | `#identity` | §1 above. Old identity, Saturn wagon. |
| 3 | `05-carspotter-store-studies` | `#marketing` | §2 above. Old identity, 1.2-era screens. |
| 4 | `status:` frontmatter | `src/content/build/car-spotter.mdx:24` | Reads *"v1.4 submitted for review"*. Correct today; **must** change on approval, and it is the one string every card and metadata block reads. |
| 5 | The `#identity` prose | `[slug].astro` ~935–945 | Says the board *"documents the earlier identity"* — true today, false the moment §1's replacement lands without a rewrite. |

### B. Unreferenced — safe to delete, or archive deliberately

Verified by resolving every base path in `src/` against the files on disk.

| Path | Status |
|---|---|
| `2026-10/screens/home-*`, `question-*`, `reveal-*`, `results-*`, `practice-reveal-*` | **0 references.** Old-build captures, 10 files. |
| `v1.4/ipad-home-*`, `ipad-progress-*`, `ipad-reveal-*` | **0 references.** Only `ipad-question` and `ipad-practice` are used. 6 files. |
| `2026-10/artwork/01-carspotter-portfolio-hero-*` (4 rungs) | Only a **fallback** in `approach.astro:45`, and `coverImage` is always set — so it can never render. Old hero. |
| `2026-10/artwork/01-carspotter-portfolio-hero-mobile-*` (3 rungs) | 0 references. |
| `brand-system/open_graph/carspotter_light.png` | **0 references** since the OG card moved to `carspotter_v14.png`. Old identity. |
| `components/artifacts/CarSpotterArtifact.astro` | Registered in `[slug].astro:90` but **never renders** — the cover-image branch wins, so it is dead code carrying a hand-drawn old mark. |
| `components/diagrams/ReelPipeline.astro` | **0 imports.** A frame-timeline diagram for a CarSpotter reel that no page uses. |

### C. Present and current — no action

- The v1.4 phone ladder, both iPad figures, the poster + its 6 rungs, the work
  thumbnail, `carspotter_v14.png` OG card, both films and their posters, the 18-tile
  wall (count derives from the array, so it cannot drift), the share-card
  comparison pair, the reveal/results comparison, `coverAlt` / `coverMobileAlt` /
  `ogAlt`.

### D. A genuine gap, if you want one more asset

The case study never shows **the Gate** — the 24-hour dial that is the most
distinctive 1.4 interface element, and the thing the whole "one instrument, every
surface" argument rests on. `v1.4/iphone-home-720.webp` contains it but at
thumbnail scale. A single 1:1 crop of the dial (art + `HH:MM` + the seconds drum)
on `#16181C` would let the identity chapter make its point with a figure instead
of a paragraph. That is the one addition I would argue for.

---

## 5. If you only do three things

1. Replace the **home-page hero** (item A1). It is the first thing anyone sees and
   it is currently a stock Camry.
2. Generate **one** new identity board and use it as an *addition* to `#identity`
   rather than a replacement — the before/after is the better story, and it needs
   no prose rewrite.
3. Delete the 20 unreferenced files in group B and the two dead components. That
   removes every remaining old-identity binary from the repo except the two boards
   you are deliberately keeping as history.
