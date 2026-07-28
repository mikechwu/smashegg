> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## J0-J3: the card constant ships, and 430 turns out to be the cell that mattered

**Routing.** J1's document-architecture question went to **Grok** (`docs/research/proposals/status-structure-{brief,grok}.md`) — it is a judgement about what a reader loads and where a seam falls, not a mechanical question, and this repo's own reading behaviour was the evidence. J0's arithmetic got **no external lineage**, with practice 33's substitute: an independent exhaustive reconstruction of the capacity-ceiling curve, agreeing with the closed form at five widths and rejecting a deliberately wrong divisor. J0b and J0c are measurements, audited by the intervention's own control arm rather than by a second opinion.

### 1. [J0 CONFIRMED] The four capacity ceilings, and why one width decides them

| width | max cardW at capacity >= 8 | ratio at 48.15 | capacity | slack (columns) |
|---|---|---|---|---|
| 320 | 46.10 | 7.64 | 7 | -0.36 |
| 360 | 52.88 | 8.83 | 8 | 0.83 |
| 375 | 55.42 | 9.27 | 9 | 1.27 |
| 390 | 57.97 | 9.72 | 9 | 1.72 |
| 430 | 64.75 | 10.91 | 10 | 2.91 |

All four brief figures verified exactly. Crossover `48.0 + 5.9 x 48.15 = 332.1` CSS px.

**And "the gate at every supported width" reduces to one check**, which is worth stating because a per-width sweep hides it. `margin(s, w)` does not depend on W at all — the threshold and the fan height are both vertical, and W enters only through capacity, which enters the marginal bin only via `maxS = 27 - (min(15, 2*cap) - 2)`, equal to 14 for **every** cap >= 8. And capacity is monotonically non-decreasing in W at fixed w. So the smallest supported width binds, and checking 360 checks everything above it.

### 2. [J0a] R at the shipped configuration, and the factorial that separates the two causes

| cardW | width | capacity | R(0) modelled |
|---|---|---|---|
| 50.70 (today) | 390 | 9 | 7.65% |
| 50.70 | 360 | 8 | 9.92% |
| 48.15 | 390 | 9 | 1.31% |
| **48.15** | **360** | **8** | **1.78%** |

**1.78% modelled**, well under the brief's ~3% return threshold. The 2x2 separates the card-size effect (7.65% -> 1.31% at fixed capacity) from the split effect (the 8/7 split at 360 is more balanced than 9/6 and does raise the rate, exactly as the brief predicted).

### 3. [THE FINDING THE BRIEF DID NOT HAVE] The change is not "-5.0%", and 430 is the cell that mattered

| inner width | card today | card now | change | capacity | R(0) today | R(0) now |
|---|---|---|---|---|---|---|
| 320 | 44.00 | unsupported | — | 8 -> 7 | 0.02% | 2.12% |
| 360 | 46.80 | 48.15 | **+2.9%** | 9 -> 8 | 0.15% | 1.78% |
| 375 | 48.75 | 48.15 | -1.2% | 9 -> 9 | 1.31% | 1.31% |
| 390 | 50.70 | 48.15 | -5.0% | 9 -> 9 | **7.65%** | **1.31%** |
| 430 | 55.90 | 48.15 | -13.9% | 9 -> 10 | **66.93%** | **0.74%** |

Today's card is a function of the viewport, so a constant cannot have one percentage change. **Below width 370.4 the constant is LARGER than the clamp.** And at 430 today's card is 55.9px, where only depths s <= 6 fit: a **66.93% modelled** following-state failure rate, the worst cell recorded anywhere in this arc, at a width no round had ever swept. G2's remaining half was not a formality.

### 4. [J0c] Measured by same-hand intervention, per cell

Same page, same deal, same scroll state, one card staged in both arms; only the card width intervened on. A third arm re-measures BEFORE as a drift control.

| cell | panel-span change | feasibility | worst deficit | joker staged | control drift |
|---|---|---|---|---|---|
| 390x664 | -20.8px mean (-15.4 to -22.0) | 12/12 feasible both arms | -14.3 -> -36.3px | 6/12 | 0px |
| 430x664 | **-70.4px mean** (-46.8 to -107.7) | **8/12 infeasible -> feasible** | +30.9 -> -36.3px | 10/12 | 0px |
| 390x748 | -20.4px mean | 12/12 feasible both arms | -98.3 -> -120.3px | 9/12 | 0px |
| 360x664 | **+19.1px mean — worse** | 12/12 feasible both arms | -48.1 -> -16.1px | 7/12 | 0px |
| 1366x681 | **0.00px on 6/6** | control cell | unchanged | — | 0px |

The model and the measurement agree at 430 from two directions. F5b's two cells are folded in here rather than run separately, per J2.

### 5. [J0b] The box stops scaling and the ink does not

| root font-size | card box | rank font | pip | ink escapes |
|---|---|---|---|---|
| 12px | 48.14 | 13.00px | 21.66 | none |
| 16px | 48.14 | 17.33px | 28.88 | none |
| 18px | 48.14 | 19.50px | 32.50 | none |
| 20px | 48.14 | 20.88px | 34.80 | none |
| 24px | 48.14 | 20.88px | 34.80 | none |

Whether the hand FITS is no longer user-controllable; the ink still grows with the root font-size and caps at 58px. The cap is **measured, not derived**: ramping the ink basis against rendered boxes, the first escape is at 62px, where the top-left corner index and the bottom-right body pip begin to overlap. 7,668 card renders over 12 of 15 value classes.

A hypothesis died in the measuring: the pip is 0.6 of its basis where the rank glyph is 0.36-0.42 of its own, so the pip looked like it would set a ceiling the corner index had not earned. It does not — what binds is the **collision between them**, which either one growing causes, and splitting their bases buys 1px. Both are capped together; the split knob is kept because it is what made that measurable.

### 6. [NOT ON THE BRIEF] The card width was nine literals, and changing it broke eight of them

`clamp(2.75rem, 13vw, 4.25rem)` was written out at **nine** sites — box, seat stack, cut ribbon sliver, fan overlap, column pitch, shelf — with four tests guarding the copies, and a stylesheet comment saying the duplication was deliberate because tokenizing "would break a literal-parsing pin".

Changing the card changed one copy. The other eight kept computing overlaps from the old value, which positions columns at one width and draws them at another. **A first full set of measurements was taken against that state and has been discarded**; the tell was inside a gate that PASSED, which printed a pitch of 35 where `0.7 x 48.15 = 33.7`. The nine copies are now one `--gd-handcardw` declaration, the four pins are re-aimed at the token, and METHODOLOGY practice 34 records the general form: a test that enforces agreement between N copies is recording a design defect, not preventing one.

### 7. [J1] STATUS is a folder

7,895 lines and 118 rounds, split verbatim — the original body and the concatenation of the parts hash identically, and `status-structure.test.ts` pins the round bodies going forward. `status/` now holds CURRENT, model.json, a generated MODEL.md, VALIDATED, WITHDRAWN, a README, and `rounds/` with an INDEX.

The generated model earned its keep on its first run, before it was finished: the drift test rejected two `source` pointers I had written from memory, and chasing the real one for `stripW` surfaced that **the second deck theme's value is 0.841 against lacquer's 0.42** — a factor of two on the lattice step, which makes every span figure in this model a lacquer figure. It also showed that `K 125.1 = 59 + 10 + 15 + 41` sums to **125.0**: the residual is 0.1px, not the 0 recorded as "also exact".

Scanner scopes moved with the split. Prose-figures now covers the mutable live files instead of the top STATUS entry, and its allowlist fell from **17 exemptions to 3** — the friction was never the rule being too broad, it was the rule pointed at a document whose form was narrative. The withdrawn registry graduated from a Vitest fixture to `status/WITHDRAWN.md`, parsed by the test.

### 8. [J2] Trailing items

- **D5** — the `en` string set is complete (325/325 keys), and the missing half was a gate: C4's `nowrap` turned a wrapping title into a silently ellipsised one, which moves no layout figure and so nothing reported it. Now a rendered assertion (scrollWidth vs clientWidth), run per locale. Clean at zh-Hant, en and zh-Hans, with 12/15/18 titles examined so a pass is not vacuous.
- **D7** — `docs/research/prereg-template.md`, whose distribution-power section requires naming the bins that will carry the test and the smallest discrepancy the planned n could detect.
- **C2** stays parked, with Grok's constraint recorded in the note.
- **E5** downgraded per the owner's direction: feedback on a shipped change, not a precondition.
- A recurring hazard became a test: a backtick inside a probe's template literal ends it. Twice now, both times in a comment quoting CSS. `probe-literals.test.ts` runs `node --check` over every script and carries a mutant proving it fires.

### 9. Open

- **320 is a withdrawal, not a gap.** Today's clamp serves it through the 2.75rem floor (card 44px, capacity 8) at the default root font-size. The one-line alternative is a second constant below the crossover. Owner's call; see CURRENT.
- **The compact-mode feedback loop does not exist as described.** The detector is a build-time gate, and there is no telemetry in the client, so shipping and waiting to learn who is at 320 will not report anything.
- `aspect` 1.45 vs the scripts' 1.44970, and `kMinusCard`'s 0.1px residual: both recorded, neither resolved.
