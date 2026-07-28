> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Deploy record (2026-07-24) — 94d1440 verified live (health build == pushed HEAD)

Owner word: "ready to deploy", after the panel round closed both HIGHs.

Three commits: the sort-areas partition model + UI (722108a), the finder's
send-to-area and shelf grouping (3a5b8f6), and the fold gate + METHODOLOGY
practice 11 (94d1440).

Gate: typecheck (4 tsconfigs) + unit **1228/1228 (51 files)** + lint:hooks +
build + the fan tap-target sweep (baseline 700/1000/3750 UNCHANGED, seam and
group bar 0 stolen points, zero victims) + `scripts/measure-fold.mjs` (base
layout passes). Outgoing sweep clean.

**Desktop verification CLOSED this round** (the gap named last round): at
1280x900, zh-Hant, a two-group shelf renders `runs=2 lines=1` in a 704px
container — cards 68px at the clamp ceiling, pitch 27.2, group bars 176.8x46 and
149.6x46 — no wrap, no sideways scroll, every control >= 44px. So the grouping
design is ONE design that works at both viewports, which was the stated
preference.

`npm run deploy` -> Version 6c03a421-2d1d-4712-9a63-4e39e29211cf; `/api/health`
build == 94d1440b… == pushed HEAD. First poll round caught ONE stale edge still
serving b1ed999 (propagation, not a bad deploy); re-polled to **16/16 consecutive
matches** — full edge convergence. Site 200.

CARRIED OPEN, deployed knowingly (none of these is a correctness defect):
  • **The real-device and elder sessions have NOT run.** This is the feature's
    first contact with elders and the sessions are still the real gate: can they
    see which cards form which flush without explanation; do they PERCEIVE the
    auto-scroll or does Play appear from nowhere; is the 44px group bar reachable
    given the vertical near-miss above it; does send-to-area read as organizing
    rather than playing; is the chip pager understood. iOS Safari's dynamic
    toolbar also cannot be closed by the iframe.
  • **Three recorded groups in one shelf wrap** (407.4px vs a 342px box),
    reachable via a crosshatch hand. Stated null result; the fix (cap groups per
    shelf, or a stacked layout) is an owner call.
  • **`ScrollActionsIntoView` re-fired mid-turn in 1 of 6 measured deals**
    (scrollY 7 -> 54, Play moving ~47px). 5/6 settle once and hold. The one-word
    fix — keying the effect to `loud` alone — alters shipped scroll behaviour on
    the DEFAULT path, so it was not taken unilaterally.
  • `HandFan`'s `readOnly` prop is now unused (the finder's remainder fan was its
    only consumer); kept rather than deleted, and flagged.
