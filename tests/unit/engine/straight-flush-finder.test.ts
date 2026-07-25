// Straight-flush finder tests (docs/research/straight-flush-finder.md §5).
//
// The load-bearing check is a BRUTE-FORCE ORACLE that is independent of the
// implementation by construction: it recognises straight flushes DIRECTLY
// (sort ranks, check consecutive + A-low duality + single suit — it never calls
// sequenceWindow, so an A-low/no-wrap boundary bug cannot be co-shared), and it
// enumerates decompositions by substituting each wild over every non-joker
// identity and brute-force partitioning the resulting all-natural hand over
// PHYSICAL positions (twins as distinct positions — so the two-identical-SFs
// case is in the oracle's space). It cannot share the (top,suit,need) template
// or the Σ-inequality with the finder.
//
//   (A) SOUNDNESS — every emitted group is a real SF (∃ wild substitution → SF).
//   (B) COMPLETENESS — enumerateDecompositions's raw signatures == the oracle's.
//   (C) COMPLEMENT-EXACTNESS under twins — independent Counter subtraction, keyed
//       on the exact card identity, |R| = |hand| − 5k, no over-removal.
//   (D) RANKING — the shown set is exactly the Pareto frontier, deterministically
//       ordered (a property, not a taste).
//   Plus the closed FACTUAL tag vocabulary (owner strengthen 1) and the
//   zero/one-SF signalling (owner strengthen 2).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RANKS, SUITS, type Card, type Rank } from '../../../src/engine/guandan/cards';
import { JIANGSU_OFFICIAL_ONLINE, type RuleVariant } from '../../../src/engine/guandan/config';
import { bombTier, compareComboStrength, isBombForm } from '../../../src/engine/guandan/combos';
import { legalPlays } from '../../../src/engine/guandan/generate';
import type { CanonicalForm } from '../../../src/engine/guandan/types';
import {
  enumerateDecompositions,
  findStraightFlushes,
  countHoldings,
  remainderQuality,
  REMAINDER_TAG_KINDS,
  SF_FINDER_PACKING_BUDGET,
  type Decomposition,
} from '../../../src/engine/guandan/straight-flush-finder';

// ---------------------------------------------------------------------------
// Independent SF recognizer — DELIBERATELY does not call sequenceWindow.
// ---------------------------------------------------------------------------

/** The window TOP if `cards` (5 all-natural cards) is a straight flush, else
 *  null. A-low ({A,2,3,4,5}) is the one special case; every other run is 5
 *  consecutive rank indices, one suit, distinct ranks. */
function naturalSfTop(cards: readonly Card[]): Rank | null {
  if (cards.length !== 5) return null;
  const suits = new Set<string>();
  const idx: number[] = [];
  for (const c of cards) {
    if (c === 'SJ' || c === 'BJ') return null;
    suits.add(c[1]!);
    idx.push(RANKS.indexOf(c[0] as Rank));
  }
  if (suits.size !== 1) return null;
  if (new Set(idx).size !== 5) return null; // distinct ranks
  const sorted = [...idx].sort((a, b) => a - b);
  // A-low: A(index 12),2(0),3(1),4(2),5(3) → tops at '5'.
  if (sorted[0] === 0 && sorted[1] === 1 && sorted[2] === 2 && sorted[3] === 3 && sorted[4] === 12) {
    return '5';
  }
  for (let i = 1; i < 5; i++) if (sorted[i] !== sorted[0]! + i) return null;
  return RANKS[sorted[4]!]!;
}

const ALL_IDENTITIES: Card[] = RANKS.flatMap((r) => SUITS.map((s) => `${r}${s}` as Card));

// ---------------------------------------------------------------------------
// Canonical decomposition identity (research §1, owner Decision 6): an
// arrangement is identified by its REMAINDER (= the committed-card set, since the
// hand is fixed). "The same five cards pulled are one arrangement regardless of
// label; a different suit is a genuinely different pull." This is what dissolves
// the DFS-order / wild-redistribution artifacts: two partitions of the same
// committed cards leaving the same remainder are ONE arrangement.
// ---------------------------------------------------------------------------

function canonicalKey(remainder: readonly Card[]): string {
  return [...remainder].sort().join(',');
}

// ---------------------------------------------------------------------------
// Oracle — every distinct decomposition signature (group-multiset key), found by
// substitution + physical-position partitioning. Wilds map back to the physical
// wild card in the signature.
// ---------------------------------------------------------------------------

interface Pos {
  sub: Card; // substituted identity, used for SF recognition
  sig: Card; // original card (wild or natural), used for the signature
}

function groupSetSignature(groups: readonly Card[][]): string {
  return groups
    .map((g) => [...g].sort().join(','))
    .sort()
    .join('|');
}

let ORACLE_NODE_BUDGET = 0;

/** Every non-empty set of disjoint SF groups over `positions`, as signatures.
 *  Canonical increasing-min-index order dedups orderings. Fills `out` with a
 *  representative group-set (array of card-arrays, sig cards) per signature. */
function enumDisjointSFs(positions: readonly Pos[], out: Map<string, Card[][]>): void {
  const n = positions.length;
  const combos: number[][] = [];
  const pick: number[] = [];
  const gen = (start: number): void => {
    if (pick.length === 5) {
      if (naturalSfTop(pick.map((i) => positions[i]!.sub)) !== null) combos.push([...pick]);
      return;
    }
    for (let i = start; i < n; i++) {
      pick.push(i);
      gen(i + 1);
      pick.pop();
    }
  };
  gen(0);

  const used = new Array<boolean>(n).fill(false);
  const rec = (chosen: number[][], lastMin: number): void => {
    if (--ORACLE_NODE_BUDGET < 0) throw new Error('oracle node budget exceeded (hand too large)');
    if (chosen.length > 0) {
      const groups = chosen.map((c) => c.map((i) => positions[i]!.sig));
      out.set(groupSetSignature(groups), groups);
    }
    for (const c of combos) {
      if (c[0]! <= lastMin) continue;
      if (c.some((i) => used[i])) continue;
      for (const i of c) used[i] = true;
      rec([...chosen, c], c[0]!);
      for (const i of c) used[i] = false;
    }
  };
  rec([], -1);
}

/** The sets of wild-slot identities under which `group` is a natural SF — one
 *  entry per window interpretation (so an end-position group yields two). A
 *  no-wild group yields [[]] iff it is itself an SF. Independent of the finder. */
const ASSIGN_CACHE = new Map<string, Card[][]>();
function groupWildAssignments(group: readonly Card[], level: Rank): Card[][] {
  const memoKey = `${level}|${[...group].sort().join(',')}`;
  const cached = ASSIGN_CACHE.get(memoKey);
  if (cached !== undefined) return cached;
  const wild = `${level}H` as Card;
  const wildIdx = group.map((c, i) => (c === wild ? i : -1)).filter((i) => i >= 0);
  if (wildIdx.length === 0) {
    const res = naturalSfTop(group) !== null ? [[]] : [];
    ASSIGN_CACHE.set(memoKey, res);
    return res;
  }
  const seen = new Set<string>();
  const out: Card[][] = [];
  const rec = (k: number, cur: Card[], ids: Card[]): void => {
    if (k === wildIdx.length) {
      if (naturalSfTop(cur) !== null) {
        const key = [...ids].sort().join(',');
        if (!seen.has(key)) {
          seen.add(key);
          out.push([...ids]);
        }
      }
      return;
    }
    for (const id of ALL_IDENTITIES) {
      const next = [...cur];
      next[wildIdx[k]!] = id;
      rec(k + 1, next, [...ids, id]);
    }
  };
  rec(0, [...group], []);
  ASSIGN_CACHE.set(memoKey, out);
  return out;
}

/** Frugal (natural-first) test: a group is frugal iff SOME valid window fills its
 *  wilds ONLY with identities absent from the remainder's naturals — i.e. no
 *  wild was spent where a leftover natural of that exact slot was available. This
 *  keeps genuinely-different windows (top-9 vs top-8) while dropping wasteful
 *  ones (a wild filling J♠ while a natural J♠ sits unused). A decomposition is
 *  frugal iff every group is. The wild card itself in the remainder is NOT a
 *  natural, so a wild-as-itself hearts slot is always frugal. */
function isFrugalDecomposition(groups: readonly Card[][], remainder: readonly Card[], level: Rank): boolean {
  const wild = `${level}H` as Card;
  const remainderNaturals = new Set(remainder.filter((c) => c !== wild && c !== 'SJ' && c !== 'BJ'));
  return groups.every((g) =>
    groupWildAssignments(g, level).some((ids) => ids.every((id) => !remainderNaturals.has(id))),
  );
}

function oracleSignatures(hand: readonly Card[], level: Rank): Set<string> {
  ORACLE_NODE_BUDGET = 2_000_000;
  const wild = `${level}H` as Card;
  const naturals = hand.filter((c) => c !== wild && c !== 'SJ' && c !== 'BJ');
  const wilds = hand.filter((c) => c === wild).length;
  const bySig = new Map<string, Card[][]>();
  const subst = (k: number, assigned: Card[]): void => {
    if (k === wilds) {
      const positions: Pos[] = [
        ...naturals.map((c) => ({ sub: c, sig: c })),
        ...assigned.map((a) => ({ sub: a, sig: wild })),
      ];
      enumDisjointSFs(positions, bySig);
      return;
    }
    for (const id of ALL_IDENTITIES) subst(k + 1, [...assigned, id]);
  };
  subst(0, []);

  // Keep only FRUGAL decompositions (the natural-first set the finder produces,
  // research §2.4), then reduce each to its CANONICAL key (form-sets + remainder)
  // so equivalent wild redistributions collapse exactly as the finder's dedup
  // does. remainder = hand − groups, by exact multiset.
  const canon = new Set<string>();
  const handCount = counter(hand);
  for (const groups of bySig.values()) {
    const rem = new Map(handCount);
    for (const g of groups) for (const c of g) rem.set(c, (rem.get(c) ?? 0) - 1);
    const remainder: Card[] = [];
    for (const [c, nn] of rem) for (let i = 0; i < nn; i++) remainder.push(c);
    if (isFrugalDecomposition(groups, remainder, level)) {
      canon.add(canonicalKey(remainder));
    }
  }
  return canon;
}

// ---------------------------------------------------------------------------
// (C) Complement-exactness — independent Counter subtraction by exact identity.
// ---------------------------------------------------------------------------

function counter(cards: readonly Card[]): Map<Card, number> {
  const m = new Map<Card, number>();
  for (const c of cards) m.set(c, (m.get(c) ?? 0) + 1);
  return m;
}

function assertComplementExact(hand: readonly Card[], d: Decomposition): void {
  const used: Card[] = [];
  for (const g of d.groups) {
    expect(g.cards).toHaveLength(5);
    used.push(...g.cards);
  }
  expect(d.remainder.length).toBe(hand.length - 5 * d.groups.length);
  const combined = counter([...used, ...d.remainder]);
  const handCount = counter(hand);
  expect(combined.size).toBe(handCount.size);
  for (const [card, n] of handCount) expect(combined.get(card)).toBe(n);
  // No over-removal: the remainder never contains a NEGATIVE (Counter never
  // records negatives, so this is the union-equals-hand assertion above), and
  // every group card was really in the hand.
  for (const [card, n] of counter(used)) {
    expect(n).toBeLessThanOrEqual(handCount.get(card) ?? 0);
  }
}

// ---------------------------------------------------------------------------
// (A) Soundness — every emitted group is a genuine SF.
// ---------------------------------------------------------------------------

function assertGroupSound(group: Card[], level: Rank): void {
  const wild = `${level}H` as Card;
  const wildIdx = group.map((c, i) => (c === wild ? i : -1)).filter((i) => i >= 0);
  // Substitute the group's wilds over every identity; ∃ assignment → SF.
  let ok = false;
  const trySub = (k: number, cur: Card[]): void => {
    if (ok) return;
    if (k === wildIdx.length) {
      if (naturalSfTop(cur) !== null) ok = true;
      return;
    }
    for (const id of ALL_IDENTITIES) {
      const next = [...cur];
      next[wildIdx[k]!] = id;
      trySub(k + 1, next);
    }
  };
  trySub(0, [...group]);
  expect(ok, `group ${group.join(',')} is a genuine SF`).toBe(true);
}

// ---------------------------------------------------------------------------
// Independent group-field, tag-truth and ranking checks (audit findings: the
// oracle previously compared REMAINDERS only, asserted no tag VALUES, and
// claimed a Pareto check it never performed).
// ---------------------------------------------------------------------------

/** Every window top under which `group` reads as an SF — independent (naturalSfTop
 *  + substitution), so it can disagree with the finder's classifyPlays labels. */
function groupTops(group: readonly Card[], level: Rank): Rank[] {
  const wild = `${level}H` as Card;
  const wildIdx = group.map((c, i) => (c === wild ? i : -1)).filter((i) => i >= 0);
  const tops = new Set<Rank>();
  const rec = (k: number, cur: Card[]): void => {
    if (k === wildIdx.length) {
      const t = naturalSfTop(cur);
      if (t !== null) tops.add(t);
      return;
    }
    for (const id of ALL_IDENTITIES) {
      const next = [...cur];
      next[wildIdx[k]!] = id;
      rec(k + 1, next);
    }
  };
  rec(0, [...group]);
  return [...tops];
}

/** Max pairwise-DISJOINT plays of a predicate class in `cards`, by exhaustive
 *  search over the engine's own legal plays. Used to bound (never to define) what
 *  a count tag may claim. */
function maxDisjoint(
  cards: readonly Card[],
  level: Rank,
  config: RuleVariant,
  pick: (decl: CanonicalForm) => boolean,
): number {
  const plays = legalPlays([...cards], null, level, config).filter((p) => pick(p.decl));
  const pool0 = new Map<Card, number>();
  for (const c of cards) pool0.set(c, (pool0.get(c) ?? 0) + 1);
  let best = 0;
  const rec = (idx: number, pool: Map<Card, number>, n: number): void => {
    best = Math.max(best, n);
    if (idx >= plays.length || n > 6) return;
    for (let j = idx; j < plays.length; j++) {
      const need = new Map<Card, number>();
      for (const c of plays[j]!.cards) need.set(c, (need.get(c) ?? 0) + 1);
      let ok = true;
      for (const [c, k] of need) if ((pool.get(c) ?? 0) < k) { ok = false; break; }
      if (!ok) continue;
      const next = new Map(pool);
      for (const [c, k] of need) next.set(c, next.get(c)! - k);
      rec(j + 1, next, n + 1);
    }
  };
  rec(0, pool0, 0);
  return best;
}

/** Max pairwise-DISJOINT straight flushes in `cards`, counted INDEPENDENTLY of
 *  the engine: every 5-card subset recognised by naturalSfTop (wilds substituted)
 *  is a candidate, taken greedily over physical positions. Twins and different
 *  suits are naturally distinct here — which is exactly what the suit-blind
 *  legalPlays projection cannot express. */
function maxDisjointSfs(cards: readonly Card[], level: Rank): number | null {
  const n = cards.length;
  // The subset scan is C(n,5); above this the check is SKIPPED and reports
  // UNKNOWN (null) — never 0, which would read as "holds no straight flush" and
  // wrongly fail a correct count (it did on first run).
  if (n > 18) return null;
  const combos: number[][] = [];
  const pick: number[] = [];
  const gen = (start: number): void => {
    if (pick.length === 5) {
      const chosen = pick.map((i) => cards[i]!);
      if (groupWildAssignments(chosen, level).length > 0) combos.push([...pick]);
      return;
    }
    for (let i = start; i < n; i++) {
      pick.push(i);
      gen(i + 1);
      pick.pop();
    }
  };
  gen(0);
  const used = new Array<boolean>(n).fill(false);
  let best = 0;
  const rec = (idx: number, taken: number): void => {
    best = Math.max(best, taken);
    for (let j = idx; j < combos.length; j++) {
      const c = combos[j]!;
      if (c.some((i) => used[i])) continue;
      for (const i of c) used[i] = true;
      rec(j + 1, taken + 1);
      for (const i of c) used[i] = false;
    }
  };
  rec(0, 0);
  return best;
}

/** Every tag must state something TRUE about the remainder: counts never exceed
 *  what is really extractable disjointly, `straightFlush` fires whenever an SF is
 *  really present (the demoted-SF mislabel that shipped green before), `scatter`
 *  only when literally nothing combines, `cardsLeft` is exact. */
function assertTagsTruthful(d: Decomposition, level: Rank, config: RuleVariant): void {
  const R = d.remainder;
  const where = `remainder ${R.join(',') || '(empty)'}`;
  const tag = (k: string) => d.tags.find((t) => t.kind === k);

  expect(tag('cardsLeft')?.count, `${where} cardsLeft exact`).toBe(R.length);

  // The bound must itself be multiplicity-aware: maxDisjoint iterates legalPlays,
  // whose SF projection is SUIT-BLIND, so it can only ever see ONE straight flush
  // per window. Counting the SF bound INDEPENDENTLY (5-card subsets recognised by
  // naturalSfTop, greedily taken while disjoint) keeps the check honest — and it
  // is what caught the finder's own undercount.
  const isRankBomb = (decl: CanonicalForm) => isBombForm(decl, config) && decl.type !== 'straightFlush';
  const sfMax = maxDisjointSfs(R, level);
  const bombMax = maxDisjoint(R, level, config, isRankBomb);

  // Counts never OVERCLAIM (skipped when the independent bound is UNKNOWN).
  const sfCount = tag('straightFlush')?.count ?? 0;
  const bombCount = tag('bomb')?.count ?? 0;
  if (sfMax !== null) {
    expect(sfCount, `${where} straightFlush count ≤ max disjoint`).toBeLessThanOrEqual(sfMax);
  }
  expect(bombCount, `${where} bomb count ≤ max disjoint`).toBeLessThanOrEqual(bombMax);

  // A present straight flush is NEVER reported as merely a run / scatter — the
  // config-dependent mislabel the audit found (a demoted SF is still an SF).
  //
  // Stated as the exact invariant: the weak presence words only fire when the
  // greedy took NOTHING notable (no bomb, no SF), so if one is present the
  // remainder must genuinely hold neither. NOTE the deliberately weaker form —
  // "any extractable SF ⇒ the SF tag fires" would be WRONG: when the greedy takes
  // rank bombs first, an SF sharing those cards is an ALTERNATIVE use of them,
  // not a concurrent holding, and 'bomb ×N' is the true report.
  const weak = ['run', 'fullHouse', 'triple', 'pair', 'scatter'].some((k) => tag(k) !== undefined);
  if (weak) {
    if (sfMax !== null) {
      expect(sfMax, `${where} tagged a weak structure, so it must hold NO straight flush`).toBe(0);
    }
    expect(bombMax, `${where} tagged a weak structure, so it must hold no rank bomb`).toBe(0);
  }
  // And when an SF is the ONLY notable holding, it must be named as one.
  if (sfMax !== null && sfMax > 0 && bombMax === 0) {
    expect(sfCount, `${where} holds an SF and no bomb, so the SF tag must fire`).toBeGreaterThan(0);
  }
  // No remainder is left SILENT: a non-empty remainder always carries at least
  // one descriptive tag beside the bare count (the gap the vocabulary extension
  // closed).
  if (R.length > 0) {
    const descriptive = d.tags.filter((t) => t.kind !== 'cardsLeft');
    expect(descriptive.length, `${where} must not be silent`).toBeGreaterThan(0);
  }
  // SCATTER means literally nothing combines.
  if (tag('scatter') !== undefined) {
    const anyMulti = legalPlays([...R], null, level, config).some((p) => p.cards.length >= 2);
    expect(anyMulti, `${where} tagged scatter, so no multi-card play may exist`).toBe(false);
  }
}

/** (D) The shown list IS the Pareto frontier of `raw`, in the published order.
 *  Recomputed here from the PUBLISHED rule (dominance on SF-strength vector +
 *  remainder quality) using independently-derived quantities, then compared. */
function assertParetoFrontierAndOrder(
  raw: readonly Decomposition[],
  result: { decompositions: Decomposition[]; totalFound: number },
  level: Rank,
  config: RuleVariant,
): void {
  if (raw.length === 0) {
    expect(result.decompositions).toEqual([]);
    expect(result.totalFound).toBe(0);
    return;
  }
  // Independent SF-strength vector: bombs outrank demoted SFs, then window top.
  const sfVec = (d: Decomposition): number[] =>
    d.groups
      .map((g) => {
        const tops = groupTops(g.cards, level);
        const top = tops.sort((a, b) => RANKS.indexOf(b) - RANKS.indexOf(a))[0]!;
        return (isBombForm(g.forms[0]!, config) ? 1000 : 0) + RANKS.indexOf(top) + 2;
      })
      .sort((a, b) => b - a);
  // Remainder quality, same published lexicographic tuple. bombPower comes from
  // the PRODUCT's own remainderQuality — imported deliberately, the clampBudgetMs
  // idiom: the model and the product must agree on the DEFINITION, and that
  // agreement is the pin. (Re-deriving it here would be duplication, not
  // verification; independence for the COUNTS lives in assertTagsTruthful, which
  // bounds them with its own brute-force enumeration.)
  const quality = (d: Decomposition): [number, number, number] =>
    remainderQuality(d.remainder, level, config);
  const ge = (a: number[], b: number[]): boolean => {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) if ((a[i] ?? -Infinity) < (b[i] ?? -Infinity)) return false;
    return true;
  };
  const qCmp = (a: [number, number, number], b: [number, number, number]): number =>
    a[0] !== b[0] ? a[0] - b[0] : a[1] !== b[1] ? a[1] - b[1] : a[2] - b[2];

  const scored = raw.map((d) => ({ d, v: sfVec(d), q: quality(d), key: canonicalKey(d.remainder) }));
  const frontier = scored.filter(
    (x) =>
      !scored.some(
        (o) =>
          o !== x &&
          ge(o.v, x.v) &&
          qCmp(o.q, x.q) >= 0 &&
          (JSON.stringify(o.v) !== JSON.stringify(x.v) || qCmp(o.q, x.q) > 0),
      ),
  );
  // The frontier SIZE is what totalFound reports.
  expect(result.totalFound, 'totalFound == independent Pareto frontier size').toBe(frontier.length);
  // ORDER: SF-strength desc, then remainder quality desc, then the stable key.
  frontier.sort((a, b) => {
    const n = Math.max(a.v.length, b.v.length);
    for (let i = 0; i < n; i++) {
      const av = a.v[i] ?? -Infinity;
      const bv = b.v[i] ?? -Infinity;
      if (av !== bv) return bv - av;
    }
    const q = qCmp(b.q, a.q);
    if (q !== 0) return q;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
  const expected = frontier.map((x) => x.key);
  const actual = result.decompositions.map((d) => canonicalKey(d.remainder));
  expect(actual, 'shown == top-N of the independently ranked frontier, in order').toEqual(expected);
}

// ---------------------------------------------------------------------------
// Full battery over one hand.
// ---------------------------------------------------------------------------

function checkHand(hand: readonly Card[], level: Rank, config: RuleVariant): void {
  const raw = enumerateDecompositions(hand, level, config);
  // (B) COMPLETENESS: the finder's arrangements (by canonical form-sets+remainder
  // identity) == the independent oracle's frugal set.
  const rawCanon = new Set(raw.map((d) => canonicalKey(d.remainder)));
  const oracleCanon = oracleSignatures(hand, level);
  expect([...rawCanon].sort(), `hand ${hand.join(' ')} @lvl${level}`).toEqual([...oracleCanon].sort());
  // No duplicate ARRANGEMENT in raw (the finder never shows the same arrangement
  // twice) — raw is already deduped on this exact key.
  expect(rawCanon.size).toBe(raw.length);

  for (const d of raw) {
    for (const g of d.groups) assertGroupSound(g.cards, level); // (A)
    assertComplementExact(hand, d); // (C)
    // Every group's REPORTED FIELDS are independently correct, not just its type
    // (audit finding: suit/top/forms/wildsUsed were previously unchecked, so a
    // finder reporting every top as 'A' would have passed the whole sweep).
    for (const g of d.groups) {
      expect(g.forms.length).toBeGreaterThan(0);
      for (const f of g.forms) expect(f.type).toBe('straightFlush');
      const wild = `${level}H` as Card;
      // suit: the single suit of the group's naturals (independent read).
      const naturalSuits = new Set(g.cards.filter((c) => c !== wild).map((c) => c[1]));
      expect(naturalSuits.size, `group ${g.cards.join(',')} one natural suit`).toBe(1);
      expect(g.suit).toBe([...naturalSuits][0]);
      // wildsUsed: the physical wild count.
      expect(g.wildsUsed).toBe(g.cards.filter((c) => c === wild).length);
      // forms/top: exactly the tops the INDEPENDENT recognizer admits, and `top`
      // is the strongest (largest window top) among them.
      const oracleTops = new Set(groupTops(g.cards, level));
      const reportedTops = new Set(g.forms.map((f) => f.keyRank));
      expect([...reportedTops].sort(), `group ${g.cards.join(',')} tops`).toEqual(
        [...oracleTops].sort(),
      );
      expect(g.top).toBe(g.forms[0]!.keyRank);
      const byWindowTop = [...oracleTops].sort((a, b) => RANKS.indexOf(b) - RANKS.indexOf(a));
      expect(g.top).toBe(byWindowTop[0]);
      // Every form carries the group's suit.
      for (const f of g.forms) expect(f.suit).toBe(g.suit);
    }
    // Tags: in the closed set AND independently TRUE (audit finding: membership
    // alone let a mislabelled remainder ship green).
    for (const tag of d.tags) expect(REMAINDER_TAG_KINDS).toContain(tag.kind);
    assertTagsTruthful(d, level, config);
  }

  // (D) RANKING — really verified now (audit finding: this was DOCUMENTED as an
  // independent Pareto recomputation but never implemented; the old assertions
  // would have passed `raw.slice(0,6)` in arbitrary order).
  const result = findStraightFlushes(hand, level, config);
  expect(result.found).toBe(raw.length > 0);
  assertParetoFrontierAndOrder(raw, result, level, config);
  // The whole frontier is returned: every way the player is told about is reachable.
  expect(result.totalFound).toBe(result.decompositions.length);
}

// ---------------------------------------------------------------------------
// Named cases (the concrete hands the model must handle).
// ---------------------------------------------------------------------------

describe('straight-flush finder — named cases', () => {
  it('zero SF: returns empty, found=false, no throw (the acknowledge-the-press signal)', () => {
    // A scattered off-suit hand — no five one-suit consecutive cards.
    const hand: Card[] = ['2S', '5D', '8C', 'JH', 'AS', '3D', '9C'];
    const result = findStraightFlushes(hand, '2', JIANGSU_OFFICIAL_ONLINE);
    expect(result.found).toBe(false);
    expect(result.decompositions).toEqual([]);
    expect(result.totalFound).toBe(0);
    checkHand(hand, '2', JIANGSU_OFFICIAL_ONLINE);
  });

  it('the twin double-pull: 5S5S6S6S7S7S8S8S9S9S @lvl2 offers TWO identical top-9♠ SF bombs', () => {
    const hand: Card[] = ['5S', '5S', '6S', '6S', '7S', '7S', '8S', '8S', '9S', '9S'];
    checkHand(hand, '2', JIANGSU_OFFICIAL_ONLINE);
    const result = findStraightFlushes(hand, '2', JIANGSU_OFFICIAL_ONLINE);
    // The maximal decomposition pulls BOTH SFs, empty remainder.
    const two = result.decompositions.find((d) => d.groups.length === 2);
    expect(two, 'a 2-SF decomposition exists').toBeDefined();
    expect(two!.remainder).toEqual([]);
    for (const g of two!.groups) {
      expect(g.top).toBe('9');
      expect(g.wildsUsed).toBe(0);
    }
    // It ranks first (strongest SFValue), and its remainder tags = just cardsLeft 0.
    expect(result.decompositions[0]!.groups.length).toBe(2);
    expect(result.decompositions[0]!.tags).toEqual([{ kind: 'cardsLeft', count: 0 }]);
  });

  it('global wild allocation: 5S..KS + 2H @lvl2 packs TWO disjoint SFs (per-window frugal would miss it)', () => {
    const hand: Card[] = ['5S', '6S', '7S', '8S', '9S', 'TS', 'JS', 'QS', 'KS', '2H'];
    checkHand(hand, '2', JIANGSU_OFFICIAL_ONLINE);
    const result = findStraightFlushes(hand, '2', JIANGSU_OFFICIAL_ONLINE);
    // Some decomposition pulls 2 disjoint SFs using the single wild globally.
    const two = result.decompositions.find((d) => d.groups.length === 2);
    expect(two, 'a 2-SF decomposition exists via global wild allocation').toBeDefined();
    expect(two!.groups.reduce((n, g) => n + g.wildsUsed, 0)).toBe(1);
  });

  it('end-position: a wild-completed run carries BOTH tops as one group (same cards, same remainder)', () => {
    // 5S6S7S8S + wild, no 9S and no 4S in hand ⇒ both top-9♠ and top-8♠ need the wild.
    const hand: Card[] = ['5S', '6S', '7S', '8S', '2H', 'KC', 'QD'];
    checkHand(hand, '2', JIANGSU_OFFICIAL_ONLINE);
    const raw = enumerateDecompositions(hand, '2', JIANGSU_OFFICIAL_ONLINE);
    const group = raw.flatMap((d) => d.groups).find((g) => g.cards.includes('2H'));
    expect(group).toBeDefined();
    const tops = new Set(group!.forms.map((f) => f.keyRank));
    expect(tops.has('9')).toBe(true);
    expect(tops.has('8')).toBe(true);
    // Strongest (larger top) first.
    expect(group!.forms[0]!.keyRank).toBe('9');
  });

  it('A-low: AS2S3S4S5S @lvlK is a straight flush topping at 5', () => {
    const hand: Card[] = ['AS', '2S', '3S', '4S', '5S', 'TD', '9C'];
    checkHand(hand, 'K', JIANGSU_OFFICIAL_ONLINE);
    const result = findStraightFlushes(hand, 'K', JIANGSU_OFFICIAL_ONLINE);
    expect(result.found).toBe(true);
    const g = result.decompositions[0]!.groups[0]!;
    expect(g.top).toBe('5');
    expect(g.suit).toBe('S');
  });

  it('hearts through the level: the wild fills its own heart slot as itself', () => {
    // level 7 ⇒ wild is 7H. Window 5H6H7H8H9H needs the 7H slot from a wild.
    const hand: Card[] = ['5H', '6H', '8H', '9H', '7H', '2C', 'KD'];
    checkHand(hand, '7', JIANGSU_OFFICIAL_ONLINE);
    const result = findStraightFlushes(hand, '7', JIANGSU_OFFICIAL_ONLINE);
    expect(result.found).toBe(true);
    const g = result.decompositions.flatMap((d) => d.groups).find((x) => x.suit === 'H');
    expect(g).toBeDefined();
    expect(g!.wildsUsed).toBe(1);
  });

  it('two wilds open several windows: 5S6S7S + 2H2H @lvl2', () => {
    const hand: Card[] = ['5S', '6S', '7S', '2H', '2H', 'AC', 'AD'];
    checkHand(hand, '2', JIANGSU_OFFICIAL_ONLINE);
    const result = findStraightFlushes(hand, '2', JIANGSU_OFFICIAL_ONLINE);
    expect(result.found).toBe(true);
    // The AA pair sits in the remainder; the SF windows use the two wilds.
    expect(result.totalFound).toBeGreaterThanOrEqual(1);
  });

  it('remainder annotation reads the leftover factually (a bomb left behind)', () => {
    // One SF + a natural 4-bomb of K left over.
    const hand: Card[] = ['5S', '6S', '7S', '8S', '9S', 'KC', 'KD', 'KH', 'KS'];
    const result = findStraightFlushes(hand, '2', JIANGSU_OFFICIAL_ONLINE);
    expect(result.found).toBe(true);
    const d = result.decompositions.find((x) => x.groups.length === 1 && x.groups[0]!.top === '9');
    expect(d).toBeDefined();
    const bombTag = d!.tags.find((t) => t.kind === 'bomb');
    expect(bombTag).toEqual({ kind: 'bomb', count: 1 });
  });

  it('AUDIT REGRESSION — a DEMOTED straight flush in the remainder is still reported as a straight flush, never as "run"', () => {
    // Under wildStraightFlushIsBomb=false a wild-substituted SF is DEMOTED (not a
    // bomb). The annotator used to count SFs off the bomb-filtered list, so this
    // remainder — which really holds a spade straight flush — was tagged 'run'.
    // The tag LIED about the cards; the closed FACTUAL vocabulary exists to stop
    // exactly that.
    const hand: Card[] = ['5S', '6S', '7S', '8S', '9S', 'TS', 'JS', 'QS', 'KS', '2H'];
    const demoted: RuleVariant = { ...JIANGSU_OFFICIAL_ONLINE, wildStraightFlushIsBomb: false };
    const ds = enumerateDecompositions(hand, '2', demoted);
    const d = ds.find((x) => canonicalKey(x.remainder) === canonicalKey(['TS', 'JS', 'QS', 'KS', '2H']));
    expect(d, 'the TS-KS+wild remainder arrangement exists').toBeDefined();
    expect(d!.tags.find((t) => t.kind === 'straightFlush')?.count).toBe(1);
    expect(d!.tags.find((t) => t.kind === 'run')).toBeUndefined();
    expect(d!.tags.find((t) => t.kind === 'scatter')).toBeUndefined();
  });

  it('AUDIT REGRESSION — a remainder holding a PAIR is never tagged "scatter"', () => {
    // scatter means literally "loose cards"; a leftover pair combines, so the tag
    // would misread the cards.
    const hand: Card[] = ['5S', '6S', '7S', '8S', '9S', '3D', 'KC', 'KC'];
    for (const d of enumerateDecompositions(hand, '2', JIANGSU_OFFICIAL_ONLINE)) {
      if (d.remainder.filter((c) => c === 'KC').length === 2) {
        expect(d.tags.find((t) => t.kind === 'scatter'), `remainder ${d.remainder.join(',')}`).toBeUndefined();
      }
    }
  });

  it('AUDIT REGRESSION — TWO disjoint straight flushes in the remainder are counted as TWO', () => {
    // legalPlays dedups SFs by the SUIT-BLIND projection (one emission per
    // window), so counting off it reported ONE here — systematically undercounting
    // the very "break it and I have two bombs" signal the feature exists for.
    // Counts now come from multiplicity-aware enumeration.
    const hand: Card[] = [
      'AS', '2S', '3S', '4S', '5S', // the SF we pull
      '5C', '6C', '7C', '8C', '9C', // remainder SF #1 (clubs)
      '5D', '6D', '7D', '8D', '9D', // remainder SF #2 (diamonds)
    ];
    const d = enumerateDecompositions(hand, 'K', JIANGSU_OFFICIAL_ONLINE).find(
      (x) => x.remainder.length === 10,
    );
    expect(d, 'an arrangement leaving the two other runs exists').toBeDefined();
    expect(d!.tags.find((t) => t.kind === 'straightFlush')?.count).toBe(2);
  });

  it('AUDIT REGRESSION — a remainder that only holds a PAIR / TRIPLE / FULL HOUSE is still described', () => {
    // Fixing the scatter overreach had traded a wrong tag for SILENCE (only a card
    // count) although the remainder really held a combo.
    const cases: [Card[], string][] = [
      [['5S', '6S', '7S', '8S', '9S', '3D', 'KC', 'KC'], 'pair'],
      [['5S', '6S', '7S', '8S', '9S', 'KC', 'KD', 'KH'], 'triple'],
      [['5S', '6S', '7S', '8S', '9S', 'QC', 'QD', 'KC', 'KD', 'KH'], 'fullHouse'],
    ];
    for (const [hand, expectedKind] of cases) {
      const d = enumerateDecompositions(hand, '2', JIANGSU_OFFICIAL_ONLINE).find(
        (x) => x.groups.length === 1 && x.remainder.length === hand.length - 5,
      );
      expect(d, `an arrangement exists for ${hand.join(',')}`).toBeDefined();
      const descriptive = d!.tags.filter((t) => t.kind !== 'cardsLeft');
      expect(descriptive.length, `${hand.join(',')} must not be silent`).toBeGreaterThan(0);
      expect(descriptive.map((t) => t.kind)).toContain(expectedKind);
    }
  });

  it('AUDIT REGRESSION — the holdings count is STRONGEST-first, explicitly NOT maximum-cardinality', () => {
    // The 4x5 crosshatch: 5-9 in all four suits. TWO true readings of the same
    // cards — four straight flushes (4 x tier 55 = 220) or five rank bombs
    // (5 x tier 40 = 200). The greedy takes the STRONGER one, so it reports 4,
    // not 5. That is deliberate (each SF beats a 4-bomb, so it is the better
    // thing to tell a player) and it is why the contract is "real, pairwise
    // disjoint, a LOWER BOUND" — never "the maximum number of holdings". Pinned
    // so the comment and the behaviour cannot drift apart again.
    const crosshatch: Card[] = [];
    for (const r of ['5', '6', '7', '8', '9'] as const) {
      for (const s of SUITS) crosshatch.push(`${r}${s}` as Card);
    }
    const held = countHoldings(crosshatch, '2', JIANGSU_OFFICIAL_ONLINE);
    expect(held.straightFlushes, 'four straight flushes, one per suit').toBe(4);
    expect(held.bombs, 'the stronger SF reading consumes the cards').toBe(0);
    // The alternative 5-bomb reading really does exist — this is a genuine
    // strength-vs-cardinality choice, not a blindness.
    const fiveBombs = maxDisjoint(crosshatch, '2', JIANGSU_OFFICIAL_ONLINE, (d) => d.type === 'bomb');
    expect(fiveBombs, 'five disjoint rank bombs also exist').toBeGreaterThanOrEqual(5);
    // And the reported holdings are genuinely disjoint (no overclaim).
    expect(held.straightFlushes * 5).toBeLessThanOrEqual(crosshatch.length);
  });

  it('AUDIT REGRESSION — coverage/orphans are MULTIPLICITY-aware (a twin is a physically distinct card)', () => {
    // The coverage metric used a Set keyed on card identity, so a straight flush
    // covering ONE 5S marked BOTH copies covered and reported orphans=0. That
    // flatters twin-heavy remainders and can wrongly dominate a genuinely cleaner
    // one away in the Pareto ranking.
    const twinned: Card[] = ['5S', '5S', '6S', '7S', '8S', '9S'];
    const clean: Card[] = ['5S', '6S', '7S', '8S', '9S'];
    const twinnedQ = remainderQuality(twinned, '2', JIANGSU_OFFICIAL_ONLINE);
    const cleanQ = remainderQuality(clean, '2', JIANGSU_OFFICIAL_ONLINE);
    expect(-twinnedQ[2], 'the spare twin is a real orphan').toBe(1);
    expect(-cleanQ[2], 'a clean straight flush leaves no orphan').toBe(0);
    expect(twinnedQ[1], 'twinned coverage is below a clean cover').toBeLessThan(cleanQ[1]);
    // And the cover takes the LARGEST play first, so it is not hostage to
    // legalPlays' emission order (a lone pair used to win over the 5-card SF).
    expect(twinnedQ[1]).toBeCloseTo(5 / 6, 5);
  });

  it('AUDIT REGRESSION — realistic 27-card hands: correct, bounded, and within the packing budget', () => {
    // The finder ships for 27-card hands; the suite previously never exceeded 10.
    const hands: Card[][] = [
      ['5S','6S','7S','8S','9S','TS','JS','QS','KS','AS','2H','2H','3C','4C','5C','6C','7D','8D','9D','TD','JH','QH','KH','AH','SJ','BJ','2C'],
      ['3S','4S','5S','6S','7S','8S','9S','TS','3H','4H','5H','6H','7H','8H','9H','TH','3C','4C','5C','6C','3D','4D','5D','6D','2H','2H','SJ'],
    ];
    for (const hand of hands) {
      expect(hand).toHaveLength(27);
      const raw = enumerateDecompositions(hand, '2', JIANGSU_OFFICIAL_ONLINE);
      const result = findStraightFlushes(hand, '2', JIANGSU_OFFICIAL_ONLINE);
      expect(result.found).toBe(true);
      // Soundness + complement-exactness still hold at full hand size.
      for (const d of raw) {
        for (const g of d.groups) assertGroupSound(g.cards, '2');
        assertComplementExact(hand, d);
        assertTagsTruthful(d, '2', JIANGSU_OFFICIAL_ONLINE);
      }
      // Ranking is the real frontier, in order, capped.
      assertParetoFrontierAndOrder(raw, result, '2', JIANGSU_OFFICIAL_ONLINE);
      expect(result.totalFound).toBe(result.decompositions.length);
      // The packing budget is NOT reached on realistic hands (if it were, whole
      // decompositions would be dropped — a completeness compromise, not a
      // display cap). raw well under the budget is the observable proxy.
      expect(raw.length).toBeLessThan(SF_FINDER_PACKING_BUDGET);
    }
  }, 30_000);

  it('is pure: does not mutate the hand and is deterministic', () => {
    const hand: Card[] = ['5S', '6S', '7S', '8S', '9S', '2H', 'KC'];
    const snapshot = [...hand];
    const a = findStraightFlushes(hand, '2', JIANGSU_OFFICIAL_ONLINE);
    const b = findStraightFlushes(hand, '2', JIANGSU_OFFICIAL_ONLINE);
    expect(hand).toEqual(snapshot); // no mutation
    expect(JSON.stringify(a)).toBe(JSON.stringify(b)); // deterministic
  });
});

// ---------------------------------------------------------------------------
// Closed, FACTUAL tag vocabulary (owner strengthen 1) — structural pin.
// ---------------------------------------------------------------------------

describe('straight-flush finder — remainder tag vocabulary is closed and factual', () => {
  it('is exactly the eight factual kinds — no advisory/comparative kind may be added', () => {
    expect([...REMAINDER_TAG_KINDS].sort()).toEqual([
      'bomb',
      'cardsLeft',
      'fullHouse',
      'pair',
      'run',
      'scatter',
      'straightFlush',
      'triple',
    ]);
    const advisory = ['better', 'best', 'recommended', 'stronger', 'weaker', 'optimal', 'worse', 'advice'];
    for (const bad of advisory) {
      expect((REMAINDER_TAG_KINDS as readonly string[]).includes(bad)).toBe(false);
    }
  });

  it('AUDIT REGRESSION — the bomb ladder has ONE definition: the finder must not re-type combos.bombTier', () => {
    // A local bombWeight() copy had DRIFTED (jokerBomb hard-coded 100, missing the
    // jokerBombSupreme=false 75 rung), silently reordering what the player is
    // shown — the "second oracle that drifts" this module's header claims is
    // impossible. The fix was to export and use combos.bombTier; this SOURCE
    // ratchet (the design-system.test idiom) stops a copy coming back, because a
    // behavioural test for it needs a contrived joker-bomb hand.
    const src = readFileSync(
      new URL('../../../src/engine/guandan/straight-flush-finder.ts', import.meta.url),
      'utf8',
    );
    expect(src, 'the finder must import the one bomb ladder').toContain('bombTier');
    // No re-typed ladder: the tier constants must not appear as literals in CODE.
    // Comments are stripped first — prose legitimately cites numbers (measured
    // timings, budgets), and matching those was a false positive on the first run.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const ladderLiterals = code.match(/\b(?:110|100|75|55)\b/g) ?? [];
    expect(ladderLiterals, `bomb-ladder literals re-typed in the finder: ${ladderLiterals.join(',')}`).toEqual([]);
    expect(code).not.toMatch(/function\s+bombWeight/);
  });

  it('every tag the finder ever emits is in the closed set', () => {
    const hands: Card[][] = [
      ['5S', '6S', '7S', '8S', '9S', 'KC', 'KD', 'KH', 'KS'],
      ['5S', '5S', '6S', '6S', '7S', '7S', '8S', '8S', '9S', '9S'],
      ['5S', '6S', '7S', '2H', '2H', 'AC', 'AD'],
      ['AS', '2S', '3S', '4S', '5S', 'TD', '9C', '9H'],
    ];
    for (const hand of hands) {
      for (const d of enumerateDecompositions(hand, '2', JIANGSU_OFFICIAL_ONLINE)) {
        for (const tag of d.tags) expect(REMAINDER_TAG_KINDS).toContain(tag.kind);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Property sweep — random twin/wild-heavy small hands, config sweep, cross-
// checked against the independent oracle (§5.2/§5.3). Manual enumeration proved
// untrustworthy in the wild-disambiguation work, so the oracle is the authority.
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A small hand biased toward twins and one-suit runs (the hard cases), drawn
 *  from a two-deck supply so no identity exceeds 2 copies and wilds ≤ 2. */
function randomHand(rng: () => number, level: Rank): Card[] {
  const wild = `${level}H` as Card;
  const supply = new Map<Card, number>();
  const bump = (c: Card, max: number): boolean => {
    const n = supply.get(c) ?? 0;
    if (n >= max) return false;
    supply.set(c, n + 1);
    return true;
  };
  const hand: Card[] = [];
  const size = 6 + Math.floor(rng() * 3); // 6..8 (keeps the O(52^w) oracle fast)
  // Bias: often a one-suit consecutive seed, sometimes twinned.
  const suit = SUITS[Math.floor(rng() * 4)]!;
  const base = Math.floor(rng() * 9); // rank index 0..8
  for (let i = 0; i < 5 && rng() < 0.85; i++) {
    const card = `${RANKS[base + i]!}${suit}` as Card;
    if (card !== wild && bump(card, 2)) hand.push(card);
    if (rng() < 0.4 && card !== wild && bump(card, 2)) hand.push(card); // twin
  }
  // A wild or two.
  if (rng() < 0.6 && bump(wild, 2)) hand.push(wild);
  if (rng() < 0.3 && bump(wild, 2)) hand.push(wild);
  // Fill with random cards.
  while (hand.length < size) {
    const r = RANKS[Math.floor(rng() * 13)]!;
    const s = SUITS[Math.floor(rng() * 4)]!;
    const card = `${r}${s}` as Card;
    if (bump(card, 2)) hand.push(card);
  }
  return hand;
}

describe('straight-flush finder — property sweep vs the independent oracle', () => {
  const configs: RuleVariant[] = [
    JIANGSU_OFFICIAL_ONLINE,
    { ...JIANGSU_OFFICIAL_ONLINE, wildStraightFlushIsBomb: false },
    { ...JIANGSU_OFFICIAL_ONLINE, allowUnderDeclareStraightFlush: true },
  ];

  it('matches the oracle over randomized twin/wild-heavy hands (all levels, config sweep)', () => {
    // A LIGHT sanity sweep (the named cases carry the thorough coverage); the
    // O(52^w) oracle is CPU-heavy, so keep the count low to avoid starving other
    // parallel test workers.
    const rng = mulberry32(0x5f3759df);
    let checked = 0;
    for (let iter = 0; iter < 15; iter++) {
      const level = RANKS[Math.floor(rng() * 13)]!;
      const config = configs[iter % configs.length]!;
      const hand = randomHand(rng, level);
      checkHand(hand, level, config);
      checked++;
    }
    expect(checked).toBe(15);
  }, 30_000);

  it('(E) frugal-domination: no emitted arrangement spends a wild where a natural of that slot was left in the remainder', () => {
    // AUDIT FINDING: this test used to assert `naturals + wildsUsed === 5`, which
    // is `5 === 5` by construction (wildsUsed is incremented exactly when a wild
    // is pushed) — a TAUTOLOGY, while doc §5(E) claimed a real frugality check.
    // Now it checks the actual property, via the INDEPENDENT frugality predicate
    // the oracle uses: for every group there must exist a valid window whose
    // wild-filled slots are all identities ABSENT from the remainder. A wasteful
    // materialization (wild in a slot whose natural sits unused in the remainder)
    // fails this — and would also mean the remainder is not the natural-first
    // one, i.e. "same groups ⟺ same remainder" (§2.4) would not be well-defined.
    const rng = mulberry32(0x9e3779b9);
    let groupsChecked = 0;
    for (let iter = 0; iter < 40; iter++) {
      const level = RANKS[Math.floor(rng() * 13)]!;
      const hand = randomHand(rng, level);
      for (const d of enumerateDecompositions(hand, level, JIANGSU_OFFICIAL_ONLINE)) {
        expect(
          isFrugalDecomposition(d.groups.map((g) => g.cards), d.remainder, level),
          `hand ${hand.join(' ')} @lvl${level}: non-frugal arrangement, remainder ${d.remainder.join(',')}`,
        ).toBe(true);
        groupsChecked += d.groups.length;
      }
    }
    // Non-vacuity floor: the sweep must actually have produced groups to check.
    expect(groupsChecked, 'the frugality sweep must exercise real groups').toBeGreaterThan(20);
  });
});
