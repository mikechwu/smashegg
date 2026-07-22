# Fan selection without occlusion — measured variants (silent-no-op round, item 1)

**Status:** PLAN — awaiting the owner's mechanic sign-off (the round's named
gate). Item 2 (sit-then-name) ships independently.
**Date:** 2026-07-22
**Method:** not eyeballed — a Playwright harness drives a real room to a
settled 27-card hand at TRUE 390×844 (zh-Hant), then for EVERY card:
select it alone and grid-sample document.elementFromPoint over every other
card's rect to measure the actually-tappable area (px²). Full sweep = 27
selections × 27 measurements per variant (scratchpad measure-fan.mjs;
raw JSON in the round records).

## Diagnosis (measured, not assumed)

The playtest's "second-row card" is a covered PILE-STRIP row: the settled
fan renders same-value piles whose covered cards each show a ~20px top
strip. Selecting a card lifts it −14px, and the lift eats the strip of the
card DIRECTLY ABOVE it in its own pile: that victim's tappable area halves,
700px² → 350px² (a ~10px sliver). Two aggravators, honestly noted: the
elder round itself doubled the lift (−6 → −14) for legibility, amplifying
this; and the pile layout is OURS — the reference 斗地主/掼蛋 apps use flat
single-row fans where a vertical raise has no vertical neighbor, so the
genre never faces this collision (their answer, reserved lift headroom,
solves a different geometry). WCAG 2.5.8 context: a 20px strip at 20px
pitch is ALREADY below the 24px AA floor — the bar here is "make it no
worse, ideally better", not "reach ideal".

## The measured table (worst victim after any single selection)

| Variant | Worst victim | Target positions | Visual |
|---|---|---|---|
| Current (solo −14 lift) | 700 → **350** (−50%) | stable | full lift |
| C: solo −8 lift | 700 → 525 (−25%) | stable | reduced lift |
| A′: owner's gap-open* | ~−6..15% (850–2275 floors) | strips MOVE −14px between taps | full lift + real gap |
| B: ring-only, no transform | **zero loss** | stable | no lift |
| **D: hit/paint decoupled** | **zero loss** | **stable** | **full lift, unchanged** |

*A′ = the owner's shift-following idea translated to pile geometry
(single-gap form: the group above the lowest selected card rises with it,
so no strip is eaten; the pile top rises one δ). It measurably works — and
the selected card's own target GROWS (700→1050). Its cost is the one the
elder-HCI literature flags hardest: fisheye-menu research (Bederson 2000;
Hornbæk & Hertzum TOCHI 2007) shows layouts that MOVE remaining targets
degrade pointing accuracy — and a Guandan turn is a SEQUENCE of taps
(a 6-card straight = six aims), each shifting the next targets under A′.
It also needs a reserved row-gap for the rare wrapped (15-class) hand.

## Variant D — the recommendation

Production Dou Dizhu implementations decouple HIT-TESTING from PAINTING
(cocos forum, shipped clients): touches resolve against the stable
base-layout strip rects, not the lifted sprites. The DOM translation is
two lines of CSS: the lift transform moves from the card BUTTON to the
inner face (.gd-card) and the face gets pointer-events:none — so the
painted card rises exactly as today (the pull-proud look, the ivory ring,
everything), while every button's hit box stays at base layout. Measured:
**zero victims, every card's tap area byte-identical to baseline in every
selection state, zero layout motion** (reduced-motion needs nothing — the
static form IS the form).

The one trade: a lifted card's visible face sits 14px above its own hit
box, so a tap at the very top of a lifted face lands on the strip above —
an unselect near-miss can select a neighbor. Mitigations, in order: the
face is ~74px tall so center-aims still land; the DESK (D1) is the
designed unselect surface — tap the staged face there (a full-size
target), which is exactly the fan/desk cooperation this round was asked
to confirm; and the strip the overhang covers visually is the very strip
that today is UNTAPPABLE — D makes it tappable again.

## The decision (recommended default in bold)

**F1 — the mechanic: variant D (hit/paint decoupling)** — genre-
precedented, zero victims, zero moving targets, the current visual kept,
~4 lines of change; vs A′ (the owner's gap-open — measured good on area,
weighed down by the moving-targets evidence and the wrap reserve); vs B
(ring-only — equally clean on targets, loses the pull-proud lift).
F2 — if D: keep the −14 lift height as-is (**yes** — it no longer costs
anything) or reduce it.
F3 — add the harness's tap-target sweep to the repo as a scripted check
(**yes, as a scratchpad-style script recorded in docs** — the DOM-free
suite cannot run it; the visual gate runs it per fan change).

## Build shape on sign-off (D)

table.css: the --selected transform moves to `.gd-fan__card--selected
.gd-card` (+ hover equivalent) with pointer-events:none on the fan card
face; the reduced-motion override collapses the FACE transform (ring pair
stays). HandFan: untouched (no JS). Pins: CSS source pins (transform on
the face not the button; pointer-events:none present; reduced-motion
override) + the existing selection pins hold. Visual gate: re-run the
measurement sweep — the named check is "zero victims at 390px", plus the
elder re-test of second-row taps.
