# Card-Face Wild Chooser — Presentation Research

**Date:** 2026-07-14 (M4 owner item A research deliverable — REQUIRED before implementation)
**Status:** Decision-ready. Presentation-only: no engine, protocol, or validation change; obligation 4 (PLAN §3) untouched by design.
**Scope:** How the decl chooser presents each interpretation of a wild-containing selection as CARD FACES — the wild→substituted-card arrow, the post-substitution concrete combo, the wild-marker tension, two-wild readability, many-option layout, and a PROVEN 390px fit — plus the implementation sketch, i18n keys, and test plan.
**Owner intent (verbatim spirit):** a family member must understand each option with no explanation: wild face → arrow → the card it becomes, PLUS the resulting combo rendered as it will be played (the heart 2 appears as the card it stands for, not as itself, inside the group).
**Sources:** docs/research/wild-disambiguation.md (§1 rule R1–R5, §2 enumeration, §2 chooser-size bound), `src/engine/guandan/combos.ts`, `src/engine/guandan/cards.ts`, `src/engine/guandan/types.ts`, `src/engine/guandan/index.ts`, `src/client/table/helpers.ts`, `src/client/table/ActionBar.tsx`, `src/client/table/CardFace.tsx`, `src/client/table/HandFan.tsx`, `src/client/table/table.css`, `src/client/app.css`, `src/client/RoomPage.tsx`, `src/client/i18n/index.ts` + the three locale JSONs, `tests/unit/client/table.test.ts`, `tests/e2e/product-paths.e2e.test.ts`.

**Verification legend (METHODOLOGY §3):**
- **VERIFIED-READ** — claim read directly from code/CSS this pass, file:line cited.
- **PROVED** — short arithmetic/combinatorial argument inline.
- **PROPOSED** — a design decision this document makes (justified, owner-changeable).
- **ASSUMED** — inferred from an adjacent verified mechanism; becomes a named test in §7.

**Null results (headlined, METHODOLOGY §4):**
- **N1 — the wild→substituted-card mapping exists NOWHERE in the current pipeline.** `PlayMatch` is `{cards, decl, playable}` (helpers.ts:67-71); `CanonicalForm` is `{type, size, keyRank, suit?}` plus the `jokerRank`/`demoted` extras (types.ts:52-64, combos.ts:35-50). No type, event, or transform records which selected card is a wild in a given reading or what it stands for; `classifyPlays` validates by multiset inclusion and never materializes an assignment (combos.ts:1-8 header comment, 128-138). Diagnosis: genuinely unimplemented, not hidden — the engine's "never enumerate identities" design (spec §4.4 recommended approach) makes the assignment implicit. **Consequence: the client must derive it; §1 proves it can, deterministically, from data it already has.**
- **N2 — no DOM-rendering test rig exists** (vitest `environment: 'node'`, vitest.config.ts:11; no @testing-library dependency in package.json — VERIFIED-READ). The ratchet plan (§7) therefore pins pure-function derivation + CSS-token arithmetic + wire-level e2e, and leaves pixel truth to the visual round, whose findings then become named tests per the standing QA-ratchet rule (METHODOLOGY, 2026-07-14).
- **N3 — no web pass run (decision, not failure).** Every load-bearing claim is about our own code and CSS; nothing here depends on an external source.

**Questions this pass set out to answer (METHODOLOGY §5):**
1. Can the client derive, per chooser option, the wild→substituted pairs and the post-substitution concrete combo — today, from `PlayMatch` alone? → §1 (yes; algorithm given; the one under-determined case resolved).
2. How does each option present substitution + result so a family member reads it unaided? → §2.
3. How is the "wild renders as a plain clubsA — which card is the wild?" tension resolved? → §2.3 (explicit, with rejected alternatives).
4. Do two-wild options stay readable without doubling row height? → §2.4.
5. What layout for many options, what is the comfortable count, what happens beyond it? → §3.2.
6. Does the whole thing fit 390px — proven from the actual CSS numbers? → §3.1 (arithmetic, every constant cited).
7. What are the exact components, CSS, i18n keys, and tests? → §5, §6, §7.

---

## 0. What exists today (baseline, all VERIFIED-READ)

- **Chooser input:** `matchSelection` returns `PlayMatch[] = {cards, decl, playable}[]`, one entry per distinct decl, in `classifyPlays`'s order (helpers.ts:118-140). `classifyPlays` sorts strongest-first via `compareComboStrength` before returning (combos.ts:476-477), so the pinned larger-on-top ordering (R5, wild-disambiguation.md §1.2/§4.3) is engine-enforced; the client does no re-sorting (ActionBar.tsx:147 maps in array order).
- **Chooser render:** a plain text list — `<div className="gd-chooser" role="dialog">` with title, one `<button>` per match showing `t(comboKey(decl)) + rankText(keyRank)` + SF run text + optional cannotBeat note, then Cancel (ActionBar.tsx:144-172). No card faces anywhere in it. It opens only when `matches.length > 1`; a single reading auto-plays (ActionBar.tsx:120-121).
- **Chooser CSS:** absolute popup above the action bar — `bottom: calc(100% + 0.5rem); left: 50%; transform: translateX(-50%); min-width: 11rem; padding: 0.625rem; border: 1px solid var(--ivory)` inside `position: relative` `.gd-actions` (table.css:591-605, 524-531). No chooser-specific media query; the table page pins "375px must never scroll horizontally" globally (table.css:5, 25-26 `max-width:100%; overflow-x:hidden`).
- **Card faces:** `CardFace {card, level, size: 'hand'|'trick'}` (CardFace.tsx:13-18); width via `--gd-cardw` — base 2.5rem, hand `clamp(2.25rem, 11vw, 3.25rem)`, trick 2.25rem; height `1.45 × cardw`, `box-sizing: border-box` with a 2px rosewood border (table.css:377-394). Rank glyph `0.42 × cardw`, suit glyph `0.36 × cardw` (table.css:410-416). The wild marker is a solid cinnabar bottom-left corner triangle (`0.62 × cardw` square, clip-path) with the wild/W glyph at `0.28 × cardw`, rendered whenever `isWild(card, level)` — i.e. the card IS the heart of the level rank (CardFace.tsx:51-55, table.css:431-454, cards.ts:34-36).
- **Submission & validation:** the chooser row calls `onPlay(match)` → `act({type:'play', cards: match.cards, decl: match.decl})` (ActionBar.tsx:158, GameTable.tsx:432). The server re-derives everything: cards-in-hand check, decl resolution (explicit or `inferDecl`), full `validatePlay(cards, decl, …)` re-validation, then `beats()` (src/engine/guandan/index.ts:507-544). The client's decl is a disambiguation hint the server never trusts — **so anything this document adds is presentation over an unchanged wire action; obligation 4 is structurally untouched.**
- **i18n:** three chooser keys exist, identical key set in all locales (en/zh-Hans/zh-Hant .json:146-148); `TranslationKey = keyof zh-Hant.json` with a runtime parity test (i18n/index.ts:13-16, tests/unit/i18n.test.ts:23).

---

## 1. Data availability: deriving the substitution per option (Q1 — the critical question)

### 1.1 Verdict

**Everything needed is derivable client-side today from `(match.cards, match.decl, level)` — no protocol, engine, or `PlayMatch` shape change.** The mapping is not stored anywhere (N1), but it is a deterministic function of data the chooser already holds, because a validated decl pins its required multiset exactly (that is how `validatePlay` works — combos.ts:128-138 for suit-blind types, 374-386 for SF identities), and the deficit between that multiset and the selection's naturals IS the wilds' assignment.

### 1.2 Algorithm — `wildSubstitutions(cards, decl, level): WildSubstitution[]` (PROPOSED; each step's engine mirror cited)

Split the selection with the same predicate the engine uses (`isWild`/`isJoker` — cards.ts:18-36; helpers.ts already does this in `rankKey`, helpers.ts:40-45). Then build the decl's **required multiset** and subtract the naturals; the remainder is the wilds' targets:

| decl.type | Required multiset | Engine mirror |
|---|---|---|
| single / pair / triple / bomb | `keyRank × size` — except all-wild single/pair with `keyRank == level`: wilds play **as themselves** (§4.2 / R4a) | combos.ts:224-268, 205-214 |
| fullHouse | `keyRank × 3` + pair rank `p × 2`, where `p` = the unique natural rank ≠ keyRank if one exists; else if natural keyRank count > 3 (five-of-kind variant), `p = keyRank`; else (naturals are exactly the triple) the two wilds ARE the pair — **as themselves** (R3: pair rank never compares) | combos.ts:288-320 |
| straight / tube / plate | `sequenceWindow(keyRank, 5/3/2) × 1/2/3` copies (rank-only) | combos.ts:90-97, 323-360 |
| straightFlush | the window's `(rank, decl.suit)` **identities** — targets carry rank AND suit | combos.ts:374-386 |
| jokerBomb | unreachable — wilds never join it (combos.ts:217-220) | — |

Subtract naturals (rank-wise; identity-wise for SF). Remaining slots = wild targets, count-guaranteed equal to the wild count by the same arithmetic `validatePlay` relies on (combos.ts:122-127). Assign each wild a slot, **consuming any level-rank slot (for SF: the `(level, H)` identity) first as `asSelf`** — the wild plays as itself there, mirroring the §9.11 no-demotion rule the engine already encodes (combos.ts:388-393). Everything else is a substitution `{becomesRank, becomesSuit: decl.suit | null}` — **suit is `null` for every suit-blind type** (deliberately: see §2.5). Identical `(wild, target)` pairs collapse into one chip with a count (§2.4).

```ts
export interface WildSubstitution {
  /** The physical wild card, e.g. '2H' at level 2. */
  wild: Card;
  becomesRank: Rank;
  /** Present iff decl.type === 'straightFlush' (suit is determined there and only there). */
  becomesSuit: Suit | null;
  /** true = the wild plays as itself (level-rank slot / R4a / FH free pair) — no arrow chip rendered. */
  asSelf: boolean;
}
```

Worked checks against the wild-disambiguation.md §2 probe rows (ASSUMED → named tests, §7.1):
- **ST-7** `{T♠,J♦,Q♣,K♠,A♥}` @level A: `straight-A` → deficit `{A}` = level ⇒ `asSelf` (no arrow); `straight-K` → deficit `{9}` ⇒ `A♥ → 9`. Both readings render honestly.
- **FH-3** `{K,K,9,W,W}` @2: `fullHouse-K` → deficits `{K, 9}` ⇒ two distinct chips; `fullHouse-9` → deficits `{9, 9}` ⇒ one chip ×2.
- **FH-4** `{9,9,9,W,W}` @2: `fullHouse-9` → naturals are exactly the triple ⇒ both wilds `asSelf` (they are, physically, a legal pair of level hearts — the honest presentation of R3's invisible pair rank); `bomb-5-9` → both wilds `→ 9`, one chip ×2.
- **SF-7** `{4♥5♥6♥7♥8♥}` @7, `SF-8♥`: deficit identity `{7♥}` = the level heart ⇒ `asSelf` — consistent with the engine's `substituting -= 1` non-demotion arithmetic (combos.ts:391-392).
- **SF-3** `{5♠6♠7♠8♠,W}` @2: `SF-9♠` → `W → 9♠` (suited target); `SF-8♠` → `W → 4♠`.

### 1.3 The one under-determined case, resolved

Only the **full-house free pair** (FH-4 shape) has no engine-pinned target — the spec says the pair rank never compares (R3). Presenting the wilds **as themselves** there is (a) physically true (the two wilds are a real pair of level hearts), (b) the only choice that invents nothing, and (c) already the engine's own idiom for wilds in their natural slot (§4.1/§9.11). PROPOSED and pinned; any invented rank (e.g. "pair of Aces") would be a lie the server never checks.

### 1.4 The result row — `resolveComboFaces(cards, decl, level): ResolvedFace[]` (PROPOSED)

The post-substitution combo is the same computation projected per-slot: every natural renders as itself; every wild renders at its assigned identity (`asSelf` wilds as the physical wild face). Display order is a presentation pin: **sequence types in ascending window order** (the substituted face sits in its slot — this is what makes a straight legible to a family member); **fullHouse as triple-then-pair; everything else in the engine's `sortCards` order** (cards.ts:114-120). One face per selected card — `faces.length === decl.size` always.

```ts
export interface ResolvedFace {
  /** Physical card occupying this slot ('2H' even when displayed as a 9). */
  card: Card;
  displayRank: Rank;
  /** null ⇒ suit-blind ghost face (no suit glyph); set for naturals and SF targets. */
  displaySuit: Suit | null;
  /** true ⇒ this slot is wild-backed (drives the wild corner marker). */
  viaWild: boolean;
}
```

Both functions are pure, React-free, and belong in `src/client/table/helpers.ts` beside `matchSelection` (same import legality: engine pure functions are client-legal per the existing header comment, helpers.ts:1-7). They import only `sequenceWindow` (already exported, combos.ts:90) and cards.ts predicates. **Not** engine code: this is presentation; the engine's "never materialize α" design stays intact, and a derivation bug can never corrupt a play (the submitted action is still `{cards, decl}`, server-re-validated — §0).

---

## 2. Presentation design (Q2–Q4)

### 2.1 Anatomy of one option (PROPOSED)

Each chooser option becomes one tappable `<button class="gd-chooser__option">` with up to three stacked zones:

```
┌──────────────────────────────────────────┐
│  [2♥wild] → [ 9 ]  ×2      full house 9        │   header: substitution chips + type label
│  [9♠][9♣][9♦][ 9 ][ 9 ]                  │   result: the combo AS IT WILL BE PLAYED
└──────────────────────────────────────────┘
```

- **Header (flex-wrap row):** one **substitution chip** per distinct non-`asSelf` substitution — the physical wild face (mini CardFace, its usual solid wild corner) → arrow glyph `→` → the substituted face (mini ghost face, §2.5) — followed by the existing **type label** (`t(comboKey) + rankText + declRunText` + cannotBeat note) demoted to a small secondary cue (0.75rem, opacity 0.8). The label keeps carrying the semantics for screen readers and for the zero-wild ambiguity cases (tube-vs-plate readings with no wilds at all, e.g. natural TP shapes) where no chips render. `flex-wrap` lets the worst case (two chips + long English SF label) wrap to a second line instead of overflowing (§3.1 arithmetic).
- **Result row:** `resolveComboFaces` output as mini faces, **no overlap** (unlike the fan) — at chooser sizes every face, suit, and marker stays fully visible, and §3.1 proves no-overlap fits. Wild-backed slots render the substituted identity with the wild corner marker (§2.3); `asSelf` wilds render as the ordinary wild face (marker already automatic via `isWild`, CardFace.tsx:51).
- **Options with no substitutions** (all wilds `asSelf`, or no wilds) simply have no chips — header collapses to the label alone. No "=" chip: rendering nothing when nothing substitutes is the lower-noise reading, and the result row already shows the wild as itself, marked. (Rejected alternative: a `2♥ = 2♥` self-chip — adds a symbol a family member must decode, to say "nothing happened".)

The full option remains ONE button (tap anywhere = choose), preserving the current interaction contract, the unplayable dimming (`gd-chooser__unplayable`, opacity 0.55, table.css:614) and the two-tap-free flow.

### 2.2 Why arrow row AND marked result row (owner requirement, justified)

The two zones answer different questions a first-time player actually asks: the arrow answers *"what is my wild doing?"* (identity mapping, one glance); the result row answers *"what exactly hits the table and how big is it?"* (the thing opponents must beat). Either alone fails someone: arrow-only forces mental assembly of the final combo (exactly the cognitive step wilds make hard); result-only hides which card was yours vs conjured. Redundant encoding is the accessibility-grade choice and it is cheap (§3.1: both rows fit with >100px to spare).

### 2.3 The wild-marker tension — resolved (Q3)

**Tension:** if the wild renders as a plain clubsA inside the group, the player cannot tell which card is the wild. **Resolution (PROPOSED): the substituted face carries the exact same solid cinnabar wild corner marker the table already uses for wilds** (table.css:431-454), on top of the substituted identity.

Justification:
- It preserves **one convention with one meaning**: "cinnabar wild corner = the wild is at work on this card." In the hand/trick it sits on the wild's own face; in the chooser it sits on the face the wild is playing as. A family member who has seen the hand marker transfers the reading for free; the arrow chip directly above teaches the equivalence the first time.
- The invariant survives the *result row alone* (glance path: most players will look at the big row first) — the row is self-sufficient even if the chips are ignored.

Rejected alternatives (explicit, per owner instruction):
- **(a) Arrow row carries the burden alone** (result row unmarked): fails glanceability — the player must count-match cards between rows to locate the wild; and it silently misrepresents the result row as five natural cards, the exact confusion the owner named.
- **(b) A new "subtle" marker variant** (hollow triangle / dimmed corner): introduces a second convention to learn ("solid = real wild, hollow = wild-as-other-card") — a distinction that buys nothing a family member needs, and a hollow triangle's ~1px stroke is illegible at the 32px mini size (the solid triangle+glyph was explicitly designed for ≥36px readability, table.css:431-433; §3.1 shows mini is 32px).
- **(c) Dashed/ghosted card border**: competes with the card's rosewood border identity and reads as "not a card / disabled", not "wild-backed"; also collides with the existing unplayable-option opacity dimming.

### 2.4 Two wilds without doubling height (Q4)

Two mechanisms, both in the header line:
1. **Chips sit side-by-side** in the flex row — two distinct substitutions (FH-3 `fullHouse-K`: `W→K`, `W→9`) are two chips on one line: 2 × 88px + gap = 188px, fits with room (§3.1).
2. **Identical substitutions collapse** — both wilds → same target (bomb-5-9, tube end-extensions) render ONE chip with a `×2` count badge (locale-free glyph). This is the common two-wild case and costs the width of one chip.

Result-row height never changes with wild count (one face per card regardless). Worst-case option height is bounded by the header wrapping to two lines (long English SF label + two chips), ≈130px; typical is ≈110px (PROVED in §3.1's table).

### 2.5 Suit honesty on substituted faces (owner constraint: no suit-redundancy reintroduction)

For suit-blind types the wild stands for **a rank, not a card identity** — the engine never chooses a suit (combos.ts:122-138) and R1 (wild-disambiguation.md §1.2) pins that suit is never a chooser dimension. **PROPOSED: suit-blind substituted faces are rank-only "ghost faces"** — rank glyph in the corner index, no suit glyph, ink-colored, plus the wild corner marker. Inventing a concrete suit (the owner's illustrative clubsA) would (a) claim something false-precise, and (b) visually reintroduce the suit dimension the enumeration deliberately collapsed. For **straight flushes the suit IS determined** (`decl.suit`, pinned by the naturals — R1 proof) and the ghost face shows it (e.g. `9♠` with marker), which is exactly when a family member needs the suit to understand why this option is the big one. The owner's example remains fully honored in structure (wild face → arrow → card face); only the suit-blind case renders "the A it becomes" rather than "the ♣A it never specifically becomes".

---

## 3. Layout, option count, and the 390px proof (Q5–Q6)

### 3.1 The 390px arithmetic (PROVED, every constant cited; root font 16px)

**Available width.** The table page nests `.gd-table` inside `.app-main--wide` (RoomPage.tsx:85) with horizontal padding 1rem each side (app.css:99-105) → at 390px the table is 390 − 32 = **358px**; `.gd-table` padding 0.5rem each side (table.css:24) → content column **342px**. The chooser floats centered inside `.gd-actions` (`position:relative`, table.css:524-531; chooser absolute + `translateX(-50%)`, table.css:591-595), clipped by `.gd-table { overflow-x: hidden }` (table.css:25-26) — so **342px is the hard budget** for the chooser's outer width.

**Proposed mini card size.** New variant `.gd-card--mini { --gd-cardw: 2rem; }` → 32px wide, 1.45 × 32 = **46.4px** tall, border included (`box-sizing: border-box`, table.css:388). Why a new variant is warranted: reusing `trick` (2.25rem = 36px, table.css:393-394) also fits the width budget but costs 52.2px per row — two rows per option would push a 3-option chooser past ~470px tall; mini keeps it ≈380px (table below) while staying above the smallest size the wild marker was designed around (glyph 0.28 × 32 = 9.0px vs 10.1px at trick — flagged for the visual round, §8-Q2). Reusing `hand` (11vw = 42.9px at 390px, table.css:390-391) is both wider AND viewport-coupled — wrong tool for a fixed dialog.

**Worst-case rows.** The chooser only ever shows multi-reading selections (`matches.length > 1`, ActionBar.tsx:144), and readings exist only for sizes 1–6 with multiplicity (7–10-card selections classify as bombs of a single rank → single reading; combos.ts:468-474) → **result row ≤ 6 faces**. All numbers below include the chooser's own chrome: padding 0.625rem × 2 = 20px + 1px border × 2 (table.css:596-599) = **22px**.

| Element | Formula | Width @390px | Budget check (≤342) |
|---|---|---|---|
| Result row, 6 mini faces, no overlap, 0.125rem gaps | 6×32 + 5×2 | 202px | 202+22 = **224 ✓** (118px spare) |
| One substitution chip | 32 + 4 + 16(arrow) + 4 + 32 | 88px | trivially ✓ |
| Two distinct chips + 0.75rem gap | 2×88 + 12 | 188px | 188+22 = **210 ✓** |
| Chips + longest label inline (en SF: "Straight flush A (10–A♠)" ≈150px @0.75rem) | 188 + 8 + ~150 | ~346px | **✗ inline — hence `flex-wrap` on the header (§2.1); wrapped it is 188px + a 150px second line, both ✓** |
| Current text chooser (baseline) | min-width 11rem | 176px | ✓ (unchanged behavior) |

Chooser outer width: `width: max-content; max-width: min(22rem, calc(100vw - 3rem))` → at 390px the cap is min(352, 342) = 342, and the widest content needs 224 — **no overflow, no horizontal scroll, with margin, at 390px and even at the design floor 375px** (375: budget = 375−32−16 = 327 ≥ 224 ✓).

**Height (informative, not a hard constraint).** Per option: result 46.4 + header 46.4 (chip line) [+ ~17 label wrap line worst-case] + 3 gaps ≈ 8 + button padding ≈ 12 → **≈113px typical, ≈130px worst**. Chooser with 3 options + title (~20) + cancel (~36) + gaps ≈ **~380–430px**, anchored above the action bar — it overlays the trick well like a modal, acceptable for a declaration dialog. Safety: `max-height: min(70vh, 30rem); overflow-y: auto`.

**Desktop (≥720px).** Identical mini sizing (fixed rem units — nothing is viewport-coupled); the only difference is more surrounding air (`.gd-table` padding 1rem, table.css:769-771). Same table, second column:

| Token | 390px phone | ≥720px desktop |
|---|---|---|
| `--gd-cardw` mini | 32px | 32px |
| mini face h | 46.4px | 46.4px |
| result row (6 faces) | 202px | 202px |
| chooser max-width | 342px (viewport cap) | 352px (22rem cap) |
| table content column | 342px | table is flex-child of the 72rem column (app.css:106-108) — budget ≫ 352px |

### 3.2 Many options: layout, comfortable count, overflow behavior (Q5)

**Layout: a single vertical list, strongest on top — unchanged.** The R5 order is the content's meaning (larger option literally on top, owner pin); a grid would break the vertical strength scan and buys nothing at ≤342px where only one column of 224px content fits anyway.

**Comfortable count: 3, and 3 is the proven default-config maximum.** wild-disambiguation.md §2 PROVED `|Offered(S)| ≤ 3` under default config (attained by SF-4/ST-3/TP-2/TP-3) — so the no-scroll experience covers every reachable default-config case. Beyond 3 (only under non-default variants: ≤6 with `allowUnderDeclareStraightFlush=true`, 13 for a lone wild under `allowWildUnderDeclare=true`): the `max-height: min(70vh, 30rem)` + `overflow-y: auto` kicks in — options scroll, order preserved, strongest visible first, Cancel pinned OUTSIDE the scroll region (always reachable). The 13-option lone-wild variant additionally degrades gracefully because each of its options is a 1-card result row + no chips (`asSelf` or a single chip) ≈ 60px — 13 options ≈ scrollable 780px, functional if ugly, on a config no known platform uses (combos.ts:236 comment).

---

## 4. Invariants this design must not disturb (checked against code)

- **Ordering (R5):** the chooser continues to render `matches` in array order; the order is created engine-side (combos.ts:476-477) and flows through `matchSelection` untouched (helpers.ts:132-139). This design adds zero client sorting. VERIFIED-READ + pinned by tests/unit/client/table.test.ts:142.
- **Suit-only-matters-for-SF:** no new suit dimension is offered (§2.5 renders suit-blind targets suitless); the offered SET is untouched — presentation reads `classifyPlays` output, never filters or extends it.
- **Obligation 4:** the submitted action stays exactly `{type:'play', cards, decl}` (GameTable.tsx:432); server-side re-validation path unchanged (index.ts:519-544). The derivation functions are render-only.
- **Type label stays as secondary cue** (owner pin): same strings, same t() keys, demoted typographically, never removed (also the accessibility text backbone, §6).
- **Engine purity / DO game-agnosticism:** untouched — every new line of code is in `src/client/**`.

---

## 5. (a) Component & CSS implementation sketch

### 5.1 Files & structure

```
src/client/table/helpers.ts      + wildSubstitutions(), resolveComboFaces(),
                                   WildSubstitution, ResolvedFace   (pure, §1)
src/client/table/CardFace.tsx    + size: 'hand' | 'trick' | 'mini'
                                 + new sibling export GhostFace({rank, suit, size}):
                                   .gd-card .gd-card--mini .gd-card--ghost — rank index,
                                   suit glyph only when suit !== null, ALWAYS renders
                                   .gd-card__wild marker; ink-colored when suitless,
                                   red/black by suit otherwise (isRedSuit, helpers.ts:247)
src/client/table/ActionBar.tsx     chooser JSX (lines 144-172) rebuilt per §2.1
src/client/table/table.css        + chooser-option / chip / mini rules below
src/client/i18n/locales/*.json    + 3 keys ×3 locales (§6)
```

### 5.2 Chooser option JSX (shape)

```tsx
<button type="button"
        className={'gd-chooser__option' + (match.playable ? '' : ' gd-chooser__unplayable')}
        aria-label={optionAria(match, level)}          // §6: label + substitution sentences
        onClick={() => props.onPlay(match)}>
  <span className="gd-chooser__header">
    {chips.map((c) => (
      <span className="gd-chooser__chip" key={...}>
        <CardFace card={c.wild} level={level} size="mini" />
        <span className="gd-chooser__arrow" aria-hidden="true">→</span>
        <GhostFace rank={c.becomesRank} suit={c.becomesSuit} size="mini" />
        {c.count > 1 && <span className="gd-chooser__mult">×{c.count}</span>}
      </span>
    ))}
    <span className="gd-chooser__label">
      {t(comboKey(match.decl))} {rankText(match.decl.keyRank)}
      {run !== null && ` (${run})`}
      {!match.playable && <span className="gd-chooser__note"> · {t('game.chooser.cannotBeat')}</span>}
    </span>
  </span>
  <span className="gd-chooser__result" aria-hidden="true">
    {faces.map((f) => f.viaWild && f.card !== /* asSelf ⇒ */ selfIdentity
      ? <GhostFace rank={f.displayRank} suit={f.displaySuit} size="mini" />
      : <CardFace card={f.card} level={level} size="mini" />)}
  </span>
</button>
```

(All faces `aria-hidden` — the existing CardFace pattern, CardFace.tsx:37/46; the button's `aria-label` carries the full meaning, §6.)

### 5.3 CSS additions (class names + sizing pinned)

```css
/* chooser card size (§3.1 arithmetic depends on these two numbers) */
.gd-card--mini { --gd-cardw: 2rem; }
.gd-card--ghost { color: var(--ink); }            /* suitless ghost default; suit classes still apply */

/* the chooser grows from text list to card list */
.gd-chooser {                                      /* existing block, table.css:591-605, gains: */
  width: max-content;
  max-width: min(22rem, calc(100vw - 3rem));
  max-height: min(70vh, 30rem);
}
.gd-chooser__options { overflow-y: auto; display: flex; flex-direction: column; gap: 0.375rem; }
                                                   /* Cancel + title live OUTSIDE this scroll region */
.gd-chooser__option {
  display: flex; flex-direction: column; gap: 0.25rem;
  background: var(--rosewood); border: 1px solid transparent; border-radius: 8px;
  padding: 0.375rem 0.5rem; text-align: left;
}
.gd-chooser__option:first-of-type { border-color: color-mix(in srgb, var(--ivory) 35%, transparent); }
                                                   /* quiet top-option affordance; NOT goldleaf (reserved) */
.gd-chooser__header { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.gd-chooser__chip   { display: inline-flex; align-items: center; gap: 0.25rem; }
.gd-chooser__arrow  { font-size: 1rem; opacity: 0.9; }
.gd-chooser__mult   { font-family: var(--font-mono); font-size: 0.75rem; opacity: 0.85; }
.gd-chooser__label  { font-size: 0.75rem; opacity: 0.8; }          /* demoted secondary cue */
.gd-chooser__result { display: flex; gap: 0.125rem; }               /* no overlap (§2.1) */
```

Design-system conformance: colors only from the normative palette (lacquer/rosewood/ivory/cinnabar/ink — table.css:7-13); goldleaf NOT used (reserved for rail/jiefeng/victory, table.css:1-4); focus-visible inherited from `.gd-table button` rules (table.css:30-38); reduced-motion already global (table.css:792-799).

### 5.4 Sizing table (normative for implementation & the ratchet test)

| Quantity | Value | Source |
|---|---|---|
| mini `--gd-cardw` | 2rem = 32px | new, §3.1 |
| mini face height | 46.4px | 1.45 ratio, table.css:382 |
| result-row gap | 0.125rem = 2px | new |
| worst result row (6 faces) | 202px | PROVED §3.1 |
| chip width | 88px | PROVED §3.1 |
| chooser chrome | 22px | table.css:596-599 |
| 390px width budget | 342px | app.css:104 + table.css:24 |
| required ≤ budget | 224 ≤ 342 ✓ | §3.1 |

---

## 6. (b) New i18n keys — exactly three, aria-first (visuals carry the meaning)

The visual design deliberately makes the card faces + arrow + marker carry the semantics, so the new strings are needed only for accessibility labels — they survive translation trivially. Keys, all three locales (added to en.json / zh-Hans.json / zh-Hant.json; the parity test enforces the key-set match, tests/unit/i18n.test.ts:23):

| Key | en | zh-Hant | zh-Hans | Used for |
|---|---|---|---|---|
| `game.chooser.becomes` | `"wild plays as {card}"` | `"wild card as  {card}"` | `"wild card as  {card}"` | one chip's aria sentence; `{card}` = `rankText(rank)` or rank+suit via existing `game.card.label`/`game.suit.*` for SF |
| `game.chooser.becomesBoth` | `"both wilds play as {card}"` | `"two wild card as  {card}"` | `"two wild cards as  {card}"` | collapsed ×2 chip's aria sentence |
| `game.chooser.playedAs` | `"played as"` | `"actual play"` | `"actual play"` | joins the option aria-label before the face list; also available as an (optional) visible micro-caption if the visual round wants one |

Option `aria-label` composition (client-side, no new key): `"{combo} {rank}[ ({run})] · {becomes-sentences} · {playedAs} {face list via cardLabel/rankText}[ · {cannotBeat}]"` — every fragment from existing keys plus the three above. The arrow `→` and `×2` are locale-free glyphs (precedent: `declRunText`'s `–` and suit glyphs, helpers.ts:281-287).

---

## 7. (c) Test plan

### 7.1 Unit — substitution derivation (new `tests/unit/client/chooser-faces.test.ts`, node env, React-free)

Named cases (IDs from wild-disambiguation.md §2 — reusing its scenario vocabulary so the two docs cross-reference):
- **Arrow correctness:** ST-2/ST-7 (end positions; wild-as-self at level A), FH-1 (dual assignment: the SAME cards yield different targets per decl), FH-3 (split vs concentrated: two distinct chips vs one ×2 chip), FH-4 (free pair ⇒ both `asSelf`, and `bomb-5-9` ⇒ ×2 chip), SF-1/SF-3 (§9.18 pair: suited targets carry `decl.suit`), SF-7 (level-heart slot ⇒ `asSelf`, mirrors non-demotion), TP-2/TP-3 (6-card cross-type, worst-width row), B-4 (bomb ×2 collapse), S-1/R4a (lone wild ⇒ `asSelf`), S-9 variant (`allowWildUnderDeclare=true` lone wild declared '9' ⇒ arrow to 9), five-of-kind variant (`fiveOfKindAsFullHouse=true`, keyCount=4 ⇒ pair rank = keyRank — the §1.2 fullHouse subtlety).
- **Properties** (random sub-multisets sizes 1–6 of shuffled double decks, wilds forced into ≥50% of samples, all 13 levels; for every `decl ∈ classifyPlays(S)`):
  1. `wildSubstitutions(S, decl, level).length === wildCount(S)` and `asSelf ⇔ target == wild's own identity`.
  2. **Reconstruction:** naturals + derived targets rebuild exactly the decl's required multiset — checked by substituting each wild with its target (any suit for suit-blind targets) and asserting `validatePlay(substituted, decl', level, config).ok`, where `decl'` recomputes `demoted` for the now-natural multiset (the §3.7 flag is wild-count-dependent, combos.ts:391-393 — the test must not naively reuse `decl`).
  3. `becomesSuit !== null ⇔ decl.type === 'straightFlush'`, and then `=== decl.suit`.
  4. `resolveComboFaces` length `=== decl.size`; `viaWild` slots correspond 1:1 with the wilds; sequence display order is the ascending window; every natural's `displayRank/Suit` equals its own.
- **Config sweep:** run the properties under the same 2⁵ variant matrix wild-disambiguation.md §5.2 uses.

### 7.2 Ratchet regressions (METHODOLOGY QA-ratchet standing rule — pinned BEFORE the visual round's fixes count as done)

- **390px fit arithmetic ratchet** (unit): a test that reads `table.css` + `app.css` as text, extracts the tokens the §3.1/§5.4 proof depends on (`--gd-cardw` mini, chooser padding/border, result gap, `.app-main` and `.gd-table` horizontal paddings), recomputes `6·cardw + 5·gap + chrome ≤ 390 − pagePadding` and fails with the actual numbers if any CSS edit breaks the inequality. Title states honestly what green guarantees: *"chooser 390px fit — CSS-token arithmetic (render verified by visual round, inputs pinned here)"*. This is the cheap rung that keeps the §3.1 proof true after this document stops being read; the render itself is verified once by the visual round (N2: no DOM rig exists to do better in CI today).
- **Ordering ratchet (existing, kept):** tests/unit/client/table.test.ts:142 already pins strongest-first `PlayMatch` order into the chooser — unchanged, and it now also protects the visual "larger option on top".
- **Wire-level product path** (extend tests/e2e/product-paths.e2e.test.ts's wild-disambiguation test): in phase A (engine-guaranteed), for every offered `PlayMatch` also run `wildSubstitutions`/`resolveComboFaces` and assert properties 1–4 of §7.1 against the real server hints — proving the presentation pipeline consumes real wire data without error, under the same honest proof-level titling that file already uses.
- **Visual-round findings:** per the standing rule, every finding of the M4 visual/computer-use round over this chooser (marker legibility at 32px, wrap behavior, scroll reachability of Cancel) becomes a named automated regression before its fix is considered done — expected mostly as new §7.1-style unit pins or CSS-token assertions; listed in the gate report.

### 7.3 i18n

The existing parity test (tests/unit/i18n.test.ts:23) automatically enforces the three new keys exist in all locales. Add one unit assertion that `optionAria` output contains the combo label, every substitution sentence, and the face list for a two-wild SF case (the maximal composition).

---

## 8. (d) Open questions (owner / visual-round input wanted)

1. **Ghost-face suit slot (§2.5):** rank-only face (proposed) vs rendering wild in the suit-glyph position (rank over a small cinnabar wild instead of an empty slot). The alternative is denser but overloads the glyph (corner marker AND suit slot). Visual round should screenshot both if cheap.
2. **Mini marker legibility:** wild glyph at mini is 0.28 × 32 = 9.0px vs the 10.1px it was designed for at trick size (table.css:431-433). If the visual round finds it muddy, bump only mini: `.gd-card--mini .gd-card__wildGlyph { font-size: calc(var(--gd-cardw) * 0.32); }` (10.2px). Decide on screenshots, then pin the chosen ratio in the CSS-token ratchet.
3. **Single-reading wild plays get NO visualization** (chooser only opens at ≥2 readings, ActionBar.tsx:120-144): a wild-completed unambiguous play auto-submits with no card-face confirmation of what the wild became. Out of scope for item A (the owner asked for the chooser), but the same `resolveComboFaces` could cheaply power a transient confirmation or the trick-well rendering of one's own play. Flag for M4 backlog, not this change.
4. **Scroll affordance beyond 3 options** (non-default configs only, §3.2): plain `overflow-y: auto` (proposed) vs an added fade/`N more…` indicator. Given the 3-option proven bound under the shipped default, proposing to ship plain scroll and revisit only if a variant config becomes real.
5. **Trick-well consistency:** opponents' plays in the well still render wilds as their physical faces (CardFace with solid marker) — after this change, a wild played by an opponent shows as 2♥wild in the well while the chooser taught "wild shows as what it stands for". Unifying the well (rendering opponents' wild-backed plays via `resolveComboFaces(play.cards, play.decl, level)` — both are in every seat's view) is a natural follow-up; kept out of item A's scope to keep the diff reviewable, but the helper is deliberately signature-ready for it.
6. **Desktop mini size:** keep 32px everywhere (proposed, consistency) vs bumping to trick 36px at ≥720px (more air available). Cosmetic; default to consistency unless the visual round objects.
