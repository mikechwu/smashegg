> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## P0-P2: a stale crossover, a wider sweep than expected, and the uncovered axis

**Routing.** None, and none needed: all three P0 items are closed-form or documentation. Practice 33's substitute is that each is checked by arithmetic over its whole domain rather than at a point.

### 1. [P0a CONFIRMED] The crossover was derived from a card that stopped shipping

| card | `minWidth(w) = 48.0 + 5.9w` |
|---|---|
| 48.15 (what J0 shipped) | 332.1 — **what the doc said** |
| 46.51 (shipped since L0) | **322.4** |
| 44.00 (the narrow floor) | 307.6 |

The figure was correct when written and went stale when the card moved, which is exactly the argument M2 used to make `stripCeilingFor` derived. So the crossover is now derived at the shipped card, and `floorBelowWidth` records both the shipped boundary and the derived one.

**The boundary stays at 332, conservative by choice**, per the brief's reasoning: widths 323-332 get the 44px floor although 46.51 would still clear 8 columns there, which costs a slightly smaller card on a ten-pixel band and touches no CSS on the eve of a deploy. A smaller card has more vertical margin, not less, so the effect is harmless — but `CURRENT.md`'s stated reason was false across that range and is corrected.

**`unsupportedBelow: 320` is a policy, not a derivation** — the 44px floor clears 8 columns down to 307.6. It is now labelled the way `depthFloor` is, so a later reader does not take it for a computed result.

A test pins the CSS media-query literal against the recorded boundary and against the derived crossover, so this cannot go stale a second time.

### 2. [P0b] The sweep, and the answer the brief expected — but a wider surface than it assumed

**The expected answer holds: no recorded figure is affected.** Every measured figure in `VALIDATED.md` was produced before M2 unregistered the theme, and every run requested a theme that was registered at the time, so the readback was correct. The exposure is entirely forward-looking. No browser gate has run since M2.

**The surface is larger than the two scripts N3 named.** Enumerating scripts that write `pref:deckTheme`: eleven do. **Six** verified by reading back what they had just written — the weak check — and **five** verified nothing at all.

Rather than add a rendered check to eleven scripts on a deploy eve, the other half of the conjunction is removed. The failure needs a script to *request an unregistered id*; a test now enumerates theme defaults across `scripts/` and fails if any names a theme that is not registered. If no script can name one, the silent fallback cannot be reached.

Two live instances found and fixed:

- `intervene-theme.mjs` still defaulted `IC_TO` to the withdrawn theme. It switches through the **picker** and asserts the select took the value, so it would have failed loudly rather than measured lacquer twice — but a script whose out-of-the-box invocation cannot work is a trap, and the default is now required rather than guessed.
- `axes.mjs` still described the theme as one that "ships and is one tap from the header picker". False since M2.

### 3. [P0c] The one pinned dimension with nothing behind it

The reference cell pins nine dimensions. Eight had somewhere to land — sort order was held-out tested at descending, staged count verified saturating, locale has the desk-title rows, timing has the `bar = 4` note, theme has its own rows and the not-validated entry.

**`no shelf` had neither.** The set-aside shelf is a shipped, user-facing feature with its own strings. Containment measures both states, no shelf and one shelf, at every covered viewport; **the span model measures only one**, and nothing said so. It is now the not-validated list's newest entry, named as the pinned dimension with the least behind it.

And the mechanism, which is this file's own stated purpose applied to the cell instead of to the rows: the reference cell is now structured, each dimension carrying a coverage phrase, and a test asserts every one appears in `VALIDATED.md`. Mutant-verified with a fictitious pinned dimension.

### 4. [P1] Pre-flight

| check | result |
|---|---|
| full suite | 1334 passed, 60 files |
| typecheck, four projects | clean |
| `gen-model.mjs --check` | `MODEL.md` matches `model.json` |
| containment, 320/332/333/360/375/390/430 | PASS, 28 probes, desk title clean at 28 titles |
| the card-frame case | its non-vacuity guard **fired first** — zero jokers staged in the seven-width run, so it proved nothing; re-run at four deals staged 8 and was clean |
| theme fallback, **built bundle** | stored `cinnabar-court` -> picker offers `lacquer` only, selected `lacquer` |
| glyph rules, both regimes, root 12/16/24 | box constant per regime (44px and 46.51px), ink grows and caps, **no escapes** |
| diff scope | `status/`, `scripts/`, `tests/` only — no `src/` change this round |

The card-frame guard firing is worth recording as a small vindication of its own design: a seven-width run at two deals happened to stage no joker, and the check said so rather than reporting a clean pass.

### 5. [P2] Deployed

The shipping change is CSS constants plus one unregistration, both already committed in rounds L0 and M2: client-local, no protocol, no room state.

**What players may notice:** anyone whose stored preference is the withdrawn theme silently gets lacquer. The fallback is verified against the built bundle not to break, but their deck changes with no explanation, so it is worth saying before it is noticed rather than after.

**Rollback:** restore the previous `--gd-handcardw` / `--gd-handglyphw` declarations and uncomment the theme registration. Note that reverting the card restores a 66.93% modelled failure at inner 430 (lacquer), so a rollback should be for a defect the new card introduced — a complaint about card size is a tuning conversation, not a revert.

**What to watch, and it is people, because there is no telemetry by decision.** Two questions worth asking rather than waiting for: does the card read as easily as before on the phones actually in use (about 8% narrower at inner 390 and about 17% at 430), and did anyone notice their deck changed. Anything else is noise until reported twice. If a report arrives, the first question is which width and which phone — the one field that has decided nearly every finding in this arc.

### 6. Open

Nothing. The arc is closed.
