// Property tests for ALL SIX GameDefinition interface obligations
// (PLAN.md §3, including the round-2 deltas), driven through the PUBLIC
// GuandanGame interface with a custom seeded playout harness (no property-
// testing library — stateful seeded playouts, like integration.test.ts).
//
// REPLAYABLE FAILURES (PLAN §6 fuzz→regression pipeline): every playout runs
// inside a try/catch that, on ANY assertion failure, console.errors a single
// JSON line `{seed, config, actions: [{seat, action}...]}` — exactly the
// scripts/replay.ts input format — before rethrowing. Feed that line to the
// replay harness to reconstruct the failing state at every seq.
//
// Obligations checked (numbering per PLAN §3):
//   1. Determinism — init() twice deep-equal; applyAction twice on the same
//      (state, seat, action) deep-equal (checked at every sampled step).
//   2. Serializability — sampled states/actions/events/views survive a
//      JSON.parse(JSON.stringify(x)) round trip.
//   3. Zero trust in views — no 'prng' key reachable from any view; view.hand
//      is exactly the viewer's hand; cardCounts obey cardCountVisibility;
//      handStarted viewEvents redact all other seats' hands to []; under
//      returnHidden uninvolved seats' tributeReturned viewEvents carry only
//      their own pairings while payment/anti-tribute events stay public.
//   4. legalActions ⇔ applyAction agreement — every generated action applies
//      ok in every phase (tribute/return/decision included); corrupt actions
//      (wrong seat, cards not in hand, ineligible tribute/return card,
//      pass-while-leading) are rejected with a RuleError code, never a
//      throw, and never mutate the input state.
//   5. Liveness — every non-terminal state has non-empty expectedActors and
//      each expected actor has a non-null defaultAction that APPLIES ok
//      (this is the room layer's timeout path).
//   6. Locale-free — error codes match the namespaced-key grammar, event
//      types are bare camelCase keys, and no CJK appears in the JSON of any
//      event or error.
//
// Item-2 timingClass pin (per-seat planning window): at every step, for
// EVERY seat, the class is deterministic, inside the closed union, and
// 'planning' holds EXACTLY when an INDEPENDENTLY tracked acted-set says
// that seat has not yet acted in the current hand (the tracker is driven
// from applied actions + handStarted events, never from the engine's own
// actedThisHand field — model = product, not a re-implementation).
//
// Determinism note: the only randomness is src/engine/core/prng seeded with
// the string literals below (engine PRNG via init(seed); bot policy via its
// own seedPrng). Runs are bit-for-bit reproducible.

import { describe, expect, it } from 'vitest';
import { nextInt, seedPrng, type PrngState } from '../../../src/engine/core/prng';
import { GuandanGame } from '../../../src/engine/guandan';
import { JIANGSU_OFFICIAL_ONLINE, type RuleVariant } from '../../../src/engine/guandan/config';
import { buildDeck, type Card } from '../../../src/engine/guandan/cards';
import type { Seat } from '../../../src/engine/core/game';
import type {
  GuandanAction,
  GuandanEvent,
  GuandanState,
  Phase,
} from '../../../src/engine/guandan/types';

// ---------------------------------------------------------------------------
// Obligation-6 grammars (PLAN §3 / §6: semantic keys, never prose).
// ---------------------------------------------------------------------------

const ERROR_CODE_RE = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/;
const EVENT_TYPE_RE = /^[a-z][a-zA-Z0-9]*$/;
// CJK unified ideographs + extensions A / compatibility block — the engine
// must never emit Chinese prose (or any prose; CJK is the greppable tell).
const CJK_RE = /[\u2e80-\u9fff\uf900-\ufaff]/;

// ---------------------------------------------------------------------------
// Small helpers.
// ---------------------------------------------------------------------------

/** JSON round trip — obligation 2's exact survival test. */
function rt<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Does any object anywhere in `value` carry an own-key named `key`?
 *  (Obligation 3: 'prng' must be unreachable from views/viewEvents.) */
function containsKey(value: unknown, key: string): boolean {
  if (Array.isArray(value)) return value.some((v) => containsKey(v, key));
  if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === key || containsKey(v, key)) return true;
    }
  }
  return false;
}

/** Multiset equality over cards (view.hand is sorted; order is cosmetic). */
function sameMultiset(a: readonly Card[], b: readonly Card[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((card, i) => card === sb[i]);
}

type ApplyResult = ReturnType<typeof GuandanGame.applyAction>;

/** Obligation 4: applyAction must REJECT bad input with a RuleError — a
 *  throw is itself a failure, reported distinctly. */
function applyNoThrow(state: GuandanState, seat: Seat, action: GuandanAction, label: string): ApplyResult {
  try {
    return GuandanGame.applyAction(state, seat, action);
  } catch (e) {
    throw new Error(`obligation 4: applyAction THREW instead of returning a RuleError (${label}): ${String(e)}`);
  }
}

/** Item-2 timingClass pin at one state, for EVERY seat. `actedIndependent`
 *  is tracked from applied actions + handStarted events — never from the
 *  engine's own actedThisHand field — so this asserts the semantic meaning,
 *  not the implementation: 'planning' ⇔ this seat's first action of the
 *  current hand is still pending. */
function checkTimingClass(state: GuandanState, actedIndependent: ReadonlySet<Seat>): void {
  for (const seat of [0, 1, 2, 3] as Seat[]) {
    const cls = GuandanGame.timingClass!(state, seat);
    expect(['turn', 'planning'], 'timingClass stays inside the closed union').toContain(cls);
    expect(GuandanGame.timingClass!(state, seat), 'timingClass determinism').toBe(cls);
    // Item 3 carve-out: the cut precedes the deal — no hand to read, so the
    // ceremonyCut phase classes 'turn' by design and consumes no window
    // (the acted flags reset AT the deal that follows).
    const expected =
      state.phase === 'ceremonyCut' ? 'turn' : actedIndependent.has(seat) ? 'turn' : 'planning';
    expect(cls, `timingClass ⇔ first-action-pending (phase ${state.phase}, seat ${seat})`).toBe(
      expected,
    );
  }
}

/** The independent acted-set tracker: the ACTING seat marks on apply; a
 *  handStarted event (a fresh deal — including one dealt atomically by a
 *  hand-ending action) clears everyone. Order matters and mirrors the
 *  product's: mark first, then let the deal reset win. */
function trackActed(
  acted: Set<Seat>,
  actingSeat: Seat | null,
  events: readonly GuandanEvent[],
): Set<Seat> {
  if (actingSeat !== null) acted.add(actingSeat);
  for (const event of events) {
    if (event.type === 'handStarted') acted.clear();
  }
  return acted;
}

/** Obligation 6 checks on a rejection. */
function checkError(result: ApplyResult, label: string): void {
  expect(result.ok, `expected a rejection (${label})`).toBe(false);
  if (result.ok) return;
  expect(result.error.code, `obligation 6: error code grammar (${label})`).toMatch(ERROR_CODE_RE);
  expect(CJK_RE.test(JSON.stringify(result.error)), `obligation 6: no CJK in error (${label})`).toBe(false);
  // Obligation 2 for errors: they cross the wire as JSON too.
  expect(rt(result.error)).toEqual(result.error);
}

// ---------------------------------------------------------------------------
// Event checks (obligations 2, 3, 6 — incl. the round-2 deltas: tribute
// events reveal only the moved cards; antiTribute reveals exactly the
// qualifying big jokers with holder attribution and nothing else).
// ---------------------------------------------------------------------------

function checkEvent(event: GuandanEvent, config: RuleVariant): void {
  expect(event.type, 'obligation 6: event type is a bare camelCase key').toMatch(EVENT_TYPE_RE);
  expect(CJK_RE.test(JSON.stringify(event)), `obligation 6: no CJK in event ${event.type}`).toBe(false);
  expect(rt(event), 'obligation 2: event JSON round trip').toEqual(event);

  switch (event.type) {
    case 'handStarted': {
      // Obligation 3: the deal viewEvent shows each seat ONLY its own hand.
      for (let seat = 0; seat < 4; seat++) {
        const ve = GuandanGame.viewEvent(event, seat, config);
        expect(ve, 'handStarted is never hidden entirely').not.toBeNull();
        if (ve === null || ve.type !== 'handStarted') throw new Error('unreachable');
        expect(containsKey(ve, 'prng')).toBe(false);
        for (let s = 0; s < 4; s++) {
          if (s === seat) {
            expect(ve.hands[s], `handStarted keeps seat ${seat}'s own hand`).toEqual(event.hands[s]);
          } else {
            expect(ve.hands[s], `handStarted redacts seat ${s}'s hand for viewer ${seat}`).toEqual([]);
          }
        }
      }
      break;
    }
    case 'tributeCommitted':
      // Staging marker must stay card-less for everyone (spec §7.3 — no
      // sequential information leak within a double-tribute phase).
      expect(containsKey(event, 'card'), 'tributeCommitted carries no card').toBe(false);
      for (let seat = 0; seat < 4; seat++) {
        expect(GuandanGame.viewEvent(event, seat, config)).toEqual(event);
      }
      break;
    case 'tributePaid':
      // Round-2 delta: payment events are PUBLIC under every visibility
      // (returnHidden hides only the RETURN card — spec §7.7).
      for (let seat = 0; seat < 4; seat++) {
        expect(
          GuandanGame.viewEvent(event, seat, config),
          `tributePaid stays public to seat ${seat} under ${config.tributeVisibility}`,
        ).toEqual(event);
      }
      break;
    case 'tributeReturned':
      for (let seat = 0; seat < 4; seat++) {
        const ve = GuandanGame.viewEvent(event, seat, config);
        expect(ve).not.toBeNull();
        if (ve === null || ve.type !== 'tributeReturned') throw new Error('unreachable');
        if (config.tributeVisibility === 'returnHidden') {
          // Obligation 3 (returnHidden): a seat sees exactly its own
          // pairings — uninvolved seats see none of the returned cards.
          const own = event.pairings.filter((p) => p.from === seat || p.to === seat);
          expect(ve.pairings, `tributeReturned redaction for seat ${seat}`).toEqual(own);
          for (const p of ve.pairings) {
            expect(p.from === seat || p.to === seat, 'no foreign pairing leaks').toBe(true);
          }
        } else {
          expect(ve, 'public visibility: full event to every seat').toEqual(event);
        }
      }
      break;
    case 'antiTribute':
      // Round-2 delta: exactly the qualifying big jokers with holder
      // attribution — two BJ copies, nothing else — public in full.
      expect(event.reveals.length, 'anti-tribute reveals exactly the two big jokers').toBe(2);
      for (const reveal of event.reveals) {
        expect(reveal.card, 'anti-tribute reveals only big jokers').toBe('BJ');
      }
      for (let seat = 0; seat < 4; seat++) {
        expect(GuandanGame.viewEvent(event, seat, config)).toEqual(event);
      }
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Per-state property sample (obligations 2, 3, 4, 5, 6 at one state).
// ---------------------------------------------------------------------------

function checkViews(state: GuandanState, config: RuleVariant): void {
  for (let viewer = 0; viewer < 4; viewer++) {
    const view = GuandanGame.playerView(state, viewer);

    // Obligation 2: views are what the wire carries.
    expect(rt(view), 'obligation 2: view JSON round trip').toEqual(view);

    // Obligation 3: the PRNG (it determines every future deal) must be
    // unreachable from any view, and the viewer's own hand must be honest.
    expect(containsKey(view, 'prng'), `obligation 3: no 'prng' key in seat ${viewer}'s view`).toBe(false);
    // Item 3 (Grok panel catch — pin CONTINUOUSLY, not just in the named
    // ceremony test): the committed cut deck is hidden info of the same
    // strength as the PRNG. No view may carry it under any key…
    expect(containsKey(view, 'deck'), `obligation 3: no 'deck' key in seat ${viewer}'s view`).toBe(false);
    expect(
      containsKey(view, 'ceremonyCut'),
      `obligation 3: no 'ceremonyCut' object in seat ${viewer}'s view`,
    ).toBe(false);
    // …and while the deck is COMMITTED (phase ceremonyCut, nothing dealt),
    // the ONLY card tokens a view may carry are the PUBLIC attempt flips
    // (re-cut round: everyone at the table watched each uncountable flip —
    // the stated exception, delivered as view.ceremonyFlips). Outside that
    // field, no card token of any encoding may appear.
    if (state.phase === 'ceremonyCut') {
      const flips = state.ceremonyCut?.flips ?? [];
      expect(
        view.ceremonyFlips,
        `obligation 3: seat ${viewer}'s ceremonyFlips mirror the public attempt flips`,
      ).toEqual(flips);
      const json = JSON.stringify({ ...view, ceremonyFlips: [] });
      expect(json, `obligation 3: card token in seat ${viewer}'s ceremonyCut view`).not.toMatch(
        /"[2-9TJQKA][SHCD]"|"SJ"|"BJ"/,
      );
    }
    expect(
      sameMultiset(view.hand, state.hands[viewer]!),
      `obligation 3: view.hand is exactly seat ${viewer}'s hand`,
    ).toBe(true);

    // Obligation 3: cardCounts obey the active cardCountVisibility.
    for (let target = 0; target < 4; target++) {
      const actual = state.hands[target]!.length;
      let expected: number | null;
      if (target === viewer || config.cardCountVisibility === 'always') {
        expected = actual;
      } else {
        const threshold = config.cardCountVisibility === 'onRequestLE10' ? 10 : 6;
        expected = actual <= threshold ? actual : null;
      }
      expect(
        view.cardCounts[target],
        `obligation 3: cardCounts[${target}] for viewer ${viewer} under ${config.cardCountVisibility}`,
      ).toBe(expected);
    }
  }
}

/** Full property sample at one reachable (or constructed) state. Returns
 *  without consuming the state — everything here must be side-effect-free
 *  on `state`, and the final stringify comparison PROVES it was. */
function sampleState(state: GuandanState, config: RuleVariant): void {
  const frozen = JSON.stringify(state); // mutation sentinel (obligation 4)

  // Obligation 2: full authoritative state survives the DO's JSON persist.
  expect(rt(state), 'obligation 2: state JSON round trip').toEqual(state);

  checkViews(state, config);

  const terminal = GuandanGame.isTerminal(state);
  const actors = GuandanGame.expectedActors(state);
  expect(GuandanGame.result(state) === null, 'result() non-null exactly when terminal').toBe(!terminal);

  if (terminal) {
    expect(actors, 'terminal states have no expected actors').toEqual([]);
    const result = GuandanGame.result(state)!;
    expect(rt(result)).toEqual(result);
    expect(CJK_RE.test(JSON.stringify(result))).toBe(false);
    expect(JSON.stringify(state)).toBe(frozen);
    return;
  }

  // Obligation 5: liveness — non-empty actors, each with an applying default.
  expect(actors.length, `obligation 5: expectedActors non-empty in phase ${state.phase}`).toBeGreaterThan(0);
  for (const actor of actors) {
    expect(actor >= 0 && actor <= 3, 'actors are real seats').toBe(true);
    const fallback = GuandanGame.defaultAction(state, actor);
    expect(fallback, `obligation 5: defaultAction non-null for actor ${actor} in ${state.phase}`).not.toBeNull();
    const applied = applyNoThrow(state, actor, fallback!, `defaultAction in ${state.phase}`);
    expect(
      applied.ok,
      `obligation 5: defaultAction applies ok (timeout path) in ${state.phase}: ${applied.ok ? '' : applied.error.code}`,
    ).toBe(true);
    expect(rt(fallback!)).toEqual(fallback!);
  }

  // Non-actors: no legal actions, no default (defaultAction contract).
  for (let seat = 0; seat < 4; seat++) {
    if (actors.includes(seat)) continue;
    expect(GuandanGame.legalActions(state, seat), `non-actor ${seat} has no legal actions`).toEqual([]);
    expect(GuandanGame.defaultAction(state, seat), `non-actor ${seat} has no default action`).toBeNull();
  }

  // Obligation 4 (positive half): every generated action applies ok — in
  // EVERY phase, for EVERY concurrent actor (double tribute has two).
  for (const actor of actors) {
    const legal = GuandanGame.legalActions(state, actor);
    // Obligation 1 flavor: generation itself is deterministic.
    expect(GuandanGame.legalActions(state, actor)).toEqual(legal);
    for (const action of legal) {
      expect(rt(action), 'obligation 2: action JSON round trip').toEqual(action);
      const res = applyNoThrow(state, actor, action, `legal ${action.type} in ${state.phase}`);
      expect(
        res.ok,
        `obligation 4: legal action rejected in ${state.phase}: ${JSON.stringify(action)} → ${res.ok ? '' : res.error.code}`,
      ).toBe(true);
    }

    // Obligation 4 (negative half): corrupt probes — rejected with a code,
    // never a throw, input state untouched (proved by the sentinel below).
    // Wrong seat: replay this actor's first available action from a seat
    // that is NOT an expected actor.
    const probe = legal[0] ?? GuandanGame.defaultAction(state, actor)!;
    const nonActor = ([0, 1, 2, 3] as Seat[]).find((s) => !actors.includes(s));
    if (nonActor !== undefined) {
      checkError(applyNoThrow(state, nonActor, probe, 'wrong-seat probe'), `wrong seat ${nonActor} in ${state.phase}`);
    }
    // Out-of-range seat.
    checkError(applyNoThrow(state, 9 as Seat, probe, 'seat 9 probe'), 'out-of-range seat 9');
  }

  // Phase-specific corrupt probes.
  switch (state.phase) {
    case 'playing': {
      const toAct = state.trick!.toAct;
      // Cards not in hand: three copies of one identity — only two exist in
      // the entire double deck, so this multiset is never fully held.
      checkError(
        applyNoThrow(
          state,
          toAct,
          { type: 'play', cards: ['AS', 'AS', 'AS'], decl: { type: 'triple', size: 3, keyRank: 'A' } },
          'cards-not-in-hand probe',
        ),
        'play with cards not in hand',
      );
      // Pass while leading (spec §5.2/§9.2).
      if (state.trick!.top === null) {
        const rej = applyNoThrow(state, toAct, { type: 'pass' }, 'pass-while-leading probe');
        checkError(rej, 'pass while leading');
        if (!rej.ok) expect(rej.error.code).toBe('play.cannotPassLeading');
      }
      // Wrong action type for the phase.
      checkError(
        applyNoThrow(state, toAct, { type: 'payTribute', card: 'AS' }, 'wrong-type probe'),
        'payTribute during playing',
      );
      break;
    }
    case 'tribute':
    case 'returnTribute': {
      const isPay = state.phase === 'tribute';
      for (const actor of actors) {
        const eligible = new Set(
          GuandanGame.legalActions(state, actor).map((a) =>
            a.type === 'payTribute' || a.type === 'returnTribute' ? a.card : null,
          ),
        );
        // Ineligible card: any held card OUTSIDE the eligible set (the
        // eligible set is a strict subset of a 27-ish card hand in practice;
        // skip in the degenerate all-eligible case).
        const bad = state.hands[actor]!.find((card) => !eligible.has(card));
        if (bad !== undefined) {
          const action: GuandanAction = isPay
            ? { type: 'payTribute', card: bad }
            : { type: 'returnTribute', card: bad };
          const rej = applyNoThrow(state, actor, action, 'ineligible-card probe');
          checkError(rej, `${state.phase} with ineligible card ${bad}`);
          if (!rej.ok) expect(rej.error.code).toBe('tribute.cardNotEligible');
        }
        // A card that is not even in the hand (e.g. a joker the payer does
        // not hold, or any foreign card) must also be rejected.
        const foreign = buildDeck().find((card) => !state.hands[actor]!.includes(card))!;
        const action: GuandanAction = isPay
          ? { type: 'payTribute', card: foreign }
          : { type: 'returnTribute', card: foreign };
        checkError(applyNoThrow(state, actor, action, 'foreign-card probe'), `${state.phase} foreign card`);
        // Wrong action type for the phase.
        checkError(
          applyNoThrow(state, actor, { type: 'pass' }, 'wrong-type probe'),
          `pass during ${state.phase}`,
        );
      }
      break;
    }
    case 'antiTributeDecision': {
      const nonDecider = ([0, 1, 2, 3] as Seat[]).find((s) => !actors.includes(s));
      if (nonDecider !== undefined) {
        checkError(
          applyNoThrow(state, nonDecider, { type: 'antiTributeDecision', invoke: true }, 'non-decider probe'),
          'anti-tribute decision by non-decider',
        );
      }
      checkError(
        applyNoThrow(state, actors[0]!, { type: 'pass' }, 'wrong-type probe'),
        'pass during antiTributeDecision',
      );
      break;
    }
    case 'matchEnd':
      break;
  }

  // Obligation 4: none of the probes (legal or corrupt) mutated the input.
  expect(JSON.stringify(state), 'obligation 4: probes never mutate the input state').toBe(frozen);
}

// ---------------------------------------------------------------------------
// The seeded playout harness. Every failure inside emits the replay artifact
// {seed, config, actions} (scripts/replay.ts input format) before rethrowing.
// ---------------------------------------------------------------------------

interface PlayoutOpts {
  maxActions: number;
  stopAfterHands: number;
  /** Sample every N playing-phase steps (non-playing phases always sample). */
  sampleEvery: number;
}

interface PlayoutOutcome {
  phasesSeen: Set<Phase>;
  terminal: boolean;
}

function runCheckedPlayout(config: RuleVariant, seed: string, opts: PlayoutOpts): PlayoutOutcome {
  const log: { seat: Seat; action: GuandanAction }[] = [];
  try {
    return playoutBody(config, seed, opts, log);
  } catch (error) {
    // PLAN §6: every fuzz failure emits a replayable artifact — one JSON
    // line in exactly the replay harness's input format.
    console.error(JSON.stringify({ seed, config, actions: log }));
    throw error;
  }
}

function playoutBody(
  config: RuleVariant,
  seed: string,
  opts: PlayoutOpts,
  log: { seat: Seat; action: GuandanAction }[],
): PlayoutOutcome {
  // Obligation 1: init is a pure function of (config, seats, seed).
  const first = GuandanGame.init(config, 4, seed);
  const second = GuandanGame.init(config, 4, seed);
  expect(second.state, 'obligation 1: init determinism (state)').toEqual(first.state);
  expect(second.events, 'obligation 1: init determinism (events)').toEqual(first.events);

  let state = first.state;
  for (const event of first.events) checkEvent(event, config);
  sampleState(state, config);

  // Item 2: the independent acted-set starts from the init events (hand 1's
  // handStarted clears it — nobody has acted) and is checked for EVERY seat
  // at EVERY step below.
  const acted = trackActed(new Set<Seat>(), null, first.events);
  let planningStatesSeen = 0;
  checkTimingClass(state, acted);
  if ([0, 1, 2, 3].some((s) => GuandanGame.timingClass!(state, s as Seat) === 'planning')) {
    planningStatesSeen++;
  }

  let bot: PrngState = seedPrng(`obligations-bot:${seed}`);
  let actions = 0;
  let handsCompleted = 0;
  let sinceSample = 0;
  const phasesSeen = new Set<Phase>([state.phase]);

  while (!GuandanGame.isTerminal(state) && actions < opts.maxActions) {
    const actors = GuandanGame.expectedActors(state);
    // Obligation 5 at EVERY step, not just sampled ones (cheap).
    expect(actors.length, `obligation 5: actors in phase ${state.phase}`).toBeGreaterThan(0);

    // Inline pass-while-leading probe at every trick lead (leads are easy
    // to undersample otherwise).
    if (state.phase === 'playing' && state.trick!.top === null) {
      const rej = applyNoThrow(state, state.trick!.toAct, { type: 'pass' }, 'inline lead-pass probe');
      checkError(rej, 'pass while leading (inline)');
    }

    const seat = actors[0]!;
    const legal = GuandanGame.legalActions(state, seat);
    const fallback = GuandanGame.defaultAction(state, seat);
    expect(legal.length > 0 || fallback !== null, 'obligation 5: some action exists').toBe(true);

    // Seeded bot policy (biased toward playing so hands finish) — identical
    // to integration.test.ts's shape, different seeds.
    let action = fallback!;
    if (legal.length > 0) {
      const plays = legal.filter((a) => a.type !== 'pass');
      const pool = plays.length > 0 ? plays : legal;
      const pick = nextInt(bot, pool.length);
      bot = pick.state;
      action = pool[pick.value]!;
    }

    const sampled = state.phase !== 'playing' || sinceSample >= opts.sampleEvery;

    const before = state.handNo;
    const res = applyNoThrow(state, seat, action, `chosen ${action.type}`);
    if (!res.ok) {
      throw new Error(`chosen legal action rejected: ${res.error.code} (phase ${state.phase})`);
    }
    if (sampled) {
      // Obligation 1: applying the SAME (state, seat, action) again yields a
      // deeply-equal result — state and events.
      const again = applyNoThrow(state, seat, action, 'determinism re-apply');
      expect(again.ok, 'obligation 1: re-apply also ok').toBe(true);
      if (again.ok) {
        expect(again.state, 'obligation 1: applyAction determinism (state)').toEqual(res.state);
        expect(again.events, 'obligation 1: applyAction determinism (events)').toEqual(res.events);
      }
    }

    log.push({ seat, action });
    for (const event of res.events) checkEvent(event, config);
    state = res.state;
    trackActed(acted, seat, res.events);
    checkTimingClass(state, acted);
    if (
      !GuandanGame.isTerminal(state) &&
      [0, 1, 2, 3].some((s) => GuandanGame.timingClass!(state, s as Seat) === 'planning')
    ) {
      planningStatesSeen++;
    }
    actions++;
    sinceSample = sampled ? 0 : sinceSample + 1;
    phasesSeen.add(state.phase);

    if (sampled || GuandanGame.isTerminal(state)) sampleState(state, config);

    if (state.handNo > before || GuandanGame.isTerminal(state)) handsCompleted++;
    if (handsCompleted >= opts.stopAfterHands) break;
  }

  expect(actions, 'playout must not stall out its action budget').toBeLessThan(opts.maxActions);
  // M4 coverage floor: hand 1 always opens in the playing phase before any
  // play, so every playout sees at least one 'planning' state.
  expect(planningStatesSeen, 'at least one planning state per playout').toBeGreaterThan(0);
  return { phasesSeen, terminal: GuandanGame.isTerminal(state) };
}

// ---------------------------------------------------------------------------
// Config matrix (task brief): default + every listed single-key variation.
// ---------------------------------------------------------------------------

const BASE = JIANGSU_OFFICIAL_ONLINE;

const CONFIG_MATRIX: { name: string; config: RuleVariant; seeds: string[] }[] = [
  { name: 'default profile', config: BASE, seeds: ['obl-default-1', 'obl-default-2', 'obl-default-3'] },
  {
    // Item 3: the REAL cut — obligations 1-6 must hold through the
    // ceremonyCut phase (an actor phase with a 97-action choice set) and
    // across the cut→deal transition. This is also the PRODUCT default
    // (curated rooms create with drawCard).
    name: "firstLeadMethod='drawCard' (real cut phase)",
    config: { ...BASE, firstLeadMethod: 'drawCard' },
    seeds: ['obl-drawcard-1', 'obl-drawcard-2'],
  },
  {
    // Ceremony-marker round: the official one-card form must satisfy the
    // same obligations as the owner's two-card default.
    name: 'ceremonyCardCount=1 (official one-card form)',
    config: { ...BASE, firstLeadMethod: 'drawCard', ceremonyCardCount: 1 },
    seeds: ['obl-onecard-1', 'obl-onecard-2'],
  },
  {
    name: "aFailConsequence='demote'",
    config: { ...BASE, aFailConsequence: 'demote' },
    seeds: ['obl-demote-1', 'obl-demote-2'],
  },
  {
    name: "aFailConsequence='none'",
    config: { ...BASE, aFailConsequence: 'none' },
    seeds: ['obl-afnone-1', 'obl-afnone-2'],
  },
  {
    name: "antiTributeMode='optional'",
    config: { ...BASE, antiTributeMode: 'optional' },
    seeds: ['obl-anti-1', 'obl-anti-2'],
  },
  {
    name: "tributeVisibility='returnHidden'",
    config: { ...BASE, tributeVisibility: 'returnHidden' },
    seeds: ['obl-hidden-1', 'obl-hidden-2'],
  },
  {
    name: "turnDirection='clockwise'",
    config: { ...BASE, turnDirection: 'clockwise' },
    seeds: ['obl-cw-1', 'obl-cw-2'],
  },
  {
    name: "levelTrack='shared'",
    config: { ...BASE, levelTrack: 'shared' },
    seeds: ['obl-shared-1', 'obl-shared-2'],
  },
  {
    name: 'jokerBombSupreme=false',
    config: { ...BASE, jokerBombSupreme: false },
    seeds: ['obl-jbs-1', 'obl-jbs-2'],
  },
  {
    name: 'wildStraightFlushIsBomb=false',
    config: { ...BASE, wildStraightFlushIsBomb: false },
    seeds: ['obl-wsf-1', 'obl-wsf-2'],
  },
  {
    name: 'allowUnderDeclareStraightFlush=true',
    config: { ...BASE, allowUnderDeclareStraightFlush: true },
    seeds: ['obl-udsf-1', 'obl-udsf-2'],
  },
  {
    name: 'returnTributeMaxRank=null',
    config: { ...BASE, returnTributeMaxRank: null },
    seeds: ['obl-retany-1', 'obl-retany-2'],
  },
  {
    name: "jiefengRecipient='nextPlayer'",
    config: { ...BASE, jiefengRecipient: 'nextPlayer' },
    seeds: ['obl-jf-1', 'obl-jf-2'],
  },
  {
    name: 'overshootWinsGame=true',
    config: { ...BASE, overshootWinsGame: true },
    seeds: ['obl-over-1', 'obl-over-2'],
  },
  {
    name: 'aWinPartnerNotLast=false',
    config: { ...BASE, aWinPartnerNotLast: false },
    seeds: ['obl-awin-1', 'obl-awin-2'],
  },
  {
    name: "cardCountVisibility='onRequestLE10'",
    config: { ...BASE, cardCountVisibility: 'onRequestLE10' },
    seeds: ['obl-cc10-1', 'obl-cc10-2'],
  },
];

// Tuned for runtime: 31 playouts × ≤8 hands ≈ 10s wall — well under the
// ~60s suite budget while reaching mid-match levels (tribute every hand,
// levels climbing, occasional natural anti-tribute).
const PLAYOUT_OPTS: PlayoutOpts = { maxActions: 8000, stopAfterHands: 8, sampleEvery: 25 };

describe('PLAN §3 interface obligations 1-6 (seeded property playouts)', () => {
  for (const { name, config, seeds } of CONFIG_MATRIX) {
    it(`${name}: obligations hold across ${seeds.length} seeded playouts`, () => {
      const phases = new Set<Phase>();
      for (const seed of seeds) {
        const outcome = runCheckedPlayout(config, seed, PLAYOUT_OPTS);
        for (const phase of outcome.phasesSeen) phases.add(phase);
      }
      // Phase-coverage floor: playing always; tribute/returnTribute from
      // hand 2 onward (anti-tribute on EVERY hand of EVERY seed is the only
      // way to miss them, which these fixed seeds don't do). Deterministic:
      // fixed seeds ⇒ this can never flake.
      expect(phases.has('playing')).toBe(true);
      expect(phases.has('tribute'), `${name}: tribute phase reached`).toBe(true);
      expect(phases.has('returnTribute'), `${name}: returnTribute phase reached`).toBe(true);
    });
  }

  it('terminal states satisfy result/actors/view obligations (overshootWinsGame reaches matchEnd)', () => {
    // overshootWinsGame ends matches within a few hands, giving a reachable
    // (not constructed) terminal state to sample.
    const config: RuleVariant = { ...BASE, overshootWinsGame: true };
    const seed = 'obl-terminal-1';
    const log: { seat: Seat; action: GuandanAction }[] = [];
    try {
      const init = GuandanGame.init(config, 4, seed);
      let state = init.state;
      let bot: PrngState = seedPrng(`obligations-bot:${seed}`);
      let steps = 0;
      while (!GuandanGame.isTerminal(state) && steps < 200_000) {
        const seat = GuandanGame.expectedActors(state)[0]!;
        const legal = GuandanGame.legalActions(state, seat);
        let action = GuandanGame.defaultAction(state, seat)!;
        if (legal.length > 0) {
          const plays = legal.filter((a) => a.type !== 'pass');
          const pool = plays.length > 0 ? plays : legal;
          const pick = nextInt(bot, pool.length);
          bot = pick.state;
          action = pool[pick.value]!;
        }
        const res = GuandanGame.applyAction(state, seat, action);
        if (!res.ok) throw new Error(`legal action rejected: ${res.error.code}`);
        log.push({ seat, action });
        state = res.state;
        steps++;
      }
      expect(GuandanGame.isTerminal(state), 'match must end under overshootWinsGame').toBe(true);
      sampleState(state, config); // terminal branch: result non-null, actors empty
      const result = GuandanGame.result(state)!;
      expect(result.standings[0]!.rank).toBe(1);
      expect(result.standings[0]!.seats).toHaveLength(2);
      // Post-terminal actions are rejected, not thrown.
      checkError(applyNoThrow(state, 0, { type: 'pass' }, 'post-terminal probe'), 'action after matchEnd');
    } catch (error) {
      console.error(JSON.stringify({ seed, config, actions: log }));
      throw error;
    }
  });
});

// ---------------------------------------------------------------------------
// antiTributeDecision phase — a CONSTRUCTED state (spec §7.6 optional-mode
// machine). Naturally reaching this phase needs the two payers to be dealt
// both big jokers under antiTributeMode='optional' — too rare to rely on in
// bounded playouts, so the state is built directly (documented intent below)
// and every obligation is checked on it. No {seed, config, actions} artifact
// applies here: the state is not init-reachable by construction; the test
// source itself is the deterministic reproduction.
// ---------------------------------------------------------------------------

const OPTIONAL_ANTI_CONFIG: RuleVariant = { ...BASE, antiTributeMode: 'optional' };

/** INTENT: hand 2 of a match under antiTributeMode='optional', previous hand
 *  a 1-2 (1-2 finish) for team 0 with finish order [0,2,3,1] ⇒ double tribute,
 *  payers = [1 (4th finisher), 3 (3rd finisher)], receivers = [0, 2]. The unshuffled double
 *  deck deals BJ copies (deck indices 53 and 107) to seats 1 and 3 — one big
 *  joker per payer — so the optional-mode decision machine is pending with
 *  BOTH payers as deciders (unanimity required, spec §7.6). All 108 cards
 *  are distributed (27 each), so the state is fully consistent. */
function constructedAntiTributeDecisionState(): GuandanState {
  const deck = buildDeck();
  const hands: GuandanState['hands'] = [
    deck.slice(0, 27),
    deck.slice(27, 54), // contains BJ (index 53)
    deck.slice(54, 81),
    deck.slice(81, 108), // contains BJ (index 107)
  ];
  expect(hands[1].filter((c) => c === 'BJ')).toHaveLength(1);
  expect(hands[3].filter((c) => c === 'BJ')).toHaveLength(1);
  return {
    config: OPTIONAL_ANTI_CONFIG,
    prng: seedPrng('obl-constructed-anti'),
    handNo: 2,
    phase: 'antiTributeDecision',
    actedThisHand: [false, false, false, false],
    ceremonyCut: null,
    levels: ['2', '2'],
    aAttempts: [0, 0],
    aAttemptsExhausted: [false, false],
    currentLevel: '2',
    declarerTeam: 0,
    hands,
    finishOrder: [],
    trick: null,
    tribute: null,
    prevFinishOrder: [0, 2, 3, 1],
    antiTributePending: { kind: 'decision', payers: [1, 3], decisions: {} },
    firstFinisherAllAces: null,
    matchWinner: null,
  };
}

describe('antiTributeDecision phase obligations (constructed state, optional mode)', () => {
  it('satisfies obligations 1-6 at the pending-decision state', () => {
    const state = constructedAntiTributeDecisionState();
    expect(GuandanGame.expectedActors(state).sort()).toEqual([1, 3]);
    // The generic sampler covers: serializability, views/prng redaction,
    // legal-actions-apply-ok, corrupt probes, liveness, no mutation.
    sampleState(state, OPTIONAL_ANTI_CONFIG);
    // Obligation 1 on this phase's transition.
    const a = GuandanGame.applyAction(state, 1, { type: 'antiTributeDecision', invoke: true });
    const b = GuandanGame.applyAction(state, 1, { type: 'antiTributeDecision', invoke: true });
    expect(a).toEqual(b);
  });

  it('unanimous invoke fires the public two-big-joker reveal and 1st finisher leads', () => {
    const state = constructedAntiTributeDecisionState();
    const step1 = GuandanGame.applyAction(state, 1, { type: 'antiTributeDecision', invoke: true });
    expect(step1.ok).toBe(true);
    if (!step1.ok) return;
    // Deciding reveals NOTHING until unanimity (spec §7.6).
    expect(step1.events).toEqual([]);
    expect(step1.state.phase).toBe('antiTributeDecision');
    expect(GuandanGame.expectedActors(step1.state)).toEqual([3]);
    sampleState(step1.state, OPTIONAL_ANTI_CONFIG);
    // Re-deciding is rejected, seat 1 is no longer an actor.
    checkError(
      applyNoThrow(step1.state, 1, { type: 'antiTributeDecision', invoke: true }, 'already-decided probe'),
      'decider deciding twice',
    );

    const step2 = GuandanGame.applyAction(step1.state, 3, { type: 'antiTributeDecision', invoke: true });
    expect(step2.ok).toBe(true);
    if (!step2.ok) return;
    // Both payers invoked → the mandatory public reveal, exactly the two
    // big jokers with holder attribution, then previous 1st finisher (seat 0) leads.
    expect(step2.events).toEqual([
      { type: 'antiTribute', reveals: [{ seat: 1, card: 'BJ' }, { seat: 3, card: 'BJ' }] },
    ]);
    for (const event of step2.events) checkEvent(event, OPTIONAL_ANTI_CONFIG);
    expect(step2.state.phase).toBe('playing');
    expect(step2.state.trick!.leader).toBe(0);
    sampleState(step2.state, OPTIONAL_ANTI_CONFIG);
  });

  it('a decline resolves to the normal tribute flow with nothing revealed', () => {
    const state = constructedAntiTributeDecisionState();
    const declined = GuandanGame.applyAction(state, 1, { type: 'antiTributeDecision', invoke: false });
    expect(declined.ok).toBe(true);
    if (!declined.ok) return;
    // Nothing revealed on decline (spec §7.6): no events at all.
    expect(declined.events).toEqual([]);
    expect(declined.state.phase).toBe('tribute');
    expect(declined.state.tribute!.payers).toEqual([1, 3]);
    expect(declined.state.tribute!.receivers).toEqual([0, 2]);
    // The resulting tribute phase satisfies every obligation too (this also
    // exercises the double-tribute two-concurrent-actors case directly).
    expect(GuandanGame.expectedActors(declined.state).sort()).toEqual([1, 3]);
    sampleState(declined.state, OPTIONAL_ANTI_CONFIG);
  });
});
