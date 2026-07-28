> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## The structural check overturned both "0/12" figures — and caught an error in my own occlusion claim (2026-07-27)

### Checking against the STRUCTURAL worst case changed the answer

The owner refused a 2.4px margin on a quantity that moves in 21.3px quanta and
asked whether the sample had reached MAIN's structural maximum first. Derived:
**MAIN's max line count is 2** — 15 provable value classes (12 non-level ranks +
the level class + both jokers) over a 9-column wrap threshold at 390px. Then
re-measured in a sample that demonstrably reaches it.

n=16, inner 390×844, fold 844. Sample coverage: **MAIN lines 1–2 (max 2 of 2 —
the structural maximum IS represented)**, columns 9–13 of 15, deepest pile 6 of 8.

| | Play med | worst | margin | below fold |
|---|---|---|---|---|
| today | 925.9 | 989.7 | −145.7 | 16/16 = 100% [80.6, 100] |
| **collapsed 24px** | 812.4 | 876.2 | −32.2 | **2/16 = 12.5%** [3.5, 36.0] |
| collapsed 24px + 44px hit | 812.4 | 876.2 | −32.2 | 2/16 = 12.5% |
| collapsed 44px | 832.4 | 896.2 | −52.2 | 7/16 = 43.8% [23.1, 66.8] |
| **overlay UP** | 788.4 | 852.2 | −8.2 | **1/16 = 6.3%** [1.1, 28.3] |
| overlay UP, shortened | 804.6 | 852.2 | −8.2 | 1/16 = 6.3% |

**Both previous "0/12" figures were sample artifacts.** Collapsed-24 is 12.5%,
not 0%. The overlay is 6.3%, not 0%. Practice 14 applied to my own sampling, and
the owner's instinct to check the structural case before choosing was right.

**But the target is not 0% — it is the ACCEPTED baseline.** The phone's no-shelf
rate is 12.5% [4.3, 31.0] (n=24, post-rung-0) and the owner accepted ~8% on the
record. So:

- **collapsed 24px = 12.5%, statistically indistinguishable from having no shelf
  at all.** By that measure a shelf becomes free.
- **overlay UP = 6.3%, BETTER than the accepted no-shelf baseline.**
- collapsed 44px = 43.8% — the standing press floor really does cost the fold,
  and now with a sample that reaches the structural worst case.

### An error in my own occlusion claim, caught by a different probe

I reported that the upward overlay "covers 0/24 MAIN cards". **That was wrong.**
The coverage probe measured the shelf BAND only and never included the SEAM row,
which my own positioning formula (`bottom: calc(100% - 131px)`) places 131px
*below* the fan's top — i.e. over MAIN. The tap probe in this run shows
**121 stolen tap points across 16 deals**, roughly a third of MAIN's cards
having their top edge resolve to something other than themselves.

So the upward overlay as implemented is **not** occlusion-free for the hand; it
needs the seam placed above the band rather than offset into the fan. The
semantic finding that survives is the part measured on the band alone: the
trick-well cards stay readable, the loudness spine is untouched, and one
opponent's plate and count are fully hidden.

### The decoupled hit box is a NULL RESULT with a diagnosis

A 24px painted indicator with a 44px hit box measured **paint 24, hit 25** — the
extension did not materialise. Diagnosis: the collapse is implemented as
`max-height` + `overflow: hidden`, and that clip removes any pseudo-element
reaching outside the box. **The idea is not refuted** — it needs the hit surface
to be a SIBLING of the clipped band rather than a child of it, which is a markup
change and was not tried. Recorded so the next attempt starts from the diagnosis
rather than from the idea.

### Where this leaves the two decisions

Neither is ready to build, and both are closer to dissolving than to a judgement
call:

- **Height:** 24px matches the accepted baseline exactly (12.5% vs 12.5%). 44px
  costs 43.8%. The decoupled hit box would give both and is untested through the
  sibling route.
- **Occlusion:** the "carry the fact" strip was not reached this round, because
  the overlay's own seam placement turned out to be broken first. Fixing the
  placement comes before measuring mitigations for a cost that may shrink.
