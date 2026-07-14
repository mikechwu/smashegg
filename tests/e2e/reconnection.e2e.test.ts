// M4 reconnection acceptance e2e (PLAN §5 flow, docs/research/room-timing.md
// §2): socket drops while the SERVER STAYS UP — the gap no other e2e file
// covers (room.e2e kills the whole process; its takeover test never closes
// the original socket). Four pins: the delta resync path, the forced
// snapshot fallback, actionId exactly-once across a drop, and the
// reconnect-restores-base deadline rule (the M2 fresh-clock fix) — all
// wire-protocol only, like every e2e file.

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { Seat } from '../../src/engine/core/game';
import type { GNConfig, GNView } from '../../src/engine/guess-number';
import { JIANGSU_OFFICIAL_ONLINE } from '../../src/engine/guandan/config';
import { DEFAULT_GAME_ID } from '../../src/client/config';
import {
  claimSeat,
  connectAndWelcome,
  createRoom,
  createRoomFor,
  driveToMatchEnd,
  getDump,
  getRoomInfo,
  startServer,
  stopAllServers,
  WsClient,
  type DevServer,
  type EventMsg,
  type ResyncMsg,
  type WelcomeMsg,
} from './helpers';

const CONFIG: GNConfig = { rangeMax: 100, suddenDeath: true };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function closeAll(clients: WsClient[]): void {
  for (const c of clients) c.close();
}

/** Await this client's fan-out copy for one (seat, seq) pair — copies land
 *  asynchronously per socket, so assertions must await them explicitly. */
function awaitEventCopy(client: WsClient, seat: Seat, seq: number): Promise<EventMsg> {
  return client.waitFor<EventMsg>((m) => m.type === 'event' && m.seat === seat && m.seq === seq);
}

/** Seqs (ascending) of the game-event copies this client received for one
 *  held seat — the witness-side delivery record. */
function eventSeqsForSeat(client: WsClient, seat: Seat): number[] {
  return client.log
    .filter((m): m is EventMsg => m.type === 'event' && m.seat === seat)
    .map((m) => m.seq)
    .sort((a, b) => a - b);
}

describe('Reconnection acceptance e2e (M4)', () => {
  let server: DevServer;

  beforeAll(async () => {
    server = await startServer();
  });

  afterAll(async () => {
    await stopAllServers();
  });

  /** Two-seat guess-number game on the shared server, started, with the
   *  secret read off the dump route so tests can play guaranteed-WRONG
   *  guesses that never end the match. Rooms are created WITHOUT timing —
   *  the server-side default is the standard preset (45s turns), so every
   *  post-drop sequence below has a huge margin before any alarm could
   *  auto-play a default action and disturb the seq arithmetic. */
  async function startTwoSeatGuessGame(): Promise<{
    code: string;
    a: WsClient;
    b: WsClient;
    seatA: { seat: Seat; token: string };
    seatB: { seat: Seat; token: string };
    /** a's welcome.seq from BEFORE any seat was claimed — lobby-era. */
    lobbySeq: number;
    startedSeq: number;
    secret: number;
    wrongGuess: number;
  }> {
    const code = await createRoom(server, CONFIG);
    const { client: a, welcome: welcomeA } = await connectAndWelcome(server, code, { label: 'a' });
    const seatA = await claimSeat(a, 'alice');
    const { client: b } = await connectAndWelcome(server, code, { label: 'b' });
    const seatB = await claimSeat(b, 'bob');
    a.start();
    const started = await a.waitFor((m) => m.type === 'started');
    await b.waitFor((m) => m.type === 'started');

    const dump = await getDump(server, code);
    const secret = dump.snapshot.state?.secret as number;
    expect(typeof secret).toBe('number');
    return {
      code,
      a,
      b,
      seatA,
      seatB,
      lobbySeq: welcomeA.seq,
      startedSeq: started.seq,
      secret,
      wrongGuess: secret === 1 ? 2 : 1,
    };
  }

  /** Submit one guess and await the SENDER's own event copy. */
  async function playGuess(
    client: WsClient,
    seat: Seat,
    value: number,
    expectedSeq: number,
  ): Promise<EventMsg> {
    const mark = client.mark();
    client.action(seat, { type: 'guess', value }, { expectedSeq });
    return client.waitFor<EventMsg>(
      (m) => m.type === 'event' && m.seat === seat && m.seq > expectedSeq,
      { from: mark },
    );
  }

  test('drop mid-game → reconnect resyncs by exact contiguous delta and the game finishes on the new socket', async () => {
    const { code, a, b, seatA, seatB, startedSeq, wrongGuess } = await startTwoSeatGuessGame();
    const opened: WsClient[] = [a, b];
    try {
      // Real event history before the drop: A, B, A guess wrong → toAct = B.
      let seq = startedSeq;
      for (const [client, seat] of [
        [a, seatA.seat],
        [b, seatB.seat],
        [a, seatA.seat],
      ] as const) {
        seq = (await playGuess(client, seat, wrongGuess, seq)).seq;
      }
      const preDropSeq = seq;
      for (let s = startedSeq; s <= preDropSeq; s++) {
        await Promise.all([awaitEventCopy(a, seatA.seat, s), awaitEventCopy(b, seatB.seat, s)]);
      }

      // HARD DROP A — native close(), server stays up. The witness observing
      // disconnected-presence proves handleSocketGone ran before we move on.
      const bMark = b.mark();
      a.close();
      await b.waitFor(
        (m) => m.type === 'presence' && m.seat === seatA.seat && m.connected === false,
        { from: bMark },
      );

      // The game moves on without A: B's guess is the event A will miss.
      const missed = await playGuess(b, seatB.seat, wrongGuess, preDropSeq);
      expect(missed.seq).toBe(preDropSeq + 1);

      // Reconnect with the same token + preDropSeq (byte-identical semantics
      // to the client's hello-on-open).
      const bMark2 = b.mark();
      const { client: a2, welcome } = await connectAndWelcome(server, code, {
        tokens: [seatA.token],
        lastSeenSeq: preDropSeq,
        label: 'a2',
      });
      opened.push(a2);
      expect(welcome.seats).toEqual([seatA.seat]); // token still resolves the seat
      expect(welcome.room.status).toBe('playing');
      // Exact — nothing else can move the seq: we are seconds into the
      // default standard 45s turn budget, so no alarm auto-play interferes.
      expect(welcome.seq).toBe(preDropSeq + 1);

      // DELTA path: the retained log covers the gap contiguously.
      const resync = await a2.waitFor<ResyncMsg>(
        (m) => m.type === 'resync' && m.seat === seatA.seat,
      );
      expect(resync.events).toBeDefined();
      expect(resync.events!.map((e) => e.seq)).toEqual([preDropSeq + 1]);
      // guess-number's viewEvent is the identity (everything public), so the
      // witness's live copy is a valid cross-seat control for the redacted
      // payload A would have seen live.
      expect(resync.events![0]!.event).toEqual(missed.event);
      const resumedView = resync.view as GNView;
      expect(resumedView.seat).toBe(seatA.seat);
      expect(resumedView.toAct).toBe(seatA.seat);
      expect(resync.hints).toBeDefined();

      // Presence recovered on the witness.
      await b.waitFor(
        (m) => m.type === 'presence' && m.seat === seatA.seat && m.connected === true,
        { from: bMark2 },
      );

      // The resynced socket is genuinely LIVE, not just cosmetically synced.
      const { view: finalView } = await driveToMatchEnd(
        [
          { client: a2, seats: [seatA.seat] },
          { client: b, seats: [seatB.seat] },
        ],
        { view: resumedView, seq: resync.seq },
      );
      expect(finalView.phase).toBe('matchEnd');
      expect((await getRoomInfo(server, code)).status).toBe('finished');

      // Per-seat delivery held across the whole reconnected session: every
      // event/resync on a2 was redacted for seat A — no seat-B copies, and
      // exactly the one hello resync.
      const perSeat = a2.log.filter(
        (m): m is EventMsg | ResyncMsg => m.type === 'event' || m.type === 'resync',
      );
      expect(perSeat.length).toBeGreaterThan(1);
      for (const m of perSeat) {
        expect(m.seat).toBe(seatA.seat);
        expect((m.view as GNView).seat).toBe(seatA.seat);
      }
      expect(perSeat.filter((m) => m.type === 'resync')).toHaveLength(1);
    } finally {
      closeAll(opened);
    }
  });

  test('lobby-era lastSeenSeq forces snapshot-only resync (no events) whose view alone resumes play', async () => {
    const { code, a, b, seatA, seatB, lobbySeq, startedSeq, secret, wrongGuess } =
      await startTwoSeatGuessGame();
    const opened: WsClient[] = [a, b];
    try {
      // lobbySeq predates BOTH seat claims (a fresh room's first welcome), so
      // the gap lobbySeq+1..seq spans lobby bumps that wrote no events rows —
      // the delta can never cover it once the game has produced events.
      expect(lobbySeq).toBe(0);

      let seq = startedSeq;
      seq = (await playGuess(a, seatA.seat, wrongGuess, seq)).seq;
      seq = (await playGuess(b, seatB.seat, wrongGuess, seq)).seq; // toAct = A
      for (let s = startedSeq; s <= seq; s++) {
        await Promise.all([awaitEventCopy(a, seatA.seat, s), awaitEventCopy(b, seatB.seat, s)]);
      }
      const bLast = await awaitEventCopy(b, seatB.seat, seq);

      const bMark = b.mark();
      a.close();
      await b.waitFor(
        (m) => m.type === 'presence' && m.seat === seatA.seat && m.connected === false,
        { from: bMark },
      );

      const { client: a2, welcome } = await connectAndWelcome(server, code, {
        tokens: [seatA.token],
        lastSeenSeq: lobbySeq,
        label: 'a2',
      });
      opened.push(a2);
      expect(welcome.seats).toEqual([seatA.seat]);
      expect(welcome.seq).toBe(seq);

      const resync = await a2.waitFor<ResyncMsg>(
        (m) => m.type === 'resync' && m.seat === seatA.seat,
      );
      // THE discriminating assertion (the delta test asserts the opposite,
      // so the pair pins both branches of the resync path).
      expect(resync.events).toBeUndefined();
      // The snapshot view is complete: it equals the witness's current view
      // re-seated for A (guess-number redacts nothing else per seat).
      expect(resync.view).toEqual({ ...(bLast.view as GNView), seat: seatA.seat });
      expect(resync.hints).toBeDefined();
      expect(resync.deadlines).toBeDefined();
      expect(resync.deadlines!.some((d) => d.seat === seatA.seat)).toBe(true);

      // Playability: act purely from the snapshot's hints, and it applies.
      const hints = resync.hints as { type: 'guess'; value: number }[];
      const hint = hints.find((h) => h.value !== secret);
      expect(hint).toBeDefined();
      const bMark2 = b.mark();
      a2.action(seatA.seat, hint!, { expectedSeq: resync.seq });
      const applied = await a2.waitFor<EventMsg>(
        (m) => m.type === 'event' && m.seat === seatA.seat && m.seq > resync.seq,
      );
      expect(applied.seq).toBe(seq + 1);
      await b.waitFor((m) => m.type === 'event' && m.seq === applied.seq, { from: bMark2 });

      // Degenerate cousin — the no-restart drop path every stable client's
      // reconnect produces in production: fully caught up (lastSeenSeq =
      // current) is also snapshot-only, with nothing to replay.
      const bMark3 = b.mark();
      a2.close();
      await b.waitFor(
        (m) => m.type === 'presence' && m.seat === seatA.seat && m.connected === false,
        { from: bMark3 },
      );
      const { client: a3, welcome: welcome3 } = await connectAndWelcome(server, code, {
        tokens: [seatA.token],
        lastSeenSeq: applied.seq,
        label: 'a3',
      });
      opened.push(a3);
      expect(welcome3.seq).toBe(applied.seq);
      const resync3 = await a3.waitFor<ResyncMsg>(
        (m) => m.type === 'resync' && m.seat === seatA.seat,
      );
      expect(resync3.events).toBeUndefined();
      expect(resync3.view).toEqual(applied.view);
    } finally {
      closeAll(opened);
    }
  });

  test('the same actionId resent across a drop applies exactly once: dup answered by resync, witness seq never gaps', async () => {
    const { code, a, b, seatA, seatB, startedSeq, wrongGuess } = await startTwoSeatGuessGame();
    const opened: WsClient[] = [a, b];
    try {
      // A opens the round. Pin the actionId so the post-drop resend is the
      // IDENTICAL envelope, exactly as the client contract prescribes.
      const preSeq = startedSeq;
      const actionId = randomUUID();
      const action = { type: 'guess', value: wrongGuess };
      const bMark = b.mark();
      a.action(seatA.seat, action, { expectedSeq: preSeq, actionId });

      // The FIRST application is confirmed by the independent witness, which
      // removes any race about whether the frame arrived.
      const witnessed = await b.waitFor<EventMsg>(
        (m) => m.type === 'event' && m.seat === seatB.seat && m.seq > preSeq,
        { from: bMark },
      );
      const seqApplied = witnessed.seq;
      expect(seqApplied).toBe(preSeq + 1);

      // Drop BEFORE consuming the ack: A's own copy may sit unread in its
      // log, but the client never acted on it — the real 'sent, never
      // learned the outcome' shape that forces a resend.
      a.close();
      await b.waitFor(
        (m) => m.type === 'presence' && m.seat === seatA.seat && m.connected === false,
        { from: bMark },
      );

      // Everything from here to the seq-gap proof completes in ~1-2s — far
      // inside the default standard preset's 45s turn budget, so no alarm
      // default action can consume a seq and contaminate the arithmetic.
      const { client: a2, welcome } = await connectAndWelcome(server, code, {
        tokens: [seatA.token],
        lastSeenSeq: preSeq,
        label: 'a2',
      });
      opened.push(a2);
      expect(welcome.seq).toBe(seqApplied);
      const helloResync = await a2.waitFor<ResyncMsg>(
        (m) => m.type === 'resync' && m.seat === seatA.seat,
      );
      // The delta already INCLUDES the applied seq — a real client that
      // dropped pre-ack cannot correlate it with its unacked send, hence
      // the resend below.
      expect(helloResync.events).toBeDefined();
      expect(helloResync.events!.map((e) => e.seq)).toEqual([seqApplied]);

      // RESEND the identical envelope: same actionId, same action, now-stale
      // expectedSeq. The reply must be a resync — an idempotent success —
      // never a second event and never a rejection.
      const replyMark = a2.mark();
      a2.action(seatA.seat, action, { expectedSeq: preSeq, actionId });
      const reply = await a2.waitFor(
        (m) =>
          m.type === 'resync' ||
          (m.type === 'rejected' && m.actionId === actionId) ||
          (m.type === 'event' && m.seq > seqApplied),
        { from: replyMark },
      );
      expect(reply.type).toBe('resync');
      const dupResync = reply as ResyncMsg;
      expect(dupResync.seq).toBe(seqApplied);
      expect(dupResync.events).toBeUndefined();
      // State-wise the dup resync is a no-op: same view the delta produced.
      expect(dupResync.view).toEqual(helloResync.view);

      // SEQ-GAP PROOF: the witness's own next action lands at EXACTLY
      // seqApplied+1 — any duplicate application would have consumed a seq.
      const bNext = await playGuess(b, seatB.seat, wrongGuess, seqApplied);
      expect(bNext.seq).toBe(seqApplied + 1);
      // The witness saw exactly one event per applied seq, nothing extra.
      expect(eventSeqsForSeat(b, seatB.seat)).toEqual([startedSeq, seqApplied, seqApplied + 1]);
      expect((await getRoomInfo(server, code)).seq).toBe(seqApplied + 1);
    } finally {
      closeAll(opened);
    }
  });

  test('reconnect restores the ORIGINAL deadline base: disconnect clamps toward grace, reconnect never grants a fresh clock', async () => {
    // Guandan under the standard preset (the create-without-timing default):
    // the opening lead is the 'planning' class → 90s budget, ABOVE the 60s
    // disconnect grace, so the clamp is strictly visible on the wire and a
    // restore-to-base cannot be confused with an unchanged row.
    const code = await createRoomFor(server, DEFAULT_GAME_ID, JIANGSU_OFFICIAL_ONLINE);
    const opened: WsClient[] = [];
    try {
      const { client: holder } = await connectAndWelcome(server, code, { label: 'holder' });
      opened.push(holder);
      const tokens: string[] = [];
      for (let i = 0; i < 4; i++) tokens.push((await claimSeat(holder, `p-${i}`)).token);
      // Token-less observer: outlives every drop, and re-hello lets it read
      // the current deadlines table off a fresh welcome (wire-only).
      const { client: observer } = await connectAndWelcome(server, code, { label: 'observer' });
      opened.push(observer);

      const startMark = holder.mark();
      holder.start();
      const started = await holder.waitFor((m) => m.type === 'started', { from: startMark });
      let leader: Seat | null = null;
      let d0 = 0;
      for (let seat = 0 as Seat; seat < 4; seat++) {
        const copy = await holder.waitFor<EventMsg>(
          (m) => m.type === 'event' && m.seat === seat && m.seq === started.seq,
          { from: startMark },
        );
        if (copy.hints !== undefined) leader = seat; // the opening leader
        if (seat === 0) {
          const rows = copy.deadlines!;
          expect(rows).toHaveLength(1);
          expect(rows[0]!.timingClass).toBe('planning');
          d0 = rows[0]!.dueAt; // the broadcast base deadline
        }
      }
      expect(leader).not.toBeNull();
      // Far enough out that any grace clamp in the next few seconds must
      // strictly SHRINK dueAt (drop+60s < d0).
      expect(d0 - Date.now()).toBeGreaterThan(70_000);

      // Move the leader seat to its own socket via token TAKEOVER — the seat
      // never disconnects, so the clock must be untouched (takeover is not a
      // presence flip).
      const { client: taker, welcome: takerWelcome } = await connectAndWelcome(server, code, {
        tokens: [tokens[leader!]!],
        label: 'taker',
      });
      opened.push(taker);
      expect(takerWelcome.deadlines).toEqual([
        { seat: leader, dueAt: d0, timingClass: 'planning' },
      ]);

      // HARD-DROP the actor on the clock.
      const obsMark = observer.mark();
      const droppedAt = Date.now();
      taker.close();
      await observer.waitFor(
        (m) => m.type === 'presence' && m.seat === leader && m.connected === false,
        { from: obsMark },
      );

      // The other client reads the presence-clamped deadline: clamped DOWN
      // toward disconnect+60s, never extended, class preserved.
      const helloMark = observer.mark();
      observer.hello([], 0);
      const welcome2 = await observer.waitFor<WelcomeMsg>((m) => m.type === 'welcome', {
        from: helloMark,
      });
      const clamped = (welcome2.deadlines ?? []).find((d) => d.seat === leader);
      expect(clamped).toBeDefined();
      expect(clamped!.dueAt).toBeLessThan(d0);
      expect(clamped!.dueAt - droppedAt).toBeGreaterThan(50_000);
      expect(clamped!.dueAt - droppedAt).toBeLessThanOrEqual(61_000);
      expect(clamped!.timingClass).toBe('planning');

      // A real gap between arm and reconnect, so restore-to-base and a
      // fresh clock (reconnect time + budget) cannot numerically coincide.
      await sleep(1_000);

      // Reconnect the actor within the grace: the next deadlines broadcast
      // restores dueAt EXACTLY to the original base — the wire-level pin of
      // nextDeadlines' reconnect-restores-base row (the M2 fresh-clock fix).
      const obsMark2 = observer.mark();
      const { client: taker2, welcome: welcome3 } = await connectAndWelcome(server, code, {
        tokens: [tokens[leader!]!],
        lastSeenSeq: started.seq,
        label: 'taker2',
      });
      opened.push(taker2);
      expect(welcome3.deadlines).toEqual([{ seat: leader, dueAt: d0, timingClass: 'planning' }]);
      const resync = await taker2.waitFor<ResyncMsg>(
        (m) => m.type === 'resync' && m.seat === leader,
      );
      expect(resync.deadlines).toEqual([{ seat: leader, dueAt: d0, timingClass: 'planning' }]);
      await observer.waitFor(
        (m) => m.type === 'presence' && m.seat === leader && m.connected === true,
        { from: obsMark2 },
      );
    } finally {
      closeAll(opened);
    }
  });
});
