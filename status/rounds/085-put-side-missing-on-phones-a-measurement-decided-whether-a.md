> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## "Put side" missing on phones: a measurement decided whether a feature existed (2026-07-25)

Owner report, verbatim: *"In phone version put side feature is not always shown.
Sometimes it doesn't show up in the first cycle. The feature show up in the 2nd
cycle with the same hand cards."*

Reproduced, root-caused and fixed. **This is a real product defect, shipped, and
it made the set-aside feature unreachable on every phone-sized window** — not
intermittently, but for the whole of a player's first turn on every hand, and in
landscape permanently.

### The mechanism, end to end

`areaAllowed` (GameTable.tsx) was the vertical "how many bands fit" budget:

```
fanBudgetPx = window.innerHeight - handZone.getBoundingClientRect().top - 214.5
```

Five things had to line up, and they did:

1. `getBoundingClientRect().top` is **viewport-relative**, on a page this
   component scrolls *itself* (`ScrollActionsIntoView`). The identical layout
   measured **68.8px unscrolled and 260.8px scrolled**.
2. The measurement is a **layout** effect; the scroll is a **passive** one.
   React runs every layout effect before paint and passive effects after, so the
   sample was always taken at the *pre-scroll* position.
3. Its deps were `[view?.hand, view?.handNo, view?.currentLevel, activeSeat]` —
   no scroll, resize or ResizeObserver. Only a new server view re-fires it, and
   **no server view can arrive during your own turn**, because only you can act.
4. Below `innerHeight` ≈ 765 that single sample yields allowance **1**.
5. `areaCountOf(null) === 1` — **MAIN counts as one of the allowed areas** — so
   `setAsideDestination(areas, 1)` returned `null` with no shelf made yet, and
   `PlayDesk`'s `{canSetAside && …}` rendered **nothing at all**.

So allowance 1 did not mean "one shelf". It meant *no set-aside feature*, with
no control, no statement, and nothing to press. Then the player passes, the
opponents act, each frame re-runs the effect — now at the scrolled position —
the ratchet raises it to 2, and the control appears on the next turn with a hand
that has not changed. The owner's "2nd cycle", exactly.

"cycle" means a **turn**, not a hand: `areas` and the ratchet both reset per
`${seat}:${handNo}`, so a new hand re-armed the bug rather than curing it.

### Measured

| viewport | control on the first turn |
|---|---|
| 390x844 (**this repo's reference**) | present — the bug is invisible here |
| 390x745 | present |
| 390x659 (a real phone inner height) | **absent**, then present next turn |
| 390x600 | **absent**, 8/8 deals |
| 844x340 (landscape) | **absent — and it never returns, ever** |

The threshold is `innerHeight >= 766` present / `<= 765` absent, verified to the
pixel. Every geometry constant in this feature was measured at "true 390x844",
and **844 is an inner height no phone browser produces** — Safari and Chrome
keep toolbars, so a 390x844 device reports ~664. That is the whole reason every
gate in this repo ran green while the feature was missing for every real user.

### The fix

The measurement is **deleted, not re-timed**. Re-timing it (a scroll listener, a
scroll-invariant budget) was considered and rejected on evidence: forced open at
four small viewports, the shelf the budget would have refused rendered fine.
Measured directly, after both auditors flagged that I had taken this table from
a subagent rather than running it:

| viewport | cards | zero-sized | outside fan box | fan height | Play |
|---|---|---|---|---|---|
| 390x659 | 27/27 | 0 | 0 | 294.7 → 432.2 | reachable |
| 390x400 | 27/27 | 0 | 0 | 294.7 → 389.6 | reachable |
| 844x340 | 27/27 | 0 | 0 | 226.8 → 332.3 | reachable |
| 844x280 | 27/27 | 0 | 0 | 198.3 → 360.9 | reachable |

**The refusal never once fired correctly.** A scroll-invariant budget computes a
number whose only possible output is a state that never legitimately occurs.

**Read "reachable" precisely:** Play sits *below the fold in document space* at
these heights and the page scrolls to it — as it already did with no shelf at
all (at 390x659 Play is at document 830.9 against a 659 fold before any shelf
exists). Opening a shelf moves it further down, not from visible to hidden.
**None of this is gated anywhere** — it is a manual browser measurement, the
client suite is DOM-free, and CI runs no browser.

- `setAsideDestination(areas)` is **total** — one argument, returns `AreaId`, no
  `null` branch. The arity is the guard: threading a measurement back in is
  TS2554. (The return type is *not* a guard — `tsc` accepts `number === null`
  with no diagnostic, so a leftover null-check would compile as always-true.
  That case is covered by a source pin.)
- `areaAllowance`, `ratchetAllowance`, `BAND_FLOOR_PX`, `COLUMNS_PER_LINE` and
  `RESERVED_BELOW_FAN_PX` are gone, with `areaAllowed`, its effect and
  `handZoneRef`. `AREA_HARD_MAX` is now the only cap.
- Monotonicity (owner decision 1) survives in its strongest form: **a constant
  is monotone**, so no offer can be withdrawn mid-hand by anything.
- `PlayDesk`'s `canSetAside?: boolean` becomes `setAside?: 'move' |
  'alreadyThere'` with **no falsy branch**, so "stage row up, slot empty" is
  unrepresentable. This closes a *second*, independent silent-hide: re-selecting
  cards already on the shelf made the control vanish with no statement, while
  the finder sheet said 「已放一旁」 for the identical state. The desk now says
  the same sentence — reusing `game.sf.alreadySetAside`, so no locale changed.
- `SfFinderSheet`'s `canSendToArea` prop is gone — the same null, on the second
  surface. It mattered: `game.areas.setAside` and `game.sf.send` are the *same
  string* in zh-Hant, so a desk-only fix would have left the report reproducible.

### Three green tests were deleted, and one of them was holding the bug in place

`tests/unit/client/hand-areas-ui.test.ts` asserted:

```ts
it('refuses ONLY when not even one shelf fits, which is the honest case', () => {
  expect(setAsideDestination(null, 1)).toBeNull();
});
```

Green for the life of the feature. Its title claims the refusal is an honest
edge case; it never checked whether real devices are *in* that state. They are —
it is the ordinary first turn at any `innerHeight <= 765`. **The QA ratchet was
ratifying the policy that made the bug possible.**

Precisely (Grok's correction, accepted): the test pinned the *enabling policy* —
"maxAreas 1 means no shelf at all" — not the viewport measurement, and it would
have stayed green under a correct measurement that rarely produced 1. So it did
not cause the defect; it locked in the half of it that turned a bad measurement
into a deleted feature, and it would have blocked the fix.

The other two (the `MONOTONE ALLOWANCE` block; the finder's "with nowhere to
send, the control is HIDDEN") lost their premise rather than their rule; the
load-bearing half of the latter — never a greyed control — is re-asserted on the
states that remain reachable.

### The new ratchet, and what each rung can and cannot see

- **Unit, `play-desk.test.tsx`** — the load-bearing leg: with cards staged, the
  set-aside slot is never empty, for both kinds, never `disabled`; plus a
  non-vacuity test that the two kinds are *different* renders.
- **Unit, `hand-areas-ui.test.ts`** — `setAsideDestination` is total over every
  reachable area count and never a no-op; source pins that the measurement and
  `canSendToArea` cannot return. Stated in the file: **the pins match text, not
  behaviour.**
- **Browser, new `scripts/measure-setaside.mjs`** — the only rung that can see
  the real thing. Sweeps `390x659, 390x745, 390x844, 844x340` and fails if a
  stage row is up with no affordance. **A gate pinned to 390x844 measures
  nothing about this defect** — 844 is green on the broken code, on a partial
  fix and on the real one alike. Verified discriminating: on the reverted source
  it reports `MISSING` at 659 and at 844x340 and `ok` at 844.
- `scripts/measure-fold.mjs` had a live practice-11 hole, now closed: it pressed
  `.gd-desk__setAside` through an **optional chain**, so wherever the button was
  absent the press silently no-opped and the script recorded the *no-shelf*
  layout under the "one shelf" label. It never noticed because it only ever ran
  at 844. It now asserts the element exists and takes the viewport as a knob.

### Verified

Typecheck (4 configs) ✓ · unit **1242/1242, 51 files** ✓ · lint:hooks ✓ · build ✓
· new browser gate PASS at all four viewports ✓ · fold gate PASS at 844 with the
shelf row genuinely measuring a shelf (947.1 vs 830.9) ✓ · new tests confirmed
RED on the reverted source (6 failures in hand-areas-ui, 2 in play-desk) ✓ ·
end-to-end at 390x659: button present on turn 1, and re-selecting shelved cards
yields 「已放一旁」 instead of nothing ✓

### Owner decisions this change makes, and does not hide

1. **"Budget-aware" is retired from owner decision 1.** The ratchet survives
   trivially; the geometric budget does not. Evidence says it never refused
   correctly at any reachable viewport — but retiring a decision is the owner's
   call, not an engineering one.

   Grok put the counter-case sharply and it is recorded rather than argued away:
   **there is now no client-side gate whatsoever against opening a band**, at
   any viewport, and the monotonicity guarantee holds "only because the cap is a
   constant — not because layout was shown to stay usable." That is accurate.
   The defence is the table above (measured, four viewports, nothing clipped)
   plus the fact that the gate being removed refused *everything* on real
   phones, so it was not buying safety — but the defence is a measurement at
   four sizes, not a proof for all of them, and no automated check enforces it.
2. **A shelf can now exist on turn 1 at phone heights.** Measured safe (nothing
   clips; Play stays reachable via the scroll that already carries it), but it
   changes what a first turn can look like.
3. **The desk gains a sentence** where a control used to vanish. The finder
   already shipped this exact sentence for this exact state, so it is the desk
   catching up rather than a reversal — but it is new text on the play desk.

### Not addressed

The fold is still held by scrolling, not by fitting — at 390x659 Play/Pass is
below the fold in document space with zero shelves, which is pre-existing and
recorded. `AREA_HARD_MAX = 2` still makes merge unreachable. The app has no
landscape styling at all; only the set-aside control and the shelf render were
checked there. Heights below 280 and widths other than 390/844 are untested.
