// §2 QA-ratchet suite: e2e tests that traverse the REAL product paths — the
// exact payloads and selection machinery the shipped UI uses — so that every
// behavior found by computer-use/visual iteration is pinned as an automated
// regression (docs/research/METHODOLOGY.md, "QA ratchet" standing rule).
//
// Product-path fidelity:
//  - Room creation uses the UI's OWN config assembly: assembleConfig(
//    CURATED_DEFAULT_PICKS) imported from src/client/RulePicker.tsx (the
//    exact function HomePage.handleCreate calls) and DEFAULT_GAME_ID from
//    src/client/config.ts — not a hand-rolled copy.
//  - The wild-disambiguation test drives the client's OWN selection →
//    interpretation path (matchSelection/declSignature from
//    src/client/table/helpers.ts) against real server hints over the wire.
//
// RARE-PATH PROOF LEVELS (stated honestly, per test): rooms accept no seed
// (PLAN §8 — seeds are server-minted), so seed-dependent rare paths
// (anti-tribute, A-suspension) cannot be FORCED over the wire. Each rare-path
// test therefore has two phases:
//  (A) a DETERMINISTIC engine-level proof: a bounded seed scan drives the
//      real engine (same first-hint policy as the wire bot) to the rare
//      path and asserts the full mechanics — this phase can never flake and
//      is the guaranteed regression;
//  (B) a BOUNDED wire hunt: fresh rooms are created and bot-driven until
//      the rare path occurs on the wire (probability per match is high —
//      measured ~0.73 for anti-tribute, ~0.35 for suspension — so the hunt
//      succeeds in the overwhelming majority of runs); when it does, the
//      wire transport of the events is asserted too. The proof level
//      actually achieved is recorded in the PROOF-LEVEL summary printed by
//      afterAll and must be reported by whoever reads the run.
//
// Bot policy: same "first-hint bot" as tests/e2e/guandan.e2e.test.ts (the
// expected actor plays the FIRST server-provided hint); the driver here is
// that file's, extended with wall-clock deadlines and graceful stop reasons
// so bounded hunts can span multiple rooms.

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { Seat } from '../../src/engine/core/game';
import { isJoker, isWild, rankOf, RANKS, type Card, type Rank } from '../../src/engine/guandan/cards';
import type { RuleVariant } from '../../src/engine/guandan/config';
import { GuandanGame } from '../../src/engine/guandan';
import type {
  GuandanAction,
  GuandanEvent,
  GuandanState,
  GuandanView,
} from '../../src/engine/guandan/types';
import { teamOf } from '../../src/engine/guandan/types';
import {
  asRuleVariant,
  declSignature,
  matchSelection,
  sameMultiset,
} from '../../src/client/table/helpers';
import { DEFAULT_GAME_ID } from '../../src/client/config';
// The UI's own config assembly — RulePicker.tsx sits outside
// tsconfig.scripts.json's jsx-less program (TS6142), but vitest transforms
// it fine, so the suite runs the REAL HomePage construction, not a replica.
// The bindings arrive untyped (the import error is suppressed); they are
// re-typed immediately below.
// @ts-expect-error TS6142 — .tsx module deliberately imported at runtime only
import { assembleConfig, CURATED_DEFAULT_PICKS, picksFromConfig } from '../../src/client/RulePicker';
import {
  claimSeat,
  connectAndWelcome,
  createRoomFor,
  getRoomInfo,
  startServer,
  stopAllServers,
  WsClient,
  type DevServer,
  type EventMsg,
  type RejectedMsg,
} from './helpers';

const assembleUiConfig = assembleConfig as (picks: unknown) => RuleVariant;
const curatedDefaultPicks = CURATED_DEFAULT_PICKS as Record<string, unknown>;
const picksFromUiConfig = picksFromConfig as (config: unknown) => Record<string, unknown>;

/** EXACTLY what HomePage.handleCreate sends as `config`. */
const UI_DEFAULT_CONFIG: RuleVariant = assembleUiConfig(curatedDefaultPicks);

// ---------------------------------------------------------------------------
// Small guandan wire helpers (same shapes as guandan.e2e.test.ts).
// ---------------------------------------------------------------------------

type HandStartedEvent = Extract<GuandanEvent, { type: 'handStarted' }>;
type HandEndedEvent = Extract<GuandanEvent, { type: 'handEnded' }>;
type AntiTributeEvent = Extract<GuandanEvent, { type: 'antiTribute' }>;
type PlayedEvent = Extract<GuandanEvent, { type: 'played' }>;

function guandanEvents(msg: EventMsg): GuandanEvent[] {
  return msg.event as GuandanEvent[];
}

function viewOf(msg: EventMsg): GuandanView {
  return msg.view as GuandanView;
}

function eventOfType<T extends GuandanEvent['type']>(
  events: readonly GuandanEvent[],
  type: T,
): Extract<GuandanEvent, { type: T }> | undefined {
  return events.find((e): e is Extract<GuandanEvent, { type: T }> => e.type === type);
}

/** Missing seats appended ascending — same rule as tribute.ts (spec §5.8). */
function normalizeFinishOrder(finishOrder: readonly Seat[]): Seat[] {
  const order = [...finishOrder];
  for (let seat = 0 as Seat; seat < 4; seat++) {
    if (!order.includes(seat)) order.push(seat);
  }
  return order;
}

/** Tribute payers derived from a hand's finish order (spec §7.1). */
function payersOf(order: readonly Seat[]): Seat[] {
  return teamOf(order[0]!) === teamOf(order[1]!) ? [order[3]!, order[2]!] : [order[3]!];
}

// ---------------------------------------------------------------------------
// First-hint bot driver — one socket holding all four seats. Adapted from
// guandan.e2e.test.ts's driveFirstHintBot, extended with a wall-clock
// deadline and graceful stop reasons (hunts must give up cleanly, never
// hang or throw, when a bounded search legitimately exhausts).
// ---------------------------------------------------------------------------

type StopReason = 'matchEnd' | 'stopWhen' | 'deadline' | 'actionCap';

interface DriveProgress {
  seq: number;
  actionsApplied: number;
  eventTypesSeen: Set<GuandanEvent['type']>;
  maxHandNo: number;
  views: Map<Seat, GuandanView>;
  /** All four seats' redacted copies of the CURRENT seq's batch. */
  lastCopies: Map<Seat, EventMsg>;
  stopReason: StopReason;
}

async function driveFirstHintBot(
  client: WsClient,
  startSeq: number,
  opts: {
    maxActions: number;
    /** Wall-clock epoch-ms; the driver returns 'deadline' when passed. */
    deadline?: number;
    stopWhen?: (progress: DriveProgress) => boolean;
  },
): Promise<DriveProgress> {
  const progress: DriveProgress = {
    seq: startSeq,
    actionsApplied: 0,
    eventTypesSeen: new Set(),
    maxHandNo: 0,
    views: new Map(),
    lastCopies: new Map(),
    stopReason: 'actionCap',
  };
  let mark = 0;

  for (;;) {
    // (1) Collect every seat's redacted copy of the current seq.
    progress.lastCopies = new Map();
    for (let seat = 0 as Seat; seat < 4; seat++) {
      const copy = await client.waitFor<EventMsg>(
        (m) => m.type === 'event' && m.seat === seat && m.seq === progress.seq,
        { from: mark },
      );
      progress.lastCopies.set(seat, copy);
      progress.views.set(seat, viewOf(copy));
      for (const e of guandanEvents(copy)) progress.eventTypesSeen.add(e.type);
    }
    const view = progress.views.get(0)!;
    progress.maxHandNo = Math.max(progress.maxHandNo, view.handNo);

    // (2) Stop conditions.
    if (view.phase === 'matchEnd') return { ...progress, stopReason: 'matchEnd' };
    if (opts.stopWhen !== undefined && opts.stopWhen(progress)) {
      return { ...progress, stopReason: 'stopWhen' };
    }
    if (opts.deadline !== undefined && Date.now() > opts.deadline) {
      return { ...progress, stopReason: 'deadline' };
    }
    if (progress.actionsApplied >= opts.maxActions) return { ...progress, stopReason: 'actionCap' };

    // (3) Act: lowest seat whose copy carries hints plays its first hint.
    const actors = [...progress.lastCopies.entries()]
      .filter(([, m]) => m.hints !== undefined)
      .map(([s]) => s);
    if (actors.length === 0) {
      throw new Error(`bot stalled at seq ${progress.seq}: phase ${view.phase}, no hints anywhere`);
    }
    const actor = Math.min(...actors) as Seat;
    const hints = progress.lastCopies.get(actor)!.hints as GuandanAction[];
    const action = hints[0];
    if (action === undefined) throw new Error(`empty hints for actor ${actor} at seq ${progress.seq}`);

    mark = client.mark();
    const actionId = client.action(actor, action, { expectedSeq: progress.seq });
    const reply = await client.waitFor(
      (m) =>
        (m.type === 'event' && m.seat === actor && m.seq > progress.seq) ||
        (m.type === 'rejected' && m.actionId === actionId),
      { from: mark },
    );
    if (reply.type === 'rejected') {
      throw new Error(`first-hint ${action.type} by seat ${actor} rejected: ${reply.error.code}`);
    }
    progress.actionsApplied += 1;
    progress.seq = (reply as EventMsg).seq;
  }
}

/** Create a room with the given config, claim all 4 seats on one socket
 *  (the fastest wire-legal path to a running match) and start it. */
async function startSoloRoom(
  server: DevServer,
  config: unknown,
  label: string,
): Promise<{ code: string; client: WsClient; startedSeq: number }> {
  const code = await createRoomFor(server, DEFAULT_GAME_ID, config);
  const { client } = await connectAndWelcome(server, code, { label });
  for (let i = 0; i < 4; i++) await claimSeat(client, `${label}-${i}`);
  const mark = client.mark();
  client.start();
  const started = await client.waitFor((m) => m.type === 'started', { from: mark });
  return { code, client, startedSeq: started.seq };
}

/** Bounded wire hunt: fresh rooms bot-driven until `stopWhen` fires, a room
 *  cap is hit, or the wall-clock deadline passes. On a hit the room's still-
 *  open client is returned so the caller can keep driving (e.g. to chase the
 *  suspension CLEAR); the caller closes it. */
async function huntOverRooms(
  server: DevServer,
  opts: {
    config: RuleVariant;
    label: string;
    roomsCap: number;
    deadline: number;
    maxActionsPerRoom: number;
    stopWhen: (progress: DriveProgress) => boolean;
  },
): Promise<{ progress: DriveProgress; client: WsClient; roomsTried: number } | { progress: null; roomsTried: number }> {
  for (let room = 1; room <= opts.roomsCap; room++) {
    // A new room needs enough runway to be worth starting.
    if (Date.now() > opts.deadline - 10_000) return { progress: null, roomsTried: room - 1 };
    const { client, startedSeq } = await startSoloRoom(server, opts.config, `${opts.label}-${room}`);
    let progress: DriveProgress;
    try {
      progress = await driveFirstHintBot(client, startedSeq, {
        maxActions: opts.maxActionsPerRoom,
        deadline: opts.deadline,
        stopWhen: opts.stopWhen,
      });
    } catch (e) {
      client.close();
      throw e;
    }
    if (progress.stopReason === 'stopWhen') return { progress, client, roomsTried: room };
    client.close();
    if (progress.stopReason === 'deadline') return { progress: null, roomsTried: room };
    // 'matchEnd' / 'actionCap': this room never reached the rare path — next.
  }
  return { progress: null, roomsTried: opts.roomsCap };
}

// ---------------------------------------------------------------------------
// Engine-level first-hint drive (phase A of the rare-path tests): the same
// policy as the wire bot, run directly against GuandanGame with a chosen
// seed — deterministic, so these proofs can never flake.
// ---------------------------------------------------------------------------

function engineFirstHintDrive(
  config: RuleVariant,
  seed: string,
  maxActions: number,
  /** Return true to stop; receives each applied batch + resulting state. */
  onBatch: (events: GuandanEvent[], state: GuandanState) => boolean,
): { stopped: boolean; state: GuandanState; actions: number } {
  const init = GuandanGame.init(config, 4, seed);
  let state = init.state;
  let actions = 0;
  if (onBatch(init.events, state)) return { stopped: true, state, actions };
  while (!GuandanGame.isTerminal(state) && actions < maxActions) {
    const actors = GuandanGame.expectedActors(state);
    const seat = Math.min(...actors) as Seat;
    const action = GuandanGame.legalActions(state, seat)[0];
    if (action === undefined) throw new Error(`engine bot: empty legalActions for seat ${seat}`);
    const res = GuandanGame.applyAction(state, seat, action);
    if (!res.ok) throw new Error(`engine bot: first hint rejected: ${res.error.code}`);
    state = res.state;
    actions += 1;
    if (onBatch(res.events, state)) return { stopped: true, state, actions };
  }
  return { stopped: false, state, actions };
}

// ---------------------------------------------------------------------------
// Test 3 scenario: a leading turn whose hand holds a wild + two distinct
// natural pairs — {a,a,b,b,W} then classifies as EXACTLY two full houses
// (over a and over b): the wild multi-interpretation case.
// ---------------------------------------------------------------------------

interface WildSelection {
  selection: Card[];
  /** Ascending by rank; [0] is the WEAKER full-house key. */
  pairRanks: [Rank, Rank];
  level: Rank;
}

function wildTwoPairSelection(hand: readonly Card[], level: Rank): WildSelection | null {
  const wild = `${level}H` as Card;
  if (!hand.includes(wild)) return null;
  const byRank = new Map<Rank, Card[]>();
  for (const card of hand) {
    if (isJoker(card) || isWild(card, level)) continue;
    const rank = rankOf(card)!;
    if (rank === level) continue; // keep the scenario plain-natural
    byRank.set(rank, [...(byRank.get(rank) ?? []), card]);
  }
  const pairs = [...byRank.entries()].filter(([, cards]) => cards.length >= 2);
  if (pairs.length < 2) return null;
  pairs.sort(([a], [b]) => RANKS.indexOf(a) - RANKS.indexOf(b));
  const [lo, hi] = [pairs[0]!, pairs[1]!];
  return {
    selection: [...lo[1].slice(0, 2), ...hi[1].slice(0, 2), wild],
    pairRanks: [lo[0], hi[0]],
    level,
  };
}

/** The two-full-house assertion + decl choice, shared by the wire and the
 *  engine-fallback paths of test 3. Returns the CHOSEN (weaker) match. */
function assertTwoReadingsAndChoose(
  scenario: WildSelection,
  hints: GuandanAction[],
  config: unknown,
): { cards: Card[]; decl: PlayedEvent['decl'] } {
  const matches = matchSelection(scenario.selection, hints, scenario.level, asRuleVariant(config));
  // Exactly two meaningful-distinct readings: fullHouse over each pair rank.
  expect(matches).toHaveLength(2);
  expect(matches.map((m) => m.decl.type)).toEqual(['fullHouse', 'fullHouse']);
  expect([...matches.map((m) => m.decl.keyRank)].sort()).toEqual([...scenario.pairRanks].sort());
  // classifyPlays order is strongest-first (R5): the HIGHER pair rank leads.
  expect(matches[0]!.decl.keyRank).toBe(scenario.pairRanks[1]);
  // Leading: both readings must be offered as playable by the hints.
  expect(matches.every((m) => m.playable)).toBe(true);
  // Deliberately pick the WEAKER reading — proving the transported decl is
  // the CHOSen one, not the strongest/default interpretation.
  const chosen = matches.find((m) => m.decl.keyRank === scenario.pairRanks[0])!;
  return { cards: chosen.cards, decl: chosen.decl };
}

// ---------------------------------------------------------------------------
// The suite.
// ---------------------------------------------------------------------------

describe('Product paths e2e (§2 QA ratchet)', () => {
  let server: DevServer;
  /** Room A: created in test 1 with the exact HomePage payload; test 2 reads
   *  its config + first handStarted (deliberate ordering dependency — same
   *  pattern as guandan.e2e.test.ts's finishedMatchCode). */
  let roomA: { code: string; client: WsClient; startedSeq: number } | null = null;
  const openedForever: WsClient[] = [];
  /** Honest per-test proof-level record, printed by afterAll. */
  const proofNotes: string[] = [];

  beforeAll(async () => {
    server = await startServer();
  });

  afterAll(async () => {
    for (const c of openedForever) c.close();
    await stopAllServers();
    // The plainly-stated proof level each rare-path test achieved this run.
    console.log(`PROOF-LEVEL SUMMARY:\n  ${proofNotes.join('\n  ')}`);
  });

  test(
    'UI-default room creation starts successfully',
    async () => {
      // --- The EXACT HomePage.handleCreate request (same body expression,
      // same imported functions/constants — src/client/HomePage.tsx). ---
      const res = await fetch(`${server.url}/api/rooms`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          gameId: DEFAULT_GAME_ID,
          config: assembleUiConfig(curatedDefaultPicks),
        }),
      });
      expect(res.status).toBe(201); // HomePage treats !== 201 as failure
      const { code } = (await res.json()) as { code: string };

      const { client } = await connectAndWelcome(server, code, { label: 'ui-default' });
      openedForever.push(client);
      for (let i = 0; i < 4; i++) await claimSeat(client, `ui-${i}`);
      const mark = client.mark();
      client.start();
      const started = await client.waitFor((m) => m.type === 'started', { from: mark });
      // Start SUCCEEDED: no room.startFailed anywhere on this socket.
      expect(
        client.log.some((m) => m.type === 'rejected' && m.error.code === 'room.startFailed'),
      ).toBe(false);
      expect((await getRoomInfo(server, code)).status).toBe('playing');
      roomA = { code, client, startedSeq: started.seq };

      // --- Loud-path contract: creating with config:null must FAIL start
      // with room.startFailed and leave the room in the lobby (the engine
      // validates the config at init; the room never guesses defaults). ---
      const nullCode = await createRoomFor(server, DEFAULT_GAME_ID, null);
      const { client: nullClient } = await connectAndWelcome(server, nullCode, { label: 'null-config' });
      try {
        for (let i = 0; i < 4; i++) await claimSeat(nullClient, `null-${i}`);
        const nullMark = nullClient.mark();
        nullClient.start();
        const rejected = await nullClient.waitFor<RejectedMsg>((m) => m.type === 'rejected', {
          from: nullMark,
        });
        expect(rejected.error.code).toBe('room.startFailed');
        const info = await getRoomInfo(server, nullCode);
        expect(info.status).toBe('lobby'); // stayed editable, never started
        expect(info.config).toBeNull();
      } finally {
        nullClient.close();
      }
    },
    60_000,
  );

  test(
    'created-room defaults expose the intended features',
    async () => {
      expect(roomA).not.toBeNull();
      const { code, client, startedSeq } = roomA!;

      // The stored config IS the curated-defaults assembly, verbatim — and
      // the picker's own reader round-trips it to the default picks (every
      // toggle's value present and recognized).
      const info = await getRoomInfo(server, code);
      expect(info.config).toEqual(UI_DEFAULT_CONFIG);
      expect(picksFromUiConfig(info.config)).toEqual(curatedDefaultPicks);
      // The one PRODUCT default on top of the engine profile is pinned:
      expect((info.config as RuleVariant).firstLeadMethod).toBe('drawCard');

      // The started room's FIRST handStarted carries the 翻牌定先 ceremony
      // payload on every seat's copy (drawCard product default visible).
      let ceremony: HandStartedEvent['ceremony'] | undefined;
      for (let seat = 0 as Seat; seat < 4; seat++) {
        const copy = await client.waitFor<EventMsg>(
          (m) => m.type === 'event' && m.seat === seat && m.seq === startedSeq,
        );
        const hs = eventOfType(guandanEvents(copy), 'handStarted');
        expect(hs).toBeDefined();
        expect(hs!.handNo).toBe(1);
        expect(hs!.suspensionApplied).toBe(false);
        expect(hs!.ceremony).toBeDefined();
        if (ceremony === undefined) ceremony = hs!.ceremony;
        else expect(hs!.ceremony).toEqual(ceremony); // public, bit-identical
        // The ceremony's marker seat holds the first lead.
        const view = viewOf(copy);
        expect(view.trick).not.toBeNull();
        expect(view.trick!.leader).toBe(ceremony!.markerSeat);
      }
    },
    30_000,
  );

  test(
    'concrete selection path incl. wild multi-interpretation',
    async () => {
      // Drive rooms until some seat LEADS holding a wild + two distinct
      // natural pairs; then run the client's OWN matchSelection over its
      // own hand + the server's hints, pick the WEAKER of the two offered
      // full-house readings, submit concrete cards + chosen decl over the
      // wire, and require the played event to carry exactly that decl.
      const deadline = Date.now() + 55_000;
      const stopWhen = (p: DriveProgress): boolean =>
        [...p.lastCopies.entries()].some(([seat, copy]) => {
          if (copy.hints === undefined) return false;
          const view = viewOf(copy);
          return (
            view.phase === 'playing' &&
            view.trick !== null &&
            view.trick.top === null &&
            view.trick.toAct === seat &&
            wildTwoPairSelection(view.hand, view.currentLevel) !== null
          );
        });

      const hunt = await huntOverRooms(server, {
        config: UI_DEFAULT_CONFIG,
        label: 'wild',
        roomsCap: 4,
        deadline,
        maxActionsPerRoom: 1_500,
        stopWhen,
      });

      if (hunt.progress !== null) {
        const { progress, client } = hunt;
        try {
          const [actor, copy] = [...progress.lastCopies.entries()].find(
            ([seat, m]) =>
              m.hints !== undefined &&
              viewOf(m).trick?.top === null &&
              viewOf(m).trick?.toAct === seat &&
              wildTwoPairSelection(viewOf(m).hand, viewOf(m).currentLevel) !== null,
          )!;
          const view = viewOf(copy);
          const scenario = wildTwoPairSelection(view.hand, view.currentLevel)!;
          // The room was created with UI_DEFAULT_CONFIG; the client passes
          // room.config through asRuleVariant exactly as GameTable does.
          const chosen = assertTwoReadingsAndChoose(
            scenario,
            copy.hints as GuandanAction[],
            UI_DEFAULT_CONFIG,
          );

          const mark = client.mark();
          const actionId = client.action(
            actor,
            { type: 'play', cards: chosen.cards, decl: chosen.decl },
            { expectedSeq: progress.seq },
          );
          const reply = await client.waitFor(
            (m) =>
              (m.type === 'event' && m.seat === actor && m.seq > progress.seq) ||
              (m.type === 'rejected' && m.actionId === actionId),
            { from: mark },
          );
          // NEVER a pass, never a rejection: the chosen reading is played.
          expect(reply.type).toBe('event');
          const batch = guandanEvents(reply as EventMsg);
          expect(batch.some((e) => e.type === 'passed')).toBe(false);
          const played = eventOfType(batch, 'played');
          expect(played).toBeDefined();
          expect(played!.seat).toBe(actor);
          expect(sameMultiset(played!.cards, scenario.selection)).toBe(true);
          expect(declSignature(played!.decl)).toBe(declSignature(chosen.decl));
          proofNotes.push(
            `test 3 (wild disambiguation): WIRE path — room ${hunt.roomsTried}, ` +
              `found after ${progress.actionsApplied} bot actions; ` +
              `chose fullHouse(${String(chosen.decl.keyRank)}) of {${scenario.pairRanks.join(',')}}`,
          );
        } finally {
          client.close();
        }
        return;
      }

      // --- Engine-constructed fallback (live wire search exhausted): the
      // same client-selection machinery against the real engine with a
      // deterministically scanned seed. Which path ran is recorded. ---
      let ran = false;
      for (let i = 0; i < 20 && !ran; i++) {
        let hit: { seat: Seat; scenario: WildSelection } | null = null;
        const r = engineFirstHintDrive(UI_DEFAULT_CONFIG, `wild-fallback-${i}`, 1_500, (_evs, state) => {
          if (state.phase !== 'playing' || state.trick === null || state.trick.top !== null) return false;
          const seat = state.trick.toAct;
          const scenario = wildTwoPairSelection(state.hands[seat]!, state.currentLevel);
          if (scenario === null) return false;
          hit = { seat, scenario };
          return true;
        });
        if (!r.stopped || hit === null) continue;
        const { seat, scenario } = hit as { seat: Seat; scenario: WildSelection };
        const hints = GuandanGame.legalActions(r.state, seat);
        const chosen = assertTwoReadingsAndChoose(scenario, hints, UI_DEFAULT_CONFIG);
        const applied = GuandanGame.applyAction(r.state, seat, {
          type: 'play',
          cards: chosen.cards,
          decl: chosen.decl,
        });
        expect(applied.ok).toBe(true);
        if (applied.ok) {
          expect(applied.events.some((e) => e.type === 'passed')).toBe(false);
          const played = eventOfType(applied.events, 'played');
          expect(played).toBeDefined();
          expect(played!.seat).toBe(seat);
          expect(sameMultiset(played!.cards, scenario.selection)).toBe(true);
          expect(declSignature(played!.decl)).toBe(declSignature(chosen.decl));
        }
        proofNotes.push(
          `test 3 (wild disambiguation): ENGINE-CONSTRUCTED fallback (wire hunt exhausted ` +
            `after ${hunt.roomsTried} rooms) — seed wild-fallback-${i}`,
        );
        ran = true;
      }
      expect(ran).toBe(true); // the scenario must be constructible — never skipped
    },
    90_000,
  );

  test(
    'anti-tribute over the full wire stack',
    async () => {
      // ---- Phase A (deterministic): engine seed scan to a REAL hand-2+
      // anti-tribute, asserting the full mechanics. ----
      let engineProof: {
        seed: string;
        anti: AntiTributeEvent;
        handStarted: HandStartedEvent;
        prevOrder: Seat[];
        state: GuandanState;
      } | null = null;
      for (let i = 0; i < 12 && engineProof === null; i++) {
        const seed = `anti-scan-${i}`;
        let capture: { anti: AntiTributeEvent; handStarted: HandStartedEvent; prevOrder: Seat[] } | null = null;
        const r = engineFirstHintDrive(UI_DEFAULT_CONFIG, seed, 4_000, (events) => {
          const anti = eventOfType(events, 'antiTribute');
          if (anti === undefined) return false;
          const handStarted = eventOfType(events, 'handStarted')!;
          const handEnded = eventOfType(events, 'handEnded')!;
          capture = { anti, handStarted, prevOrder: normalizeFinishOrder(handEnded.result.finishOrder) };
          return true;
        });
        if (r.stopped && capture !== null) {
          const c = capture as { anti: AntiTributeEvent; handStarted: HandStartedEvent; prevOrder: Seat[] };
          engineProof = { seed, ...c, state: r.state };
        }
      }
      expect(engineProof).not.toBeNull(); // deterministic: same seeds every run
      const ep = engineProof!;
      // §7.6: both big jokers, collectively held by the payers, publicly
      // revealed; tribute cancelled; previous 头游 leads.
      expect(ep.anti.reveals).toHaveLength(2);
      expect(ep.anti.reveals.every((r) => r.card === 'BJ')).toBe(true);
      const payers = payersOf(ep.prevOrder);
      for (const reveal of ep.anti.reveals) expect(payers).toContain(reveal.seat);
      for (const reveal of ep.anti.reveals) {
        // The revealed jokers really are in the just-dealt hands.
        const copies = ep.handStarted.hands[reveal.seat]!.filter((c) => c === 'BJ').length;
        expect(copies).toBeGreaterThanOrEqual(1);
      }
      expect(ep.state.phase).toBe('playing'); // no tribute/return phase at all
      expect(ep.state.tribute).toBeNull();
      expect(ep.state.trick!.leader).toBe(ep.prevOrder[0]); // 头游 leads (§7.6)
      expect(ep.state.trick!.toAct).toBe(ep.prevOrder[0]);

      // ---- Phase B (wire, bounded hunt): fresh rooms until anti-tribute
      // happens on the wire; then assert the TRANSPORT of the same facts. ----
      const deadline = Date.now() + 70_000;
      const hunt = await huntOverRooms(server, {
        config: UI_DEFAULT_CONFIG,
        label: 'anti',
        roomsCap: 8,
        deadline,
        maxActionsPerRoom: 4_000,
        stopWhen: (p) =>
          eventOfType(guandanEvents(p.lastCopies.get(0)!), 'antiTribute') !== undefined,
      });
      if (hunt.progress !== null) {
        const { progress, client } = hunt;
        try {
          const reference = eventOfType(guandanEvents(progress.lastCopies.get(0)!), 'antiTribute')!;
          const handEnded = eventOfType(guandanEvents(progress.lastCopies.get(0)!), 'handEnded')!;
          const prevOrder = normalizeFinishOrder(handEnded.result.finishOrder);
          expect(reference.reveals).toHaveLength(2);
          expect(reference.reveals.every((r) => r.card === 'BJ')).toBe(true);
          const wirePayers = payersOf(prevOrder);
          for (const reveal of reference.reveals) expect(wirePayers).toContain(reveal.seat);
          for (let seat = 0 as Seat; seat < 4; seat++) {
            const copy = progress.lastCopies.get(seat)!;
            // The mandatory reveal is PUBLIC: bit-identical on every copy.
            expect(eventOfType(guandanEvents(copy), 'antiTribute')).toEqual(reference);
            const view = viewOf(copy);
            expect(view.phase).toBe('playing'); // tribute skipped entirely
            expect(view.tribute).toBeNull();
            expect(view.trick!.leader).toBe(prevOrder[0]);
          }
          proofNotes.push(
            `test 4 (anti-tribute): WIRE-LEVEL proof — room ${hunt.roomsTried}, hand ` +
              `${progress.maxHandNo}, after ${progress.actionsApplied} bot actions ` +
              `(plus deterministic engine proof, seed ${ep.seed})`,
          );
        } finally {
          client.close();
        }
      } else {
        proofNotes.push(
          `test 4 (anti-tribute): ENGINE-CONSTRUCTED proof only (seed ${ep.seed}); wire hunt ` +
            `exhausted (${hunt.roomsTried} rooms) — rooms accept no seed, so wire occurrence ` +
            `is probabilistic (~0.73/match); transport not re-proven this run`,
        );
      }
    },
    110_000,
  );

  test(
    'suspension over the full wire stack',
    async () => {
      // Owner house rule accelerated to reachability: ONE failed A-attempt
      // suspends (aMaxAttempts:1), match never ends by overshoot.
      const config: RuleVariant = {
        ...UI_DEFAULT_CONFIG,
        aMaxAttempts: 1,
        overshootWinsGame: false,
        aFailConsequence: 'suspendPlayOpponentLevel',
      };

      // ---- Phase A (deterministic): engine seed scan for suspension AND
      // the later clear-by-win, asserting the full §1.5/§6.4 mechanics. ----
      interface SuspensionCapture {
        team: 0 | 1;
        suspendedHandStarted: HandStartedEvent;
        suspendedHandEnded: HandEndedEvent;
        levelsAtSuspension: [Rank, Rank];
        clearHandStarted: HandStartedEvent | null;
        clearHandEnded: HandEndedEvent | null;
      }
      let engineSeed: string | null = null;
      let cap: SuspensionCapture | null = null;
      let stateAtClear: GuandanState | null = null;
      for (let i = 0; i < 20 && engineSeed === null; i++) {
        const seed = `susp-scan-${i}`;
        const c: Partial<SuspensionCapture> & { lastHandEnded?: HandEndedEvent } = {};
        const r = engineFirstHintDrive(config, seed, 30_000, (events, state) => {
          for (const e of events) {
            if (e.type === 'handEnded') c.lastHandEnded = e;
            if (e.type !== 'handStarted') continue;
            if (e.suspensionApplied && c.suspendedHandStarted === undefined) {
              c.team = e.declarerTeam as 0 | 1;
              c.suspendedHandStarted = e;
              c.suspendedHandEnded = c.lastHandEnded!;
              c.levelsAtSuspension = [...state.levels] as [Rank, Rank];
            } else if (
              c.suspendedHandStarted !== undefined &&
              e.declarerTeam === c.team &&
              !e.suspensionApplied
            ) {
              c.clearHandStarted = e;
              c.clearHandEnded = c.lastHandEnded!;
              return true;
            }
          }
          return false;
        });
        if (r.stopped && c.clearHandStarted != null) {
          engineSeed = seed;
          cap = c as SuspensionCapture;
          stateAtClear = r.state;
        }
      }
      expect(engineSeed).not.toBeNull(); // deterministic scan — never flakes
      const s = cap!;
      const team = s.team;
      const opponents = (1 - team) as 0 | 1;
      // The suspended hand: declarer team at A, exhausted, playing at the
      // OPPONENTS' level (spec §1.5 refinement — suspend, never demote).
      expect(s.suspendedHandEnded.aAttemptsExhausted[team]).toBe(true);
      expect(s.levelsAtSuspension[team]).toBe('A'); // never demoted
      expect(s.suspendedHandStarted.declarerTeam).toBe(team);
      expect(s.suspendedHandStarted.suspensionApplied).toBe(true);
      expect(s.suspendedHandStarted.currentLevel).toBe(s.levelsAtSuspension[opponents]);
      // A later win clears it: the clearing hand was WON by the suspended
      // team, the flag dropped, and their A-level survived intact.
      expect(s.clearHandEnded!.result.winnerTeam).toBe(team);
      expect(s.clearHandEnded!.aAttemptsExhausted[team]).toBe(false);
      expect(s.clearHandStarted!.declarerTeam).toBe(team);
      expect(s.clearHandStarted!.suspensionApplied).toBe(false);
      expect(s.clearHandStarted!.currentLevel).toBe('A'); // own A again
      expect(stateAtClear!.levels[team]).toBe('A');
      expect(stateAtClear!.aAttemptsExhausted[team]).toBe(false);

      // ---- Phase B (wire, bounded hunt): fresh rooms until a suspension
      // handStarted crosses the wire; chase the clear with leftover budget. ----
      const deadline = Date.now() + 85_000;
      const suspendedIn = (p: DriveProgress): HandStartedEvent | undefined => {
        const hs = eventOfType(guandanEvents(p.lastCopies.get(0)!), 'handStarted');
        return hs !== undefined && hs.suspensionApplied ? hs : undefined;
      };
      const hunt = await huntOverRooms(server, {
        config,
        label: 'susp',
        roomsCap: 8,
        deadline,
        maxActionsPerRoom: 4_000,
        stopWhen: (p) => suspendedIn(p) !== undefined,
      });
      if (hunt.progress !== null) {
        const { progress, client } = hunt;
        try {
          const hs = suspendedIn(progress)!;
          const wireTeam = hs.declarerTeam as 0 | 1;
          const wireOpponents = (1 - wireTeam) as 0 | 1;
          const handEnded = eventOfType(guandanEvents(progress.lastCopies.get(0)!), 'handEnded')!;
          expect(handEnded.aAttemptsExhausted[wireTeam]).toBe(true);
          expect(handEnded.newLevels[wireTeam]).toBe('A'); // suspended, not demoted
          // level = opponents' level, on every seat's view.
          expect(hs.currentLevel).toBe(handEnded.newLevels[wireOpponents]);
          for (let seat = 0 as Seat; seat < 4; seat++) {
            const view = viewOf(progress.lastCopies.get(seat)!);
            expect(view.currentLevel).toBe(handEnded.newLevels[wireOpponents]);
            expect(view.aAttemptsExhausted[wireTeam]).toBe(true);
            expect(view.levels[wireTeam]).toBe('A');
          }
          // Chase the clear with the remaining budget (conditional: the
          // match may end first — the deterministic clear proof is phase A).
          const chase = await driveFirstHintBot(client, progress.seq, {
            maxActions: 4_000,
            deadline,
            stopWhen: (p) => {
              const next = eventOfType(guandanEvents(p.lastCopies.get(0)!), 'handStarted');
              return next !== undefined && next.declarerTeam === wireTeam && !next.suspensionApplied;
            },
          });
          let clearNote = 'clear not reached on the wire this run (match/budget ended first)';
          if (chase.stopReason === 'stopWhen') {
            const clearEnded = eventOfType(guandanEvents(chase.lastCopies.get(0)!), 'handEnded')!;
            expect(clearEnded.result.winnerTeam).toBe(wireTeam);
            expect(clearEnded.aAttemptsExhausted[wireTeam]).toBe(false);
            expect(clearEnded.newLevels[wireTeam]).toBe('A');
            clearNote = 'clear-by-win ALSO observed on the wire';
          }
          proofNotes.push(
            `test 5 (suspension): WIRE-LEVEL proof — room ${hunt.roomsTried}, hand ` +
              `${progress.maxHandNo}, after ${progress.actionsApplied} bot actions; ${clearNote} ` +
              `(plus deterministic engine proof incl. clear, seed ${engineSeed})`,
          );
        } finally {
          client.close();
        }
      } else {
        proofNotes.push(
          `test 5 (suspension): ENGINE-CONSTRUCTED proof only incl. clear (seed ${engineSeed}); ` +
            `wire hunt exhausted (${hunt.roomsTried} rooms) — rooms accept no seed, wire ` +
            `occurrence is probabilistic (~0.35/match); transport not re-proven this run`,
        );
      }
    },
    115_000,
  );
});
