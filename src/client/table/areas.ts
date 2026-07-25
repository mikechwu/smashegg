// Manual sort areas — the hand's client-only visual PARTITION.
//
// Design study + owner decisions: docs/research/sort-areas.md. This module is
// the MODEL and the INVARIANT; the UI is built on top of it, never before it
// (owner sequencing).
//
// WHAT AN AREA IS. A purely visual grouping of the viewer's OWN hand. Every
// card belongs to exactly one area; area 0 (MAIN) is the hand you play from
// and always exists. Areas 1..n-1 are SHELVES, drawn above MAIN. The back end
// never learns areas exist: nothing here is sent, and a play still flows
// through the ordinary selection -> matchSelection -> server validatePlay
// path, so a bug in this file can only mis-ORGANIZE, never mis-PLAY.
//
// ABSENCE, NOT A ONE-AREA STATE. "No areas" is `null`, not `singleArea(n)`.
// That is what makes progressive disclosure REAL rather than nominal: a
// player who never makes a shelf holds `null` forever, so reconcile returns
// the same value (no allocation, no state commit, no re-render), and every
// call site can branch once and run today's exact code. A total `areaOf` map
// over a hand whose LENGTH changes could never return the same instance —
// the pre-build critique caught that, and this is the fix.
//
// TWIN EXACTNESS (the round's most serious finding). `view.hand` holds two
// decks, so identical cards ("twins") are common, and areas can hold them
// SEPARATELY — a 5S on a shelf inside a straight flush while its twin sits in
// MAIN. The project's usual first-unclaimed-slot remap is IDENTITY-BLIND
// between such twins: play the MAIN 5S and the walk hands the surviving 5S to
// MAIN, dropping the shelf's slot, which silently dismantles the very holding
// the feature exists to protect. `reconcileAreas` therefore does NOT re-derive
// membership by identity when the client caused the change: it removes the
// EXACT slots the client committed (which it knows, from the selection it
// submitted) and keeps every other slot's area. See remapAreas.

import type { Card } from '../../engine/guandan/cards';
import type { SelectionContext } from './helpers';

/** The area every card starts in and the one that always exists. Rendered
 *  LAST (the bottom band, nearest the play desk) so the hand you play from
 *  never moves away from the desk as shelves come and go. */
export const MAIN_AREA = 0;

/** 0 is MAIN; 1.. are shelves, drawn above MAIN in ascending order. */
export type AreaId = number;

/** Passed as a move destination to mean "a shelf that does not exist yet". */
export const NEW_SHELF = -1;

/** 0 means "not part of any recorded group". */
export type GroupId = number;
export const NO_GROUP = 0;

/**
 * How a recorded group is currently doing. The annotation MUST DEGRADE RATHER
 * THAN LIE: the instant a member leaves — played, tributed away, or moved by the
 * player — a label reading "this is a straight flush" is false, and drawn on
 * screen it would tell the player a flush is intact when it is not.
 *
 *   'intact' — every recorded member is still here. Only here may the group be
 *              named as the combination it was.
 *   'broken' — it lost members but at least two remain. Still drawn as a group
 *              (these cards WERE set aside together, which is true) but carrying
 *              NO combination claim.
 *   dissolved — fewer than two remain, so it stops being a group at all and the
 *              survivors rejoin the loose cards. Represented by absence, not by
 *              a third label.
 */
export type GroupHealth = 'intact' | 'broken';

/**
 * The hand's manual arrangement: a TOTAL function slot -> area over
 * `view.hand`, plus how many areas exist.
 *
 * REPRESENTABLE-ONLY-IF-VALID for the two properties the owner named:
 *   - DISJOINT: `areaOf[i]` is ONE AreaId, so "a card in two areas" has no
 *     inhabitant at all.
 *   - COVERING: every slot has an entry, so "a card in no area" has none.
 * Union-equals-hand and empty-intersections are therefore theorems about the
 * type, not assertions about a value. What remains merely VALIDATED is the
 * scalar agreement `areaOf.length === hand.length` and `areaOf[i] <
 * areaCount`, and both are established at the single construction site
 * (`remapAreas`) that ever builds a HandAreas against a hand it did not
 * already match.
 *
 * A move is a single write per slot, so no intermediate state exists in which
 * a card has left one area without arriving in another.
 *
 * INVARIANT (non-null): `areaCount >= 2`, and every shelf is NON-EMPTY. A
 * value with only MAIN left is not representable as a HandAreas — it
 * normalizes to `null`, which is the same thing said honestly.
 */
export interface HandAreas {
  readonly areaOf: readonly AreaId[];
  readonly areaCount: number;
  /**
   * RECORDED grouping: which sent-together set each slot belongs to, 0 = none.
   *
   * Parallel to `areaOf` and remapped in the SAME walk, deliberately, so the two
   * can never disagree about which slot is which — the lesson the twin-remap
   * round paid for.
   *
   * RECORDED, NEVER RE-DERIVED. The alternative — recomputing "which of these
   * cards form a straight flush" from a shelf's contents — is unsound as a
   * display: decompositions are not unique, so a recomputation can group the
   * same cards differently from what the player actually sent, changing under
   * them for no visible reason. The system knows exactly which group was sent,
   * so it records it.
   */
  readonly groupOf: readonly GroupId[];
  /** Member count of each group AT THE MOMENT IT WAS SENT, indexed by id (index
   *  0 unused). This is what makes staleness detectable: a group is intact only
   *  while it still has every member it was created with. Without it, a group
   *  that lost a card would be indistinguishable from a smaller group. */
  readonly groupSize: readonly number[];
}

/** What the client submitted, and the hand it was submitted against.
 *  `reconcileAreas` uses it to remove the EXACT slots that left rather than
 *  guessing by card identity (the twin fix). The hand is carried so a stale
 *  commit — an action the server rejected, so the hand never changed — can be
 *  recognised and ignored instead of corrupting the next real change. */
export interface HandCommit {
  readonly slots: ReadonlySet<number>;
  readonly hand: readonly Card[];
}

/** Ascending slots of one area. */
export function slotsOf(areas: HandAreas | null, area: AreaId): number[] {
  if (areas === null) return area === MAIN_AREA ? [] : [];
  const out: number[] = [];
  for (let i = 0; i < areas.areaOf.length; i += 1) {
    if (areas.areaOf[i] === area) out.push(i);
  }
  return out;
}

/** Slots of one recorded group, ascending. */
export function slotsOfGroup(areas: HandAreas | null, group: GroupId): number[] {
  if (areas === null || group === NO_GROUP) return [];
  const out: number[] = [];
  for (let i = 0; i < areas.groupOf.length; i += 1) if (areas.groupOf[i] === group) out.push(i);
  return out;
}

/**
 * The health of a recorded group — the whole basis of "degrade, never lie".
 * null means the group no longer exists (fewer than two members).
 */
export function groupHealth(areas: HandAreas | null, group: GroupId): GroupHealth | null {
  if (areas === null) return null;
  const members = slotsOfGroup(areas, group).length;
  if (members < 2) return null;
  const original = areas.groupSize[group] ?? members;
  return members === original ? 'intact' : 'broken';
}

/** Every live group id in one area, in ascending order of first appearance. */
export function groupsIn(areas: HandAreas | null, area: AreaId): GroupId[] {
  if (areas === null) return [];
  const out: GroupId[] = [];
  for (let i = 0; i < areas.groupOf.length; i += 1) {
    const g = areas.groupOf[i]!;
    if (g !== NO_GROUP && areas.areaOf[i] === area && !out.includes(g)) out.push(g);
  }
  return out;
}

/** The bands in RENDER order: shelves ascending from the top, MAIN last so the
 *  hand you play from always sits nearest the desk and never moves away from it
 *  as shelves come and go. */
export function bandOrder(areas: HandAreas | null): AreaId[] {
  const count = areaCountOf(areas);
  const out: AreaId[] = [];
  for (let a = 1; a < count; a += 1) out.push(a);
  out.push(MAIN_AREA);
  return out;
}

/** How many areas exist, counting MAIN. `null` is one area (the whole hand). */
export function areaCountOf(areas: HandAreas | null): number {
  return areas === null ? 1 : areas.areaCount;
}

/** The area a slot lives in. `null` means the whole hand is MAIN. */
export function areaAt(areas: HandAreas | null, slot: number): AreaId {
  return areas === null ? MAIN_AREA : (areas.areaOf[slot] ?? MAIN_AREA);
}

/** Structural equality — used to prove a press changed something. */
export function sameAreas(a: HandAreas | null, b: HandAreas | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a.areaCount !== b.areaCount || a.areaOf.length !== b.areaOf.length) return false;
  return a.areaOf.every((id, i) => id === b.areaOf[i]);
}

/**
 * Drop empty SHELVES and renumber so ids stay 0..areaCount-1 with shelf order
 * preserved. Returns `null` when nothing but MAIN survives — the ONLY way
 * back to the never-user state, and the reason exiting is always reachable.
 * Idempotent.
 */
export function normalizeAreas(areas: HandAreas | null): HandAreas | null {
  if (areas === null) return null;
  const used = new Set(areas.areaOf);
  // Shelves that still hold at least one card, in ascending id order.
  const liveShelves = [...used].filter((id) => id !== MAIN_AREA).sort((a, b) => a - b);
  if (liveShelves.length === 0) return null;
  // Already compact and correctly counted? Return the SAME instance so React
  // state bails out (the never-allocate discipline applies here too).
  const compact =
    areas.areaCount === liveShelves.length + 1 &&
    liveShelves.every((id, i) => id === i + 1);
  // Even when the AREAS need no renumbering, the recorded GROUPS may have gone
  // thin or split, so the dissolve has to run on this path too — it returns the
  // same instance when nothing changed, so the React bail-out still holds.
  if (compact) return dissolveThinGroups(areas);
  const renumber = new Map<AreaId, AreaId>([[MAIN_AREA, MAIN_AREA]]);
  liveShelves.forEach((id, i) => renumber.set(id, i + 1));
  return dissolveThinGroups({
    areaOf: areas.areaOf.map((id) => renumber.get(id) ?? MAIN_AREA),
    areaCount: liveShelves.length + 1,
    groupOf: areas.groupOf,
    groupSize: areas.groupSize,
  });
}

/**
 * Drop any recorded group that no longer has two members, and any group whose
 * members are no longer all in the SAME area (moving half a flush to another
 * band ends the grouping — the annotation describes a set-aside set, and a set
 * spread across bands is not one). Survivors rejoin the loose cards.
 */
export function dissolveThinGroups(areas: HandAreas): HandAreas {
  const seen = new Map<GroupId, { count: number; area: AreaId; split: boolean }>();
  for (let i = 0; i < areas.groupOf.length; i += 1) {
    const g = areas.groupOf[i]!;
    if (g === NO_GROUP) continue;
    const at = areas.areaOf[i] ?? MAIN_AREA;
    const rec = seen.get(g);
    if (rec === undefined) seen.set(g, { count: 1, area: at, split: false });
    else {
      rec.count += 1;
      if (rec.area !== at) rec.split = true;
    }
  }
  let changed = false;
  const groupOf = areas.groupOf.map((g) => {
    if (g === NO_GROUP) return g;
    const rec = seen.get(g)!;
    if (rec.count < 2 || rec.split) {
      changed = true;
      return NO_GROUP;
    }
    return g;
  });
  return changed ? { ...areas, groupOf } : areas;
}

/**
 * Move every selected slot to `destination`, then normalize.
 *
 * `destination` is an existing AreaId, or NEW_SHELF to mint one. Minting is
 * refused when `areaCount` already equals `maxAreas` — the cap is a PARAMETER,
 * not a constant, because the owner's decision makes it budget-aware: how many
 * bands fit depends on how many lines the hand occupies and whether the desk is
 * loud, so the UI computes it and the model merely obeys.
 *
 * Total: any input is accepted and returns a well-formed result. Callers must
 * still consult `moveWouldChange` before OFFERING a control, so no press is
 * ever a silent no-op (this project's house rule).
 */
export function applyMove(
  areas: HandAreas | null,
  handSize: number,
  selected: ReadonlySet<number>,
  destination: AreaId,
  maxAreas: number,
): HandAreas | null {
  if (selected.size === 0) return areas;
  const count = areaCountOf(areas);
  let target = destination;
  if (target === NEW_SHELF) {
    if (count >= maxAreas) return areas;
    target = count;
  }
  if (target < 0 || target > count) return areas;
  const next: AreaId[] = new Array<AreaId>(handSize);
  for (let i = 0; i < handSize; i += 1) next[i] = areaAt(areas, i);
  let moved = false;
  for (const slot of selected) {
    if (slot < 0 || slot >= handSize) continue;
    if (next[slot] !== target) {
      next[slot] = target;
      moved = true;
    }
  }
  if (!moved) return areas;
  const result = normalizeAreas({
    areaOf: next,
    areaCount: Math.max(count, target + 1),
    groupOf: areas?.groupOf ?? new Array<GroupId>(handSize).fill(NO_GROUP),
    groupSize: areas?.groupSize ?? [0],
  });
  // A move can be a WRITE that is not a CHANGE: sending a shelf's whole contents
  // to a fresh shelf empties the old one, which normalizes away and renumbers
  // the new one back to the same id — the same arrangement by a different
  // route. Returning the original keeps `moveWouldChange` honest, which is what
  // the straight-flush finder's repeat-pick path depends on to avoid offering a
  // press that visibly does nothing.
  return sameAreas(areas, result) ? areas : result;
}

/**
 * Move `selected` into `destination` AND record them as one group.
 *
 * This is the finder's send path: the player asked for exactly these cards to go
 * aside together, so exactly those are recorded. Nothing is inferred from the
 * shelf's contents afterwards.
 */
export function applyMoveAsGroup(
  areas: HandAreas | null,
  handSize: number,
  selected: ReadonlySet<number>,
  destination: AreaId,
  maxAreas: number,
): HandAreas | null {
  const moved = applyMove(areas, handSize, selected, destination, maxAreas);
  if (moved === null || selected.size < 2) return moved;
  // Only the slots that actually LANDED in the destination are recorded; a slot
  // outside the hand was never moved and must not be claimed as a member.
  const members = [...selected].filter((i) => i >= 0 && i < handSize);
  if (members.length < 2) return moved;
  const id = moved.groupSize.length;
  const groupOf = [...moved.groupOf];
  for (const i of members) groupOf[i] = id;
  return dissolveThinGroups({
    ...moved,
    groupOf,
    groupSize: [...moved.groupSize, members.length],
  });
}

/** Would `applyMove` with these arguments change anything? The predicate the
 *  UI must gate every area control on, so a control that cannot act is not
 *  offered rather than offered-and-dead. */
export function moveWouldChange(
  areas: HandAreas | null,
  handSize: number,
  selected: ReadonlySet<number>,
  destination: AreaId,
  maxAreas: number,
): boolean {
  return !sameAreas(areas, applyMove(areas, handSize, selected, destination, maxAreas));
}

/** Merge `from` into `into` (every card of `from` joins `into`). */
export function mergeAreas(
  areas: HandAreas | null,
  from: AreaId,
  into: AreaId,
): HandAreas | null {
  if (areas === null || from === into) return areas;
  if (from === MAIN_AREA) return areas; // MAIN cannot be dissolved.
  let touched = false;
  const next = areas.areaOf.map((id) => {
    if (id !== from) return id;
    touched = true;
    return into;
  });
  if (!touched) return areas;
  return normalizeAreas({ ...areas, areaOf: next });
}

/**
 * Re-anchor the partition onto a CHANGED hand.
 *
 * `commit` is the slot set the client itself submitted (a play, a tribute
 * payment, a tribute return), together with the hand it was submitted against.
 * When it applies, those slots are removed EXACTLY and every surviving slot
 * keeps its area — which is what makes twins in different areas survive a play
 * of their sibling. When it does not apply (a change the client did not cause:
 * a tribute card ARRIVING, a resync), the walk falls back to matching by card
 * value, per value, in slot order.
 *
 * The walk is per-VALUE rather than by a comparator, deliberately: `view.hand`
 * is sorted by the engine's own `sortCards`, and re-deriving that ordering here
 * would be a second, driftable copy of an engine rule (the class of defect the
 * straight-flush round already paid for once). Grouping by value needs only
 * equality, so there is nothing to drift.
 *
 * Cards with no predecessor — a tribute card arriving, or any card the client
 * cannot account for — land in MAIN. New cards are by definition unorganized.
 */
export function remapAreas(
  areas: HandAreas | null,
  prevHand: readonly Card[],
  nextHand: readonly Card[],
  commit: HandCommit | null,
): HandAreas | null {
  if (areas === null) return null;

  // A commit applies only if it was made against THIS hand and its arithmetic
  // matches what actually left. A rejected action leaves a stale commit behind;
  // this is what stops it from corrupting an unrelated later change.
  // A commit applies only if it was made against THIS hand AND the cards it
  // names ACTUALLY LEFT.
  //
  // Hand-equality alone is not enough, and both audit lineages found the same
  // hole independently: a REJECTED action leaves the hand unchanged, so the
  // commit stays pending and still matches `prevHand`. When the server later
  // acts for an idle seat, that stale commit would be accepted and would delete
  // slots nobody played — with twins, preserving the wrong copy and leaving an
  // 'intact' label on a group whose real member departed. So the commit is
  // checked against the observed DELTA: whatever the client claims it committed
  // must be a sub-multiset of what genuinely disappeared.
  let committed: ReadonlySet<number> | null = null;
  if (
    commit !== null &&
    commit.hand.length === prevHand.length &&
    commit.hand.every((card, i) => card === prevHand[i])
  ) {
    const remaining = [...nextHand];
    const departed: Card[] = [];
    for (const card of prevHand) {
      const at = remaining.indexOf(card);
      if (at >= 0) remaining.splice(at, 1);
      else departed.push(card);
    }
    const pool = [...departed];
    let matches = true;
    for (const slot of commit.slots) {
      const card = prevHand[slot];
      const at = card === undefined ? -1 : pool.indexOf(card);
      if (at < 0) {
        matches = false;
        break;
      }
      pool.splice(at, 1);
    }
    if (matches) committed = commit.slots;
  }

  // Areas of the slots that SURVIVE, grouped by card value, in slot order.
  const keptByValue = new Map<Card, { area: AreaId; group: GroupId }[]>();
  for (let i = 0; i < prevHand.length; i += 1) {
    if (committed !== null && committed.has(i)) continue;
    const card = prevHand[i]!;
    const entry = { area: areaAt(areas, i), group: areas.groupOf[i] ?? NO_GROUP };
    const list = keptByValue.get(card);
    if (list === undefined) keptByValue.set(card, [entry]);
    else list.push(entry);
  }

  // SHELVES ARE SERVED FIRST when copies of one value compete for fewer
  // survivors, so a departing card is taken from MAIN before any shelf.
  //
  // This is what covers the hand changes the client did NOT initiate and so has
  // no commit for: the server applying `defaultAction` for an AFK seat (an
  // auto-played lead, a timed-out tribute) removes cards without any act() call
  // (found by the Grok UI audit, HIGH — and my property harness could not have
  // caught it, because it only ever committed for actions it applied itself).
  //
  // There is no fact of the matter about WHICH twin the server removed — the
  // engine itself removes by multiset (`remaining.indexOf`), so the copies are
  // indistinguishable to it too. Given that, the only question is which choice
  // best preserves what the PLAYER deliberately arranged, and taking from MAIN
  // is the answer: the shelf is the thing they went out of their way to build.
  for (const list of keptByValue.values()) {
    if (list.length > 1) {
      list.sort((a, b) => (a.area === MAIN_AREA ? 1 : 0) - (b.area === MAIN_AREA ? 1 : 0));
    }
  }

  const cursor = new Map<Card, number>();
  const areaOf: AreaId[] = new Array<AreaId>(nextHand.length);
  const groupOf: GroupId[] = new Array<GroupId>(nextHand.length);
  for (let j = 0; j < nextHand.length; j += 1) {
    const card = nextHand[j]!;
    const list = keptByValue.get(card);
    const k = cursor.get(card) ?? 0;
    if (list !== undefined && k < list.length) {
      areaOf[j] = list[k]!.area;
      groupOf[j] = list[k]!.group;
      cursor.set(card, k + 1);
    } else {
      // A card with no predecessor — a tribute arriving — is loose and unowned.
      areaOf[j] = MAIN_AREA;
      groupOf[j] = NO_GROUP;
    }
  }
  // groupSize is carried UNCHANGED on purpose: it records how big each group was
  // when it was sent, which is precisely what a shrunken group must be compared
  // against to know it is no longer intact.
  return normalizeAreas({ areaOf, areaCount: areas.areaCount, groupOf, groupSize: areas.groupSize });
}

// ---------------------------------------------------------------------------
// The SEAM's action — the line under a shelf is a button, and this is the one
// thing it does right now.
// ---------------------------------------------------------------------------

/**
 * Where "set aside" should send the selection.
 *
 * A new shelf while the budget allows one; otherwise the LAST existing shelf,
 * so the control still does what it says. Returns null only when not even one
 * shelf fits — the single case where refusing (with a visible reason) is honest.
 *
 * Without this, at a cap of 2 a button reading "set aside" did nothing to the
 * arrangement once any shelf existed: it could not mint a second and had no
 * destination to fall back to, so its label and its effect diverged (found by
 * the Grok UI audit, MED — the same label-vs-effect class as the finder's old
 * MAIN fallback, arrived at from the opposite direction).
 */
export function setAsideDestination(areas: HandAreas | null, maxAreas: number): AreaId | null {
  const count = areaCountOf(areas);
  if (count < maxAreas) return NEW_SHELF;
  if (count > 1) return count - 1;
  return null;
}

/** What the seam under one shelf offers, given the current selection. */
export type SeamAction = 'selectAll' | 'putBack' | 'moveHere';

/**
 * TOTAL, and never a no-op — that is the point of routing every seam press
 * through one function instead of letting the view decide.
 *
 *  - Cards are lifted somewhere OUTSIDE this shelf  -> `moveHere` (they move in;
 *    at least one of them is not here already, so something always changes).
 *  - The whole shelf is lifted and nothing else     -> `putBack` (it empties
 *    into MAIN and the shelf disappears).
 *  - Anything else — nothing lifted, or only PART of this shelf lifted ->
 *    `selectAll` (the rest of the shelf lifts, so the selection always changes).
 *
 * The third branch is what makes the partial-selection case safe: a strict
 * subset of the shelf is "entirely within" it, so it cannot fall to `moveHere`
 * and become the silent no-op the pre-build critique found (reachable in three
 * presses at the cap).
 */
export function seamAction(
  areas: HandAreas | null,
  selected: ReadonlySet<number>,
  shelf: AreaId,
): SeamAction {
  const slots = slotsOf(areas, shelf);
  const outside = [...selected].some((slot) => areaAt(areas, slot) !== shelf);
  if (selected.size > 0 && outside) return 'moveHere';
  const all = slots.length > 0 && slots.every((slot) => selected.has(slot));
  return all ? 'putBack' : 'selectAll';
}

// ---------------------------------------------------------------------------
// The MONOTONE budget-aware allowance (owner decision 1).
// ---------------------------------------------------------------------------

/**
 * The most areas the design will ever offer: MAIN + ONE shelf.
 *
 * This was 3 (the owner's "used one -> offer a second -> used two -> offer a
 * third" ladder). It is 2 because the ladder's third rung was MEASURED and
 * never opens: across 8 real deals at true 390x844, the second band was
 * reachable 8/8 times and the third 0/8 — the budget refused it every time, on
 * every column count from 11 to 15. A rung that never opens is worse than an
 * absent one: it is a control the player can see refused but never satisfy.
 *
 * The owner pre-authorised this fallback ("if the window is rare or erratic,
 * report it and fall back to a clean two-area version"). The consequence is
 * stated honestly rather than hidden: MERGE needs two shelves, so merge is
 * unreachable at this cap, and the ladder has one rung.
 *
 * The allowance machinery below is NOT dead weight at a cap of 2 — it still
 * refuses the FIRST shelf when even that does not fit, and it still carries the
 * monotonicity guarantee. Raising this constant is a one-line change if a
 * future layout frees the room; the budget ratchet decides, not this number.
 */
export const AREA_HARD_MAX = 2;

// Geometry MEASURED on the current build at true 390x844 (zh-Hant, real dealt
// 27-card hands) — docs/research/sort-areas.md §3. These are measurements, not
// estimates, and each is quoted with what it was measured from.
/** A band's floor cost: one card line (73.5px) plus its 14px lift headroom.
 *  Measured constant across k=2..7 single-card columns. */
export const BAND_FLOOR_PX = 87.5;
/** Value-columns that fit one line: the widest line's ink runs 334.6px of a
 *  342px container, so the 10th column wraps. */
export const COLUMNS_PER_LINE = 9;
/** Vertical space between the fan's bottom and the bottom of the Play button,
 *  RESERVED with the desk at its LOUD height (148.5px) rather than its quiet
 *  one (94.5px) — the safe direction, and the reason the allowance never needs
 *  to read desk state. Measured: fan bottom 649.1 -> Play bottom 809.6 gives
 *  160.5px quiet; the loud desk adds 54px. */
export const RESERVED_BELOW_FAN_PX = 214.5;

/**
 * How many areas the vertical budget can hold, from the fan's QUIET-state
 * geometry alone.
 *
 * WHY QUIET-STATE ONLY (the pathology found before the build): the desk is LOUD
 * exactly when a selection exists, and a selection is the precondition for
 * pressing "set aside". An allowance that read desk loudness would therefore be
 * most likely to REFUSE at the precise moment of use. So the desk's height is
 * not an input here; the caller passes the budget measured with the desk quiet.
 *
 * The model: bands stack, each costs at least one card LINE, and a band holding
 * more than `columnsPerLine` value-columns wraps to more. The cheapest possible
 * layout for B bands therefore needs `max(B, ceil(columns / columnsPerLine))`
 * lines, because the columns have to go somewhere no matter how they are split.
 * All figures are MEASURED, never assumed — see docs/research/sort-areas.md §3.
 */
export function areaAllowance(input: {
  /** Vertical space the fan may occupy, measured with the desk QUIET. */
  fanBudgetPx: number;
  /** Measured floor cost of one band (one card line plus its lift headroom). */
  bandFloorPx: number;
  /** Distinct value-columns the hand currently occupies. */
  columns: number;
  /** Measured wrap threshold — how many columns fit one line. */
  columnsPerLine: number;
}): number {
  const { fanBudgetPx, bandFloorPx, columns, columnsPerLine } = input;
  if (bandFloorPx <= 0 || columnsPerLine <= 0) return 1;
  const linesNeeded = Math.max(1, Math.ceil(columns / columnsPerLine));
  // Even one band does not fit: the fan already overflows its budget. MAIN
  // still exists — you cannot be offered fewer than the hand you have.
  if (linesNeeded * bandFloorPx > fanBudgetPx) return 1;
  const affordable = Math.floor(fanBudgetPx / bandFloorPx);
  return Math.max(1, Math.min(AREA_HARD_MAX, affordable));
}

/**
 * The MONOTONICITY RATCHET, and the whole basis of the feature's
 * predictability: within one hand the allowance may only ever GROW.
 *
 * A pure geometric allowance is *almost* monotone on its own — a hand shrinks
 * as it is played, so `columns` falls and the budget loosens. But it is not
 * monotone in general: a tribute card ARRIVING grows the hand and can add a
 * column, which would otherwise withdraw an offer the player could already
 * see. Taking the running maximum makes "the allowance never decreases within a
 * hand" true by construction rather than true by luck, so no future change to
 * the geometry above can quietly break it.
 *
 * Reset (back to the fresh computation) belongs to a new hand or a seat switch,
 * which is exactly where areas reset to `null` anyway.
 */
export function ratchetAllowance(highWater: number, computed: number): number {
  return Math.max(highWater, computed);
}

/**
 * Has anything happened that a held commit could describe, or that makes it
 * meaningless? Exported as its own predicate so the "when do we consume the
 * commit" decision is BEHAVIOUR that can be tested, rather than a shape buried
 * in a React effect that only a source-text pin could reach.
 *
 * The bug it prevents: GameTable's reconciliation effect has no dependency
 * array, so it runs on every render — including the one act() causes by
 * clearing the selection, which happens BEFORE the server's reply. Consuming
 * the commit there discarded it, and the real hand change then fell back to the
 * identity walk and silently moved a twin between bands.
 */
export function commitIsResolved(prev: SelectionContext | null, next: SelectionContext): boolean {
  if (prev === null) return true;
  if (prev.seat !== next.seat || prev.handNo !== next.handNo || prev.dealNo !== next.dealNo) {
    return true;
  }
  return (
    prev.hand.length !== next.hand.length || prev.hand.some((card, i) => card !== next.hand[i])
  );
}

/**
 * The survival policy, mirroring `reconcileSelection`'s shape so the two can
 * never disagree about what "this hand" means.
 *
 * - A never-user holds `null` and this returns `null` — no allocation, no
 *   state commit, no re-render, for the whole session.
 * - A seat switch or a fresh deal is a new arrangement context: areas reset to
 *   `null`, exactly as selection resets to empty.
 * - An unchanged hand returns the SAME instance so setState bails out.
 * - Otherwise the partition is re-anchored by `remapAreas`.
 */
export function reconcileAreas(
  areas: HandAreas | null,
  prev: SelectionContext | null,
  next: SelectionContext,
  commit: HandCommit | null,
): HandAreas | null {
  if (areas === null) return null;
  if (prev === null) return areas;
  if (prev.seat !== next.seat || prev.handNo !== next.handNo || prev.dealNo !== next.dealNo) {
    return null;
  }
  const sameOrder =
    prev.hand.length === next.hand.length && prev.hand.every((card, i) => card === next.hand[i]);
  if (sameOrder) return areas;
  return remapAreas(areas, prev.hand, next.hand, commit);
}
