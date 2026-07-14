# Wild-Card (逢人配) Selection Disambiguation — Design Research

**Date:** 2026-07-14 (M3-hardening §1 research deliverable, owner-mandated)
**Status:** Decision-ready; one owner sign-off required (§1.4). No code changed by this pass.
**Scope:** When a player selects concrete cards containing wilds, which set of interpretations must the engine/chooser offer, how does the existing enumerator (`classifyPlays`) measure against that rule, and what is the implementation design.
**Sources:** docs/rules/guandan.md v1.3 (§2–§4, §9), PLAN.md §3 (obligation 4), `src/engine/guandan/combos.ts`, `src/engine/guandan/generate.ts`, `src/client/table/helpers.ts`, `tests/unit/engine/combos.test.ts`, `tests/unit/engine/generate.test.ts`, plus a 25-probe execution transcript against the real engine (Appendix A, run 2026-07-14).

**Verification legend (per METHODOLOGY §3):**
- **VERIFIED-EXEC** — behavior executed against the current engine (probe `P#` in Appendix A, or an existing named repo test).
- **VERIFIED-READ** — claim read directly from spec/code, file:line cited.
- **PROVED** — short combinatorial argument included inline.
- **ASSUMED** — inferred from an adjacent verified mechanism; every ASSUMED row becomes a named test in §5 so the assumption cannot survive unexecuted.

**Null results (headlined, METHODOLOGY §4):**
- **N1 — no web pass run (decision, not failure).** Every load-bearing claim here is about our own spec and code; the one externally-uncertain rule this touches (§3.8 under-declaration of suited runs) was already source-researched and tagged UNCERTAIN/VARIANT in spec v1.3 with an owner-pinned default. Re-searching it could not change an owner-pinned default; recorded per the METHODOLOGY tool-ladder rule (Firecrawl disabled 2026-07-13; built-ins available but not needed).
- **N2 — window ambiguity is impossible for single-wild tubes and for all plates** (PROVED, §2.5) — but *cross-type* tube/plate ambiguity is real and easy to miss (probes P4, P13 found `plate` readings this author's first manual pass overlooked). The absence-plus-near-miss is itself a finding: manual enumeration is not a trustworthy oracle, hence the brute-force oracle in §5.
- **N3 — no suit over-enumeration exists in the current `classifyPlays`** (checked, no finding — §3, G3).

**Questions this pass set out to answer (METHODOLOGY §5):**
1. What exactly is a "meaningfully distinct" interpretation of a concrete selection? → §1
2. How does the owner's new rule interact with spec v1.3's §4.4.2 wild policy for suited sets? → §1.4 (tension; sign-off required)
3. What is the exhaustive edge-case surface? → §2
4. Does `classifyPlays` already produce exactly the meaningful-distinct set? → §3
5. What algorithm/API/ordering, and does obligation 4 survive? → §4
6. How is it tested, and what oracles completeness? → §5

---

## 0. Problem statement

A PLAY is `cards + decl` (spec §0, §4.4.4): wilds make one concrete multiset admit several canonical forms, and the declared form binds what opponents must beat. The M3 visual gate exposed the *play-becomes-pass* class: the client's selection→hint matching was narrower than the engine, so legal selections died in the UI. The point fix (M3 round-2) made `matchSelection` classify the selection with the engine's own `classifyPlays` and intersect with server hints by suit-blind projection (helpers.ts:107–131). The general fix — this document — pins down the *offered set* itself: for any selection, the chooser must offer **every meaningfully distinct interpretation, no redundant ones, in a stable strength order**, and the engine, generator, and client must agree on that set through a single code path.

Four surfaces must stay coherent:

| Surface | File | Role |
|---|---|---|
| `validatePlay` (Problem V) | combos.ts:144–397 | accepts/rejects a `(cards, decl)` pair |
| `classifyPlays` | combos.ts:416–470 | all valid decls of one concrete selection (runs `validatePlay` per candidate — cannot disagree with it) |
| `legalPlays` (Problem G) | generate.ts:87–263 | all forms playable from a 27-card hand, one wild-frugal realization each |
| `matchSelection` | helpers.ts:107–131 | chooser input = `classifyPlays(selection)` ∩ hints, by projection |

---

## 1. The meaningful-distinctness rule, formalized (owner-pinned)

### 1.1 Definitions

- **Selection** `S`: the concrete card multiset the player picked; `w(S) ∈ {0,1,2}` wilds (the ♥-level cards, spec §4.1 **CORE**); `naturals(S)` = `S` minus wilds minus jokers.
- **Interpretation**: a pair `(F, α)` — a canonical form `F = (type, size, keyRank, suit?, jokerRank?, demoted?)` plus a wild assignment `α : wilds → non-joker card identities` under which `S` satisfies `F`'s shape. The engine never materializes `α`; validity is "∃α", decided by multiset inclusion (spec §4.4.2 **CORE**; combos.ts:122–138).
- **Projection** `π(F) = (type, size, keyRank, jokerRank?, demoted?)` — the suit-blind identity already implemented as `formProjectionKey` (helpers.ts:72–75).

### 1.2 The rule

> **Offered(S) = { π-distinct forms F valid for S } minus the under-declaration suppressions of R4, presented in the R5 order.**

- **R1 — suit collapse (CORE, owner-pinned).** Wild assignments differing only in *suit* are never distinct. Suit matters in exactly one place — whether five cards are a straight flush — and there it is *determined, not chosen*: any SF form valid for `S` has its suit pinned by `naturals(S)` (≥3 naturals for a 5-card set with ≤2 wilds; each must match the declared `(rank,suit)` identity, so at most one suit can validate — **PROVED**). The SF form still *carries* `suit` (validation needs it, spec §4.4.3), but it is never a chooser dimension.
- **R2 — rank distinctness (CORE, owner-pinned).** Wild *rank* assignments that change `type` or `keyRank` are distinct, and **all** are offered. This covers: sequence end-position (wild below the bottom vs above the top — both offered, spec §9.18), full-house dual assignment ({8,8,9,9,W} → fullHouse-8 *and* fullHouse-9), and cross-type splits (fullHouse-9 vs 5-bomb-9 for {9,9,9,W,W}; tube vs plate for {4,4,5,5,W,W}).
- **R3 — invisible-assignment collapse (CORE).** Assignment differences not visible in `π` collapse to one entry: which of two wilds fills which slot; the *rank* of the pair that leftover wilds form in a full house (the pair never compares, spec §3 row 4 — {9,9,9,W,W} yields **one** fullHouse-9 entry, not twelve).
- **R4 — under-declaration suppressions (config-scoped).**
  - **R4a (§4.2, default `allowWildUnderDeclare=false`):** an all-wild single/pair offers only `keyRank = level`.
  - **R4b (§3.6, default `fiveOfKindAsFullHouse=false`):** a five-of-one-rank shape (wild-completed included) never offers `fullHouse`.
  - **R4c (§3.8 extended — the owner's NEW rule, default `allowUnderDeclareStraightFlush=false`):** a selection whose **naturals are all one suit** never offers `type=straight`; every rank-feasible window is offered as the straight flush instead. This *extends* the v1.3 guard (which exempts wild-containing sets) — see §1.4.
- **R5 — stable ordering (owner-pinned).** Offered forms are presented strongest-first by the documented total order of §4.3; in particular the SF end-position pair is ordered **larger-on-top** (SF-top-7 above SF-top-6).

### 1.3 Non-orphaning lemma for R4c (PROVED)

If `naturals(S)` are all one suit `s` and a plain-straight reading of window `V` is valid, then the SF reading of `(V, s)` is also valid — so R4c never removes a window outright, it only upgrades it. *Proof:* straight validity means every natural occupies a distinct in-window rank slot (multiset inclusion into 5 distinct ranks) and wilds cover the rank deficits; each natural is `(r, s)` by hypothesis, so it equally occupies the `(r, s)` identity slot of the SF; wilds may fill any identity slot (spec §4.4.2). ∎ — The converse suppression is therefore always a strict strengthening for the player *except* under `wildStraightFlushIsBomb=false`, where a substituting-wild SF is demoted and beats exactly like the plain straight (combos.ts:519–527) — net power identical, one chooser entry instead of two.

### 1.4 Tension with spec v1.3 — owner sign-off required ⚠️

R4c **contradicts spec v1.3 as written** in three places (all VERIFIED-READ):

1. §4.4.2 special checks (guandan.md:125): "**Wild policy for §3.8:** when wilds are present the declaration is free … a wild-completed suited set may be declared either as SF or as a plain straight; the guard applies only to fully-natural one-suit sets."
2. §4.4.3 dedupe example (guandan.md:133): "`3♠4♠5♠6♠ + wild` yields SF-top-7 *and* SF-top-6 … *and the corresponding plain-straight interpretations*."
3. §9.18 (guandan.md:235): "`2♠3♠4♠5♠+wild` = SF-6♠ / SF-A-low / **straight**."

And the code implements the v1.3 reading faithfully (VERIFIED-EXEC): the §3.8 guard fires only when `split.wilds === 0` (combos.ts:334); probes P25/P3/P11/P14/P15 all show plain-straight forms offered for one-suit-naturals + wild selections; named tests pin it (combos.test.ts:423–427 "§4.4.2 wild policy", 565–575 "§9.18"; generate.test.ts:189–197 "§3.8 wild policy" — the generator even *spends a wild off-suit on purpose* to realize the plain straight).

**Both readings are internally coherent; they answer different questions:**

- *v1.3 reading (substitution-maximal):* the wild genuinely may be an off-suit card (§4.1 CORE), so the weaker reading is a legal, occasionally strategic option (declaring the beatable form to feed the partner) — the same option §3.8's `allowUnderDeclareStraightFlush=true` variant grants natural sets.
- *Owner reading (appearance-based):* a selection whose visible cards are one suit *is* a suited run to everyone at the table; letting a wild launder it into a plain straight is exactly the under-declaration §3.8's default forbids for natural sets. The v1.3 asymmetry is strange at the margins: at level 7, the physically-all-hearts `4♥5♥6♥7♥8♥` currently offers a plain straight **because one of its own cards is the wild** (probe P11) — while the identical-looking natural run at any other level would be SF-only.

**Resolution options:**

- **Option A (recommended): enforce R4c at the engine level.** Drop the `split.wilds === 0` condition in `validateStraight` — the §3.8 guard becomes "`naturals(S)` all one suit ⇒ reject `straight` decl" under the default config; `classifyPlays` and `matchSelection` inherit the suppression for free (they run `validatePlay`); `realizeStraight` in generate.ts flips its wild-swap fallback to suppression (§4.4). One rule, one code path, no UI/engine asymmetry, raw-protocol clients cannot reach a form the UI hides.
- **Option B: suppress in the chooser only.** Engine keeps v1.3 semantics; `matchSelection` filters. Rejected: recreates a UI-narrower-than-engine split (the play-becomes-pass class this whole effort exists to kill), and a raw client could still under-declare — the decl binds opponents (§4.4.4), so the asymmetry is player-visible.
- **Option C: read the owner rule as suit-collapse only** (no straight suppression). Rejected as inconsistent with the owner's phrasing ("must NOT also offer weaker plain-straight readings"), but listed for completeness.

**Recommendation: Option A**, with the reading that R4c is the *natural completion* of §3.8's owner-pinned default rather than a new rule — no expressiveness is permanently lost, because `allowUnderDeclareStraightFlush=true` re-enables under-declaration for natural and wild sets alike (symmetry the variant currently lacks).

**If Option A is signed off, spec v1.4 must amend:** the §4.4.2 wild-policy sentence (guandan.md:125), the §4.4.3 example (guandan.md:133), §9.18 (guandan.md:235); **tests to update:** combos.test.ts:423–427 (flips to `expectErr` … `play.mustDeclareStraightFlush`), combos.test.ts:565–575 (§9.18 fingerprints drop the two straight forms), generate.test.ts:189–197 (wild-swap test becomes a suppression test). Everything else in this document is independent of the A/B/C choice except where marked ⚠️.

---

## 2. Exhaustive edge-case enumeration

Notation: `W` = the wild (♥ of level rank, written with its engine identity, e.g. `2H` at level 2). "Offered" = expected `Offered(S)` under **default config + Option A**; where the current engine differs, the delta is noted. Ordering shown is the §4.3 order (strongest first). All rows are per-selection (the chooser's question), not per-hand.

### 2.1 Singles, pairs, triples — incl. standalone-wild rule and joker exclusions

| ID | Level | Selection | Offered | Status |
|---|---|---|---|---|
| S-1 | 2 | `2H` (lone wild) | `single-2` (level rank only, R4a) | VERIFIED-EXEC P18 + combos.test.ts §4.2 |
| S-2 | 2 | `2H,2H` (two wilds) | `pair-2` (level pair, §9.7) | VERIFIED-EXEC combos.test.ts §9.7 |
| S-3 | 9 | `9S,9H` (natural + wild) | `pair-9` (natural reading ≡ substitution, §4.2) | VERIFIED-EXEC combos.test.ts §4.2 |
| S-4 | 2 | `KS,2H` | `pair-K` | VERIFIED-EXEC combos.test.ts §4.1 |
| S-5 | 2 | `KS,KC,2H` | `triple-K` | VERIFIED-EXEC combos.test.ts §4.1 |
| S-6 | 2 | `KS,2H,2H` | `triple-K` (both wilds, one slot-group) | ASSUMED (validateTriple mechanism combos.ts:194–196) → test §5 |
| S-7 | 2 | `SJ,2H` | ∅ — wild never pairs a joker (§4.1) | VERIFIED-EXEC P19 + combos.test.ts §4.1 |
| S-8 | 2 | `SJ,BJ` | ∅ — mixed jokers never a pair (§2.2) | VERIFIED-EXEC combos.test.ts §2.2 |
| S-9 | 2 | lone wild, `allowWildUnderDeclare=true` | 13 singles (every rank) — ambiguity by config intent | VERIFIED-EXEC combos.test.ts §4.2 variant |

### 2.2 Full house (5 cards)

| ID | Level | Selection | Offered | Status |
|---|---|---|---|---|
| FH-1 | 2 | `8S,8D,9S,9D,2H` — **dual assignment** | `fullHouse-9`, `fullHouse-8` | VERIFIED-EXEC P9 (KK99+W twin: combos.test.ts:377–383) |
| FH-2 | 2 | `9S,9C,9D,KS,2H` | `fullHouse-9` only (triple-K infeasible: 1 K + 1 W < 3) | ASSUMED (validateFullHouse decomposition combos.ts:288–320) → test §5 |
| FH-3 | 2 | `KS,KC,9S,2H,2H` — **split vs concentrated wilds** | `fullHouse-K` (wilds split: K-slot + 9-slot), `fullHouse-9` (both wilds in the 9 triple) | VERIFIED-EXEC P16 |
| FH-4 | 2 | `9S,9C,9D,2H,2H` — wilds as the rank-free pair | `bomb-5-9`, `fullHouse-9` (**one** entry — pair rank invisible, R3) | VERIFIED-EXEC P17 + combos.test.ts:585–592 |
| FH-5 | 2 | `9S,9C,9D,9H,2H` — five-of-kind shape | `bomb-5-9` only (R4b) | VERIFIED-EXEC combos.test.ts §3.6 |
| FH-6 | 2 | `9S,9C,2H,SJ,SJ` — joker pair + wild-completed triple | `fullHouse-9` (`fullHouseJokerPair=true` default) | VERIFIED-EXEC P20 |
| FH-7 | 2 | `9S,9C,9D,SJ,2H` — lone joker | ∅ (wild never completes a joker pair, §4.1) | VERIFIED-EXEC P7 |
| FH-8 | 2 | `9S,9C,9D,SJ,BJ` | ∅ (mixed jokers, §2.2 invariant) | VERIFIED-EXEC combos.test.ts §2.2 |
| FH-9 | 7 | `7S,7C,7H,KS,KC` — wild as itself in triple | `fullHouse-7` (beats Aces-up, §9.6) | VERIFIED-EXEC combos.test.ts §3.5 |

Lemma (PROVED): a 5-card selection can never read as both `fullHouse` and `straight` — a straight needs ≥3 distinct natural ranks, a full house at most 2. Cross-type ambiguity at size 5 is exactly {fullHouse, bomb-5} (FH-4/FH-5 shapes).

### 2.3 Plain straights (mixed-suit naturals — no SF interplay)

| ID | Level | Selection | Offered | Status |
|---|---|---|---|---|
| ST-1 | 2 | `5S,6D,8C,9S,2H` — interior gap | `straight-9` | ASSUMED (same mechanism as P21) → test §5 |
| ST-2 | 2 | `5S,6D,7C,8H,2H` — one wild, both ends | `straight-9`, `straight-8` (larger on top) | ASSUMED (P25 minus suit; P10 shows multi-window mechanics) → test §5 |
| ST-3 | 2 | `5S,6D,7C,2H,2H` — two wilds, three windows | `straight-9`, `straight-8`, `straight-7` | VERIFIED-EXEC P10 |
| ST-4 | 2 | `JS,QD,KC,AS,2H` — top boundary | `straight-A` only (no wrap above A, §2.5) | ASSUMED (mixed twin of P14) → test §5 |
| ST-5 | 7 | `AS,2D,3C,4S,7H` — bottom boundary | `straight-5` only (nothing below A-low) | ASSUMED (mixed twin of P15) → test §5 |
| ST-6 | 6 | `4S,5D,6H,7C,8S` — **wild in its own natural slot** | `straight-8` (window 5–9 infeasible: two deficits, one wild) | VERIFIED-EXEC P21 |
| ST-7 | A | `TS,JD,QC,KS,AH` — **wild = level = A, both readings** | `straight-A` (wild as itself, A-high), `straight-K` (wild as 9) | VERIFIED-EXEC P2 |
| ST-8 | 7 | `2S,3D,4C,7H,7H` — A-boundary, two wilds | `straight-6`, `straight-5` (window 3–7 infeasible: natural 2 outside) | ASSUMED → test §5 |
| ST-9 | 2 | `5S,6S,7S,8D,2H` — naturals *mixed* (3+1 suits) | `straight-9`, `straight-8` — **both retained** (R4c does not fire; no SF reading exists: 8D breaks every ♠ window) | ASSUMED (contrast case for R4c) → test §5 |

### 2.4 Straight flushes and the §3.8/R4c interplay ⚠️ (rows marked Δ change under Option A)

| ID | Level | Selection | Offered (Option A) | Current engine (v1.3) | Status |
|---|---|---|---|---|---|
| SF-1 | 6 | `2S,3S,4S,5S,6H` — the §9.18 case, both ends | `SF-6♠`, `SF-5♠` (larger on top) | + `straight-6`, `straight-5` Δ | VERIFIED-EXEC P5 + combos.test.ts:565–575 |
| SF-2 | 2 | `5S,6S,7S,9S,2H` — interior wild | `SF-9♠` | + `straight-9` Δ | VERIFIED-EXEC combos.test.ts:423–427 |
| SF-3 | 2 | `5S,6S,7S,8S,2H` — one wild, both ends | `SF-9♠`, `SF-8♠` | + `straight-9`, `straight-8` Δ | VERIFIED-EXEC P25 |
| SF-4 | 2 | `5S,6S,7S,2H,2H` — two wilds, three windows | `SF-9♠`, `SF-8♠`, `SF-7♠` | + 3 straights Δ | VERIFIED-EXEC P3 |
| SF-5 | 2 | `JS,QS,KS,AS,2H` — top boundary | `SF-A♠` (single window; no wrap) | + `straight-A` Δ | VERIFIED-EXEC P14 |
| SF-6 | 7 | `AS,2S,3S,4S,7H` — bottom boundary (A-low) | `SF-5♠` | + `straight-5` Δ | VERIFIED-EXEC P15 |
| SF-7 | 7 | `4H,5H,6H,7H,8H` — physically all-hearts; own card is the wild | `SF-8♥` (wild-as-itself in the 7-slot — never demoted, §9.11) | + `straight-8` Δ (the P11 oddity motivating R4c) | VERIFIED-EXEC P11 |
| SF-8 | 7 | `4H,5H,6H,7H,7H` — second wild substitutes 8♥ | `SF-8♥` (§9.13) | same + `straight-8` Δ | VERIFIED-EXEC combos.test.ts §9.13 (SF); straight reading ASSUMED |
| SF-9 | 2 | `5S,6S,7S,8S,9S` — fully natural one-suit | `SF-9♠` only (v1.3 §3.8 guard — unchanged by Option A) | identical | VERIFIED-EXEC combos.test.ts §3.8 |
| SF-10 | 2 | `5S,6S,7S,8S,9D` — natural, mixed | `straight-9` only (no SF suit validates) | identical | VERIFIED-EXEC P22 |
| SF-11 | 2 | SF-2 under `wildStraightFlushIsBomb=false` | `SF-9♠ demoted` (beats like straight-9; one entry — §1.3) | + `straight-9` Δ | VERIFIED-EXEC combos.test.ts §3.7 (demoted flag); suppression interplay ASSUMED |
| SF-12 | 2 | SF-3 under `allowUnderDeclareStraightFlush=true` | SFs **and** straights (R4c off) — 4 entries, SFs on top | identical | ASSUMED (variant twin of P25) → test §5 |

### 2.5 Tubes and plates (6 cards)

| ID | Level | Selection | Offered | Status |
|---|---|---|---|---|
| TP-1 | 2 | `4S,4C,5D,6S,2H,2H` — deficits split across ranks | `tube-6` | VERIFIED-EXEC combos.test.ts §4.1 |
| TP-2 | 2 | `4S,4D,5S,5D,2H,2H` — **both-end extension + cross-type** | `tube-6`, `plate-5`, `tube-5` | VERIFIED-EXEC P4 (the `plate-5` reading is the manual-pass near-miss, N2) |
| TP-3 | 2 | `5S,5D,6S,6D,2H,2H` | `tube-7`, `plate-6`, `tube-6` | VERIFIED-EXEC P1 |
| TP-4 | 7 | `AS,AC,2S,2C,7H,7H` — A-boundary | `tube-3`, `plate-2` (both lowest-of-family, §3.2; no wrap) | VERIFIED-EXEC P13 |
| TP-5 | 2 | `5S,5C,5D,6S,6C,2H` — one wild | `plate-6` | VERIFIED-EXEC combos.test.ts §4.1 |
| TP-6 | 2 | `6S,6C,6D,7S,7C,2H` | `plate-7` only (no tube: third 6 has no slot) | VERIFIED-EXEC P24 |
| TP-7 | 2 | `6S,6S,6C,6C,2H,2H` — same-rank 6 | `bomb-6-6` only (a "plate" of 6-and-6 is not two *consecutive* ranks) | VERIFIED-EXEC P12 |
| TP-8 | 2 | `5S,5C,5D,6S,2H,2H` | `plate-6` (tube 4–6 infeasible: third 5 has no slot) | ASSUMED → test §5 |

**Window-ambiguity lemmas (PROVED, N2):** two distinct tube windows overlap in ≤2 ranks = ≤4 cards, so 5 naturals (single wild) can never fit both — single-wild tubes are window-unique; two plate windows overlap in ≤1 rank = ≤3 cards, so ≥4 naturals (any wild count) can never fit both — plates are *always* window-unique. All observed multiplicity at size 6 is therefore end-extension with two wilds (tube) or cross-type (tube/plate/bomb), exactly as probed.

### 2.6 Bombs (4–10) and level-rank caps

| ID | Level | Selection | Offered | Status |
|---|---|---|---|---|
| B-1 | 2 | `KS,KC,KD,2H` | `bomb-4-K` | VERIFIED-EXEC combos.test.ts §4.1 |
| B-2 | 2 | `KS,KC,2H,2H` | `bomb-4-K` | ASSUMED (same mechanism) → test §5 |
| B-3 | 2 | `KS,9S,2H,2H` | ∅ — two wilds cannot bridge two ranks in a 4-set | VERIFIED-EXEC P8 |
| B-4 | 2 | K×k naturals + wilds, sizes 4–10 | `bomb-k-K` per size; **10-bomb only as 8 naturals + 2 wilds** (§9.14 — pure counting, no special rule) | VERIFIED-EXEC combos.test.ts §3.3/§9.14 |
| B-5 | 7 | `7S,7S,7C,7C,7D,7D,7H,7H` — all 8 level-rank copies | `bomb-8-7` (both wilds as themselves, §9.11); **9/10-bomb of the level rank cannot exist** — the wilds *are* two of its 8 copies | VERIFIED-EXEC combos.test.ts §9.11/§9.14 |
| B-6 | 2 | `SJ,SJ,BJ,BJ` | `jokerBomb` only — never a rank-bomb, never wild-assisted | VERIFIED-EXEC combos.test.ts §3 row 10 |
| B-7 | 2 | `2H,2H,SJ,SJ` | ∅ — wilds never join the joker bomb (§4.1); jokers never join rank bombs (§2.2) | ASSUMED (both halves individually verified: P19 mechanism + row-10 test) → test §5 |
| B-8 | 2 | 7–10-card selections | bombs are the only readings (`classifyPlays` default branch) | VERIFIED-EXEC combos.test.ts "7..10 card multisets" |

### 2.7 Joker-exclusion sweep (consolidated)

Wild is never a joker; never in the joker bomb; never pairs/triples a joker — S-7, S-8, FH-7, FH-8, B-6, B-7 above; plus jokers never enter sequences or rank bombs (combos.test.ts §2.2 sweep). All VERIFIED-EXEC except B-7 (composite, ASSUMED).

**Chooser-size bound (PROVED from the tables):** under default config + Option A the offered set never exceeds **3** entries (attained by SF-4, ST-3, TP-2, TP-3); under `allowUnderDeclareStraightFlush=true` the max is **6** (SF-12); under `allowWildUnderDeclare=true` a lone wild yields **13**. The chooser UI can assume a small list except under those two non-default variants.

---

## 3. Gap analysis: existing `classifyPlays` vs the rule

Method: read combos.ts:416–470 against §1, execute the 25-probe suite (Appendix A). Per METHODOLOGY §7, "checked, no finding" is listed with the findings.

### Findings

- **G1 — over-offers plain straights for one-suit-naturals wild selections (the §1.4 tension; only under-R4c gap).** VERIFIED-EXEC: P25/P3/P11/P14/P15 all include `straight` forms alongside the SFs. Root cause is a single condition: `validateStraight`'s guard `if (split.wilds === 0 && !config.allowUnderDeclareStraightFlush)` (combos.ts:334) — deliberate v1.3 behavior, pinned by tests. Not a bug against the current spec; it *is* the delta the owner's rule creates. Resolution per §1.4.
- **G2 — no strength ordering.** VERIFIED-EXEC P5: output for the §9.18 case is `[straight-5, straight-6, SF-5♠, SF-6♠]` — template-attempt order (fullHouse ranks, then bombs, then straights ascending, then SFs ascending; combos.ts:448–455), roughly *weakest first* and interleaved across families. The chooser currently inherits **hint order** instead (matchSelection iterates hints, helpers.ts:121–129), which is generate.ts template order — also unspecified. R5 ("larger-on-top") is satisfied by neither. Needs the §4.3 comparator.

### Checked, no finding

- **G3 — no suit over-enumeration.** `classifyPlays` attempts 10 windows × 4 suits (combos.ts:452–454), but for any concrete selection at most one suit validates (§1.2 R1 proof); probes show exactly one SF per window, always. The §4.4.3 suit-blind dedupe concern applies to *hand-level generation* (generate.ts:198–235 dedupes one emission per window) — not to per-selection classification, which needs no dedupe at all: each candidate form is attempted once and distinct candidates have distinct projections (given R1).
- **G4 — rank distinctness, cross-type splits, collapse, and guards already exact.** Full-house dual (P9/P16), fullHouse-vs-bomb (P17), tube/plate/bomb cross-type (P1/P4/P12/P13), R3 collapse (P17 emits one fullHouse-9), R4a (P18), R4b (five-of-kind tests), joker exclusions (P7/P19/P20), natural §3.8 guard (SF-9), boundary windows (P2/P13/P14/P15), level-rank natural slot (P21, SF-7), demoted-SF bookkeeping (§3.7 tests, enforced not inferred — combos.ts:390–395). **The enumerator is already sound and complete against spec v1.3** — an honest "already correct" finding: the M3 play-becomes-pass bug was in the *client matcher*, not here, and its fix (route matching through `classifyPlays`) is exactly why repairing this one function repairs the whole pipeline.
- **G5 — dedupe/matching keys adequate.** `formProjectionKey` (type, size, keyRank, jokerRank, demoted; SF suit excluded — helpers.ts:72–75) equals the §1.1 projection π; `declSignature` dedupes chooser entries; the selection-forms map keyed by projection (helpers.ts:116–117) cannot collide (R1 proof). The re-anchoring of SF suit to the selection's own classification (helpers.ts:100–105) is correct and needed when the hint's one-per-window realization used a different suit.
- **G6 — sizes/branches exhaustive.** Every size 1–10 maps to its complete candidate family (combos.ts:430–468); joker spellings attempted at sizes 1–2; demoted spellings attempted exactly under their config (combos.ts:424–427). No canonical form exists outside the attempted space (types.ts `ComboType` total).

**Generator-side corollary of G1 (Option A blast radius):** generate.ts currently *manufactures* the readings R4c suppresses — P6 shows hand `5S 6S 7S 8S 9S + 2H` emitting `straight-8 {5S,6S,7S,8S,2H}`, `straight-9 {2H,6S,7S,8S,9S}` (the deliberate wild-swap, generate.ts:330–339), and `straight-T {6S,7S,8S,9S,2H}` — every one with one-suit naturals + wild. Note also that the `deficit ≥ 1` path performs **no suit check at all** (the guard is inside `if (deficit === 0 …)`, generate.ts:314), so Option A's generator change is a predicate change, not just the wild-swap branch flip — see §4.4.

---

## 4. Algorithm design

### 4.1 Decision: repair `classifyPlays` in place — no new enumerator

`classifyPlays` already has the one property that killed the play-becomes-pass class: **it runs every candidate through `validatePlay`, so classification can never disagree with validation** (combos.ts:415–419), and both `inferDecl` (server-side decl inference) and `matchSelection` (client chooser) sit on top of it. A parallel `enumerateSelectionPlays` would be a second surface that can drift. The proposed engine API is therefore a contract tightening, not a new function:

```ts
// combos.ts — signatures unchanged, contract extended:
export function classifyPlays(cards: Card[], level: Rank, config: RuleVariant): CanonicalForm[];
//   POST (new): result is sorted by compareComboStrength, strongest first (R5).
//   POST (Option A ⚠️): plain-straight forms absent whenever naturals(cards)
//   are all one suit and allowUnderDeclareStraightFlush=false (R4c) — enforced
//   inside validateStraight, hence inherited, never re-implemented here.

export function compareComboStrength(               // NEW export
  a: CanonicalForm, b: CanonicalForm, level: Rank, config: RuleVariant,
): number; // total order, §4.3

// helpers.ts — matchSelection sorts its PlayMatch[] by compareComboStrength
// of decl (today: incidental hint order); no other client change.
```

Changed functions under Option A ⚠️: `validateStraight` (one condition), `realizeStraight` (§4.4), plus the two-line sort in `classifyPlays` and `matchSelection`. Nothing else moves.

### 4.2 Template-bounded complexity (extends spec §4.4.3) — no 4-suit blow-up outside SF windows

Candidate attempts per selection size (each attempt = one `validatePlay`, O(size) with small constants):

| Size | Candidates | Count (default config) |
|---|---|---|
| 1 | 13 singles + 2 joker spellings | 15 |
| 2 | 13 pairs + 2 | 15 |
| 3 | 13 triples | 13 |
| 4 | 13 bombs + jokerBomb | 14 |
| 5 | 13 fullHouse + 13 bomb + 10 straight + 10×4 SF | 76 (116 under `wildStraightFlushIsBomb=false`: +40 demoted spellings) |
| 6 | 13 bomb + 12 tube + 13 plate | 38 |
| 7–10 | 13 bombs | 13 |

Worst case 76 (116) validations of ≤10 cards — microseconds. Suits are consulted **only** inside the 40 SF candidates (identity-multiset test, combos.ts:376–382) and in the one-suit checks; every suit-blind type validates over ranks alone (`checkRankMultiset`), so wild suit assignments are never enumerated anywhere — matching spec §4.4's complexity note. Generation (`legalPlays`) is untouched in shape: ≤ 13×10 + 15 + 1 + 13 + 10 + 40 + 12 + 13 templates per hand, beats-filtered first.

### 4.3 Stable ordering (R5) — exact comparator

Sort descending by, in order:

1. **Bomb group:** `isBombForm(form, config)` — bombs above non-bombs (a demoted SF is a non-bomb and sorts with the straights it beats like).
2. **Within bombs:** `bombTier` descending (§3.11 ladder: jokerBomb 110 > 10-bomb 100 > … > SF 55 > 5-bomb 50 > 4-bomb 40), then `comboKeyValue` descending. SF end-position pair: same tier 55, keys `naturalValue(top)` — **larger-on-top falls out** (SF-7♠ above SF-6♠). ✓ owner pin.
3. **Within non-bombs:** `comboKeyValue` descending (levelValue scale for rank-keyed types incl. jokerRank 16/17; naturalValue of the top for sequences — combos.ts:512–517), then **TYPE_ORDER** descending as the final tiebreak, defined as the spec §3 table row number (single 1 … plate 7, straightFlush 9 — so a demoted SF sorts above the equal-window plain straight when a variant makes both appear).

Totality (PROVED for offered sets): two distinct offered forms tie through steps 1–2 only if both non-bombs with equal `comboKeyValue`; equal key + equal type ⇒ equal keyRank (both value functions are injective per level) ⇒ same projection ⇒ same form — so any surviving tie has distinct types and TYPE_ORDER breaks it. The only reachable same-key cross-type pair at equal size is tube/plate (P4: `plate-5` vs `tube-5`) → plate above tube. That last tiebreak is a **pinned presentation convention, not a rules claim** (tube and plate are mutually unbeatable); recorded here so it is deterministic and testable, changeable by owner taste without touching properties. Worked examples: P17 → `bomb-5-9`, `fullHouse-9`; P4 → `tube-6`, `plate-5`, `tube-5`; SF-12 variant → SFs (bombs) above all straights, each family internally key-descending.

### 4.4 Option A generator change ⚠️ + obligation-4 consistency

R4c's validation predicate is *"reject `straight` iff `naturals(S)` all one suit"* (wilds excluded from the suit census; a straight always has ≥3 naturals). The generator must emit `straight-V` iff **some** selection realizing V from the hand passes it. That predicate over the hand is: **the suits of the hand's in-window naturals span ≥ 2 suits** (pick any off-suit copy for one rank → mixed naturals; conversely every realization draws its naturals from that pool, so a singleton suit-union forces one-suit naturals in *every* realization — PROVED both directions). Concretely in `realizeStraight` (generate.ts:303–344):

- The `deficit === 0` one-suit branch keeps its natural-swap but the wild-swap fallback (330–339) becomes `return null` — spending a wild to *manufacture* an off-suit identity is exactly the laundering R4c forbids.
- The `deficit ≥ 1` path gains the suit-union check it currently lacks (G3 corollary): singleton union ⇒ `return null` (only the SF form of that window survives, emitted by the SF loop — never orphaned, §1.3 lemma).

**Obligation 4 (PLAN.md §3) survives, clause by clause:** (i) *every generated action applies OK* — emitted straight realizations now always have mixed-suit naturals, passing the extended guard; all other families untouched. (ii) *every action that applies OK has its canonical form in the generated set* — a selection validating `straight-V` has mixed naturals ⊆ the hand's in-window pool, so the pool's suit-union ≥ 2 and the generator emits `straight-V` (deficit arithmetic unchanged); suppressed forms validate nowhere, generate nowhere. (iii) *fuzzed decls outside the generated set are rejected* — the same predicate runs in `validatePlay`, so the rejection is definitionally aligned. And the client stays aligned for free: `matchSelection` classifies with the engine's own `classifyPlays` (helpers.ts:114), which runs the very `validatePlay` that changed — one predicate, four surfaces. A player whose hand holds *both* the suited run and an off-suit copy keeps full expressiveness by concrete selection: `5♠6♠7♠8♠9♦` still offers `straight-9`; `5♠6♠7♠8♠9♠` offers `SF-9♠`; `5♠6♠7♠8♠W` offers the two SFs (SF-3) — suppression is per-selection, alternatives reachable by picking different cards.

---

## 5. Test plan

New suite `tests/unit/engine/wild-disambiguation.test.ts` (+ property file), plus edits listed in §1.4 if Option A is signed off.

### 5.1 Named cases

Every ID in §2 becomes a named test asserting the **exact ordered offered set** (fingerprints, as combos.test.ts already does): S-1…S-9, FH-1…FH-9, ST-1…ST-9, SF-1…SF-12, TP-1…TP-8, B-1…B-8. Rows tagged ASSUMED are the priority — they are the claims this document could not execute (S-6, FH-2, ST-1/2/4/5/8/9, SF-8 straight-reading, SF-11 interplay, SF-12, TP-8, B-2, B-7). Config-variant rows (S-9, SF-11, SF-12, FH under `fullHouseJokerPair=false`, R4b under `fiveOfKindAsFullHouse=true`) run under their `vary()` configs.

### 5.2 The four properties

Over randomized selections — sub-multisets (sizes 1–10) of random 108-card deals, wild inclusion forced in ≥50% of samples, all 13 levels sampled; plus exhaustive rank-projected multisets for sizes 1–3:

- **P-SOUND:** every emitted form passes `validatePlay(S, f)`. (True by construction today; kept as a refactor tripwire.)
- **P-COMPLETE:** emitted set == oracle set (§5.3), compared as projection sets.
- **P-MINIMAL:** no two emitted forms share `formProjectionKey`; and no emitted form is R4-suppressed under the active config.
- **P-STABLY-ORDERED:** the emitted sequence is sorted by `compareComboStrength`; the comparator is antisymmetric/transitive on the emitted set (pairwise check); the SF end-position pair asserts larger-on-top by name (owner pin, SF-1/SF-3).

Config sweep: run all four properties under the 2⁵ combinations of `allowUnderDeclareStraightFlush × wildStraightFlushIsBomb × allowWildUnderDeclare × fiveOfKindAsFullHouse × fullHouseJokerPair` (32 configs — cheap at these sizes).

### 5.3 Completeness oracle — brute force over wild assignments

The oracle inverts the template shortcut the implementation takes, so it cannot share a bug with it: for each wild in `S`, substitute every non-joker identity (52 each; ≤ 52² = 2 704 assignments for w=2 — trivial), classify the resulting **all-natural** multiset with an independent reference classifier (direct shape checks, no wilds, no template reuse), and union the projections. Then apply the R4 suppressions **as selection-level post-filters on the original S** (they are statements about the concrete selection, not the substituted multiset): R4a keyRank=level filter for all-wild 1–2 card sets; R4b five-of-kind filter; R4c one-suit-naturals straight filter (Option A ⚠️); under `wildStraightFlushIsBomb=false`, recompute `demoted` from S + window directly (substitution loses which slots were wild — combos.ts:386–390 logic reimplemented independently). Expected == `classifyPlays` output as sets; ordering asserted separately (P-STABLY-ORDERED).

### 5.4 Cross-surface regressions

- **Obligation-4 property re-run** (existing obligations.property.test.ts): unchanged clauses, now exercising the new `realizeStraight` predicate — every generated realization validates under its own decl (P6's three straights become the sentinel: under Option A the hand `5S 6S 7S 8S 9S + 2H` generates **no** plain straights, while its three SF windows — 4–8, 5–9, 6–T, all ♠ — remain generated).
- **Play-becomes-pass class:** for random hands and every generated hint, `matchSelection(hint.cards, hints, …)` is non-empty and contains the hint's projection — plus the transposed check with an *equivalent* selection (swap a natural for its other copy / for a wild where legal), which is the exact M3 regression.
- **Chooser-size bound:** assert `|Offered(S)| ≤ 3` under default config across the property sample (the §2 PROVED bound) — a cheap canary for accidental over-enumeration.
- **§1.4 test edits (Option A only ⚠️):** combos.test.ts:423–427 → `expectErr(…, 'play.mustDeclareStraightFlush')`; combos.test.ts:565–575 → fingerprints `[SF-5♠, SF-6♠]` ordered `[SF-6♠, SF-5♠]`; generate.test.ts:189–197 → asserts *absence* of the straight form and presence of the SF for that hand.

---

## Appendix A — probe transcript (executed 2026-07-14, current engine @ M3-hardening HEAD)

Probe harness: temporary vitest file calling `classifyPlays` / `validatePlay` / `legalPlays` with `JIANGSU_OFFICIAL_ONLINE`; fingerprint format `type:size:keyRank:suit:jokerRank:demoted`. File deleted after the run; inputs/outputs reproduced verbatim below for reproducibility.

```
P1  {5S,5D,6S,6D,2H,2H} lvl2 → tube:6:6, tube:6:7, plate:6:6
P2  {TS,JD,QC,KS,AH}   lvlA → straight:5:K, straight:5:A
P3  {5S,6S,7S,2H,2H}   lvl2 → straight:5:7, straight:5:8, straight:5:9,
                              straightFlush:5:7:S, straightFlush:5:8:S, straightFlush:5:9:S
P4  {4S,4D,5S,5D,2H,2H} lvl2 → tube:6:5, tube:6:6, plate:6:5
P5  {2S,3S,4S,5S,6H}   lvl6 → straight:5:5, straight:5:6, straightFlush:5:5:S, straightFlush:5:6:S   (output order as emitted)
P6  legalPlays({5S,6S,7S,8S,9S,2H}, lead, lvl2) straights →
      straight:8 {5S,6S,7S,8S,2H} · straight:9 {2H,6S,7S,8S,9S} · straight:T {6S,7S,8S,9S,2H}
P7  {9S,9C,9D,SJ,2H}   lvl2 → ∅
P8  {KS,9S,2H,2H}      lvl2 → ∅
P9  {8S,8D,9S,9D,2H}   lvl2 → fullHouse:5:8, fullHouse:5:9
P10 {5S,6D,7C,2H,2H}   lvl2 → straight:5:7, straight:5:8, straight:5:9
P11 {4H,5H,6H,7H,8H}   lvl7 → straight:5:8, straightFlush:5:8:H ; validatePlay(straight-8) = ok
P12 {6S,6S,6C,6C,2H,2H} lvl2 → bomb:6:6
P13 {AS,AC,2S,2C,7H,7H} lvl7 → tube:6:3, plate:6:2
P14 {JS,QS,KS,AS,2H}   lvl2 → straight:5:A, straightFlush:5:A:S
P15 {AS,2S,3S,4S,7H}   lvl7 → straight:5:5, straightFlush:5:5:S
P16 {KS,KC,9S,2H,2H}   lvl2 → fullHouse:5:9, fullHouse:5:K
P17 {9S,9C,9D,2H,2H}   lvl2 → fullHouse:5:9, bomb:5:9
P18 {2H}               lvl2 → single:1:2
P19 {SJ,2H}            lvl2 → ∅
P20 {9S,9C,2H,SJ,SJ}   lvl2 → fullHouse:5:9
P21 {4S,5D,6H,7C,8S}   lvl6 → straight:5:8
P22 {5S,6S,7S,8S,9D}   lvl2 → straight:5:9
P23 {6S,6C,6D,7S,7C,7D} lvl2 → plate:6:7
P24 {6S,6C,6D,7S,7C,2H} lvl2 → plate:6:7
P25 {5S,6S,7S,8S,2H}   lvl2 → straight:5:8, straight:5:9, straightFlush:5:8:S, straightFlush:5:9:S
```
