# Desktop layout — front-end design study

Dated 2026-07-26. Owner mission: the app is phone-first and it shows — on a
~2478px-wide screen the content sits in a ~700px column with empty margins,
small cards, small type and a cramped ring. Keep the current design at small
viewports and progressively transition to a larger layout as the viewport
grows. **This round designs; it changes no product code.**

## 1. Decided premises (owner — not re-litigated here)

- **Phone-first stays.** The phone layout below the first breakpoint must be
  BYTE-IDENTICAL and proven so, the way progressive disclosure was pinned for
  sort areas (a zero-area fan emits no split/seam class at all).
- **The problem is the INVERSE of every prior round.** Every constraint this
  project has fought was scarcity — 374px of content width, 7.4px of slack, the
  9-column wrap, the 122px wrap cost, the 844 fold. Desktop is abundance, and
  "what to do with surplus" is a different question from "scale everything up".
- **Overlap is forced, not chosen.** Most of this project's hardest work exists
  *because* of overlap — corner-index legibility in a left sliver, the wild 配
  marker in that sliver, variant-D hit/paint decoupling, ~12px suit
  silhouettes. Where overlap goes away, so do its constraints. **So the desktop
  layout must not be derived from the phone layout.**
- **Discrete layout modes over continuous scaling**, because this project's
  discipline is measurement and you cannot measure infinitely many widths.
- **Token-level before structural**, because two component trees means every
  future feature is verified twice forever.
- **Every mode gets its own measured gates**, reported as rates with sample
  sizes and intervals — never a binary pass/fail. The named hazard is creating
  a second UNMEASURED surface.

## 2. What was run

Three INDEPENDENT design proposals against one brief (the brief is a scratch
artifact; its content is §1 plus the measurements of §3, which is what it
carried), plus a measurement pass that ran BEFORE the proposals so none of them
was built on a wrong assumption — the sort-areas lesson, where measurement
disqualified the layout of a proposal after the fact.

| Lineage | Mechanism | Web search | Artifact |
|---|---|---|---|
| Codex | `codex exec` in a throwaway clone | off (not enabled) | `proposals/desktop-A-codex.md` |
| Grok | `grok --prompt-file` in a throwaway clone | **on** (deliberate) | `proposals/desktop-B-grok.md` |
| Claude (in-house) | workflow: 3 code-map + 2 prior-art + 1 blast-radius agents → proposer → 3 adversarial critiques → revision | on | see the honesty note below |

**What the in-house lineage actually delivered, stated exactly.** Its six
research agents were the decisive input of this round and their findings are
folded into §3.9 (the nine-site clamp, the `.gd-seatstack` prohibition, the
clamp-ceiling silent pass, the absence of any width-reactive JS), §4.3 (variant
D's real victim) and §6's flagged WCAG note. **Every claim taken from them was
re-verified against the source before being written down here** — the clamp
count, both test pins, the `toBe(50.7)` arithmetic, the no-width-reactive-JS
grep and the fan-tap-targets quote were each checked by hand, because a
subagent's report is a claim, not a measurement.

The synthesis stages — proposer, three adversarial critiques, revision — had
**not completed when this document was written**, because one prior-art agent
ran long and the phase is a barrier. So there is no third finished PROPOSAL
here, only a third set of research. That is a smaller panel than planned and it
is stated rather than implied; the two external proposals plus the measurements
are what §4 compares.

**Disclosed asymmetry:** the audit recipe in METHODOLOGY passes
`--disable-web-search` to Grok. This is a design study in which prior art is
explicitly in scope, so search was left ON for Grok and is OFF for Codex
(`codex exec` does not enable it by default and I did not add it). Both were
given the same prior-art observation in §3.8 so neither depended on search for
the load-bearing facts. Neither lineage saw the other's answer or the in-house
work; each read the repo itself. Per METHODOLOGY practice 6 this is proposal
diversity, not an audit — the audit panel comes at the gate.

**Panel-integrity note, carried honestly (same shape as the sort-areas round):**
both lineages have a proposal role now AND an audit role at the gate. Whichever
proposal is adopted, that lineage is anchored for the gate audit of the thing it
designed (producer ≠ auditor, METHODOLOGY 2026-07-15). Flagged, not resolved
unilaterally — see the decision list.

## 3. MEASUREMENTS — the part that decided things

All measured on the current build (`f0103ee`), headless Chromium, real dealt
27-card hands in live local rooms, zh-Hant. Figures are readings, not
estimates. Sample sizes are stated per table; where a range appears it is
min–max across those deals, because the fan's geometry is a step function of
the dealt hand and one deal is a sample, not a property (practice 12).

### 3.1 The app stops responding to width at 523px

`--gd-cardw: clamp(2.75rem, 13vw, 4.25rem)` reaches its 68px ceiling where
13vw = 68px, i.e. **exactly 523px** of viewport width. Measured by a width
sweep (n=1 deal per width — card width is not deal-dependent):

| viewport width | 480 | 520 | **523** | 524 | 600 | 719 | 720 | 900 | 1152 | 2478 |
|---|---|---|---|---|---|---|---|---|---|---|
| card width (px) | 62.4 | 67.6 | **68.0** | 68.0 | 68.0 | 68.0 | 68.0 | 68.0 | 68.0 | 68.0 |

**A 523px window and a 2478px window draw identical cards.** Every font size is
also identical from 768px to 2478px (n=8): turn sentence 15px, seat-plate name
13px, Play button 15px, desk title 18px. The only type change anywhere above
the phone is the turn sentence going 13→15px at the existing 720px breakpoint.

The "desktop air" block at `min-width: 720px` is therefore not a desktop
layout. It is the phone layout, centred, with padding.

### 3.2 What actually caps the layout

| element | cap | source |
|---|---|---|
| `.app-main--wide` (the table page column) | **72rem = 1152px** | `app.css:237` |
| `.gd-ring__table` (the ring) | **38rem = 608px** (+24px padding = 632px) | `table.css` `@media (min-width: 720px)` |
| `.gd-handzone` (the hand) | **44rem = 704px** | same block |

Fraction of the viewport the product's own box occupies (n=8):

| viewport | 1024×768 | 1280×800 | 1440×900 | 1728×1117 | 1920×1080 | 2478×1400 |
|---|---|---|---|---|---|---|
| used | 96.9% | 87.5% | 77.8% | 64.8% | 58.3% | **45.2%** |

The west-to-east seat-plate span is **608px at every viewport from 720px up**.
On a 2478px screen the two opponents sit 608px apart. The trick well is at most
**149.6 × 98.6px**, and 0 when no play is on the table.

One oddity worth knowing: crossing 719→720px the ring gets NARROWER (671px →
632px), because that is where the 38rem cap starts binding.

### 3.3 The fan, and the fan without overlap

Settled mode collapses 27 cards to **11–14 value columns** (n=8 deals). Each
column overlaps its left neighbour by 30% (`margin-left: calc(cardw * -0.3)`),
so the pitch is 0.7 × card width.

| | 390×844 | ≥768 wide |
|---|---|---|
| card width | 50.7px | 68px |
| column pitch | 35.5px | 47.6px |
| fan ink width | 334.6px | 544–687px |
| fan lines | 2 | **1** |
| fan height | 252–295px | 198–227px |

The two-line wrap — the 122px the sort-areas round spent so long costing — is
already gone at every viewport from 719px up.

**Counterfactuals, measured by injecting the change and re-reading the live
DOM, not by arithmetic** (n=8 deals, hand cap lifted to the viewport). Ink
width of the whole 27-card hand and how many lines it wraps to, at ≥1440px:

| variant | ink width | lines |
|---|---|---|
| zero overlap, today's 68px card | 748–952px | 1 |
| zero overlap + 6px gaps, 68px | 808–1030px | 1 |
| today's 30% overlap, 90px card | 786–995px | 1 |
| **zero overlap, 90px card** | **990–1260px** | **1** |
| zero overlap + 6px gaps, 90px | 1050–1338px | 1 |
| zero overlap, 110px card | 1210–1540px | 1 (needs ≥1728px) |

The width at which each becomes possible on one line for every deal measured:

- **≥1024px** — zero overlap at today's card size (max 952px ink vs 992px usable).
- **≥1280px** — zero overlap with gaps at today's card size.
- **≥1440px** — zero overlap at a **90px card**: a 32% bigger card AND no overlap.
- **≥1728px** — zero overlap at 110px.

> **SUPERSEDED IN PART by §3.10 — read that before using this list.** These are
> HORIZONTAL fit thresholds and they are correct as such, but two of them do not
> survive as layout thresholds. The 1024px row assumed 992px of usable width;
> the real padding chain leaves ~930px, so a 956px zero-overlap hand **wraps**
> there and 54.2% of deals fall below the fold. And the 90px row says nothing
> about height: at 1440×900 a 90px card puts Play below the fold on 50% of
> deals. Fitting on one line horizontally is necessary, not sufficient — the
> combination had to be measured, and §3.10 is that measurement.

**A methodological note that cost a draft.** The first version of this probe
set `--gd-cardw` on `.gd-table`. That silently loses to `.gd-card--hand`, which
declares the token on the element itself, so every "bigger card" row measured
today's card. The fixed probe returns the resolved card width with each variant
and throws if it does not match what was asked for — the counterfactual proves
it applied rather than assuming it (practice 13).

### 3.4 The vertical defect — the finding nobody was looking for

Play/Pass position in **document** coordinates (viewport-relative readings are
untrustworthy here: the client scrolls itself via ScrollActionsIntoView —
practice 11).

| viewport | Play doc bottom | fold | below fold |
|---|---|---|---|
| 390×844 | 788–852 | 844 | 1/12 = 8.3% [1.5%, 35.4%] |
| 390×664 (a real phone inner height) | 788–831 | 664 | 8/8 |
| 768×1024 | 832–860 | 1024 | 0/8 |
| **1024×768** | 832–889 | 768 | **12/12 = 100% [75.8%, 100%]** |
| **1280×800** | 780–889 | 800 | **12/13 = 92.3% [66.7%, 98.6%]** |
| 1440×900 | 832–889 | 900 | 0/12 [0%, 24.2%] |
| 1920×1080 | 832–860 | 1080 | 0/8 |

**The desktop layout is TALLER than the phone one.** The ≥720px block adds
padding to `.gd-table` and to the ring and raises the ring centre's minimum row
from 6.5rem to 9rem, so the desktop stack costs ~30–50px more than the phone's
while its fan is 60–70px shorter.

**On a 1280×800 laptop — a very common size — Play/Pass is below the fold on
~92% of deals. On 1024×768 it is 100%.** That is a shipping defect on the
surface that already exists, found while measuring for a new one. The owner's
accepted ~8% below-fold rate was a phone figure and does not cover this.

The vertical budget at 1280×800, median per band, document px (n=13):

| band | height |
|---|---|
| app header | 51 |
| headline bar | 40 |
| **ring** | **341.8** |
| ↳ north seat zone | 84.8 |
| ↳ centre row | 213 (the trick well inside it is ≤98.6, and 0 with no play) |
| ↳ west/east seat zone (each) | 213 (card strip alone 147.5) |
| fan | 302.9 |
| play desk | 94.5 |
| actions row | 59 |
| bottom bar | 35.5 |
| document height | 1051 |

The ring is the largest single band, larger than the fan — and its centre row is
sized by the two vertical opponent card-strips, not by the trick well.

### 3.5 Three reclaim experiments: what buys height, and what does not

Paired measurements — baseline and variant on the SAME page and the SAME deal,
so the difference is the CSS and nothing else. Every variant lives inside
`@media (min-width: 720px)`.

| variant | what it does | height reclaimed |
|---|---|---|
| **R1** | reverse the ≥720 vertical tax: table + ring padding down, ring centre min 9rem → 5rem | **24px**, every deal |
| **R2** | let the ring and hand use the width: caps → `min(96vw, 1800px)` | **0px**, every deal — ring height 341.8 → 341.8 while its width goes 632 → 1342 |
| **D3** | take the west/east seat cells out of the grid's height math (out of flow, the way north's own plate and count flanks already are) | **69px**, every deal |
| **R1 + D3** | both | **138.4px**, every deal |

Below-fold rate per variant, n=24 deals, Wilson 95%:

| | baseline | R1 | D3 | **R1 + D3** |
|---|---|---|---|---|
| **1280×800** | 22/24 = 91.7% [74.2, 97.7] | 21/24 = 87.5% [69.0, 95.7] | 1/24 = 4.2% [0.7, 20.2] | **1/24 = 4.2% [0.7, 20.2]** |
| **1024×768** | 24/24 = 100% [86.2, 100] | 24/24 = 100% [86.2, 100] | 7/24 = 29.2% [14.9, 49.2] | **1/24 = 4.2% [0.7, 20.2]** |
| **390×844** (control) | 3/24 = 12.5% [4.3, 31.0] | 3/24 — same | 3/24 — same | **3/24 — same** |

Four things this settles.

1. **Grok's kill experiment came back negative, exactly as it pre-declared.**
   Its riskiest assumption was that reversing the ≥720 chrome tax would be
   enough to ship larger cards without a fold problem. It buys 24px against a
   ~90px deficit and moves the 1280×800 rate from 91.7% to 87.5% — inside each
   other's intervals, i.e. no measurable improvement. Its own stated
   consequence — "do not ship larger cards on top of a still-broken fold" —
   applies, and it wrote that consequence down before running the experiment.
2. **Widening does not shorten.** The intuitive abundance move — lift the caps,
   let the ring breathe — reclaims exactly ZERO vertical on every deal. The
   ring's height is set by its content, and its content does not care how wide
   its box is. This is worth stating plainly because it is the move anyone
   would try first, including me.
3. **The height is in the opponents' card strips, and re-siting them is the
   whole fix.** West and east are vertical strips because the flank round gave
   each seat its own handedness (east's right hand is its strip's top, so it
   lays as a column). At 27 cards that is a 147.5px strip inside a 213px cell,
   and it is what makes the ring 341.8px tall against a 98.6px trick well. D3
   alone takes 1280×800 from 91.7% to **4.2%**. R1 is what finishes the job at
   1024×768 (29.2% → 4.2%), because with the seat cells gone the `minmax(9rem)`
   minimum becomes the binding constraint and R1 is what lowers it.
   **This is the abundance trade made concrete: surplus WIDTH is what pays for
   the vertical budget, but only through a structural re-siting — not through a
   `max-width`.**
4. **The phone is unmoved, and that is measured, not asserted.** At 390×844 the
   reclaim ceiling is **0px** and the below-fold rate is 3/24 = 12.5% [4.3%,
   31.0%] in the baseline and in all three variants alike, because every rule
   lives inside `@media (min-width: 720px)`. This is the byte-identity
   mechanism demonstrated on a real page. It is weaker than the gate the owner
   wants (it shows one measured quantity is unchanged, not that the CSS is
   byte-identical) and it does not replace that gate.

**D3 is a diagnostic, not a proposal.** It measures how much of the ring's
height those two cells are responsible for; `position: absolute` at `left: 0` /
`right: 0` is a crude stand-in and visibly pushes the strips against the
viewport edge (see §3.6). What it establishes is that the reclaim exists, that
it is ~69px, and that it is the only lever measured so far that moves the rate.

### 3.6 What the candidate actually looks like

The reclaim variants were also rendered and looked at, not only measured —
because a number that fits says nothing about whether the result is usable.
Screenshots at 1440×900 and 2478×1400, `R1 + D3 + caps lifted + zero overlap +
6px gaps + a 90px card`:

**What works.** The hand is transformed: every one of the 27 cards shows its
whole face at 90px with no occlusion, the wild and the joker/bomb are
unmistakable at a glance, and it still fits one line. The trick well finally
holds a real play at a readable size instead of a stamp. West and east sit
~1300px apart — the opponents are genuinely across the table. Play/Pass are
above the fold.

**What does not.** Three things, all worth the owner knowing before signing
anything off:

- **The diagnostic's seat placement is wrong**, exactly as expected of a
  diagnostic: `left: 0` / `right: 0` on a 94vw ring shoves both strips against
  the viewport edge and clips them. Re-siting the seats is a real design task,
  not a two-line CSS change.
- **The remote seats now look tiny beside the hand.** Grok predicted this in
  its risks table before any of it was rendered. A 90px own-hand card next to
  an unchanged opponent strip is a new imbalance the phone never had.
- **At 2478×1400 roughly 600px of vertical void remains below the content**,
  because the whole table is top-anchored. Nothing in these experiments
  addresses it, and no amount of width will. Vertically centring the table
  within the viewport is probably a one-property change and is not in any of
  the three proposals; I am flagging it rather than folding it in.

### 3.7 A premise corrected

`AREA_HARD_MAX` does **not** read `window.innerHeight`. It is
`export const AREA_HARD_MAX = 2;` (`src/client/table/areas.ts:618`). The
viewport-derived allowance that used to sit beside it was deleted in the
set-aside fix (`186b2b9`, 2026-07-25), because it decided the control's
existence from a viewport-relative measurement taken at a moment the player
never sees. **So a third sort area will not become naturally available on a big
screen.** Raising the cap is an explicit one-line decision with its own
consequences (merge is unreachable at 2 by construction, and the sort-areas
round measured a third band at +150px of fan height on a phone).

### 3.8 Prior art

`guandan.app`, observed 2026-07-26 at 1920×1200 and again at 820×1100: **it is a
fixed landscape scene that rotates 90° when the window is portrait.** One
layout, not a responsive family. Inside it, the hand is one row spanning ~88% of
the width at roughly **70% overlap**, with a large full-height exposed sliver
carrying a big rank-over-suit glyph; selecting lifts a card clear of the pile
and reveals its whole face; played cards animate from the seat's position to the
table centre; the three opponents are large panels at left / top / right; the
primary action is bottom-right, a secondary bottom-left, a status sentence
between them.

Its answer to abundance was **a bigger card with MORE overlap and a bigger
readable sliver** — not zero overlap. That is a real competing hypothesis to
what §3.3 makes available, and both external lineages engaged with it.

`guandan.online`: the table is behind a login. **Not observed** — no account was
created (standing rule). That is a null result with a stated reason, not a gap.

### 3.9 "Token-level" is partly a fiction here, and the code says so

The owner's steer — do as much as possible at token level — is right in spirit
and the two things it is most often applied to behave very differently. I
checked this in the source rather than assuming, because the whole
token-vs-structure decision rests on it.

**Card size is NOT a token.** `clamp(2.75rem, 13vw, 4.25rem)` is written out
**nine times** in `table.css`, as a literal, not a variable:

| line | what it sizes |
|---|---|
| 271 | `--sliver-w`, the cut ribbon |
| 520 | `.gd-card--hand` — the card itself |
| 813 | `.gd-fan` — needed so the inline stack margins can resolve |
| **858** | `.gd-fan__row` overlap — **inside `calc(… * -0.6)`** |
| **876** | `.gd-fan__stackRow` padding — **inside `calc(… * 0.3)`** |
| **1024** | `.gd-fan__stack` pitch — **inside `calc(… * -0.3)`** |
| 1171 | `.gd-desk__stage` |
| 2198 | `.gd-seatstack` |
| 2914 | `.gd-sf__faces` |

Six of the nine are locked in step by tests that compare them **by string
equality** (`hand-fan.test.tsx:266,267,286,329`; `cut-panel.test.tsx:106-108`;
`seat-stack.test.tsx:931-933`). The three in bold sit inside `calc()`
multipliers, so a media query cannot override them by re-declaring a custom
property at all — it has to re-declare the whole rule.

And one existing test forbids the obvious desktop mechanism outright:
`seat-stack.test.tsx:940-943` asserts there is exactly ONE `--gd-cardw`
declaration across all `.gd-seatstack` rules, with the comment *"a divergent
re-clamp inside a media-query block cannot hide from an unanchored scan."*
That pin was written to stop a bug, and it also stops a desktop override.

**So "give desktop a bigger card" is a nine-site edit against six string-equality
pins and one explicit prohibition — not a token swap.** Overlap is the same
story: `hand-fan.test.tsx:295-296` pins `-0.6` and `-0.3` as literals, and
`hand-fan.test.tsx:369-421` derives the 390px wrap arithmetic FROM the pitch
factor and asserts the 15-column row does not fit one line — five assertions
that a zero-overlap change turns red.

**And the silent version, which is worse.** Raising only the clamp CEILING
(4.25rem → 5.625rem) passes the ENTIRE test suite while changing nothing any
test measures — because every CSS-arithmetic pin evaluates the clamp at 390px
or 375px, where `min(max(13vw, 44), ceiling)` is 50.7 regardless of the
ceiling. `hand-fan.test.tsx:384` computes exactly that and then asserts
`toBe(50.7)`. A desktop card size could therefore be shipped, believed, and
green, with no gate anywhere having looked at it. **That is the second
unmeasured surface the owner named, and it already has a door open to it.**

What IS genuinely token-level, verified the same way: the `--fs-*`, `--space-*`,
`--radius-*` and `--track-*` ladders (one declaration site each in `app.css`,
consumed by `var()` everywhere), and the three `max-width` caps in §3.2.

One more structural fact that bears on every "just add a mode" proposal:
**there is no width-reactive JavaScript in this client at all.** Every
`matchMedia` call in `src/` is `prefers-reduced-motion`; there is no
`ResizeObserver`, no `innerWidth` read, no `IntersectionObserver`. The only
`innerHeight` mentions are comments describing the code that was deleted in the
set-aside fix. Every responsive decision today is CSS-only — so a layout mode
that any component needs to *know about* would be the first such code in the
repo, and that is an addition, not a swap.

### 3.10 The combination — measured, because the levers push opposite ways

Everything above moved one lever at a time. This is the ladder, n=24 deals per
viewport, each step adding one lever so its cost is attributable. `fix` =
`R1 + D3 + caps lifted`; `zeroNN` = zero overlap with 6px gaps at an NN-px card.

**Below-fold rate (Wilson 95%):**

| | base | fix | fix+zero68 | fix+zero80 | fix+zero90 |
|---|---|---|---|---|---|
| **1024×768** | 100% [86.2, 100] | **0%** [0, 13.8] | 54.2% [35.1, 72.1] | 100% | 100% |
| **1280×800** | 95.8% [79.8, 99.3] | **0%** [0, 13.8] | **0%** [0, 13.8] | 50.0% [31.4, 68.6] | 95.8% |
| **1440×900** | 0% | **0%** | **0%** | **0%** [0, 13.8] | 50.0% [31.4, 68.6] |
| **1920×1080** | 0% | **0%** | **0%** | **0%** | **0%** [0, 13.8] |
| **390×844** (control) | 8.3% [2.3, 25.8] | 8.3% | 8.3% | 8.3% | 8.3% |

**Geometry (median):**

| step | card | hand ink | lines | fan height | ring height | west↔east span @1440 |
|---|---|---|---|---|---|---|
| base | 68×98.6 | 639.3 | 1 | 198.3 | 341.8 | 608 |
| fix | 68×98.6 | 639.3 | 1 | 198.3 | **211.4** | **1334.4** |
| fix+zero68 | 68×98.6 | **956** | 1 | **198.3** | 211.4 | 1334.4 |
| fix+zero80 | 80×116 | 1112 | 1 | 267.9 | 228.8 | 1334.4 |
| fix+zero90 | 90×130.5 | 1242 | 1 or 2 | 386.4 | 243.3 | 1334.4 |

Five results, and two of them change the answer.

1. **`fix` alone is the whole fold repair AND the whole ring win.** It takes
   1280×800 from 95.8% to **0/24 [0%, 13.8%]** and 1024×768 from 100% to
   **0/24**, drops the ring from 341.8 to 211.4, and lifts the west↔east span
   from 608px to 935 / 1181 / 1334 / 1600px depending on viewport. The
   opponents end up genuinely across the table as a *side effect* of fixing the
   fold, because both come from the same re-siting.
2. **Zero overlap at today's card is vertically FREE** — `playDoc` and fan
   height are identical to `fix` at 1280, 1440 and 1920 (693.2 / 198.3), while
   the hand's ink grows 639 → 956px. That is a real legibility win for nothing.
3. **But it starts at 1280, not 1024 — and §3.3 got that wrong.** §3.3 read
   "≥1024px" off a 992px usable-width estimate. Measured with the real padding
   chain, the zero-overlap hand is 956px of ink against ~930 usable at 1024, so
   it **wraps**, and the wrap costs ~105px of height and puts Play below the
   fold on 54.2% of deals. **This is a correction to my own §3.3 conclusion**,
   and it resolves the one place the two external lineages contradicted each
   other: Codex started zero-overlap at 1024, Grok argued for 1280 and gave the
   reason ("do not couple zero-overlap ambition to the worst laptop fold").
   Grok is right, and now it is measured rather than argued.
4. **The bigger card is gated by HEIGHT as much as width, and both lineages
   got this wrong in the same direction.** Codex and Grok independently put a
   90px card at ≥1440. Measured, `fix+zero90` at **1440×900 is below the fold on
   50% of deals** [31.4, 68.6]. A 90px card costs ~190px of stack height — the
   card is 32px taller, the piles' vertical offsets scale with card width, and
   on some deals it wraps — which is *more* than the 138px the ring re-siting
   reclaims. The measured thresholds are:

   | card | needs |
   |---|---|
   | 68px, zero overlap | ≥1280 wide |
   | 80px, zero overlap | ≥1440 wide **and** ≥900 tall |
   | 90px, zero overlap | ≥1920 wide **and** ≥1080 tall |

   Neither proposal could have known this: it only appears when the levers are
   measured together, which is why the ladder exists.
5. **The phone is identical at every step.** 2/24 = 8.3% [2.3%, 25.8%], median
   809.6, card 50.7×73.5, ink 334.6, 2 lines, fan 273.4, ring 244.7, span 342 —
   the same numbers in all five configurations across 24 deals. The 8.3% also
   reproduces the owner's accepted phone rate exactly, which is a useful sign
   the harness is measuring the same thing the fold gate does.

## 4. The proposals — where the lineages agree, and where measurement settled it

### 4.1 Independent convergence

Both external lineages, having seen neither the other's answer nor mine,
arrived at the same six positions. Convergence across lineages is the closest
thing this project has to evidence in a design question, so these are put
forward as settled unless the owner objects:

- **Discrete modes, not continuous `vw` scaling.**
- **One component tree.** Neither would build a second desktop React tree; both
  priced it as "every future feature verified twice, forever".
- **Do NOT raise `AREA_HARD_MAX` because the screen is wide.** Grok: "width does
  not create a free third shelf"; Codex: "a product decision, not a responsive
  side effect".
- **Do NOT default to a 110px card** — it needs ≥1728px and buys scanning cost.
- **Reject `guandan.app`'s rotate-to-landscape architecture** — it fights
  phone-first and means verifying every feature × orientation.
- **The 1280×800 fold is P0**, and must be fixed by shortening the stack, never
  by a sticky action bar. Grok names sticky as a practice-11 compensator that
  would falsify the gate; Codex says "treat auto-scroll as a safety net only".

### 4.2 Where they disagreed, and who was right

| question | Codex | Grok | measured verdict |
|---|---|---|---|
| where zero overlap starts | 1024 | 1280 | **Grok.** At 1024 the zero-overlap hand wraps and 54.2% of deals go below the fold (§3.10) |
| number of modes | 4 (720/1024/1440) | 3 (720/1280) + an orthogonal short-height budget | **Grok's shape.** Height is a separate axis: 1280×800 and 1920×1080 are the same width class and behave differently at every card size |
| the event feed | grow it into a right-side rail | keep it a 2-line tail; a sidebar "steals fold and attention" | **not settled by measurement** — a real owner decision |
| a 90px card | ≥1440 | ≥1440 | **both wrong.** 50% below fold at 1440×900; it needs ≥1920×1080 (§3.10) |

### 4.3 What the in-house code map added that neither proposal had

Both lineages accepted the owner's "token-first" steer and estimated that most
of the work was token-level. §3.9 shows that is true of type and spacing and
**false of the card size**, which is a nine-site literal behind six
string-equality pins and one explicit prohibition. Both proposals would have
hit that on day one.

The same pass found the silent-pass hazard (§3.9): raising the clamp ceiling
alone is green everywhere while measuring nothing. Neither proposal named it.

And a premise in the brief itself is half wrong: variant D does **not** stop
existing when horizontal overlap goes away. Its measured victim is the card
*directly above it in its own value pile* — a vertical relationship
(`docs/research/fan-tap-targets.md:18-22`), untouched by de-overlapping
horizontally. Variant D is retired only if the desktop hand also drops the
same-value piles, which is a change to the hand's whole reading model, not a
spacing change.

## 5. What I would do, and why

Offered as a recommendation, not a decision — the numbered list in §6 is what
needs sign-off.

**Split this into two changes, and ship the first one alone.**

**Change A — the fold repair.** `R1 + D3 + caps lifted`, no card change, no
overlap change. Measured: 1280×800 goes 95.8% → **0/24**, 1024×768 goes 100% →
**0/24**, the phone does not move (8.3% before and after, n=24), and the ring
drops 341.8 → 211.4px while the opponents move from 608px apart to 935–1600px
apart depending on viewport. This is a **bug fix that happens to deliver the
ring win**, it is bounded, and it is measurable today. It should not wait for a
design round to finish. The real work in it is designing where the west/east
seats actually go — the diagnostic's `left: 0 / right: 0` clips them (§3.6) —
plus checking that `DealOverlay` and `PlayOverlay`'s seat-rect reads still
land, since those measure the cells at runtime.

**Change B — the hand.** Zero overlap with small gaps, at a card size gated on
BOTH axes per §3.10. Zero overlap at today's 68px card is vertically free above
1280px and grows the hand's ink from 639 to 956px — take that. A bigger card is
a genuinely separate decision with a genuinely separate cost, and the honest
version of the ladder is 68px ≥1280, 80px ≥1440×900, 90px ≥1920×1080.

**Do the modes as pure `@media` blocks, and make "no mode rules outside these
blocks" the phone gate.** Grok proposed exactly this and it is the right shape
for a repo with no width-reactive JS (§3.9): a stylesheet scan that asserts
every desktop selector lives inside a known media block is a real proof of the
byte-identity property, cheap, and it is the same technique
`hand-areas-ui.test.ts` already uses on the sort-area block. Adding a
JS-visible mode would be the first width-reactive code in the client and should
be resisted until something actually needs it.

**Do not accept "token-level" as the plan for the card size.** §3.9 makes that
a nine-site edit against six pins. Either it is done properly — collapse the
nine literals to one real custom property and update the pins to check the
lockstep through that property instead of by string equality — or the desktop
card size stays at 68px. The half-measure (raise the ceiling, ship it) is the
one that passes every test while measuring nothing.

**What I would NOT do**, agreeing with both lineages: no second component tree,
no rotate-to-landscape, no `AREA_HARD_MAX` bump, no 110px card, no sticky Play.
And I would not grow the event feed into a sidebar — Grok's reason is the right
one, and this project has repeatedly found that the quiet things should stay
quiet.

**One thing nobody proposed:** at 2478×1400 the content is ~975px tall in a
1400px viewport and the whole table is top-anchored, leaving ~600px of void
below (§3.6). Vertically centring the table is probably one property and is the
single cheapest visible improvement on the owner's own screen. It is listed as
a decision rather than folded in, because "centre it" interacts with the fold
question at short heights and I have not measured that interaction.

## 6. Decisions for sign-off

1. **Split the work: ship the fold repair first, on its own.** `R1 + D3 + caps`
   fixes a shipping defect (1280×800 95.8% → 0/24; 1024×768 100% → 0/24) and
   delivers the ring win as a side effect. Recommend YES.
2. **Mode structure: three modes at 720 and 1280, plus an orthogonal
   short-height rule** (Grok's shape), rather than four width modes (Codex's).
   Height is a real second axis: 1280×800 and 1920×1080 are the same width
   class and behave differently at every card size.
3. **Zero overlap starts at 1280, not 1024.** Measured: at 1024 the hand wraps
   and 54.2% of deals fall below the fold. At ≥1280 it is vertically free and
   grows the hand's ink 639 → 956px.
4. **Card size ladder, gated on both axes**: 68px ≥1280, 80px ≥1440×900, 90px
   ≥1920×1080. Both external lineages said 90px at ≥1440; measurement says that
   is below the fold on 50% of deals. Alternative: keep 68px everywhere and take
   only the de-overlap win.
5. **The card-size token debt.** A desktop card size is a nine-site literal edit
   against six string-equality pins and one explicit prohibition
   (`seat-stack.test.tsx:940-943`). Either collapse the nine `clamp()` copies to
   one real custom property and re-express the pins through it, or decide the
   desktop card stays 68px. **The half-measure — raise the clamp ceiling — is
   green on every existing test while measuring nothing (§3.9), so it must not
   be the plan.**
6. **The event feed**: Codex would grow it into a desktop side rail; Grok would
   keep it a 2-line tail and calls a sidebar an attention and fold cost. Not
   settled by measurement. Recommend Grok's.
7. **Vertically centre the table at tall viewports.** ~600px of void sits below
   the content at 2478×1400. Cheapest visible win on the owner's own screen;
   not in any proposal; interacts with the fold at short heights (unmeasured).
8. **`AREA_HARD_MAX` stays 2.** Both lineages independently refuse to raise it
   as a width side effect, and §3.7 corrects the premise that it would rise on
   its own. Confirm.
9. **Panel integrity at the gate.** Both lineages have now designed. Whichever
   proposal is adopted, that lineage is anchored for the audit of the thing it
   designed (producer ≠ auditor). Options: audit with the non-adopted lineage
   plus in-house, or accept a disclosed half-panel and say so.

### Not decisions, but flagged

- **A possible WCAG SC 1.4.4 exposure on the PHONE, unrelated to this round.**
  The card's rank and suit glyphs are `calc(var(--gd-cardw) * 0.36)`
  (`table.css:617,623`), and below 523px `--gd-cardw` is `13vw`. Text sized from
  a viewport unit is the shape W3C catalogues as failure technique F94, because
  it does not respond to text zoom. This is **inference, not verified** — it
  needs one zoom measurement to settle, and nobody has run it. Cheap, and worth
  its own small round.
- **`guandan.app`'s alternative** — a bigger card with MORE overlap and a
  large readable sliver — was engaged with by both lineages and rejected for
  this product, on the grounds that the sliver machinery (the 配 marker, corner
  indices, ~12px silhouettes) is debt that abundance lets us drop rather than a
  target to aim at. Recorded so the road not taken is visible.
- **Carried open from earlier rounds, still open:** real-device / elder sessions
  not run; three recorded sort groups wrap on a phone; `HandFan`'s `readOnly`
  prop unused; merge unreachable at `AREA_HARD_MAX = 2`; no landscape styling.
