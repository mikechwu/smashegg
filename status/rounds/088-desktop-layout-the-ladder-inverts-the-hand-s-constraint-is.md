> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Desktop layout: the ladder inverts — the hand's constraint is VERTICAL (2026-07-27)

Owner's steer: **clarity is the goal; zero overlap was one possibility, never the
target.** Asked properly — where does clarity stop improving? — the answer
inverts the ladder every lineage proposed, mine included. All four spent WIDTH.

**Where clarity stops improving with pitch, structurally (practice 14, not
sampled).** The index ink needs **0.554w** to be fully exposed; a covered
column's 44px press target needs **0.647w**. Today's pitch is **0.70** — set by
the tap floor, and already over-serving the index by 27%. Everything above ~0.65
buys visibility of the card BODY, which is redundant with the suit glyph the
index already carries. **Pitch 1.00 is where overlap stops existing, not where
clarity stops improving. Recommend dropping the pitch ladder entirely.**

**The index-ratio lever is NOT independently free.** Measured on a card covered
on both axes: the ink is 32.25px wide, right edge 37.64px, bottom **29.48px**
against an exposed strip of **28.56px**. Two corrections: the ink occupies 79%
of the sliver, not "about half" (the estimate compared font-size to sliver; the
ink is rank and suit side by side), so the width headroom is +17%, not ~100%;
and **the height axis is already saturated — today's shipped layout already
clips every covered card's index by ~1px.** The lever is gated by the pile
strip, which is the same 28.6px that fails the 44px press floor. **One
constraint, two symptoms.**

**The 配 caution resolves favourably.** The active wild mark is not the
bottom-left seal — it is `gd-wild--gold` recolouring `.gd-suit`, and `SuitMark`
always carries `.gd-suit`, so the marker IS the index's own suit glyph. A bigger
index makes it bigger. The source records why the seal was abandoned: it "was
hidden under the next card" — the same strip constraint, met once before.

**What the strip costs, n=24, on top of the fold fix.** Unclipping the index
(stripW 0.42→0.50) is free: +16.3px, still 0/24 below fold everywhere. The 44px
press floor (→0.647) costs 8.3% [2.3, 25.8] at 1280×800 and **nothing at
≥1440**. Three prices: it needs the **first width-reactive JavaScript in this
client** (the strip is a theme metric emitted as an inline per-card margin, so a
media query cannot re-express it); **if it leaks to the phone the fold goes
12.5% → 79.2%** [59.5, 90.8], measured deliberately rather than feared; and deep
piles cannot reach the floor at all — `min(stripW, 2.95/(n−1))` covers depth ≤5,
and depth ≥6 occurs on 3.9% of deals (bound is 8, provable).

**A reporting self-catch.** The n=24 strip table reads `44` because it reports
the MEDIAN, and with P(depth≥6) = 3.9% only ~1 deal in 24 has one — the median
hid exactly the tail that matters. Practice 12 inside my own summary line, the
same round it was written. The 96%/4% split is from the formula and the computed
distribution, not that column.

**The other clarity surfaces, priced first as instructed — and the fold fix pays
for them.** The widest legal play is a 10-card bomb (`combos.ts:468-474`), which
at −0.6 overlap is **312.8px** of ink (a bound, not a sample). The ring's centre
track is **250.3px at every viewport today**, so the well has never been able to
hold the widest legal play. Under the fix it is 495.8 / 561.6 / 675.4. **The well
was never competing with the fan for width — it was losing to the ring's own
38rem cap.**

**The revised ladder.** Rung 0 (the fix: fold 95.8%→0/24, opponents 608→1181-1624px
apart, well 250→496-675) is a defect fix, CSS-only, phone measured unchanged, and
should ship alone. Rungs 1-2 (unclip the index; reach the press floor) are one
change with a real structural price and should be decided together. Rung 3 (pitch)
should not be built. **Full ladder in `docs/research/desktop-layout.md` §7 —
brought back before building, per the owner's instruction, because the top rung
moved.**
