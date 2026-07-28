> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Desktop layout design study — and a shipping fold defect found while measuring for it (2026-07-26)

**No product code changed this round.** The artifact is
`docs/research/desktop-layout.md`: three independent design proposals (Codex,
Grok, in-house) against one brief, plus a measurement pass that ran BEFORE the
proposals so none of them was built on a wrong assumption.

### The finding that outranks the design question

**On a 1280×800 laptop, Play/Pass is below the fold on 95.8% of deals
[79.8%, 99.3%], n=24. On 1024×768 it is 100% [86.2%, 100%].** The owner's
accepted ~8% below-fold rate is a PHONE figure; nobody had measured a desktop
height. This is a defect on the surface that already ships, found while
measuring for a new one.

Cause, decomposed: the `≥720px` "desktop air" block makes the layout ~30–50px
TALLER than the phone's, and the ring is the largest band (341.8px, larger than
the fan) because its centre row is sized by the two **vertical** opponent
card-strips — 147.5px of strip inside a 213px cell — against a trick well that
is at most 98.6px and 0 when empty.

### Three reclaim experiments, and two dead intuitions

Paired (same page, same deal), everything inside `@media (min-width: 720px)`,
n=24:

| lever | reclaims | 1280×800 below fold |
|---|---|---|
| reverse the ≥720 padding tax + ring min 9rem→5rem | 24px | 91.7% → 87.5% — no measurable change |
| **lift the width caps** (ring 632→1342px) | **0px** | unchanged |
| re-site west/east out of the grid's height math | 69px | → 4.2% |
| all three together | **138.4px** | **95.8% → 0/24 [0%, 13.8%]** |

- **Grok's own kill experiment came back negative, exactly as it pre-declared
  it would.** Its riskiest assumption was that reversing the ≥720 chrome tax
  would be enough. It buys 24px against a ~90px deficit.
- **Widening does not shorten.** The obvious abundance move — lift the caps —
  reclaims exactly ZERO vertical on every deal. Worth saying plainly because it
  is what anyone tries first, including me.
- The fix and the ring win are the same change: re-siting those two cells drops
  the ring to 211.4px AND moves the opponents from 608px apart to 935–1600px.

### What the app actually does above 523px: nothing

`--gd-cardw: clamp(2.75rem, 13vw, 4.25rem)` hits its ceiling at **exactly
523px** of viewport width (measured to the pixel: 67.6 at 520, 68.0 at 523).
Every font size is identical from 768px to 2478px. At 2478px the product's box
is **45.2%** of the viewport and the two opponents sit 608px apart. The ≥720px
block is not a desktop layout; it is the phone layout, centred, with padding.

### Where measurement beat the proposals

- **Both external lineages put a 90px card at ≥1440.** Measured, that is below
  the fold on 50% of deals at 1440×900 [31.4%, 68.6%] — a 90px card costs ~190px
  of stack height, more than the 138px the ring re-siting reclaims. The real
  ladder is gated on BOTH axes: 68px ≥1280, 80px ≥1440×900, 90px ≥1920×1080.
- **Codex started zero-overlap at 1024, Grok argued 1280.** Grok is right: at
  1024 the hand wraps and 54.2% of deals go below the fold. **This also
  corrects a conclusion of my own** — my §3.3 read "≥1024" off a usable-width
  estimate; the real padding chain makes it 1280.
- Zero overlap at today's card is **vertically free** above 1280 and grows the
  hand's ink 639 → 956px.
- **The phone did not move at any step**: 8.3% [2.3%, 25.8%], identical card,
  ink, lines, fan, ring and span across all five configurations × 24 deals.

### "Token-level" is partly a fiction, and one door is already open

`clamp(2.75rem, 13vw, 4.25rem)` is written out **nine times** in `table.css` —
three of them inside `calc()` multipliers, which a media query cannot override
without re-declaring the whole rule. Six are locked by tests comparing them **by
string equality**, and `seat-stack.test.tsx:940-943` asserts there is exactly
ONE `--gd-cardw` declaration across all `.gd-seatstack` rules precisely so a
media-query re-clamp "cannot hide from an unanchored scan". So a desktop card
size is a nine-site edit against six pins and one explicit prohibition.

**And the silent version.** Raising only the clamp CEILING passes the ENTIRE
suite while changing nothing any test measures — every CSS-arithmetic pin
evaluates the clamp at 390px, where `min(max(13vw, 44), ceiling)` is 50.7
whatever the ceiling is (`hand-fan.test.tsx:384` computes exactly that, then
asserts `toBe(50.7)`). A desktop card size could be shipped, believed and green
with no gate having looked at it. That is practice 12's "second unmeasured
surface" with a door already open to it.

### Two premises corrected

- **`AREA_HARD_MAX` does not read `window.innerHeight`.** It is a plain
  constant (`areas.ts:618`); the viewport-derived allowance was deleted in
  `186b2b9`. A third sort area will NOT become available on a big screen.
- **Variant D does not stop existing when horizontal overlap does.** Its
  measured victim is the card directly ABOVE it in its own value pile —
  vertical, untouched by de-overlapping horizontally
  (`docs/research/fan-tap-targets.md:18-22`).

### The in-house proposal landed last and changed two conclusions

Its central move is one neither external lineage made. The rank glyph is
`calc(var(--gd-cardw) * 0.36)` and that index row must fit the EXPOSED SLIVER,
`p x w`. Scale the index ratios with the pitch and the glyph becomes a fixed
fraction of the fan's total ink — so **"bigger card" vs "less overlap" was never
a legibility choice**. A pitch of 1.00 at a 68px card gives the same glyph as a
96px card at today's 0.70, with **no change to fan height**; the 96px card costs
+41% of card height on the axis that is already failing. That is exactly what
the ladder measured independently (`fix+zero68` vertically free, `fix+zero90`
~190px), so equation and measurement agree.

Consequence: card width **never changes**, so the nine-site clamp debt becomes
irrelevant, and a third rung at 960px (pitch 0.80) appears that neither external
proposal had.

**Three corrections to my own write-up, all from that pass, all re-verified
before acceptance:**

1. **My "collapse the nine clamp literals" recommendation was wrong.** Five of
   the nine are deliberate ANCESTOR definitions serving inline
   `calc(var(--gd-cardw) * F)` styles; `table.css:805-813` records what a
   missing one does — *"the calc is invalid at computed-value time and the
   margin silently becomes 0 (verified live: stacked cards rendered
   full-height, no overlap)"*. A wrong consolidation breaks the PHONE, silently.
   It is also unnecessary: a media query restates a declaration, not a rule.
2. **My 11–14 column range came from too small a sample.** The structural worst
   case is 15, already written at `hand-fan.test.tsx:415`. P(15 columns) =
   **3.43%** — re-derived independently here with a 200,000-deal simulation
   (in-house 3.42%; distribution agrees to within noise). **An n=8 sample misses
   it 75.6% of the time**, so 11–14 is just what n=8 of that distribution looks
   like, and every width threshold from it used the wrong worst case. The
   15-column hand must be CONSTRUCTED, never waited for. Practice 12, against my
   own measurement this round.
3. **My viewport labels are inner heights, not screen sizes.** Playwright's
   `viewport` sets `innerHeight` directly (checked). A real 1280×800 laptop with
   browser chrome presents ~680–710 inner, where the defect is WORSE than
   measured. Same class as the "844 is an inner height no phone produces"
   correction already on the record.

It also named a standing invariant exception nobody had: a covered card in a
pile exposes **28.6px** of uniquely tappable height at a 68px card (25.1px at 9
deep) — above WCAG 2.5.8's 24px, below this project's own 44px floor
(`HandFan.tsx:183-185`, `themes/lacquer.tsx:88`, both verified). Pre-existing;
reported, not fixed.

And it caught a real gap in mode admission: page zoom shrinks the CSS viewport
rather than scaling the layout, so an elder at 150% zoom on a 1440×900 is at
**960×600** — admitted to a desktop mode by width with 600px of height. Gating
the desktop air on `and (min-height: 700px)` makes WCAG 1.4.4 statable.

### Process notes

- **Two probe bugs, both caught by fail-loud guards rather than by luck.** The
  first counterfactual set `--gd-cardw` on `.gd-table`, which loses to
  `.gd-card--hand`, so every "bigger card" row measured today's card; the fixed
  probe returns the resolved width and throws on mismatch. The second closed
  the driver context between viewports, so the DO's 60s disconnect grace
  auto-played seat 0's turn and the action bar legitimately vanished mid-run —
  the guard reported "measured nothing" instead of recording the wrong layout.
- **One in-house agent wrote a file despite being told not to** — a stray
  `sweep-cg.txt` in the repo root, the stderr of a `node sweep.mjs` that did not
  exist. Removed; `src/`, `tests/` and `scripts/` verified untouched by
  `git diff`. Noted because "change no files" is a panel rule and it was broken,
  harmlessly, by our own side.
- **Disclosed panel asymmetry:** web search was ON for Grok and OFF for Codex
  (`codex exec` does not enable it by default). Both were given the same
  prior-art facts so neither depended on search for anything load-bearing.
- **The in-house pass refuted its own draft in two places and said so** — it
  proposed the clamp consolidation, had its own critique show that
  `table.css:805-813` documents a live failure of exactly that shape, and
  deleted it. That is the adversarial stage doing the job it exists for, on our
  own side of the panel.
- **Panel integrity flagged, not resolved:** both lineages have now DESIGNED,
  so whichever proposal is adopted, that lineage is anchored for the gate audit
  of the thing it designed. Owner decision 9 in the study.
- **Flagged for its own round:** a possible WCAG SC 1.4.4 exposure on the
  PHONE — card glyphs are `calc(var(--gd-cardw) * 0.36)` and below 523px
  `--gd-cardw` is `13vw`, which is the shape of W3C failure technique F94.
  Marked inference; one zoom measurement settles it; nobody has run it.
