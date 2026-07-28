> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## STOP: the phone fold was measured at a viewport no phone has — the calibration is void (2026-07-27)

### The blocking question, answered from our own record

**844 is a SCREEN size, not a viewport.** And this project already knew:
`measure-fold.mjs:56-60` has said since 2026-07-25 that *"844 is an inner height
no phone browser produces — Safari and Chrome keep toolbars, so a 390x844 device
reports ~664. Every geometry claim this repo made was therefore measured at a
size no user has."* METHODOLOGY practice 15 records it as one of its two
instances.

**The knob was added. The default was never changed.** `FOLD_H ?? 844`, eleven
lines below that comment. So every phone baseline, threshold and derivation since
— the accepted ~12.5%, the pooled 8.3%, the 307.8 threshold, the cap and spread
work of the last two rounds — was measured at a viewport nobody has.

### What a real phone height does to the numbers

Constructed depths 3→8, lacquer, no shelf:

| inner height | fold admits fanH ≤ | depths that fit |
|---|---|---|
| **844** (fictional) | 307.8 | 3–6 |
| **748** (iOS, toolbar minimized) | 211.8 | **none** |
| **664** (iOS, normal toolbars) | 127.8 | **none** |

**At a real phone height Play/Pass is below the fold at EVERY pile depth,
including the shallowest.**

> **CORRECTED 2026-07-27 (W5c).** This said "the smallest fan the layout can
> produce is 252.1px", which was a SAMPLED minimum phrased as a structural one —
> in the round whose whole theme was "derived, not sampled". 252.1px is
> `d1+d2 = 6`. The true structural minimum is **209.5px** (`d1+d2 = 4`), reachable
> with 12 pairs plus 3 singles = 27 cards over 15 classes; `d1+d2 = 3` is
> impossible because 9 columns x depth 2 plus 6 singletons is only 24 cards. The
> conclusion is unchanged — 664 admits 127.8 and 209.5 still exceeds it, by
> **81.7px** rather than 124.3px — so this is a wording correction, not a reversal.

**So the phone's "accepted ~8% below-fold baseline" is an artifact.** The real
rate is 100%, and it always has been. What makes the product usable is
`ScrollActionsIntoView` doing the scroll on every turn — the compensator this
project already named (practice 11), doing its job so well that the layout's
never-fitting was invisible for the whole arc.

### Everything calibrated to 844 is void

- The **307.8 threshold** → at 664 it is 127.8.
- **Cap 0.46 + spread 1.84–1.88**, which "removes the baseline entirely", produces
  fanH ≈ 305 at every depth — **short by 177px at 664**. It does not come close.
- The **canonical pooled baseline (8.3%, n=48)** describes the fictional viewport.
- The **G-FOLD rule** as restated ("must not raise the rate above the measured
  baseline") is now anchored to a baseline that means nothing on a phone.

**The cap and spread work is not wrong — it is answering a question about a
viewport that does not exist.** Stopping before implementing was right, and the
owner's instinct to ask first is what saved it.

### What this does NOT invalidate

- The **theme defect** stands: at any height, cinnabar-court adds ~86px of fan,
  and the relative comparison is height-independent.
- The **536.2px offset** stands — swept across twelve configurations, and it is
  what makes the recalculation above possible at all.
- The **desktop numbers** stand: those viewports were measured as INNER heights
  deliberately, after practice 15 was written.
- The **fanH-linear-in-depth** relationship stands.

### Structural response

The gate now prints a loud warning when it defaults to 844 without an explicit
`FOLD_H`, naming the real heights and stating that the rate there is 100%. The
default is left at 844 **only** so the historical baselines stay comparable until
the owner re-decides the reference — changing it silently would make every
recorded figure incomparable without saying so.

**What the owner has to decide, and it is bigger than the cap:** whether "Play
above the fold without auto-scroll" is achievable on a real phone at all. It is
short by 124px at the shallowest hand, against a ring that rung 0 showed can be
re-sited on desktop but which the phone has no horizontal room for. The honest
alternatives look like: accept auto-scroll as the phone's designed behaviour and
retire the phone fold metric; or restructure the phone layout the way rung 0
restructured the desktop one.

### Nothing was implemented, again — and that was correct here

The cap, derivation, spread, analytic gate and elder session all remain queued,
and the last two rounds of cap/spread calibration now need redoing against a real
height first. The implementation debt is real and acknowledged; this particular
round is the case where stopping was the right call rather than an avoidance of
it.
