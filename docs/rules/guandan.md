# Guandan (掼蛋) — Implementation-Grade Rules Specification

**Version:** 1.4 — 2026-07-14
**Changelog:**
- *v1.4 (M3 hardening, owner mission §1):* wild-disambiguation rules formalized (docs/research/wild-disambiguation.md — suit collapses everywhere except straight flushes; distinct wild rank-assignments that change type or key rank all offered; SF end-positions both offered larger-on-top). §3.8 guard owner-extended: one-suit-NATURALS selections (wilds included) never offer plain-straight readings under the default — supersedes v1.3's wild-policy sentence; §4.4.3/§9.18 examples updated.
- *v1.3 (round-3 owner sign-off):* owner confirmed defaults `aWinPartnerNotLast=true`, `overshootWinsGame=false`, `returnTributeMaxRank=10`, `fullHouseJokerPair=true` (mixed-joker-pair CORE reaffirmed), `jiefengRecipient=partner` (exact condition). Rule change: A-attempt failure consequence generalized to `aFailConsequence: suspendPlayOpponentLevel|demote|none`, owner default `suspendPlayOpponentLevel` — the A-team is never demoted; after `aMaxAttempts` failures its attempt is suspended via a per-team `aAttemptsExhausted` flag and hands are played at the opponents' level (a §1.5 level-selection refinement), resuming at A automatically on the team's next hand win; counter restarts fresh on resumption (`aAttemptCounterReset`, default `fresh`). `aFailDemoteTo` scoped under `demote`. Table: 25 keys.
- *v1.2 (owner round 2 + source verification against the official 竞技掼蛋竞赛规则(试行) text):* tribute/return are **choices over eligible sets** (rank forced, concrete card chosen; `legalActions` surfaces the sets); tribute and return cards **public to all four players** (owner-pinned default); anti-tribute rewritten — condition verified verbatim against official text, **mandatory public reveal** of the qualifying big jokers with holder attribution (and nothing else), `antiTributeAutomatic` → `antiTributeMode: auto|optional` (default `auto`; no source documents a decline flow — null result); `doubleTributeTieAward` → `equalTributeAssignment: seatOrder|random|winnersChoose` (three-way source conflict documented); `doubleTributeTieLead` **removed** (lead = payer whose card 头游 received; unanimous, hard-coded); double-tribute returns revealed simultaneously/atomically; `returnNoLowCardPolicy` fallback now CORE-backed by official text; §10 table gains house-rules-sensitivity tags. Verification report: docs/research/guandan-tribute-verification.md. Post-revision Codex cross-check fixes (4 ambiguities, 0 rule errors): `seatOrder` bound to `turnDirection`; double-tribute payment staging + atomic reveal defined; `returnNoLowCardPolicy: anyCard` semantics scoped to the no-qualifying-card case; `optional`-mode anti-tribute state machine specified.
- *v1.1 (adversarial review):* tribute computed from the newly dealt hand, not leftover cards; generation ranges corrected for sub-multisets and joker guards; joker-bomb template added; §3.8 wild policy defined; demotion timing pinned; return-tribute rule unified as `levelValue ≤ 10`; two new config keys.
**Purpose:** Single source of truth for a pure rules engine (state machine + move validation + legal-move generation + scoring). No UI/network concerns except where visibility rules affect the engine API.
**Baseline ruleset:** Jiangsu/Huai'an official competitive rules (国家体育总局/江苏掼蛋竞赛规则 lineage), with common online-platform conventions (JJ/QQ-style) as defaults where the official text is silent. Every rule is tagged **CORE** (universal), **VARIANT** (must be a `RuleVariant` config key, see §10), or **UNCERTAIN** (sources disagree or unverified; a default is still chosen and flagged).

---

## 0. Notation & Data Model

- **Players:** `P0, P1, P2, P3` seated in order. Teams: `{P0, P2}` and `{P1, P3}` (partners sit across). **CORE**
- **Turn direction:** play proceeds to the next seat in a fixed rotation. Chinese play is traditionally counter-clockwise; online implementations vary and it has no logical effect except on tie-break rules that reference "next player" (下家). **VARIANT** `turnDirection`, default `counterclockwise`. **UNCERTAIN** (sources rarely state it explicitly; pick one and be consistent — "下家" below always means "next player in turn direction").
- **Natural ranks:** `2,3,4,5,6,7,8,9,10,J,Q,K,A` encoded `2..14` (A=14), plus `SJ` (small/black joker) and `BJ` (big/red joker). Suits: `♠ ♥ ♣ ♦`. Jokers have no suit.
- **Level (打几):** a rank in `2..A` per team.
- **Two orderings** (critical — implement both):
  - `levelValue(rank, level)`: used for singles, pairs, triples, full-house triples, bomb ranks. `= 15` if `rank == level`; else the natural value `2..14`; `SJ = 16`, `BJ = 17`. So: `2 < 3 < … < A < levelCard < SJ < BJ` (with the level rank removed from its natural slot). **CORE**
  - `naturalValue(rank)`: used **only** inside straights, straight flushes, tubes, plates. `2..14`, and `A` may additionally count as `1` (low). The level card has **no elevation** inside sequences — it occupies only its natural position. **CORE**
- **Wild card (逢人配 / 配牌):** exactly the two cards `(♥, currentLevelRank)`. See §4.
- **Move:** `{playerId, type: PLAY|PASS, cards: multiset, decl: {comboType, size, keyRank, suit?}}`. Because wilds create ambiguity, a PLAY is identified by cards **plus** a declared interpretation (§4.4).

---

## 1. Setup

1. **Deck:** two standard 54-card decks shuffled together = **108 cards**: 8 copies of each rank 2–A (2 per suit), 2 small jokers, 2 big jokers. **CORE**
2. **Players/teams:** 4 players, fixed partnerships across the table. **CORE**
3. **Deal:** all 108 cards dealt out, **27 per player**. Physical dealing procedure (one at a time, cut, etc.) is irrelevant to the engine; deal uniformly at random. **CORE**
4. **Team levels:** each team has a level, starting at **2**. **CORE** (VARIANT `levelTrack = shared` exists where both teams climb a single shared ladder — casual only; default `perTeam`.)
5. **Current level of a hand (该局打几):** the level of the team whose member was **头游 (1st finisher) of the previous hand** — i.e., the "declarer" team plays *their* level. For the **first hand**, the current level is **2**. **CORE**
   - Level upgrades from the previous hand apply *before* determining the next hand's current level (e.g., team at 2 scores +3 → they are now 5 → next hand is played "at 5").
   - **Refinement under `aFailConsequence = 'suspendPlayOpponentLevel'` (round 3):** if the declaring team's `aAttemptsExhausted` flag is set (§6.4), the hand is played at the *opposing* team's current level instead of the declarer's A. The flag's lifecycle (set on exhaustion, cleared on the team's next hand win) is defined in §6.4; when it clears, this rule reduces to plain §1.5.
6. The current level determines: (a) which rank is elevated in `levelValue`, (b) which two heart cards are wild, for **both** teams during that hand. There is only ever one current level per hand. **CORE**

---

## 2. Card Ranking & the Level Card

1. **Single-card order** (by `levelValue`): `2 < 3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A < [level card] < SJ < BJ`, with the level rank absent from its natural slot. Example, level = 10: `2<3<4<5<6<7<8<9<J<Q<K<A<10<SJ<BJ`. **CORE**
2. **Jokers:** big joker > small joker > everything. Jokers form: singles, pairs (SJ+SJ or BJ+BJ only — mixed SJ+BJ is *not* a pair), the pair component of a full house (see §9), and the four-joker bomb. Jokers can never appear in straights, tubes, plates, straight flushes, or rank-bombs, and can never be represented by a wild. **CORE**
3. **Suits:** suits are relevant **only** for (a) deciding whether 5 consecutive cards form a straight flush, and (b) identifying the wild cards (hearts of level rank). Suits **never** break ties: an equal-rank play does not beat the previous play. **CORE**
4. **Level card inside sequences:** in straights / straight flushes / tubes / plates the level card counts **only at its natural position** (e.g., level = Q: `10-J-Q-K-A` is a valid straight and the Q is just a Q; `Q` does *not* sit above A there). Its elevated status applies only to non-sequence comparisons. **CORE**
5. **A duality:** Ace counts high (14) or low (1) in sequences: `A-2-3-4-5` (lowest straight) and `10-J-Q-K-A` (highest) are both legal; no wrap-around (`Q-K-A-2-3` illegal). Likewise `AA2233` / `QQKKAA` tubes and `AAA222` / `KKKAAA` plates. **CORE**

---

## 3. Combination Types

All comparisons are **strictly greater** — equal never beats. A play beats the previous play iff (same `comboType` AND same card count AND strictly higher key) OR (it is a bomb that outranks the previous play per §3.11).

| # | Type | Cards | Definition | Key for comparison |
|---|------|-------|------------|--------------------|
| 1 | Single (单张) | 1 | any card | `levelValue` |
| 2 | Pair (对子) | 2 | two equal ranks (incl. SJ+SJ, BJ+BJ) | `levelValue` |
| 3 | Triple (三张) | 3 | three equal ranks (jokers impossible) | `levelValue` |
| 4 | Full house (三带二) | 5 | triple + pair, different ranks | `levelValue` of the **triple only**; pair irrelevant to comparison **CORE** |
| 5 | Straight (顺子) | **exactly 5** | 5 consecutive natural ranks, mixed suits, no jokers | `naturalValue` of top card (A-low straight has top = 5) |
| 6 | Tube (三连对 / 木板) | 6 | 3 consecutive pairs (e.g., `445566`), no jokers | `naturalValue` of top pair (`AA2233` top = 3; lowest) |
| 7 | Plate (钢板 / 二连三) | 6 | 2 consecutive triples (e.g., `555666`), no jokers | `naturalValue` of top triple (`AAA222` top = 2; lowest) |
| 8 | Bomb (炸弹) | 4–10 | n cards of one rank, n ≥ 4 (jokers excluded) | (count, `levelValue`) — see §3.11 |
| 9 | Straight flush (同花顺 / 火箭) | 5 | straight, all one suit | `naturalValue` of top card; is a **bomb** for beating purposes |
| 10 | Joker bomb (四大天王 / 天王炸) | 4 | exactly SJ,SJ,BJ,BJ | unique; highest |

Notes:

- **3.1** Straights are exactly 5 cards — never 6+. **CORE**
- **3.2** Tubes/plates: A-low forms use A as rank 1 (so `AA2233` is the *lowest* tube, `AAA222` the *lowest* plate). No wrap. **CORE**
- **3.3** Maximum bomb size is **10**: 8 natural copies of a non-level rank + 2 wilds. For the level rank itself the max is 8 (the wilds *are* two of its copies). The engine must support n = 4..10. **CORE**
- **3.4** A bomb whose rank is the level rank beats any same-size bomb of another rank (`levelValue` = 15). **CORE**
- **3.5** Full house: triple part can be the level rank (then it beats an Aces-up full house). Triple can never be jokers (only 2 of each exist and wilds can't be jokers). Pair part being a joker pair (e.g., `999 + SJ SJ`): allowed by common rulings. **UNCERTAIN** (rarely addressed explicitly); default **allowed**, config `fullHouseJokerPair` (VARIANT; owner-confirmed `true`, round 3 — with the §2.2 CORE invariant reaffirmed: a joker pair is only SJ+SJ or BJ+BJ, and a mixed SJ+BJ is never a pair, in any combination, anywhere).
- **3.6** Five equal cards may **not** be declared as a full house (triple+pair of the same rank) — they are a 5-bomb. Default **reject**; **VARIANT** `fiveOfKindAsFullHouse = false`. (**UNCERTAIN**; virtually all platforms reject.)
- **3.7** Straight flush with wild(s) still **counts as a straight flush** (bomb rank preserved). **CORE** per official 逢人配 rules; minor house variants demote it to a plain straight — config `wildStraightFlushIsBomb`, default `true`.
- **3.8** Five suited consecutive cards are inherently a straight flush. Whether the player may *under-declare* them as a plain straight (to beat a straight without spending bomb status): **UNCERTAIN / VARIANT** `allowUnderDeclareStraightFlush`, default `false` (auto-classified as straight flush, matching major platforms).
- **3.9** Non-bomb combos can only be beaten by (i) the same type & count with strictly higher key, or (ii) any bomb (incl. straight flush, joker bomb). A single BJ is still beaten by any bomb. **CORE**
- **3.10** Bombs beat every non-bomb regardless of the non-bomb's type. **CORE**
- **3.11** **Bomb hierarchy** (ascending) — verified against official rules and Wikipedia/pagat:

  ```
  4-bomb < 5-bomb < STRAIGHT FLUSH < 6-bomb < 7-bomb < 8-bomb < 9-bomb < 10-bomb < JOKER BOMB
  ```

  - Within the same size: compare rank (`levelValue` for rank-bombs; `naturalValue` of top card for straight flushes).
  - Straight flush sits **strictly between 5-card and 6-card bombs**. **CORE** (confirmed).
  - **Joker bomb beats everything, including the 10-card bomb.** **CORE** (official). Rare house rules let 8+-bombs beat it: config `jokerBombSupreme`, default `true` (VARIANT).

---

## 4. Wild Card 逢人配 — Definition, Semantics, and the Validation Problem

### 4.1 Definition & substitution power — **CORE**

- The wilds are the **two ♥ cards of the current level rank** (e.g., level 7 → both `7♥`). Exactly 2 wilds exist per hand.
- A wild may substitute for **any card in the deck except the two jokers** — any rank 2–A, **any suit** (suit choice only matters in straight flushes; a wild may represent a card of any suit, including a suit other than hearts).
- A wild may also be played **as itself** (a natural heart level card): e.g., inside a level-rank bomb, or at its natural position in a hearts straight flush.
- **Both wilds may be used in the same combination** (e.g., `K K + wild + wild` = 4-bomb of Kings; two wilds completing a straight flush). **CORE**
- Wilds can never represent a joker, never join the joker bomb, and never make a joker pair/triple. **CORE**

### 4.2 Unassigned / standalone value — **CORE**

- A wild played as a **single**, or two wilds as a **pair**, count as **level-rank cards** (`levelValue = 15`, above A, below SJ). The engine should treat this deterministically: standalone wild(s) *are* level cards; declaring them as some lower rank is pointless and disallowed by default (config `allowWildUnderDeclare`, default `false`, VARIANT — no known platform allows it).
- A wild paired with a natural level card = pair of level cards (natural interpretation, not substitution — identical result).

### 4.3 Wilds and tribute — **CORE** (confirmed)

- Wilds are **excluded** when computing the forced tribute card ("highest card **excluding the heart level card**") and may **not** be chosen as tribute. Note the **non-heart** level cards are *not* excluded — a `♠levelRank` card is elevated and can be the forced tribute.
- Wilds cannot be the return-tribute card under the ≤10 rule (their `levelValue` is 15, always > 10 — see §7.4's `levelValue ≤ 10` formulation). Under the "any card" return variant they could be returned — but no sane engine default allows it; tie this to `returnTributeMaxRank`.

### 4.4 The validation problem (hardest engine part)

**Problem V (validate):** given a multiset `S` of selected cards containing `w ∈ {0,1,2}` wilds, and a declared interpretation `(comboType, keyRank, suit?)` — decide validity.

**Problem G (generate):** enumerate all legal plays from a 27-card hand that beat a given prior play (or all leads).

**Why it's hard naively:** each wild can be any of 13 ranks × 4 suits = 52 identities → up to 52² = 2704 assignments per candidate set, and hands have thousands of candidate subsets.

**Recommended approach — template matching, not wild enumeration:**

1. **Canonicalize:** represent a play as `(type, size, keyRank, suit?)`. Two plays with identical canonical form are the same move for legality purposes; concrete card multisets are only needed for hand bookkeeping.
2. **Validate (V):** for the declared `(type, keyRank, suit?)`, construct the **required multiset** of card identities:
   - Suit-blind types (everything except straight flush): required multiset is over **ranks only**. Strip wilds from `S`; check `ranks(S \ wilds) ⊆ required` (multiset inclusion) and `|required| − |S \ wilds| == w` and no missing identity is a joker. Done. Wild assignment is implicit — never enumerate suits.
   - Straight flush: required multiset is over (rank, suit) pairs for the declared suit and 5-rank window; same inclusion test. Wilds fill missing (rank, suit) slots — a wild may fill any slot.
   - Special checks: standalone wilds rule (§4.2) — if `type ∈ {single, pair}` and `S` is all wilds, `keyRank` must be the level rank; joker-containing types per §2.2; §3.6 five-of-a-kind guard; **§3.8 guard (owner-extended, M3 hardening)** — if `type = straight` and the selection's NATURAL (non-wild) cards are all one suit, reject under default `allowUnderDeclareStraightFlush = false` (the set must be declared as a straight flush): wilds do NOT open an off-suit escape — they read into the run's suit, so a one-suit-naturals wild-completed set offers only its straight-flush readings (larger-on-top per the disambiguation ordering). Mixed-suit naturals may still declare a plain straight. *(Supersedes the v1.3 wild-policy sentence; owner-pinned in the M3-hardening mission §1; see docs/research/wild-disambiguation.md.)*
3. **Generate (G):** iterate over **templates**, not subsets:
   - Let `c(r)` = count of natural cards of rank `r` in hand, `w` = wilds held (a wild counts toward `c(level)` too when used naturally — handle by treating wilds as a separate pool and `c(level)` as non-heart-level + naturally-played hearts; simplest: pool wilds separately and allow them to fill *any* slot including level-rank slots).
   - Singles/pairs/triples/bombs: for each rank `r` (13 ranks + jokers for single/pair) and each **needed size** `k` (1, 2, 3; bombs 4..10): feasible iff `max(0, k − c(r)) ≤ w_r`, where `w_r = w` for ordinary ranks and `w_r = 0` for joker ranks (wilds never represent jokers, §4.1). A play may use any sub-multiset of the copies held — holding `c(K)=3` yields the triple, the pair, *and* the single of Kings. No jokers in bombs.
   - Joker bomb: emit `JOKER_BOMB` iff the hand contains all four jokers `{SJ,SJ,BJ,BJ}` (wilds never contribute).
   - Straights: 10 windows (`A-5` … `10-A`); valid iff `Σ_r∈window max(0, need(r) − c(r)) ≤ w` where `need = 1`. Straight flush: 10 windows × 4 suits with per-(rank,suit) counts, `need = 1`.
   - Tubes: 12 windows of 3 consecutive ranks, `need = 2`. Plates: 13 windows of 2 consecutive ranks, `need = 3`. (A counts at both ends.)
   - Full houses: for each triple rank `t`, pair rank `p ≠ t`: feasible iff wilds can cover deficits: `max(0,3−c(t)) + max(0,2−c(p)) ≤ w` — except when `p` is a joker rank: wilds cannot fill joker slots, so require `c(p) ≥ 2` outright (jokers usable only as the pair, per config).
   - **Canonical form** is `(type, size, keyRank, suit)` with `suit` present **only for straight flushes**: SF validation requires the declared suit, while beat-comparison ignores it (§2.3). For generation, **dedupe by the suit-blind projection** `(type, size, keyRank, isSF)` — e.g., `3♠4♠5♠6♠ + wild` yields SF-top-7 *and* SF-top-6 (wild as 2♠) — and, per the owner-extended §3.8 guard, NO plain-straight readings (one-suit naturals); a mixed-suit selection yields the plain straights only; emit each distinct projection once. When beating a prior play, filter by the beats-relation first, which prunes most templates.
   - Prefer wild-frugal concrete realizations (use wilds only where a natural card is missing) when the engine must pick actual cards; the choice among equally-valid realizations is strategically irrelevant to legality.
4. **Ambiguity policy:** a PLAY message must carry the declared canonical form (or the engine auto-picks per a documented policy — recommended: require declaration whenever ≥2 canonical forms exist for the selected cards, since the choice changes what opponents must beat). **Engine requirement, CORE by construction.**

Complexity: ≤ ~15 + 10 + 40 + 12 + 13 + 156 templates per type family — trivially fast; wild suit assignments are only ever enumerated for straight flushes (and even there per-window, not combinatorially).

---

## 5. Trick / Turn Mechanics

1. **First lead of the match:** **VARIANT** `firstLeadMethod`: `random` (online default), `drawCard` (offline: a card is drawn/turned up during the deal; the player who receives it leads — pagat), or `fixedSeat`. Default `random`. Subsequent hands: lead is determined by tribute rules (§7.5) or by 头游 on 抗贡/no-tribute.
2. **Leading:** the leader plays any single legal combination. **Passing while holding the lead is illegal.** **CORE**
3. **Following:** in turn order, each player either **passes** or plays a combination that beats the current top play (§3). Passing is always allowed when not leading, even if able to beat ("no forced play"). A player who passed earlier in a trick may still play when the turn returns to them. **CORE**
4. **Finished players** (empty hands) are **skipped** entirely; their skip is not a "pass". **CORE**
5. **Trick end:** the trick ends when the turn would return to the player who made the current top play — i.e., **all other active players have passed consecutively** after it (3 passes with 4 active players; fewer as players finish). That player leads the next trick. **CORE**
6. **接风 (jiefeng, "receiving the wind"):** if the trick winner **emptied their hand with that winning play** (nobody beat their final cards), the lead for the next trick passes to their **partner** — confirmed (Wikipedia: "if the player who made the last discard now has no cards, the lead moves to their partner"). **CORE**. Rare house variant gives it to the next player: config `jiefengRecipient`, default `partner` (owner-confirmed, round 3 — including the exact condition below: 接风 fires only when the winner emptied their hand with the winning final play; a beaten final play means no 接风).
   - Exact condition: (a) player P plays their last cards, (b) that play wins the trick (all others pass / no one beats it). If P's final play is beaten, no 接风 — normal rules continue and P is simply skipped thereafter.
   - The partner is always still active when 接风 fires: if P's partner had already finished, P's finish makes P either the **2nd** finisher (teammates 1st+2nd, 双上) or the **3rd** finisher — in both cases the hand ends immediately per §5.8, before any lead is needed. Engine may assert this invariant.
7. **Finishing order terminology:** 头游 (1st out), 二游 (2nd), 三游 (3rd), 末游 (4th / "Dweller"). **CORE**
8. **Hand end:** immediately when the 1st and 2nd finishers are teammates (双上; remaining play is moot), otherwise immediately when the 3rd player finishes (the remaining player is 末游; their leftover cards have **no further rules significance** — they only fix the finishing order and are shuffled into the next deal; tribute is computed from the **newly dealt** hand, §7.2/§9.19). Hand may therefore end mid-trick. **CORE**

---

## 6. Hand Scoring & Level Upgrade

1. **Result classes** (by the winning team = 头游's team):
   - Partner finished **2nd** (双上 / "1-2"): **+3 levels**. Hand ends the moment the 2nd teammate goes out.
   - Partner finished **3rd** ("1-3"): **+2 levels**.
   - Partner finished **4th** ("1-4" / 单上): **+1 level**.
   **CORE**
2. **Only the winning team's level moves**; the losing team's level is unchanged. **CORE** (VARIANT `levelTrack = shared`: one shared ladder both teams sit on, moved by the winner — casual variant; default `perTeam`.)
3. Levels are capped at **A**; a team at A gains no further levels — they must **pass A** to win the match (below). Upgrades that would overshoot A stop at A (e.g., K +3 → A). **CORE** (some casual rules let Q+3 or K+2 "skip" A and win outright — **VARIANT** `overshootWinsGame`, default `false` — owner-confirmed, round 3).
4. **Winning the match at level A (过A / 打A):**
   - A team can attempt A only in a hand **played at their level A** — i.e., they are the current-level ("declarer") team (§1.5). **CORE**
   - **Win condition (default):** their player is 头游 **and their partner is not 末游** — i.e., a 1-2 or 1-3 result. A 1-4 result does **not** win the match (and grants no level, since A is the cap). **CORE per official/pagat**; casual variant: any 头游 at A wins — config `aWinPartnerNotLast`, default `true` (owner-confirmed, round 3).
   - **Failed attempts & consequence — VARIANT (`aFailConsequence`, owner default `suspendPlayOpponentLevel`, round 3):** an "attempt" = any hand in which the team is the declarer at level A and does not achieve the win condition (includes 1-4 results and outright losses of that hand). Hands where the team sits at A but the *opponents* declare do **not** consume attempts (default; config `aAttemptOnlyAsDeclarer = true`). After `aMaxAttempts` (default **3**) failed attempts, the consequence is one of:
     - `suspendPlayOpponentLevel` (**owner house rule, default**): the team is **never demoted**; its level stays at **A** throughout. The A-attempt is *suspended*: an explicit per-team `aAttemptsExhausted` flag is set in state, and while it is set the level-selection function (§1.5 refinement) plays hands at the **opponents' current level** — including hands the exhausted team itself declares (the one case plain §1.5 would differ). The flag clears at the end of the first hand the exhausted team **wins** after the exhausting hand; the following hand then plays at the winner's level per plain §1.5 — which is still A — so the team resumes attempting A automatically. There is no separate resumption trigger or parallel state machine: suspension only governs *which level this hand is played at* (and therefore which cards are wild, §1.6). Sub-decision: on resumption the attempt counter restarts **fresh** (owner intent; sub-config `aAttemptCounterReset: 'fresh' | 'cumulative'`, default `fresh`).
     - `demote`: the classic variant — the team is demoted to `aFailDemoteTo` (default `level2`; other seen values: `stayAtA`, `levelJ`). Demotion, like upgrades (§1.5), applies immediately at hand end, before determining the next hand's current level.
     - `none`: attempts are counted but carry no consequence (the team keeps attempting whenever it declares).

     **UNCERTAIN** across regions in the details; every knob is config. Research note (2026-07-13, [docs/research/afail-consequence-research.md](../research/afail-consequence-research.md)): the exact suspend-and-resume combination is **not documented anywhere as a named variant (clean null result)**; closest analogues are the 联众/Ourgame room toggle 「三次不过A…继续打A不会降级」 (unlimited re-attempts, no demotion — but no opponents'-level suspension) and pagat's David Wu variant (one-time demotion *to* the opponents' level after the 3rd failure). Note also that for a *single* failure where the A-team loses the hand, playing at the opponents' level is just plain §1.5 — the owner rule's distinctive behavior is (a) never demoting and (b) the declared-hand override immediately after a 1-4-style exhaustion. Tag: **house VARIANT, owner-specified**.
   - Obscure pagat variant (record only, default off): declarers at A are immediately demoted to 2 if an opponent wins the hand with a final play consisting entirely of Aces — config `aceFinishDemotes`, default `false`. **VARIANT**
5. Match end: a team fulfills the A win condition → match over. Engine should also expose optional external stop conditions (round/time limits used in tournaments) as out-of-scope hooks.

---

## 7. Tribute (进贡 / 还贡 / 抗贡)

Applies from the second hand onward, based on the previous hand's finishing order. Sequence each hand: **deal → tribute → return → determine leader → play**.

1. **Who pays — CORE:**
   - Previous result **1-2** (losers took 3rd & 4th, "double loss / 双下"): **both losers pay one card each** (双贡). The **头游 receives the higher-ranked** of the two tribute cards; **二游 receives the lower**. (Mapping is by card rank, not by seat.)
   - Previous result **1-3 or 1-4** (单贡): the **末游 pays one card to 头游**. Note in a 1-4 result the 末游 is the 头游's **own partner** and still pays (confirmed by pagat).
2. **Tribute card — CORE (confirmed):** the payer's **highest rank by `levelValue`, excluding the heart level wild(s)** (wilds may never be tributed). The **rank is forced; the concrete card is the payer's CHOICE** whenever several held cards share that highest rank — suit choice is strategic (e.g. keeping a suit for a potential straight flush). Engine contract: `legalActions` returns the exact eligible set (every held card at the forced rank), and `applyAction(payTribute{card})` validates membership in that set — never equality to one precomputed card. A big joker can be a tribute card (if the payer holds exactly one). Non-heart level cards are *not* exempt and are often the forced rank. The level used is the **new current level** of the upcoming hand — **UNCERTAIN/VARIANT** hair-split, config `tributeLevelBasis`, default `upcomingLevel`: "highest" is evaluated with the upcoming hand's level elevation and its wilds excluded (standard, since the wild is defined by the current hand's level).
3. **Equal double tributes — VARIANT (genuine three-way cross-source conflict, source-verified 2026-07-13):** if the two tribute cards have equal rank, the assignment differs by source — official trial rules 「若牌点相同，则按顺时针方向进贡」; 唐人游/JJ allocate **randomly**; pagat: the **winners choose**. Config `equalTributeAssignment`: `seatOrder` (default, official) / `random` / `winnersChoose`.
   - **Engine definition of `seatOrder`:** the 头游 receives the card from the payer encountered first from 头游 **in turn direction** (i.e. 头游's 下家 among the two payers) — bound to `turnDirection`, **not** to absolute clockwise. The official text's literal 顺时针 is read as naming that ruleset's own turn direction (**UNCERTAIN** hair-split; it only matters if `turnDirection` is flipped, and it is one comparison in one function either way).
   - **Staging (both payments and both returns):** each payer/returner commits without seeing the other's card. The engine holds the first committed `payTribute` privately — it may emit a card-less `tributeCommitted{seat}` marker (mirroring the visible face-down handover) but no card — and once both are in, performs the assignment and emits both `tributePaid` events **atomically**; the two `tributeReturned` events are likewise atomic (official simultaneity device: 「两位进贡者同时亮牌」). No sequential information leak within either phase.
4. **Return tribute (还贡) — CORE (official, confirmed):** each tribute receiver returns exactly one card with **`levelValue ≤ 10`** — a single formulation that is exactly equivalent to "natural rank 2–10 and not the current level rank; never jokers, level cards, or A/K/Q/J" — to the payer they received from (in double tribute the return follows the pairing established in §7.1/§7.3). Receiver **chooses freely among all qualifying cards** — a choice over a set, exactly like tribute payment; `legalActions` surfaces the eligible set for UI hinting and `applyAction` validates membership. **VARIANT** `returnTributeMaxRank`: default `10` (owner-confirmed, round 3; interpreted as `levelValue ≤ 10` — corroborated: a competitive explainer states that at level 10 the return must be ≤9, i.e. the current level card is not returnable even at face ≤10); pagat/Western variant `null` (any card, must merely differ from the tribute card). Edge case: if the receiver holds no qualifying card, the **official rules pin the fallback** — 「如全手牌均大于10，则还最小的牌」 (return the smallest card): config `returnNoLowCardPolicy`, default `lowestByLevelValue`, now **CORE-backed** rather than UNCERTAIN. The `anyCard` alternative is defined **only for this no-qualifying-card case**: a house-rule fallback where the receiver instead returns any card of their choice from the full hand.
5. **Who leads the new hand — mostly CORE, confirmed:**
   - Single tribute: the **tribute payer (末游) leads**.
   - Double tribute: **the payer whose tribute card the 头游 received leads** — one rule covering both the unequal case (the higher tribute goes to 头游, so its payer leads) and the equal case (whoever's card was assigned to 头游 under `equalTributeAssignment` leads). **CORE, hard-coded** (official: 「均由进贡给上游者首圈领出牌」, unanimous across Chinese sources; pagat's fringe "payers agree who leads" is documented here but not implemented — the former `doubleTributeTieLead` config is removed as derivable).
   - No tribute owed (抗贡, or first hand): 头游 of the previous hand leads (first hand: §5.1).
6. **Anti-tribute (抗贡) — CORE (verified against the official trial rules, 2026-07-13):**
   - Condition: single tribute — cancelled iff the payer holds **both big jokers**; double tribute — cancelled (for **both** payers) iff the two payers **together** hold both big jokers (one each, or one holding both). Official: 「下游或双下方在进贡前抓到两个大王，则抗贡，不再贡牌，首圈由上游领出牌」. Computed from the **newly dealt** hands (§9.19) by the engine, which holds authoritative state.
   - Effect: no tribute, no return, and the previous hand's **头游 leads**.
   - **Mandatory public reveal (owner-pinned, round 2):** the qualifying big jokers are revealed to **all four players with holder attribution** (which player holds which joker) so everyone sees why tribute was skipped — and **nothing else** from those hands is shown. Matches physical play (showing the jokers is how entitlement is proven) and platform practice (JJ/唐人游 display them in the UI: 「抗贡的大王需在界面上亮出」). Engine: emit a public `antiTribute{reveals:[{seat,card}]}` event; `viewEvent` returns it whole to every seat. **UNCERTAIN** only in the narrow sense that the retrieved official clause text does not spell out the reveal step; the reveal itself is required behavior here in every mode.
   - Invocation: **automatic/mandatory upon the condition** — every source found states it declaratively; targeted searches for a decline flow (放弃抗贡 / 可以不抗贡) found none (null result), and declining is strategically dominated (it would surrender a big joker). **VARIANT** `antiTributeMode`: `auto` (default) / `optional` (future-proofing only; no known platform implements it). The public reveal always accompanies **invocation**, in either mode.
   - **`optional`-mode state machine (engine-defined — UNCERTAIN by construction, no platform reference exists):** after the deal, if the condition holds, the qualifying payer(s) act *before* any tribute is paid via `{type:'antiTributeDecision', invoke}`; **nothing is revealed while deciding**. Double tribute with one big joker each: invoking requires **both** payers to opt in (both must reveal); a single holder of both jokers decides alone. Invoked → the standard public reveal fires, no tribute/return, previous 头游 leads. Declined (or not unanimously invoked) → nothing is revealed and the normal tribute flow proceeds. `defaultAction` for the decision = `invoke` (mirrors `auto`; preserves the liveness obligation on timeout).
7. **Visibility — owner-pinned default (round 2):** both the tributed card and the returned card are **public to all four players** (played face-up), matching the physical game. **VARIANT** `tributeVisibility`: `public` (default, pinned) / `returnHidden` (some online rooms hide the return card from the two uninvolved players — retained as config only).

---

## 8. Reporting (报牌) & Table Talk

1. **Card-count visibility — VARIANT** `cardCountVisibility`:
   - `always` — every player's remaining count is always visible (universal online default; engine default).
   - `onRequestLE10` — official offline rule: a player holding **≤ 10 cards must answer truthfully when asked** how many they hold (confirmed via pagat).
   - `onRequestLE6` — documented minor variant.
2. Engine implication: expose `visibleCardCount(viewer, target)` driven by this config; the engine itself always knows true counts.
3. **Table talk:** no signaling, no revealing hand contents, partners may not coordinate beyond legal plays. Not engine-enforceable; relevant to UI/chat policy only. Tribute/return cards and 抗贡 joker reveals are the only sanctioned information leaks. **CORE** (as a policy statement).

---

## 9. Engine Edge-Cases Checklist

1. **Last play must be one legal combination** — a player's final cards must themselves form a single valid combo; there is no "dump the remainder" rule. If a player's last cards can't beat/lead legally, they simply can't play them at that moment. **CORE**
2. **Cannot pass when leading.** **CORE**
3. **Hand may end mid-trick** (3rd finisher, or teammates 1st+2nd) — abort the trick immediately; the 末游's leftover cards matter only for fixing the finishing order (tribute uses the next hand's fresh deal, §7.2/§9.19). **CORE**
4. **接风 invariant:** the finisher's partner is always active when 接风 fires (proof in §5.6); assert it.
5. **Four jokers & tribute:** tribute is a single card, so a joker bomb is never "paid"; one big joker can be paid; both big jokers in the payer set ⇒ 抗贡 (§7.6).
6. **Level card in full house:** triple of level rank beats triple of A (levelValue 15); the pair never matters; a wild can complete either part.
7. **Pair of two wilds** = pair of level cards (levelValue 15) — beats pair of Aces, loses to SJ pair. Deterministic; no under-declaration (§4.2).
8. **A-high vs level-high straights:** `10-J-Q-K-A` is the top straight; the level card never elevates in sequences. Level = Q ⇒ Q is natural in `10-J-Q-K-A`. `A-2-3-4-5` has key 5 (lowest). Same for straight flush comparison.
9. **A-low sequences:** in `A-2-3-4-5` / `AA2233` / `AAA222`, A = 1; these are the lowest of their families; no wrap-around anywhere.
10. **Level rank inside sequences at level = 2 or A:** level 2 → `A-2-3-4-5` still valid (2 natural); level A → `10-J-Q-K-A` valid (A natural high) and `A-2-3-4-5` valid (A natural low).
11. **Wild-as-itself:** a heart level card may be played natural — e.g., 8 copies of level rank (incl. both hearts) = 8-bomb; hearts SF through the level rank's natural slot.
12. **Wild completing SF** keeps SF bomb status (§3.7); wild may represent any suit's card, not just hearts.
13. **Wild representing the "other" heart level card** (e.g., in a hearts SF window containing the level rank) is legal — substitution targets any non-joker card identity, even one whose physical copies include the wilds themselves.
14. **Ten-card bomb** exists only for non-level ranks (8 naturals + 2 wilds); level-rank bombs cap at 8. Enforce via counts, not a special rule.
15. **Mixed joker "pair" (SJ+BJ) invalid**; joker triples/bombs-of-jokers other than the exact 4-joker set invalid (e.g., SJ,SJ,BJ is nothing; SJ,SJ,BJ,BJ only as joker bomb, and 3 jokers is never a combo).
16. **Equal never beats** — including equal-top straight flushes of different suits.
17. **Passing then playing later in the same trick** is legal when the turn returns (§5.3); beating your **partner** is legal.
18. **Ambiguous selections** (wilds): require declared canonical form when ≥ 2 interpretations exist (§4.4.4) — e.g., `2♠3♠4♠5♠+wild` = SF-6♠ / SF-A-low (larger-on-top; plain-straight readings barred for one-suit naturals per the owner-extended §3.8); the declaration binds what followers must beat.
19. **Tribute forced-rank computation** must exclude wilds but include non-heart level cards and single jokers; run it — and the 抗贡 big-joker check (§7.6) — on the payer's **newly dealt 27-card hand**, after the deal and before any play. The previous hand's leftover cards are never consulted. The result is a *rank*; the payer chooses which concrete card of that rank to give (§7.2).
20. **Return card** must satisfy `levelValue ≤ 10` (§7.4), which excludes wilds, level cards, and jokers **by construction**; the no-qualifying-card corner is governed by `returnNoLowCardPolicy` (§7.4).
21. **First trick after tribute:** the leader is *not* required to lead the tribute card or any particular card (pagat's face-up-card note applies only to the offline first-deal draw and is optional).
22. **Skipped seats and pass counting:** implement trick end as "turn returns to the top-play owner" rather than counting literal 3 passes — this is correct for all active-player counts (4 → 2).

---

## 10. RuleVariant Config Table

Default profile: **`JIANGSU_OFFICIAL_ONLINE`** — Jiangsu/Huai'an official rules where they speak, most-common online (JJ-style) conventions where they don't. Round-2 owner pins: `tributeVisibility = public`; anti-tribute = both-big-jokers-on-the-tributing-side with mandatory public reveal; tribute/return = player choices over eligible sets. Round-3 owner decisions: **confirmed** `aWinPartnerNotLast=true`, `overshootWinsGame=false`, `returnTributeMaxRank=10`, `fullHouseJokerPair=true` (mixed SJ+BJ never a pair — CORE reaffirmed), `jiefengRecipient=partner` (exact §5.6 condition); **changed** A-attempt failure to `aFailConsequence=suspendPlayOpponentLevel` (never demote — suspend, play the opponents' level, resume automatically on the team's next hand win).

**HR?** = house-rules-sensitive: ✓ = families/tables commonly differ — worth confirming against how your table plays; — = technical/corner detail or source-pinned, unlikely to need changing.

| Key | Type | Allowed values | Default | HR? | Section |
|---|---|---|---|---|---|
| `turnDirection` | enum | `counterclockwise`, `clockwise` | `counterclockwise` | — | §0 |
| `firstLeadMethod` | enum | `random`, `drawCard`, `fixedSeat` | `random` | ✓ | §5.1 |
| `levelTrack` | enum | `perTeam`, `shared` | `perTeam` | ✓ | §6.2 |
| `overshootWinsGame` | bool | true/false | `false` | ✓ | §6.3 |
| `aWinPartnerNotLast` | bool | true/false | `true` | ✓ | §6.4 |
| `aMaxAttempts` | int? | 1..∞, `null` (unlimited) | `3` | ✓ | §6.4 |
| `aFailConsequence` | enum | `suspendPlayOpponentLevel`, `demote`, `none` | `suspendPlayOpponentLevel` (owner-pinned) | ✓ | §6.4 |
| `aFailDemoteTo` | enum | `level2`, `stayAtA`, `levelJ` — scoped under `aFailConsequence='demote'` only | `level2` | ✓ | §6.4 |
| `aAttemptCounterReset` | enum | `fresh`, `cumulative` | `fresh` (owner intent) | — | §6.4 |
| `aAttemptOnlyAsDeclarer` | bool | true/false | `true` | ✓ | §6.4 |
| `aceFinishDemotes` | bool | true/false | `false` | — | §6.4 |
| `returnTributeMaxRank` | int? | `10` (as `levelValue ≤ 10`), `null` (any card ≠ tribute card) | `10` | ✓ | §7.4 |
| `returnNoLowCardPolicy` | enum | `lowestByLevelValue`, `anyCard` | `lowestByLevelValue` (official-backed) | — | §7.4 |
| `tributeLevelBasis` | enum | `upcomingLevel`, `previousLevel` | `upcomingLevel` | — | §7.2 |
| `equalTributeAssignment` | enum | `seatOrder` (official), `random` (唐人游/JJ), `winnersChoose` (pagat) | `seatOrder` | ✓ | §7.3 |
| `antiTributeMode` | enum | `auto`, `optional` (future-proofing; no known platform) | `auto` | — | §7.6 |
| `tributeVisibility` | enum | `public`, `returnHidden` | `public` (owner-pinned) | — | §7.7 |
| `cardCountVisibility` | enum | `always`, `onRequestLE10`, `onRequestLE6` | `always` | ✓ | §8.1 |
| `jokerBombSupreme` | bool | true/false (false: 8+-bombs beat it) | `true` | ✓ | §3.11 |
| `wildStraightFlushIsBomb` | bool | true/false | `true` | ✓ | §3.7 |
| `allowUnderDeclareStraightFlush` | bool | true/false | `false` | ✓ | §3.8 |
| `fiveOfKindAsFullHouse` | bool | true/false | `false` | — | §3.6 |
| `fullHouseJokerPair` | bool | true/false | `true` | ✓ | §3.5 |
| `allowWildUnderDeclare` | bool | true/false | `false` | — | §4.2 |
| `jiefengRecipient` | enum | `partner`, `nextPlayer` | `partner` | ✓ | §5.6 |

Removed in v1.2: `doubleTributeTieLead` (the lead rule is unanimous and derivable — the payer whose card 头游 received leads, §7.5); `doubleTributeTieAward` renamed/expanded to `equalTributeAssignment`; `antiTributeAutomatic` renamed to `antiTributeMode`.

Remaining **UNCERTAIN** defaults (`turnDirection`, `equalTributeAssignment` — a documented three-way source conflict, `fullHouseJokerPair`, `fiveOfKindAsFullHouse`, A-level attempt details, `tributeLevelBasis`, the reveal-mandate wording in §7.6) all have keys in this table, so a wrong default is a config change, not an engine change. Everything not tagged VARIANT/UNCERTAIN is **CORE** and may be hard-coded.

### Implementation status (M1 gate, owner-resolved 2026-07-14: keep all three guarded)

Three non-default values are **guarded — not implemented**: the engine rejects them loudly at `init` with `config.notImplemented` (tested), rather than being silently wrong. Owner reasoning, recorded per decision: (1) `tributeLevelBasis='previousLevel'` — a hair-split variant no source pins; owner plays `upcomingLevel`; zero-payoff scope (Codex+Grok convergent audit finding). (2) `levelTrack='shared'` **combined with** `aFailConsequence='demote'` — shared-ladder demotion semantics are genuinely undefined by any source; defining them for a combination nobody wants is scope without payoff (Grok audit finding; each value works alone). (3) `equalTributeAssignment='winnersChoose'` — pagat's Western variant needing an extra decision action + UI; not the owner's rule lineage. Any of the three can be promoted later behind its existing key without engine redesign. Related logged ambiguity (left as-is, both keys non-default): `aceFinishDemotes` × `suspendPlayOpponentLevel` on the same hand — spec silent; engine applies the ace demote after suspension.

---

### Sources

- **《竞技掼蛋竞赛规则（试行）》** (Competitive Guandan Rules, Trial — 国家体育总局棋牌运动管理中心, 2022/2023): 第十条 贡牌与还牌 retrieved verbatim from two agreeing copies — [sohu.com](https://www.sohu.com/a/621481154_121124679), [52hrtt.com](https://www.52hrtt.com/ny/n/w/info/F1702965842341) (tribute/return/anti-tribute clauses; fetched 2026-07-13; full verification report with per-question source tables: docs/research/guandan-tribute-verification.md)
- [Guandan — Wikipedia](https://en.wikipedia.org/wiki/Guandan) (bomb hierarchy, level card position, jiefeng-to-partner, return ≤10, full house triple-only comparison, A win condition)
- [Guan Dan — pagat.com](https://www.pagat.com/climbing/guan_dan.html) (tribute/return/anti-tribute mechanics, 1-4 末游-pays-头游, A-level 3-attempt demotion to 2, ≤10-card report-on-request, first-deal drawn-card lead, wilds-not-jokers)
- [掼蛋比赛规则 (NUIST, official-style PDF)](https://gh.nuist.edu.cn/_upload/article/files/e2/4e/9a5343d0450a9580fd4c1f46fc0b/290d8299-e923-4966-a485-b0269c7e11fd.pdf) and [扑克牌（掼蛋）比赛规则 (SEU PDF)](https://ddgh.seu.edu.cn/_upload/article/files/44/c8/f455e1d04d2a998e40454931740a/4f853bb4-29b9-45dc-9c56-7627ed4c9726.pdf) (四王最大, bomb ladder, 进贡/还贡/抗贡)
- [掼蛋游戏规则 — 知乎](https://zhuanlan.zhihu.com/p/5480576176), [联众掼蛋介绍](https://www.ourgame.com/game/game-intro-new/df/sc/h2g/egglaying_002.html), [唐人游掼蛋规则](https://guandan.uc55.com/Rule/Detail/201801_000209.html) (还贡≤10, equal-tribute 下家 conventions)
- [DanZero: Mastering GuanDan with RL (arXiv)](https://arxiv.org/pdf/2210.17087) and [NeurIPS Guandan supplement](https://proceedings.neurips.cc/paper_files/paper/2023/file/1a2b4aba905a16733ff199888ac8eec4-Supplemental-Conference.pdf) (formalized combo set: 4–10 bombs, SF between 5- and 6-bombs, joker bomb highest)