<!-- GENERATED from status/model.json by scripts/gen-model.mjs. DO NOT EDIT.
     Regenerate: node scripts/gen-model.mjs -->
# MODEL (generated)

> **Answers:** what the layout model IS — every constant, formula and decomposition, in one place. **Evidence** (measured or modelled, n, configuration, validity range): `status/VALIDATED.md`. **Decisions and open items:** `status/CURRENT.md`. **Machine source:** `status/model.json`.

This file is a projection of `model.json` and is regenerated, never edited. A figure here is the value the code actually contains: every `source` below names a file and a literal, and `tests/unit/client/model-drift.test.ts` fails if that literal is no longer there. **It does not tell you whether the value is trustworthy** — that is VALIDATED's job, and a value can be present in the code and still be a model tail, a sampled bound, or a constant measured in one pinned configuration.

## Reference cell

Inner **390 x 664**. The cell every span figure in this model is stated at: inner 390x664, lacquer, zh-Hant, timed room (the product default), one card staged, no shelf, ascending sort. A figure quoted without this cell is a figure quoted without its configuration.

## Constants

| id | value | what | source |
|---|---|---|---|
| `cardW` | 46.51 px | The hand card box width below the 720px layout breakpoint. A constant, in a unit the user cannot scale. | `src/client/app.css` — `--gd-handcardw: 46.51px` |
| `glyphCap` | 56 px | Ceiling on the card ink basis --gd-glyphw. Above it the corner index and the body pip collide. Measured at the 48.15px box as a first escape at 62px and carried to this box at the same ratio, then re-measured. | `src/client/app.css` — `min(2.906875rem, 56px)` |
| `aspect` | 1.45 ratio | Card height as a multiple of card width. | `src/client/table/table.css` — `calc(var(--gd-cardw) * 1.45)` |
| `stripW` | 0.42 fraction of cardW | Visible top-edge fraction of each non-base card in a stack — the lattice step is stripW x cardW. | `src/client/table/themes/lacquer.tsx` — `stackStripW: 0.42` |
| `fanChrome` | 13.9 px | The fan's own padding. Not card-scaled. | `scripts/cardw-gate.mjs` — `CHROME = 13.9` |
| `fanRowGap` | 6 px | Row gap between the fan's two visual lines. | `scripts/cardw-gate.mjs` — `GAP = 6.0` |
| `rowChrome` | 48 px | Horizontal chrome around a fan line: contentW = W - rowChrome - 0.3*cardW. | `scripts/cardw-gate.mjs` — `ROW_CHROME = 48.0` |
| `deskMinusCard` | 83 px | Desk height less the one card height it contains: deskH = deskMinusCard + aspect*cardW. | `scripts/cardw-gate.mjs` — `DESK_MINUS_CARD = 83.0` |
| `kMinusCard` | 125.1 px | Everything in the span that is neither fan nor desk, less the one card height inside the trick well: K_well = kMinusCard + aspect*cardW. | `scripts/cardw-gate.mjs` — `K_MINUS_CARD = 125.1` |
| `kLead` | 66 px | K when the viewer LEADS and the trick well is empty. Carries no card term — the card in K_well is inside the well. | `scripts/fan-height-distribution.mjs` — `K_LEAD = 66.0` |
| `maxValueClasses` | 15 count | 12 non-level natural ranks + the level class + small joker + big joker. A class present in the hand is exactly one fan column. | `scripts/cardw-gate.mjs` — `MAX_CLASSES = 15` |
| `capacityFloor` | 8 columns | Per-line capacity needed to fit 15 value classes in TWO lines. | `scripts/containment.mjs` — `capacity < 8` |
| `layoutBreakpoint` | 720 px | The phone/desktop layout seam. The card constant governs below it; above it the card is in rem again. | `src/client/table/table.css` — `@media (min-width: 720px)` |
| `floorCardW` | 44 px | The hand card box below the crossover, where the constant cannot fit 8 columns a line. Exactly what today's clamp yields at 320 through its rem floor. | `src/client/app.css` — `--gd-handcardw: 44px` |
| `floorBelowWidth` | 332 px | Viewport width at and below which the narrow floor applies. The last integer below the 332.1px crossover. | `src/client/app.css` — `@media (max-width: 332px)` |
| `depthFloor` | 10 bin index | The minimum fan depth that must remain feasible. A PRODUCT POLICY, not a validation result: the held-out test earns 9, and requiring 10 is a stricter claim the owner makes about which depths are in scope. | `scripts/cardw-gate.mjs` — `DEPTH_FLOOR ?? 10` |
| `minGuaranteedWidth` | 360 px | Smallest viewport width the card constant is guaranteed at. Below the crossover the layout has no supported card size. | `scripts/cardw-gate.mjs` — `MIN_GUARANTEED_W ?? 360` |

## Decompositions

| id | parts | sum | stated total | residual |
|---|---|---|---|---|
| `deskMinusCard` | titleRow 27 + bar 4 + status 24 + gaps 12 + padding 14 + border 2 | 83 | 83 | **0** |
| `kMinusCard` | wellToFanBand 59 + fanToDesk 10 + deskToBar 15 + barHeight 41 | 125 | 125.1 | **0.1** |

- `deskMinusCard`: bar = 4 is TIMED-ONLY; removing it and its gap gives the untimed 148.5px desk at the old card.
- `kMinusCard`: The parts sum to 125.0 against a total of 125.1, a residual of 0.1px. The round that recorded this decomposition called it exact; it is not, and the discrepancy was found by putting the parts and the total in one machine-checked place. 0.1px does not move any decision in this model — it is 0.02% of the span — but 'residual 0px' is a stronger claim than the numbers support.

## Formulas

### `capacity`

```
capacity(W, w) = floor((W - rowChrome - 0.3*w) / (0.7*w))
```

Columns that fit on one fan line at viewport width W and card width w. Monotonically non-decreasing in W at fixed w.

### `capacityCeiling`

```
maxCardW(W) = (W - rowChrome) / (0.7*capacityFloor + 0.3) = (W - 48.0) / 5.9
```

Largest card width that still clears the two-line capacity floor at width W.

### `crossover`

```
minWidth(w) = rowChrome + 5.9*w
```

Smallest viewport width at which card width w still clears the capacity floor. At the shipped 48.15px this is 332.1 CSS px.

### `lineHeight`

```
lineH(d, w) = aspect*w + stripW*w*(d - 1)
```

Height of one fan line whose deepest column holds d cards.

### `fanHeight`

```
fanH(s, w) = fanChrome + fanRowGap + 2*aspect*w + stripW*w*(s - 2)
```

Two-line fan height, where s = d1 + d2 is the total depth over both lines. Depends on the hand only through s.

### `threshold`

```
T(w) = innerH - (deskMinusCard + aspect*w) - (kMinusCard + aspect*w) = 455.9 - 2.90*w
```

The tallest fan that still fits at the reference inner height, following state. Both the desk and K carry one card height each, which is why the coefficient is twice the aspect.

### `margin`

```
margin(s, w) = T(w) - fanH(s, w) = 436.0 - (4*aspect + stripW*(s - 2))*w
```

Slack for a hand of total depth s at card width w. Width-independent: the viewport's width enters the gate only through capacity.

### `marginalBinBand`

```
marginal bin >= K  <=>  margin(K, w) >= 0  <=>  w <= 436.0 / (4*aspect + stripW*(K - 2))
```

The marginal bin is a step function of the CARD ALONE — the viewport width does not appear. Bands at the reference height: bin 11 for w <= 45.52, bin 10 for w <= 47.60, bin 9 for w <= 49.89, bin 8 for w <= 52.41. This is the gate's vertical term, and it replaced a floor on the marginal bin's own slack, which was anti-correlated with the failure rate across a band edge.

### `toothBoundary`

```
w_s = 436.0 / (4*aspect + stripW*(s - 2))
```

Card width at which depth-s hands stop fitting. These roots make the qualifying set of card widths DISJOINT, which is why no clamp coefficient passes at every supported width.

## Where two sources disagree

- **`aspect`** — model 1.45, scripts 1.4497041420118344. The gate scripts use 73.5/50.7 = 1.44970, which is the MEASURED height at the old card divided by that card. The two differ by 0.0003, i.e. 0.03px of span at a 48.15px card, because 73.5 is itself a rounded reading of 50.7 x 1.45 = 73.515. The CSS value is authoritative; the scripts have not been changed to it this round because doing so would move every recorded gate figure by a fraction of a pixel for no gain.

## What ships

- **cardWidthRule**: --gd-handcardw: 44px at and below 332px; 46.51px to 719px; clamp(2.75rem, 13vw, 4.25rem) at and above 720px
- **glyphRule**: --gd-handglyphw: min(2.75rem, 53px) at and below 332px; min(2.906875rem, 56px) to 719px; the card width at and above 720px
- **supportedWidths**: 360, 375, 390, 430
- **unsupportedBelow**: 320
