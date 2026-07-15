// M3 gate e2e scenarios: real `wrangler dev` + real WebSocket clients
// driving the GameRoom DO through the PLAN §5 wire protocol with the REAL
// Guandan engine (registered in src/shared/games.ts at M3). The tests rely
// only on the wire protocol, the HTTP routes, and the dev dump route —
// never on GameRoom internals.
//
// Bot policy: a "first-hint bot" — for every event, the expected actor
// plays the FIRST server-provided hint (hints are legalActions in the
// engine's deterministic generation order). This is deterministic GIVEN the
// server state; room seeds are server-minted (crypto random at start), so
// run-to-run variation comes only from the deal, which every assertion
// below is robust to. First hints in the playing phase are always plays
// (pass is appended last), so hands always shed cards and finish.
//
// HONEST SCOPE NOTE: anti-tribute and A-suspension REACHABILITY over the
// wire is seed-dependent and not forced here — their correctness is covered
// by the named engine tests (house-rules.test.ts, tribute.test.ts); this
// suite proves the transport round-trip for the phases a normal match
// traverses (deal/ceremony, tribute, returnTribute, playing, trick churn,
// jiefeng, hand scoring, match end, dump→replay).

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { Seat } from '../../src/engine/core/game';
import { JIANGSU_OFFICIAL_ONLINE, type RuleVariant } from '../../src/engine/guandan/config';
import type { GuandanAction, GuandanEvent, GuandanView } from '../../src/engine/guandan/types';
import { artifactFromDump } from '../../scripts/dump-room';
import { deepEqual, replayMatch } from '../../scripts/replay';
import {
  claimSeat,
  connectAndWelcome,
  getRoomInfo,
  startServer,
  stopAllServers,
  WsClient,
  type DevServer,
  type EventMsg,
} from './helpers';

// ---------------------------------------------------------------------------
// Guandan-specific wire helpers (helpers.ts's createRoom/driver are
// guess-number-specific; these are their guandan counterparts).
// ---------------------------------------------------------------------------

async function createGuandanRoom(server: DevServer, config: RuleVariant): Promise<string> {
  const res = await fetch(`${server.url}/api/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ gameId: 'guandan', config }),
  });
  if (res.status !== 201) throw new Error(`createGuandanRoom failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { code: string };
  return body.code;
}

/** The full dev dump payload (PLAN §6) — helpers.getDump types only a
 *  subset; test 4 needs the replay-artifact fields (seed/actions/seats). */
interface GuandanRoomDump {
  gameId: string;
  seed: string | null;
  room: { gameId: string; config: unknown; status: string; code: string };
  seats: { seat: number; name: string | null; tokenHash: string }[];
  snapshot: { seq: number; state: unknown };
  actions: { seq: number; seat: number; actionId: string; action: unknown }[];
}

async function getFullDump(server: DevServer, code: string): Promise<GuandanRoomDump> {
  const res = await fetch(`${server.url}/api/rooms/${code}/dump`);
  if (!res.ok) throw new Error(`dump failed: ${res.status}`);
  return (await res.json()) as GuandanRoomDump;
}

type HandStartedEvent = Extract<GuandanEvent, { type: 'handStarted' }>;

/** The wire 'event' field is the seq's redacted event ARRAY for one seat. */
function guandanEvents(msg: EventMsg): GuandanEvent[] {
  return msg.event as GuandanEvent[];
}

function viewOf(msg: EventMsg): GuandanView {
  return msg.view as GuandanView;
}

function handStartedOf(msg: EventMsg): HandStartedEvent | undefined {
  return guandanEvents(msg).find((e): e is HandStartedEvent => e.type === 'handStarted');
}

function closeAll(clients: WsClient[]): void {
  for (const c of clients) c.close();
}

async function startMatch(client: WsClient): Promise<number> {
  const mark = client.mark();
  client.start();
  const started = await client.waitFor((m) => m.type === 'started', { from: mark });
  return started.seq;
}

// ---------------------------------------------------------------------------
// First-hint bot driver
// ---------------------------------------------------------------------------

interface GuandanHolder {
  client: WsClient;
  seats: Seat[];
}

interface DriveProgress {
  /** Seq of the last collected fan-out batch. */
  seq: number;
  actionsApplied: number;
  /** Every redacted event type observed across ALL seats' copies. */
  eventTypesSeen: Set<GuandanEvent['type']>;
  /** Action types the bot submitted AND the server applied (a rejection
   *  throws) — payTribute/returnTribute here prove those hints were both
   *  seen and accepted over the wire. */
  appliedHintTypes: Set<GuandanAction['type']>;
  maxHandNo: number;
  /** Latest per-seat authoritative view. */
  views: Map<Seat, GuandanView>;
}

/**
 * Drive a running guandan match with the first-hint bot: at each seq,
 * collect every seat's redacted event copy, find the seats whose copies
 * carry hints (hints are present iff the seat is an expected actor —
 * PLAN §5), and have the LOWEST such seat submit its FIRST hint. Exactly
 * one action is ever in flight, so expectedSeq is always fresh and every
 * hint action must apply — a rejection is a test failure, not a retry.
 * Stops at matchEnd, when `stopWhen` fires, or (throwing) at `maxActions`.
 */
async function driveFirstHintBot(
  holders: GuandanHolder[],
  startSeq: number,
  opts: { maxActions: number; stopWhen?: (progress: DriveProgress) => boolean },
): Promise<DriveProgress> {
  const holderOf = (seat: Seat): GuandanHolder => {
    const h = holders.find((x) => x.seats.includes(seat));
    if (!h) throw new Error(`no test client holds seat ${seat}`);
    return h;
  };

  const progress: DriveProgress = {
    seq: startSeq,
    actionsApplied: 0,
    eventTypesSeen: new Set(),
    appliedHintTypes: new Set(),
    maxHandNo: 0,
    views: new Map(),
  };
  // Per-client scan cursors so waitFor never rescans the whole (long) log.
  // Marks are captured BEFORE each send, so the fan-out copies of the next
  // seq always land at/after them.
  const marks = new Map<WsClient, number>();

  for (;;) {
    // (1) Collect every seat's redacted copy of the current seq.
    const copies = new Map<Seat, EventMsg>();
    for (let seat = 0; seat < 4; seat++) {
      const holder = holderOf(seat);
      const copy = await holder.client.waitFor<EventMsg>(
        (m) => m.type === 'event' && m.seat === seat && m.seq === progress.seq,
        { from: marks.get(holder.client) ?? 0 },
      );
      copies.set(seat, copy);
      progress.views.set(seat, viewOf(copy));
      for (const e of guandanEvents(copy)) progress.eventTypesSeen.add(e.type);
    }
    const view = progress.views.get(0)!;
    progress.maxHandNo = Math.max(progress.maxHandNo, view.handNo);

    // (2) Terminal / caller stop conditions.
    if (view.phase === 'matchEnd') return progress;
    if (opts.stopWhen !== undefined && opts.stopWhen(progress)) return progress;

    // (3) Act: lowest seat with hints plays its first hint.
    const actors = [...copies.entries()].filter(([, m]) => m.hints !== undefined).map(([s]) => s);
    if (actors.length === 0) {
      throw new Error(`bot stalled at seq ${progress.seq}: phase ${view.phase}, no seat received hints`);
    }
    const actor = Math.min(...actors);
    const hints = copies.get(actor)!.hints as GuandanAction[];
    const action = hints[0];
    if (action === undefined) {
      throw new Error(`empty hints for expected actor ${actor} at seq ${progress.seq}`);
    }
    if (progress.actionsApplied >= opts.maxActions) {
      throw new Error(
        `action cap ${opts.maxActions} hit at seq ${progress.seq} (hand ${view.handNo}, phase ${view.phase})`,
      );
    }

    for (const h of holders) marks.set(h.client, h.client.mark());
    const holder = holderOf(actor);
    const actionId = holder.client.action(actor, action, { expectedSeq: progress.seq });
    const reply = await holder.client.waitFor(
      (m) =>
        (m.type === 'event' && m.seat === actor && m.seq > progress.seq) ||
        (m.type === 'rejected' && m.actionId === actionId),
      { from: marks.get(holder.client)! },
    );
    if (reply.type === 'rejected') {
      throw new Error(`first-hint ${action.type} by seat ${actor} rejected: ${reply.error.code}`);
    }
    progress.appliedHintTypes.add(action.type);
    progress.actionsApplied += 1;
    progress.seq = (reply as EventMsg).seq;
  }
}

// ---------------------------------------------------------------------------
// The suite
// ---------------------------------------------------------------------------

describe('Guandan e2e (M3 gate)', () => {
  let server: DevServer;
  /** Room code of test 1's finished match — test 4 replays its dump.
   *  (Deliberate ordering dependency; vitest runs a file's tests in order.) */
  let finishedMatchCode: string | null = null;

  beforeAll(async () => {
    server = await startServer();
  });

  afterAll(async () => {
    await stopAllServers();
  });

  test(
    'a full Guandan match completes over the wire (4 clients, drawCard ceremony)',
    async () => {
      const config: RuleVariant = {
        ...JIANGSU_OFFICIAL_ONLINE,
        firstLeadMethod: 'drawCard',
        overshootWinsGame: true, // keeps the match short: passing A wins outright
      };
      const code = await createGuandanRoom(server, config);
      const clients: { client: WsClient; seat: Seat }[] = [];
      try {
        for (let i = 0; i < 4; i++) {
          const { client } = await connectAndWelcome(server, code, { label: `p${i}` });
          const { seat } = await claimSeat(client, `player-${i}`);
          expect(seat).toBe(i);
          clients.push({ client, seat });
        }
        // The lobby-created config survives to the room info verbatim.
        expect((await getRoomInfo(server, code)).config).toEqual(config);

        const startedSeq = await startMatch(clients[0]!.client);

        // --- Item 3: the match OPENS at the REAL cut. Every seat's start
        // copy names the same cutter; the cutter picks a position; the
        // deal — and the ceremony payload — follow from that action. ---
        const startCopies: EventMsg[] = [];
        for (const c of clients) {
          startCopies.push(
            await c.client.waitFor<EventMsg>(
              (m) => m.type === 'event' && m.seat === c.seat && m.seq === startedSeq,
            ),
          );
        }
        const cutView = viewOf(startCopies[0]!);
        expect(cutView.phase).toBe('ceremonyCut');
        const cutter = cutView.ceremonyCutter!;
        for (const copy of startCopies) {
          expect(viewOf(copy).ceremonyCutter).toBe(cutter); // public, identical
        }
        const cutterClient = clients[cutter]!.client;
        const cutMark = cutterClient.mark();
        cutterClient.action(cutter, { type: 'cutDeck', position: 42 }, { expectedSeq: startedSeq });
        const afterCut = await cutterClient.waitFor<EventMsg>(
          (m) => m.type === 'event' && m.seat === cutter && m.seq > startedSeq,
          { from: cutMark },
        );
        const dealSeq = afterCut.seq;

        // --- 翻牌定先 ceremony: the FIRST handStarted (hand 1) must carry
        // the ceremony payload, identical (public) on every seat's copy,
        // and its markerSeat must hold the lead. ---
        const firstCopies: EventMsg[] = [];
        for (const c of clients) {
          firstCopies.push(
            await c.client.waitFor<EventMsg>(
              (m) => m.type === 'event' && m.seat === c.seat && m.seq === dealSeq,
            ),
          );
        }
        const ceremony0 = handStartedOf(firstCopies[0]!)?.ceremony;
        expect(ceremony0).toBeDefined();
        for (const copy of firstCopies) {
          const hs = handStartedOf(copy);
          expect(hs).toBeDefined();
          expect(hs!.handNo).toBe(1);
          // Public ceremony: bit-identical on every seat's copy.
          expect(hs!.ceremony).toEqual(ceremony0);

          const view = viewOf(copy);
          expect(view.phase).toBe('playing'); // hand 1: no tribute
          expect(view.trick).not.toBeNull();
          expect(view.trick!.leader).toBe(ceremony0!.markerSeat); // marker leads
          expect(view.trick!.toAct).toBe(ceremony0!.markerSeat);
          // Hints (legal actions) go to the leader's copy and nobody else's.
          expect(copy.hints !== undefined).toBe(copy.seat === ceremony0!.markerSeat);
        }
        // Ceremony internals (item 3: flips are REAL cards now): the last
        // flip is countable — not a joker, not the hand-1 level '2' — the
        // logged position matches what we sent, and all seats are in range.
        const lastFlip = ceremony0!.flips[ceremony0!.flips.length - 1]!;
        expect(ceremony0!.flips.length).toBeGreaterThan(0);
        expect(ceremony0!.cutPosition).toBe(42);
        expect(lastFlip).not.toBe('SJ');
        expect(lastFlip).not.toBe('BJ');
        expect(lastFlip[0], 'countable rank').not.toBe('2');
        for (const s of [ceremony0!.cutter, ceremony0!.firstDrawer, ceremony0!.markerSeat]) {
          expect([0, 1, 2, 3]).toContain(s);
        }

        // --- Drive the whole match with the first-hint bot, from the
        // post-cut seq (the cut above already consumed the ceremony). ---
        const holders: GuandanHolder[] = clients.map((c) => ({ client: c.client, seats: [c.seat] }));
        const result = await driveFirstHintBot(holders, dealSeq, { maxActions: 20_000 });

        // Terminal state on every seat's authoritative view.
        for (const c of clients) {
          const finalView = result.views.get(c.seat)!;
          expect(finalView.phase).toBe('matchEnd');
          expect(finalView.matchWinner).not.toBeNull();
        }
        expect(result.eventTypesSeen.has('matchEnded')).toBe(true);

        // Tribute phases occurred from hand 2 onward: the payTribute /
        // returnTribute hints were seen AND accepted (the bot only submits
        // hints, and a rejection throws), and the atomic reveal events
        // crossed the wire.
        expect(result.maxHandNo).toBeGreaterThanOrEqual(2);
        expect(result.appliedHintTypes.has('payTribute')).toBe(true);
        expect(result.appliedHintTypes.has('returnTribute')).toBe(true);
        expect(result.eventTypesSeen.has('tributePaid')).toBe(true);
        expect(result.eventTypesSeen.has('tributeReturned')).toBe(true);

        // Normal trick churn crossed the wire too.
        expect(result.appliedHintTypes.has('play')).toBe(true);
        expect(result.eventTypesSeen.has('trickWon')).toBe(true);
        expect(result.eventTypesSeen.has('jiefeng')).toBe(true);
        expect(result.eventTypesSeen.has('playerFinished')).toBe(true);
        expect(result.eventTypesSeen.has('handEnded')).toBe(true);

        // Room reached its terminal status.
        expect((await getRoomInfo(server, code)).status).toBe('finished');
        finishedMatchCode = code; // handed to test 4 (dump→replay)
      } finally {
        closeAll(clients.map((c) => c.client));
      }
    },
    110_000,
  );

  test(
    'multi-seat self-play: one socket drives all four seats to a finished hand',
    async () => {
      const code = await createGuandanRoom(server, { ...JIANGSU_OFFICIAL_ONLINE });
      const opened: WsClient[] = [];
      try {
        const { client: solo } = await connectAndWelcome(server, code, { label: 'solo' });
        opened.push(solo);
        const seats: Seat[] = [];
        for (let i = 0; i < 4; i++) seats.push((await claimSeat(solo, `me-as-${i}`)).seat);
        expect(seats).toEqual([0, 1, 2, 3]);

        const startedSeq = await startMatch(solo);

        // Time-bound: play only until the first handEnded, not a full match.
        const result = await driveFirstHintBot([{ client: solo, seats }], startedSeq, {
          maxActions: 5_000,
          stopWhen: (p) => p.eventTypesSeen.has('handEnded'),
        });
        expect(result.eventTypesSeen.has('handEnded')).toBe(true);

        // Per-seat redaction held throughout on the ONE multiplexed socket:
        // every handStarted copy (hand 1's deal, plus hand 2's if the next
        // deal landed in the same batch as handEnded) shows exactly the
        // copy's own seat's 27 dealt cards and NOTHING of the other hands.
        let handStartedCopies = 0;
        for (const msg of solo.log) {
          if (msg.type !== 'event') continue;
          const eventMsg = msg as EventMsg;
          expect(viewOf(eventMsg).seat).toBe(eventMsg.seat); // view redacted for its seat
          for (const e of guandanEvents(eventMsg)) {
            if (e.type !== 'handStarted') continue;
            handStartedCopies += 1;
            for (let s = 0; s < 4; s++) {
              if (s === eventMsg.seat) expect(e.hands[s]!.length).toBe(27);
              else expect(e.hands[s]).toEqual([]);
            }
          }
        }
        // One copy per held seat for hand 1 at minimum (4 more if hand 2
        // was dealt in the stopping batch).
        expect(handStartedCopies).toBeGreaterThanOrEqual(4);
      } finally {
        closeAll(opened);
      }
    },
    90_000,
  );

  test(
    'rule-picker config actually alters play',
    async () => {
      // Two rooms differing ONLY in cardCountVisibility: 'always' must show
      // opponents' counts; 'onRequestLE10' must hide them while > 10 cards
      // (i.e. at the 27-card deal). Proves lobby config → engine behavior
      // end to end without a full match.
      const cases: { visibility: RuleVariant['cardCountVisibility']; expectHidden: boolean }[] = [
        { visibility: 'always', expectHidden: false },
        { visibility: 'onRequestLE10', expectHidden: true },
      ];
      const opened: WsClient[] = [];
      try {
        for (const { visibility, expectHidden } of cases) {
          const code = await createGuandanRoom(server, {
            ...JIANGSU_OFFICIAL_ONLINE,
            cardCountVisibility: visibility,
          });
          const { client } = await connectAndWelcome(server, code, { label: `vis-${visibility}` });
          opened.push(client);
          for (let i = 0; i < 4; i++) await claimSeat(client, `cfg-${i}`);
          const startedSeq = await startMatch(client);

          for (let seat = 0; seat < 4; seat++) {
            const copy = await client.waitFor<EventMsg>(
              (m) => m.type === 'event' && m.seat === seat && m.seq === startedSeq,
            );
            const view = viewOf(copy);
            expect(view.cardCounts[seat]).toBe(27); // own count always visible
            for (let other = 0; other < 4; other++) {
              if (other === seat) continue;
              expect(view.cardCounts[other]).toBe(expectHidden ? null : 27);
            }
          }
        }
      } finally {
        closeAll(opened);
      }
    },
    60_000,
  );

  test(
    'dump→replay reproduces a Guandan match (config incl.)',
    async () => {
      // Reuses test 1's finished room: its dump carries the full replay
      // triple (gameId, seed, config) + the ordered applied-action log.
      expect(finishedMatchCode).not.toBeNull();
      const dump = await getFullDump(server, finishedMatchCode!);
      expect(dump.room.status).toBe('finished');
      expect(dump.gameId).toBe('guandan');
      expect(typeof dump.seed).toBe('string');
      expect((dump.room.config as RuleVariant).overshootWinsGame).toBe(true);
      expect(dump.actions.length).toBeGreaterThan(0);

      // Convert with the production converter and replay through the REAL
      // engine in THIS process (scripts/replay.ts imports engine code
      // directly): init(config, 4, seed) + the action log must land exactly
      // on the server's authoritative final snapshot — config included,
      // since a config mismatch would diverge immediately (ceremony,
      // tribute rules, visibility all flow from it).
      const artifact = artifactFromDump(dump);
      expect(artifact.seats).toBe(4);
      const result = replayMatch(artifact, {
        // The artifact renumbers from init = seq 0, so the dump's final
        // snapshot sits at artifact seq = actions.length.
        snapshots: [{ seq: artifact.actions.length, state: dump.snapshot.state }],
      });
      expect(result.rejection).toBeUndefined();
      expect(result.divergence).toBeUndefined();
      expect(result.ok).toBe(true);
      expect(deepEqual(result.finalState, dump.snapshot.state)).toBe(true);
      // And the replayed final state is terminal, matching the room status.
      expect((result.finalState as { phase: string }).phase).toBe('matchEnd');
    },
    60_000,
  );
});
