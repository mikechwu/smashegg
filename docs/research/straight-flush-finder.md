# Straight-Flush Finder — Design Research & Model of Record

**Date:** 2026-07-24 (owner-mandated feature; research→propose→sign-off→build).
**Status:** Model SIGNED OFF by the owner (six decisions + three strengthenings).
This document is the model of record for the pure engine + its oracle; the code
and tests are the executable truth, this is the why.
**Scope:** A PURE ASSISTANT that shows a player the meaningful ways to pull
straight flushes (SFs) out of THEIR OWN hand, and what each choice leaves behind.
Changes NO game state, legality, protocol, redaction, timing or generation;
nothing it computes is authoritative; it sees only the player's own hand.
**Sources:** `src/engine/guandan/{cards,combos,generate,config,types}.ts`,
`src/client/table/helpers.ts`, `docs/research/wild-disambiguation.md`, and a
10-agent research panel (2 web prior-art lenses, 3 independent algorithm leads, 3
presentation leads, a synthesis and an adversarial completeness critic), run
2026-07-24. Web prior art is panel-sourced (§8); it informs presentation
direction, never correctness — correctness rests on the engine reuse + the oracle.

**Verification legend (METHODOLOGY §3):** VERIFIED-READ (from code, cited),
PROVED (argument inline), ASSUMED (becomes a property-sample check, never assumed
into the ship).

---

## 0. Problem statement and the answer unit

At a real table you physically set candidate SFs aside and judge what remains; on
screen you cannot. The hard part is NOT listing SFs — it is the DECOMPOSITION:
SFs compete for the same cards (keeping one can make another impossible), wilds
multiply the competition (a wild completes different SFs in different suits and
positions), and each choice changes the REMAINDER, which is what the decision
turns on.

**Unit of the answer = a COMPLETE DECOMPOSITION** `D = (groups, R)`:
- `groups` — a set of pairwise-disjoint SFs pulled from the hand (each group = a
  sorted 5-card sub-multiset that `classifyPlays` recognises as a straightFlush).
- `R = removeCards`-fold`(hand, groups)` — the induced remainder, the
  decision-carrying half. Because the hand is FIXED, the chosen groups determine
  `R` exactly (§2.4 theorem), so `R` is implied, never keyed separately.

Fragments (a lone SF divorced from its cost) are NOT the unit; every surfaced
object carries its full remainder. The empty decomposition (k=0, R=whole hand) is
the domination floor but is not itself rendered — the player already sees their
hand.

---

## 1. Distinctness (owner Decision 1 + 6, SIGNED OFF)

Reuse the wild-disambiguation projection `π` (`formProjectionKey` =
type,size,keyRank,jokerRank,demoted; SF suit excluded) as the group **label
alphabet + membership test** (a 5-set is an SF group iff `classifyPlays` returns a
straightFlush — so the finder can NEVER claim an SF `validatePlay` would reject).

**An arrangement is identified by its REMAINDER** — equivalently the
committed-card set, since the hand is fixed. This is the owner's Decision-6 words
made exact: *"the same five cards pulled are one arrangement regardless of label;
a different suit is a genuinely different pull."* Two directions from ONE
difference (*in wild-disambiguation the cards are already CHOSEN and the question
is how to read them; here the player CHOOSES which cards to pull*):

- **Coarser than π in end-position.** `{5♠6♠7♠8♠+wild}` is π-distinct as SF-top-9♠
  and SF-top-8♠, but it is ONE set-aside leaving ONE remainder → one arrangement,
  the group carrying BOTH tops on its `forms` (larger-top first) for the UI.
- **Finer than π in suit.** π drops suit (for a FIXED 5-set the suit is determined
  by the naturals, R1). But choosing which cards to pull makes the ♠-run vs the
  ♥-run different pulls → different committed cards → different remainder →
  distinct.

**Refinement note (build, oracle-driven — disclosed to the owner).** The
sign-off synthesis proposed "physical consumed-card multiset" as the identity.
The brute-force oracle proved that TOO FINE in two ways: (a) when two wilds can be
split among same-form groups (`{all-natural}+{2-wild}` vs `{1-wild}+{1-wild}` for
two 7♥ flushes), and (b) when natural-first materialization's DFS order picks a
different but equivalent partition of the SAME committed cards (same remainder).
Both are ONE arrangement. Keying on the remainder (committed-card set) dissolves
both artifacts and is precisely π-coarser-in-end-position / π-finer-in-suit as
signed off — a cleaner mechanism for the same intent, not a scope change. The
groups shown are one representative partition (natural-first); the exact tops are
a play-time choice carried on `forms`.

---

## 2. Enumeration — bounded-multiplicity set packing (owner Decisions 2, 7)

### 2.1 The correction that made the model correct (critic catch)

The first-pass framing was maximum-independent-set over the ≤40 distinct
`(top,suit)` candidate windows — ONE node per window. That structurally excludes
the highest-value case the feature exists for: a twinned one-suit run such as
`5♠5♠6♠6♠7♠7♠8♠8♠9♠9♠` at level 2 = **two identical top-9♠ SF bombs, remainder
empty**. MIS cannot select a window twice. The fix is **bounded-multiplicity
packing**: a candidate window may be pulled up to its feasible count; the global
wild inequality (§2.3) already supports this (demand counts a window twice). The
math was right, the description was wrong.

### 2.2 Candidate windows

For each top ∈ '5'..'A' (10 windows, A-low included, no wrap) × suit ∈ SUITS,
the window ranks come from `sequenceWindow(top,5)`; the required identities are
`{rank+suit}`. `supply(id) = countHand.byIdentity[id]`, with
**`supply(level+'H') = 0`** — those copies ARE the wilds. A window is a *candidate*
iff its single-instance deficit `#{rank : supply(rank+suit)==0} ≤ wilds` (≤2).

### 2.3 Global feasibility (the single inequality)

A packing is a multiset `x: candidate → count`. Let
`demand(id) = Σ_c x[c]·[id ∈ window(c)]`. The packing is FEASIBLE iff

> `Σ_id max(0, demand(id) − supply(id)) ≤ wilds`.

This one inequality captures natural-twin capacity + the shared ≤2-wild budget +
all window overlap at once. Per-window "need ≤ w" is INSUFFICIENT and silently
drops valid 2-SF packings — verified rescue: `5♠6♠7♠8♠9♠T♠J♠Q♠K♠+2H` @lvl2 packs
top-9♠ AND top-K♠ only under GLOBAL wild allocation.

### 2.4 Materialization and the load-bearing theorem (owner strengthen 3)

For a feasible packing, group cards are DETERMINED: for identity `id`, the groups
use `min(demand,supply)` naturals + `max(0,demand−supply)` wilds; the remainder
gets `max(0,supply−demand)` naturals of `id` + the leftover wilds. This is
**natural-first (minimum-wild) materialization** and it is remainder-optimal:
a wild retained in R weakly dominates a natural retained in R for every quality
metric (a wild can complete any bomb/run a natural can, and more). Hence:

> **THEOREM (same groups ⟺ same remainder).** Under natural-first
> materialization, the packing (window multiset) determines the physical
> group-multiset, which determines R exactly.

This is the single most load-bearing invariant. It is PROVED above but the
frugal-domination step ("wild ≥ natural in R") is checked empirically over the
property sample (never assumed into the ship), and complement-exactness is pinned
by an independent Counter subtraction on twin-heavy hands (§5C).

### 2.5 Search and bounds

Recursive backtrack over candidate windows in fixed order, trying multiplicity
0..cap at each (cap = supply/wild-limited), pruning by §2.3. Collect MAXIMAL
packings (no candidate addable). Structural caps make blowup impossible:
candidates C ≤ 40, SFs per packing k ≤ ⌊27/5⌋ = 5, wild-using SFs ≤ wilds ≤ 2.
An unreachable node-budget tripwire documents boundedness (owner Decision 7: any
truncation is a DISPLAY cap, never a runtime/completeness compromise — say so).

### 2.6 Sub-maximals (owner Decision 2)

Maximal packings are the backbone. Decision-relevant sub-maximals (keep fewer
SFs) are DERIVED (drop groups from a maximal packing, recompute R) and kept only
if Pareto-non-dominated (§3). The full keep-j-of-k lattice is generated
INTERNALLY (bounded, ≤ 2^k−1 ≤ 31 per packing) but only the frontier is surfaced;
"keep one fewer" is a reversible UI navigation within it. **Known limitation
(owner Decision 2):** deliberately withholding some sub-maximals is the one place
the finder shows fewer than all arrangements — if a player ever reports "I wanted
to keep just one and it wasn't offered," this is the reason, logged not
rediscovered.

---

## 3. Ranking — the Pareto frontier (owner Decision 3, the named judgement call)

**There is no objective best decomposition.** The keep-vs-break call turns on the
remainder's situational value to the player (partner, table), which the finder
does not and should not fully evaluate. A naive SF-count sort would BURY the
"break it for two bombs" arrangement the feature centres on. Resolution:

- Show the **Pareto frontier** of `(SFValue, RemainderQuality)`. `D1` dominates
  `D2` iff `SFValue(D1) ≥ SFValue(D2)` AND `RemainderQuality(D1) ≥
  RemainderQuality(D2)`, strict somewhere. Every shown row is then a genuine
  trade; "one strong SF vs two bombs" surfaces automatically as two
  non-dominated points.
- `SFValue` is a PARTIAL order: sort each decomposition's group strengths
  (`compareComboStrength`, config-correct so a demoted SF sorts below a bomb-SF)
  descending, pad the shorter with −∞, compare pointwise. So "2 weak SFs" and
  "1 strong SF" are incomparable (both kept), while "1 strong SF, ≥-as-good
  remainder" dominates "1 weak SF."
- `RemainderQuality` is a lexicographic tuple `[residual bomb power ; combo
  coverage ; −orphan singles ; tidiness]`, computed by reusing `legalPlays` /
  `classifyPlays` on R (never a re-invented heuristic). bombPower-dominant is the
  defensible DEFAULT that makes "break it → two bombs" win — a default order, not
  an optimality claim. Tidiness is the softest term, first to drop if it tests
  poorly with elders.
- **Sort, never filter (the trust line, owner Decision 3):** every shown row
  renders its FULL remainder; ranking only orders/prunes-dominated, never hides
  an alternative. Order the frontier SF-strength-first then remainder-first.
- **Ceiling:** compute everything, DISPLAY the top ~3–4, "show more" to a hard
  ~6; beyond that an honest summary, never a scroll. Note the display cap CAN
  hide non-dominated rows, so `totalFound` reports the full frontier size — never
  truncate silently.
- **COST (measured, correcting a false pre-build claim of "sub-ms"):** a full
  27-card hand costs **~130–170ms** on a dev machine (a phone is several times
  slower); the per-decomposition remainder scan dominates. Two audit-driven
  changes moved this: the scan had been run TWICE per decomposition (tags, then
  ranking) and is now computed once and threaded (~280-350ms → ~105-155ms), and
  the multiplicity-aware counting added some back (~130-170ms), trimmed by paying
  classifyPlays only under the demotion VARIANT, where the flag can differ. This suits the ON-DEMAND press the feature is — the
  player taps "find", the sheet opens — but it must NOT sit in a render path or a
  per-keystroke effect. Pure and deterministic, hence freely cacheable per
  (hand, level).
- **Verified as a PROPERTY, not by taste:** the shown set is exactly the Pareto
  frontier of the raw set under the published comparator, antisymmetric/
  transitive/deterministic (§5D).

---

## 4. Remainder annotation — a CLOSED, FACTUAL vocabulary (owner strengthen 1)

The annotation is the first time this project's UI passes any read on cards. It
must stay FACTUAL — the finder INFORMS the keep-vs-break call, never MAKES it.

**Closed tag-kind set** `REMAINDER_TAG_KINDS`: `'bomb' | 'straightFlush' | 'run' |
'fullHouse' | 'triple' | 'pair' | 'scatter' | 'cardsLeft'`. Each is factual: a
count or a presence — `bomb ×N` and `straightFlush ×N` (a constructive GREEDY
count of pairwise-DISJOINT holdings — a lower bound that never overclaims), then
ONE presence word for the strongest remaining structure (`run` = a
straight/tube/plate, else `fullHouse`, else `triple`, else `pair`), `scatter`
(loose cards — fires ONLY when literally nothing in R combines), `cardsLeft ×N`.
**NO comparative or advisory kind** ("better", "recommended", "stronger") may ever
be added — that would turn the assistant into an advisor.

Enforced STRUCTURALLY at the TYPE level: `REMAINDER_TAG_KINDS` is
`as const satisfies readonly RemainderTagKind[]` plus an exhaustiveness alias
(`Exclude<RemainderTagKind, (typeof REMAINDER_TAG_KINDS)[number]> extends never`),
so widening the union WITHOUT widening the array is a COMPILE error. (Audit
finding: the original `readonly RemainderTagKind[]` annotation was only a SUBSET
check — an advisory member could be added to the union alone and both the compiler
and the runtime equality test stayed green. Verified fixed: the union-only attack
now fails typecheck.) The annotation is render-only and NEVER routed into a decl
the server trusts.

**RESOLVED — the silent-remainder gap.** Fixing the `scatter` overreach first
traded a WRONG tag for SILENCE: **56.8%** of non-empty remainders carried no
descriptive tag at all (just `cardsLeft`) although they really held a
pair/triple/full house the closed set had no word for. Nothing false was said,
but it blunted Decision 4's stated purpose ("compare remainder QUALITY at a
glance") back toward a bare card count, and it rhymes with the owner's
no-silent-no-op rule. The set is therefore EXTENDED with three strictly factual
PRESENCE kinds — `fullHouse`, `triple`, `pair` — reported as ONE word for the
strongest remaining structure (ladder: run > fullHouse > triple > pair >
scatter), so a phone row stays readable. Measured after: **0.0% silent**. This
expands an owner-signed artifact, so it is flagged explicitly — but it adds no
comparative or advisory kind, so the "informs, never advises" rule is untouched,
and a test pins that a non-empty remainder is never left silent.

**COUNTS vs PRESENCE — a category error, found by audit and fixed.** Counting the
notable holdings off `legalPlays` was wrong: it is a MOVE generator and emits ONE
realization per canonical projection, and for straight flushes that projection is
SUIT-BLIND. So `5♠6♠7♠8♠9♠ + 5♣6♣7♣8♣9♣` — two genuinely disjoint straight
flushes — reported `straightFlush ×1`, and twins collapsed the same way. That
systematically UNDERCOUNTED exactly the "break it and I have two bombs" signal
this feature exists to surface, and it fed the ranking too. Now:
- **COUNTS** come from `countHoldings`, a multiplicity-aware greedy over
  enumerated candidates (rank bombs from actual per-rank counts, SF windows from
  the finder's own `candidateWindows`, joker bomb), strongest-first via
  `combos.bombTier`. Still constructive and pairwise disjoint, so still a lower
  bound that never overclaims.
  **It is STRONGEST-first, NOT maximum-cardinality** — an audit found the code
  comment claiming "max disjoint", which is false. For `5-9 in all four suits` it
  reports FOUR straight flushes (4 × tier 55 = 220) where FIVE disjoint rank bombs
  also exist (5 × 40 = 200). Both are true readings of the same cards; the greedy
  deliberately takes the STRONGER one, because each straight flush beats a 4-bomb
  and that is the better thing to tell a player. The contract the tags rely on is
  therefore exactly: **every reported holding is real, they are pairwise disjoint,
  so a count is a LOWER BOUND that never overclaims** — never a maximum. Pinned by
  a named crosshatch test so comment and behaviour cannot drift apart again.
- **COVERAGE/ORPHANS are multiplicity-aware too** (audit finding): this used a
  `Set` keyed on card identity, so a straight flush covering ONE `5♠` marked BOTH
  twin copies covered and reported `orphans = 0`, flattering twin-heavy remainders
  and corrupting the Pareto quality half. It is now a greedy disjoint cover taking
  the LARGEST play first (taking whatever came first also made it depend on
  `legalPlays` emission order and badly understate coverage).
- **PRESENCE** still comes from `legalPlays` — its dedupe can hide a duplicate,
  never an existence, which is exactly what presence needs.

**Two factual defects found by audit and fixed** (both were the vocabulary lying
about the cards, the exact failure this section exists to prevent):
1. Under `wildStraightFlushIsBomb=false` a wild-substituted SF is DEMOTED (not a
   bomb); SF counting ran off the bomb-filtered list, so a remainder genuinely
   holding a straight flush was tagged `run`. SFs are now counted BY TYPE.
2. `scatter` fired over a leftover PAIR. It now requires that nothing combines at
   all (every card an orphan).
Both are named regressions, each proven to fail when the bug is reintroduced.

---

## 5. Oracle + test plan (owner build gate)

Reuse the wild-disambiguation §5.3 substitution oracle as the SF-recognition core
and add a partition layer; a decomposition's correctness factors into three
independently-checkable TRUTH claims plus one non-truth (ranking) claim.

- **(A) Soundness** — for each emitted SF group, substitute its ≤2 wilds over
  every non-joker identity (≤52²=2704), classify each all-natural result with an
  INDEPENDENT reference recognizer (direct shape checks: sort ranks, check
  consecutive + A-low duality + single suit — **must NOT call `sequenceWindow`**
  or A-low/no-wrap boundary bugs are co-shared and invisible), accept iff a
  straightFlush appears. An emitted group can never be one `validatePlay` rejects.
- **(B) Completeness up to distinctness** — a DECOMPOSITION oracle whose candidate
  SFs come from the SUBSTITUTION method (not the `(top,suit,need)` loop, not the
  Σ-inequality): for each of ≤52^w substitutions make the hand all-natural,
  BRUTE-FORCE enumerate all disjoint 5-card SF partitions via subset search with
  the independent recognizer over PHYSICAL positions (twins as distinct
  positions — the double-SF case), map substituted wilds back, **keep only FRUGAL
  decompositions** (no wild spent where a remainder-natural of that slot was
  available — the natural-first set the finder produces, §2.4), reduce each to
  its REMAINDER key (§1), and assert the set of remainder keys EQUALS the
  enumerator's raw remainders. The frugal filter and the remainder key are what
  make the independent oracle agree with natural-first materialization; both were
  forced by real oracle disagreements during the build, not assumed.
- **(C) Complement-exactness under twins** — assert `Counter(⋃groups) ⊎
  Counter(R) == Counter(hand)` via INDEPENDENT Counter subtraction (NOT
  `removeCards`), `|R| = |hand| − 5k`, no fold step returns null, and wild
  accounting `supply(level+'H')=0`. In this model a Card IS its identity ('5S');
  the twin risk is MULTIPLICITY (removing more '5S' than held) — the Counter
  check keyed on the exact card string with counts pins it. Internal tripwire:
  closed-form-feasible(packing) ⟺ removeCards-fold-succeeds.
- **(D) Ranking** — verified SEPARATELY as a deterministic PROPERTY: the shown set
  == the Pareto frontier of the raw set, RECOMPUTED independently from the
  published rule (SF-strength vector + remainder-quality tuple, quantities derived
  in the test), in the published order, with `totalFound` == the full frontier
  size. NOT judged by the oracle-of-truth — ranking is judgement, not truth.
  (Audit finding: this check was DOCUMENTED here and in the test header but never
  actually implemented — the old assertions would have passed `raw.slice(0,6)` in
  arbitrary order. Now implemented and proven non-vacuous.)
- **(F) Group fields** — `suit`, `top`, `forms`, `wildsUsed` are each checked
  against the independent recognizer (previously only the remainder was compared,
  so a finder reporting every top as 'A' would have passed).
- **(G) Tag truth** — every tag must state something TRUE: counts never exceed the
  max disjoint extraction; `run`/`scatter` may not stand in for a real straight
  flush; `scatter` only when nothing combines; `cardsLeft` exact.
- **Scale** — the battery runs on realistic 27-card hands, not only the small
  crafted ones (audit finding: the suite never exceeded 10 cards while the feature
  ships for 27).
- **(E) Frugal-domination** — over the property sample, assert no alternative
  materialization of a packing yields a strictly better R than natural-first
  (§2.4), so "same groups ⟺ same remainder" is proved by sample, not assumed.

Run the battery over randomized TWIN-heavy AND WILD-heavy hands, all 13 levels,
and the 2⁵ = 32 config sweep (manual enumeration proved untrustworthy — the
wild-disambiguation doc's own oracle beat manual reads twice).

---

## 6. Assistant-only invariant (owner build gate)

PURE `findStraightFlushes(hand, level, config)` in the engine's pure layer,
importing only already-client-legal pure primitives (`cards.ts`
countHand/removeCards/sortCards, `combos.ts`
classifyPlays/compareComboStrength/sequenceWindow, `generate.ts` legalPlays for
the remainder scan). No server/timing/i18n import. Sole input is the player's own
hand → reveals nothing about other seats. No server round-trip, no game-state,
legality, protocol, redaction, timing or generation change. It REUSES the engine's
classifiers rather than reimplementing rules, so it cannot drift into a second
rules oracle. The single write is the optional client-only "keep this arrangement"
(populates the `ReadonlySet<number>` selection the server never sees), reversible
by the existing one-tap clear; any real play re-flows through
selection→matchSelection→server `validatePlay`, so a finder bug can only
mis-SUGGEST, never mis-play. Policed: annotations stay render-only; "keep this"
never submits a decl directly; the finder never runs server-side or persists.

---

## 7. Owner decisions (SIGNED OFF 2026-07-24)

1. Distinctness diverging from π — **agreed** (§1).
2. Sub-maximal scope: maximal backbone + Pareto-surfaced sub-maximals + reversible
   "keep one fewer" — **agreed** (softest; log the withheld-sub-maximal
   limitation, §2.6).
3. Ranking: Pareto frontier, SF-strength-then-remainder, sort-never-filter, every
   row shows its full remainder — **agreed** (§3).
4. Remainder annotation: engine-computed, CLOSED FACTUAL vocabulary, structural
   guard — **agreed** (§4).
5. Presentation spine (direction): tabbed one-at-a-time + fixed remainder
   scoreboard + chip strip — **agreed as direction** (UI phase; highest-risk, only
   real players validate it).
6. "Keep this": single SF stages a playable bomb; multi-SF is view-only "see it,"
   each SF row independently stageable — **agreed**.
7. Ceiling: structural caps make blowup impossible; any truncation is a DISPLAY
   cap — **agreed framing**.

Three strengthenings: (1) closed factual vocabulary, structural (§4); (2)
zero/one-SF must respond visibly — acknowledge the press ("找過了,這手沒有同花順"),
distinguish looked-none from didn't-look via `found`/`totalFound` (UI phase, the
no-silent-no-op class); (3) the same-groups⟺same-remainder lemma is load-bearing —
independent-Counter complement, twin-heavy sample, subtract by card identity (§5C).

---

## 8. Prior art (panel-sourced 2026-07-24) + null results

- **Rummy (RummyCircle, Games24x7):** two-verb hand organisation — a global one-tap
  Sort/auto-arrange (maps to our `onClearAll`) + a scoped group/bind (maps to
  populating the selection Set); grouping is a cheap bitmask-DP; wilds baked into
  candidate melds. But rummy collapses to ONE optimal grouping and HIDES the rest
  — the algorithm transfers, the presentation does not.
- **Mahjong (Riichi "Ready Hand Info"):** the closest prior art to presenting
  MULTIPLE alternatives on a phone — a per-alternative needs+result line surfaced
  ON DEMAND (tap), compressed. Steal: each arrangement compressed to a
  what-remains line.
- **Wild-as-a-specific-card (MobilityWare joker-swapping):** players already read a
  positional wild as a fixed missing card — validates `resolveComboFaces` (ghost
  face + gold-heart mark, never colour-only).
- **Senior card UIs / BGA Tichu staging:** big cards, few buttons, one arrangement
  at a time; reversible lift-and-stage matches our desk + variant-D decoupling.

**Null results (headlined):** (i) most hands hold 0–1 candidate SFs — the
competition machinery earns its keep only in rare wild/twin one-suit hands; zero-SF
is the common case (returns empty, no nag, but the press is acknowledged). (ii) No
objective best decomposition — the finder informs, cannot decide. (iii) NO card
game presents N competing full-hand decompositions on a phone — the 390px
multi-arrangement view is a genuine gap to be DESIGNED, and "cannot be made clean
at 390px for elders" remains a legitimate UI-phase finding, not a reason to ship
desktop-only. (iv) Even a single near-full-hand decomposition may not fit
one-glance — the honest boundary is "the SF you'd take + a trustworthy one-glance
verdict, full remainder behind a tap."
