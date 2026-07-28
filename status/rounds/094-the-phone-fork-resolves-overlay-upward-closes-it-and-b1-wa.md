> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## The phone fork resolves: overlay UPWARD closes it, and B1 was never 2.4px away (2026-07-27)

### The numbers at the fork — one sample, n=12, inner 390×844, fold 844

| | Play med | Play worst | below fold | MAIN cards covered | covers |
|---|---|---|---|---|---|
| no shelf at all | 809.6 | 830.9 | 0/12 = 0.0% | — | — |
| **today** | 947.1 | 968.4 | **12/12 = 100%** [75.8, 100] | 0/24 | — |
| A + B1 + no reserve | 853.6 | 874.9 | **6/12 = 50.0%** [25.4, 74.6] | 0/24 | — |
| overlay DOWN | 809.6 | 830.9 | **0/12 = 0.0%** [0, 24.2] | **20/24** | — |
| **overlay UP** | **809.6** | **830.9** | **0/12 = 0.0%** [0, 24.2] | **0/24** | well 28.5px, ring 79.5px, headline 0 |

**The upward placement was the right question to ask.** Placed above the hand the
overlay closes the gap completely — Play lands at 809.6, identical to having no
shelf at all, so on the phone a shelf becomes free — and it covers **none of
MAIN**. What it covers is the table: 79.5px of the ring and 28.5px of the trick
well. The headline is untouched, so the loudness spine (whose turn, the clock)
survives. Containment clean, 0 cards outside `.gd-table`.

**Recommendation: B2-upward. Option C is not needed.**

### B1 was never 2.4px away — and the reason is worth more than the result

The B1 ceiling measured **exactly 50.0px**, which the decomposition predicted
(44px seam row + 6px margin). That is the decomposition retrodicting a second
time. But the additive path does not close the gap:

- A (faces) 29.5 + B1 (seam row) 50.0 + the shelf band's 14px lift reserve =
  **93.5px recovered**, against a **103.1px median deficit and a 124.4px worst
  case** in the same sample. It leaves **50% of deals below the fold**.
- **The "2.4px short" figure came from comparing a median in one 12-deal sample
  against a threshold.** The fan's height moves in 21.3px quanta and the
  per-sample median moves by a whole quantum: 925.9 in one sample, 947.1 in the
  next. Measured within a single sample, the shortfall was never small.

That is practice 16's shape (wrong statistic for the property) crossed with
practice 12's (a sample is not a property), and it is now practice 22.

**The seam row is not free to delete, either.** `HandFan.tsx:493-501` records
that it sits below its shelf and *above the next band's lift headroom* precisely
so variant D's near-miss resolves onto inert padding rather than onto a
destructive button. So the 50px is a CEILING for any design that folds the
control into an existing surface — not a proposal, and any such design has to
re-answer the near-miss question.

### Two more practices, both paid for by the cap work

- **21 — when a `min()` does not appear to bind, look UP the parent chain.**
  74rem → 78rem was a **no-op below inner 1350px**: the element's width was set
  by `96vw − 32 − 16 = 1180.8` from two ancestors' padding, so neither term of
  its own `min()` was ever reached. State the range a cap binds over, not just
  its value.
- **22 — a median is not a near-miss detector when the quantity is a step
  function.** Report the rate in a single sample plus the worst case; figures
  from different samples are not comparable at all.

### Corrections to the cap record, as asked

- "The cap was raised to clear the bound" now reads **"clears it above inner
  1350px"**. Below that the parent chain binds and the raise changed nothing.
- The 1280 wrap rate is **0/48 with an upper bound of 7.4%**, and **when it
  fires the benefit is lost entirely** — the fallback yields banded, which is
  100% below fold at 1280×800. It preserves correctness, not the feature.
- Worth naming: "reclaiming `.app-main`'s padding would leave `.gd-table` and
  fail containment" means the containment gate is now **steering a design
  decision**, not only catching a defect.

### If C is ever revisited

Not needed given B2-upward, but recorded so it is not re-derived: the check
would be whether opening a shelf scrolls the SHELF off the top while bringing
Play into view — a shelf you opened to organise your hand and then cannot see
would be absurd — plus iOS Safari's dynamic toolbar making viewport height
unstable, and whether the elder perceives that the view moved.
