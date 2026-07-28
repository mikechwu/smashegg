> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## CI red diagnosed: a 1-in-100 flake that was a real logic error (2026-07-25)

CI failed `tests/e2e/reconnection.e2e.test.ts` — "lobby-era lastSeenSeq forces
snapshot-only resync":

```
AssertionError: expected undefined to be defined
  const hint = hints.find((h) => h.value !== secret);
  expect(hint).toBeDefined();                      // reconnection.e2e.test.ts:272
```

**Not a product defect, and NOT this round's work.** The reconnection path, the
resync branch selection, the room and the engine all behaved correctly. The
defect was in the test's own choice of a "wrong" guess, and `git blame` puts it
at bd505e6 (2026-07-14, M4) — untouched since, so it has been latent across
every deploy of the sort-areas arc and simply had not come up yet.

**Mechanism, established by exhaustive replay rather than by reasoning.** The
harness picked `wrongGuess = secret === 1 ? 2 : 1`. That is always a wrong
guess, which is all it was written to guarantee — but at `secret === 1` the
guess of 2 draws a `'lower'` verdict, and the engine narrows
`hi = min(hi, value - 1) = 1`. The consistent range collapses to `lo === hi === 1`
and `legalActions` (`{midpoint(lo,hi), lo, hi}`) degenerates to the single hint
`{1}` — **which IS the secret**. The test, whose whole point is to act purely
from the snapshot's hints, then has nothing safe to play. Replaying the exact
action sequence for all 100 secrets: **exactly one secret breaks it**, and
rooms draw their secret from server-side random bytes
(`seed = code + random hex`), so it is ~1% of runs.

That rate is the actual hazard. A test that fails 1% of the time reads as
infrastructure noise, and "flaky, re-run it" would have buried a deterministic,
fully diagnosable logic error indefinitely.

**Fix — one shared rule, with the second half of the guarantee made explicit.**
`wrongGuessFor(secret, rangeMax)` now lives in `tests/e2e/helpers.ts` and
guarantees *both* that the guess is wrong *and* that the range stays OPEN:

```
secret >= 3  ->  guess 1        : 'higher', leaving lo = 2, hi = rangeMax
secret <= 2  ->  guess rangeMax : 'lower',  leaving lo = 1, hi = rangeMax - 1
```

Either way `lo < hi`, so the hint set holds at least two distinct values and
therefore at least one that is not the secret; and repeating the guess
re-derives the same bounds, so it is safe from several seats and across several
turns. `rangeMax` is typed as `GNConfig['rangeMax']` (the 100|1000 union) rather
than `number`, because at `rangeMax = 2` the second arm would return the secret
— the precondition is in the type instead of in a comment. The same
`secret === 1 ? 2 : 1` rule was copy-pasted into **three** e2e files
(reconnection, version, room); all three now call the shared helper. Only
reconnection asserted on the hints, so only it could fail, but the other two
were one assertion away from the same trap.

**QA ratchet — pinned by a cheaper rung, per the standing rule.** The e2e cannot
pin this itself: it sees one random secret per run. The invariant is proven in
`tests/unit/engine/guess-number.test.ts` by exhaustive engine replay over
**every** secret at **both** `rangeMax` sizes — **1,100 distinct
(secret, rangeMax) pairs**, run twice each because the suite also varies
`suddenDeath` (2,200 iterations, but that flag provably cannot matter here: it
is consulted only on a CORRECT guess, and these guesses are never correct) —
asserting the
guess is accepted, never correct, leaves `lo < hi`, and leaves a playable
non-secret hint. Two guards on the regression itself:
  • **Non-vacuity** — it asserts the *superseded* rule DID collapse at secret 1,
    so it provably tells the two rules apart. Verified by reverting the helper:
    the regression goes red and names secret 1.
  • **Reachability** — a real seed is searched for that makes `init` draw
    secret 1, so the failing draw is demonstrated, not hypothesised.

**A note against myself:** the first version of that regression looped over
`SUDDEN_DEATH` and `BEST_OF_3` and claimed to cover "both config sizes" — but
both are `rangeMax: 100`, so the axis that mattered was constant while the axis
that could not matter varied. That is practice 11's markerSeat instance exactly,
committed while fixing a sibling of it. The configs are now spelled out.

Gate: typecheck (4 tsconfigs) + unit **1237/1237 (51 files)** + lint:hooks +
e2e **44/44 (10 files)**. The e2e green is reported with its limit stated: it
drew random secrets, so it is ~99% certain never to have exercised the branch
that failed. The proof of the fix is the exhaustive unit replay, not that run.
The new `secret <= 2 -> guess rangeMax` branch WAS separately verified over the
wire by temporarily forcing it (12/12 across the three affected files) — a
`rangeMax` guess is accepted by the server and keeps the range open in a real
room.
