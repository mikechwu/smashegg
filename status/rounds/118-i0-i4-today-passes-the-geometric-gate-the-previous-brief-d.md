> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## I0-I4: today PASSES the geometric gate — the previous brief deleted an earned term

### 1. [I0 CONFIRMED] The purely geometric gate admits today's card

| | 50.70 (today) | 45.95 (the H0 pick) |
|---|---|---|
| marginal bin | s=8 | s=10 |
| margin | 14.24px | 15.15px |
| capacity at 390 | 9 | 10 |
| two-sided setback to a discontinuity | **0.81px** | **0.43px** |

**Today passes, and beats the recommended pick on setback.** Removing R removed the only
term that could see the reason for the work.

**The brief's diagnosis is exactly right**, and the numbers it turns on are these:

| quantity | value | status |
|---|---|---|
| R(0) at segment 2, modelled | 0.08% | unvalidated tail |
| R(0) at segment 3, modelled | 0.74% | unvalidated tail |
| R(0) at today's card, modelled | 7.65% | counterpart of a measured figure |
| the same cell, measured ascending | 9.17% | validated |
| the same cell, measured descending | 9.09% | validated (held-out) |

Discriminating the first two grants precision two orders below any validated bin — but
that argument separates CANDIDATES from each other, not today from the candidates. **H1
deleted the earned part along with the unearned part.**

**Adopted, as a bin index rather than a probability** — no threshold, no tail:

> every bin the held-out test validated must be feasible. Criterion 1 covered bins with
> expected count >= 5, up to 316.0px, which is **s=9**. So `margin(s=9, w) >= 0`, i.e.
> **w <= 49.89**.

Today's 50.70 is outside; every candidate is inside. Segment four now fails the gate and
the qualifying set is three segments, as the brief predicted.

### 2. [I1] Segment three, and two different setbacks

Verified, with one refinement: **there are two setbacks and a pick needs both** — distance
to a geometric DISCONTINUITY (where behaviour changes) and slack above the 10px FLOOR
(where you stop passing).

| cardW | vs today | margin | above the floor | to nearest discontinuity |
|---|---|---|---|---|
| 46.10 (segment 2 optimum) | -9.1% | 13.78px | 3.78px | 0.58px |
| **48.15 (segment 3)** | **-5.0%** | **15.23px** | **5.23px** | **0.55px** |
| 48.75 (segment 3, discontinuity-optimal) | -3.8% | 9.98px | **-0.02px** | 1.14px |

The brief's ~48.15 is right. Its own setback figure is the one you get once the gate's own
boundary counts as an edge — which the 48.75 row shows is the correct instinct: the
discontinuity-optimal point sits exactly ON the margin floor.

### 3. [I2 CONFIRMED — and it is decisive] 320 caps a constant card at 46.10

`272 - 0.3w >= 5.6w  =>  w <= 46.10`, verified. So for a SINGLE constant:

- **segment three (48.15) is excluded outright** — capacity 7 at width 320, i.e. three lines;
- **segment two truncates to [45.52, 46.10]**, whose optimum is 46.10 — the same value
  390's tooth structure gives. **Two independent derivations converge.**

**And 46.10 has ZERO capacity slack**, which the brief asked for and which changes the read:

| target capacity ratio at 320 | max cardW | vs today |
|---|---|---|
| 8.00 (bare minimum) | 46.10 | -9.1% |
| 8.10 | 45.56 | -10.1% |
| 8.20 | 45.03 | -11.2% |
| 8.40 (today's 44px floor) | 44.01 | -13.2% |

At 46.10 the ratio is exactly **8.00**: any drift in the measured row-chrome constant drops
it to capacity 7 and three lines. **Buying capacity slack costs card size**, so the
constant-vs-breakpoint choice is sharper than it looked:

| form | 320-360 | 375+ | card vs today |
|---|---|---|---|
| single constant, zero slack | 46.10 | 46.10 | -9.1% |
| single constant, 0.2 slack | 45.03 | 45.03 | -11.2% |
| width breakpoint | 44-46.10 | 48.15 | **-5.0%** above the breakpoint |

### 4. [I3] The closed-form rationale now carries a reconstruction

METHODOLOGY practice 33: *"no audit needed, it is closed-form" is valid only with an
independent exhaustive reconstruction.* The brief's diagnosis is exact — **verifiable by
brute force is not verified by brute force**, and H0a was a sign error in a closed-form
scan over a closed-form domain that survived until an outside reader checked it.

Implemented in `cardw-gate.mjs`: walk in hundredth-pixel steps, emit segment boundaries from where the
pass flag actually flips, assert against the closed-form ones. **Five flips, all within
0.02px of a closed-form boundary, with a non-vacuity guard.** Runs in seconds.

### 5. [I4] Grok's G3 answer, read and summarised

`docs/research/proposals/gate-composition-grok.md`. Ranking for sub-310px, elderly,
zh-Hant, family-chat audience:

1. **Detected compact mode** — keep the card size, put columns in a horizontal scroller
   with a loud cue, keep desk/well/Play-Pass in the vertical stack. Protects the
   legibility they zoomed for AND the vertical budget, and names the state.
2. Hard stop with an honest message, room code still visible.
3. Accepted third line — transitional only; usually destroys panel simultaneity.
4. **A different wrap policy — explicitly NOT the answer**: "cannot create horizontal
   capacity... do not sell it as the sub-310 answer." That directly constrains C2.
5. Internal vertical scroll — worst for elders.

And on H2: **"detector-only is necessary but not sufficient."** Not acted on; recorded.

### 6. Open

- The constant-vs-breakpoint choice (item 3) is the owner's, and it sets whether the elder
  session is asked about a 5% or a 9-11% reduction.
- **G2**: sweep 360/375/430 the same way. **E5** — after I2, not before.
- **F5b** at the other two cells. **D5**, **D7**, **C2 parked** (and now constrained by I4).
