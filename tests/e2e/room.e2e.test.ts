// M2 gate e2e scenarios (PLAN.md §9): real `wrangler dev` + real WebSocket
// clients driving the GameRoom DO through the PLAN §5 wire protocol with
// the guess-number dummy game. Each named test is one gate scenario.
//
// Tests a–d and f share one wrangler instance (rooms are isolated DOs);
// the kill/restart test (e) manages its own two instances on one shared
// persist dir — reusing that dir across the process restart is exactly
// what preserves DO state.

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { GNConfig, GNView } from '../../src/engine/guess-number';
import {
  awaitInitialView,
  claimSeat,
  connectAndWelcome,
  createRoom,
  driveToMatchEnd,
  getDump,
  getRoomInfo,
  makePersistDir,
  nextGuess,
  startServer,
  stopAllServers,
  WsClient,
  type DevServer,
  type EventMsg,
  type RejectedMsg,
  type ResyncMsg,
  type SeatHolder,
} from './helpers';

const VALID_CONFIG: GNConfig = { rangeMax: 100, suddenDeath: true };

/** All live clients opened in the current test, closed in afterEach-style
 *  cleanup at the end of each test body (and harmlessly re-closable). */
function closeAll(clients: WsClient[]): void {
  for (const c of clients) c.close();
}

/** Await this client's fan-out copy for one (seat, seq) pair. Fan-out
 *  copies for the same seq land on different sockets (and different held
 *  seats) asynchronously, so tests must await the copies they are about to
 *  assert on instead of reading the log right after the SENDER's copy. */
function awaitEventCopy(client: WsClient, seat: number, seq: number): Promise<EventMsg> {
  return client.waitFor<EventMsg>((m) => m.type === 'event' && m.seat === seat && m.seq === seq);
}

/** Seqs (ascending) of the game-event fan-out copies this client received
 *  for one held seat — used to prove per-seat delivery multiplicity. */
function eventSeqsForSeat(client: WsClient, seat: number): number[] {
  return client.log
    .filter((m): m is EventMsg => m.type === 'event' && m.seat === seat)
    .map((m) => m.seq)
    .sort((a, b) => a - b);
}

describe('GameRoom e2e (M2 gate)', () => {
  let server: DevServer;

  beforeAll(async () => {
    server = await startServer();
  });

  afterAll(async () => {
    // Reaps the shared server AND any restart-test survivors on failure.
    await stopAllServers();
  });

  test('4 clients complete a guess-number game', async () => {
    const code = await createRoom(server, null);
    const clients: { client: WsClient; seat: number; token: string }[] = [];
    try {
      for (let i = 0; i < 4; i++) {
        const { client } = await connectAndWelcome(server, code, { label: `p${i}` });
        const { seat, token } = await claimSeat(client, `player-${i}`);
        expect(seat).toBe(i); // lowest-free-seat claiming, in join order
        clients.push({ client, seat, token });
      }

      // Any seated player may set the config; everyone sees the broadcast.
      const marks = clients.map((c) => c.client.mark());
      clients[2]!.client.setConfig(VALID_CONFIG);
      await Promise.all(
        clients.map((c, i) =>
          c.client.waitFor((m) => m.type === 'configChanged', { from: marks[i]! }),
        ),
      );

      // Any seated player may start once enough seats are claimed.
      clients[0]!.client.start();
      const startedMsgs = await Promise.all(
        clients.map((c) => c.client.waitFor((m) => m.type === 'started')),
      );
      const startedSeq = startedMsgs[0]!.seq;
      // Every client saw the SAME started seq.
      for (const m of startedMsgs) expect(m.seq).toBe(startedSeq);

      const holders: SeatHolder[] = clients.map((c) => ({ client: c.client, seats: [c.seat] }));
      const start = await awaitInitialView(clients[0]!.client, startedSeq);
      const { view: finalView } = await driveToMatchEnd(holders, start);

      // Terminal state reached and visible to EVERY client.
      expect(finalView.phase).toBe('matchEnd');
      expect(finalView.winner).not.toBeNull();
      for (const c of clients) {
        const terminal = await c.client.waitFor<EventMsg>(
          (m) => m.type === 'event' && (m.view as GNView).phase === 'matchEnd',
        );
        expect(terminal.seat).toBe(c.seat);

        // Per-seat delivery: every event copy this client received is
        // redacted FOR its one held seat and carries an authoritative view.
        const events = c.client.log.filter((m): m is EventMsg => m.type === 'event');
        expect(events.length).toBeGreaterThan(0);
        for (const e of events) {
          expect(e.seat).toBe(c.seat);
          expect(e.view).toBeDefined();
          expect((e.view as GNView).seat).toBe(c.seat);
        }
      }

      const info = await getRoomInfo(server, code);
      expect(info.status).toBe('finished');
    } finally {
      closeAll(clients.map((c) => c.client));
    }
  });

  test('one client drives two seats (multi-seat)', async () => {
    const code = await createRoom(server, null);
    const opened: WsClient[] = [];
    try {
      const { client: multi } = await connectAndWelcome(server, code, { label: 'multi' });
      opened.push(multi);
      // One socket claims seats 0 AND 1 — two claims on the same connection.
      const s0 = await claimSeat(multi, 'left-hand');
      const s1 = await claimSeat(multi, 'right-hand');
      expect([s0.seat, s1.seat]).toEqual([0, 1]);

      const { client: b } = await connectAndWelcome(server, code, { label: 'b' });
      opened.push(b);
      const s2 = await claimSeat(b, 'bea');
      const { client: c } = await connectAndWelcome(server, code, { label: 'c' });
      opened.push(c);
      const s3 = await claimSeat(c, 'cal');

      multi.setConfig(VALID_CONFIG);
      await multi.waitFor((m) => m.type === 'configChanged');
      multi.start();
      const started = await multi.waitFor((m) => m.type === 'started');

      const holders: SeatHolder[] = [
        { client: multi, seats: [s0.seat, s1.seat] },
        { client: b, seats: [s2.seat] },
        { client: c, seats: [s3.seat] },
      ];
      const start = await awaitInitialView(multi, started.seq);
      const { view: finalView, seq: finalSeq } = await driveToMatchEnd(holders, start);
      expect(finalView.phase).toBe('matchEnd');

      // Let the final seq's fan-out land on EVERY (socket, seat) before
      // reading logs — copies arrive asynchronously per socket.
      await Promise.all([
        awaitEventCopy(multi, s0.seat, finalSeq),
        awaitEventCopy(multi, s1.seat, finalSeq),
        awaitEventCopy(b, s2.seat, finalSeq),
        awaitEventCopy(c, s3.seat, finalSeq),
      ]);

      // The multiplexed socket got one redacted copy PER HELD SEAT for
      // every applied game seq — exactly the seqs single-seat clients saw.
      const referenceSeqs = eventSeqsForSeat(b, s2.seat);
      expect(referenceSeqs.length).toBeGreaterThan(0);
      expect(eventSeqsForSeat(multi, s0.seat)).toEqual(referenceSeqs);
      expect(eventSeqsForSeat(multi, s1.seat)).toEqual(referenceSeqs);
    } finally {
      closeAll(opened);
    }
  });

  test('4-seat solo playthrough', async () => {
    const code = await createRoom(server, null);
    const opened: WsClient[] = [];
    try {
      const { client: solo } = await connectAndWelcome(server, code, { label: 'solo' });
      opened.push(solo);
      const seats: number[] = [];
      for (let i = 0; i < 4; i++) {
        const { seat } = await claimSeat(solo, `me-as-${i}`);
        seats.push(seat);
      }
      expect(seats).toEqual([0, 1, 2, 3]);

      solo.setConfig(VALID_CONFIG);
      await solo.waitFor((m) => m.type === 'configChanged');
      solo.start();
      const started = await solo.waitFor((m) => m.type === 'started');

      const start = await awaitInitialView(solo, started.seq);
      const { view: finalView, seq: finalSeq } = await driveToMatchEnd(
        [{ client: solo, seats }],
        start,
      );
      expect(finalView.phase).toBe('matchEnd');

      // The driver returns on the FIRST copy of the final seq; the other
      // three per-seat copies are still in flight — await them.
      await Promise.all(seats.map((s) => awaitEventCopy(solo, s, finalSeq)));

      // The SINGLE socket received a per-seat redacted copy for all four
      // seats at every applied game seq, each copy's view redacted for its
      // own seat.
      const events = solo.log.filter((m): m is EventMsg => m.type === 'event');
      const bySeq = new Map<number, EventMsg[]>();
      for (const e of events) {
        bySeq.set(e.seq, [...(bySeq.get(e.seq) ?? []), e]);
        expect((e.view as GNView).seat).toBe(e.seat);
      }
      expect(bySeq.size).toBeGreaterThan(0);
      for (const [seq, copies] of bySeq) {
        expect(copies.map((e) => e.seat).sort((a, b) => a - b), `seq ${seq}`).toEqual([0, 1, 2, 3]);
      }
    } finally {
      closeAll(opened);
    }
  });

  test('lobby: edit → broadcast → freeze', async () => {
    const code = await createRoom(server, null);
    const opened: WsClient[] = [];
    try {
      const { client: editor } = await connectAndWelcome(server, code, { label: 'editor' });
      opened.push(editor);
      const e0 = await claimSeat(editor, 'edith');
      const { client: watcher } = await connectAndWelcome(server, code, { label: 'watcher' });
      opened.push(watcher);
      await claimSeat(watcher, 'walt');

      // Live edit: the OTHER socket observes configChanged as it happens.
      const draft = { rangeMax: 1000, suddenDeath: false };
      const wMark = watcher.mark();
      editor.setConfig(draft);
      const changed = await watcher.waitFor(
        (m) => m.type === 'configChanged',
        { from: wMark },
      );
      expect(changed.type === 'configChanged' && changed.config).toEqual(draft);
      expect(changed.type === 'configChanged' && changed.bySeat).toBe(e0.seat);

      // A config the room happily stores (opaque!) but the GAME rejects at
      // init: guess-number validates rangeMax as 100|1000, so 7 fails start.
      const nonsense = { rangeMax: 7, suddenDeath: true };
      editor.setConfig(nonsense);
      await watcher.waitFor(
        (m) => m.type === 'configChanged' && JSON.stringify(m.config) === JSON.stringify(nonsense),
      );
      const eMark = editor.mark();
      editor.start();
      const rejected = await editor.waitFor<RejectedMsg>((m) => m.type === 'rejected', { from: eMark });
      expect(rejected.error.code).toBe('room.startFailed');

      // Room stayed in lobby with the (bad) config intact and editable.
      const lobbyInfo = await getRoomInfo(server, code);
      expect(lobbyInfo.status).toBe('lobby');
      expect(lobbyInfo.config).toEqual(nonsense);

      // Fix the config (still editable), then a valid start succeeds.
      const wMark2 = watcher.mark();
      editor.setConfig(VALID_CONFIG);
      await watcher.waitFor(
        (m) => m.type === 'configChanged' && JSON.stringify(m.config) === JSON.stringify(VALID_CONFIG),
        { from: wMark2 },
      );
      watcher.start();
      await Promise.all([
        editor.waitFor((m) => m.type === 'started'),
        watcher.waitFor((m) => m.type === 'started'),
      ]);

      // Frozen for the match: post-start edits are rejected and the stored
      // config is unchanged.
      const eMark2 = editor.mark();
      editor.setConfig({ rangeMax: 1000, suddenDeath: false });
      const frozen = await editor.waitFor<RejectedMsg>((m) => m.type === 'rejected', { from: eMark2 });
      expect(frozen.error.code).toBe('room.notLobby');
      const playingInfo = await getRoomInfo(server, code);
      expect(playingInfo.status).toBe('playing');
      expect(playingInfo.config).toEqual(VALID_CONFIG);
    } finally {
      closeAll(opened);
    }
  });

  test('kill/restart mid-game → resume from snapshot', async () => {
    // Own servers: the whole point is stopping the wrangler PROCESS and
    // booting a fresh one on the SAME persist dir — that dir carries the
    // DO's SQLite state across the restart.
    const persistDir = makePersistDir();
    const server1 = await startServer({ persistDir });

    // ---- Phase 1: play half a game, then kill the server. ----
    const config: GNConfig = { rangeMax: 1000, suddenDeath: true };
    const code = await createRoom(server1, config);

    const { client: a1 } = await connectAndWelcome(server1, code, { label: 'a1' });
    const seatA = await claimSeat(a1, 'alice');
    const { client: b1 } = await connectAndWelcome(server1, code, { label: 'b1' });
    const seatB = await claimSeat(b1, 'bob');
    a1.start(); // 2-seat game: minSeats 2, both claimed
    const started = await a1.waitFor((m) => m.type === 'started');
    const startedSeq = started.seq;
    await awaitInitialView(a1, startedSeq);

    // Guaranteed-WRONG guesses so the half-game can't accidentally end: the
    // dump route (PLAN §6 debug affordance, dev-gated) tells us the secret.
    const dump = await getDump(server1, code);
    const secret = dump.snapshot.state?.secret as number;
    expect(typeof secret).toBe('number');
    const wrongGuess = secret === 1 ? 2 : 1;

    let seq = startedSeq;
    for (const seat of [seatA.seat, seatB.seat, seatA.seat]) {
      const client = seat === seatA.seat ? a1 : b1;
      const mark = client.mark();
      client.action(seat, { type: 'guess', value: wrongGuess }, { expectedSeq: seq });
      const ev = await client.waitFor<EventMsg>(
        (m) => m.type === 'event' && m.seat === seat && m.seq > seq,
        { from: mark },
      );
      seq = ev.seq;
    }
    const preKillSeq = seq;

    // Every applied seq fans out to BOTH seats on their own sockets; await
    // all of them so the captured "what each client knew" is complete (the
    // loop above only awaited the SENDER's copy of each guess).
    for (let s = startedSeq; s <= preKillSeq; s++) {
      await Promise.all([awaitEventCopy(a1, seatA.seat, s), awaitEventCopy(b1, seatB.seat, s)]);
    }

    // Capture what each client knew at kill time.
    const lastEventFor = (client: WsClient, seat: number): EventMsg => {
      const events = client.log.filter((m): m is EventMsg => m.type === 'event' && m.seat === seat);
      const last = events[events.length - 1];
      if (!last) throw new Error(`no events for seat ${seat}`);
      return last;
    };
    const preKillViewA = lastEventFor(a1, seatA.seat).view as GNView;
    const preKillViewB = lastEventFor(b1, seatB.seat).view as GNView;
    expect(preKillViewA.guesses).toHaveLength(3);
    // Per-seq redacted event payloads as seen LIVE by seat 0 — the resync
    // delta after restart must reproduce these bit-for-bit.
    const liveEventsBySeq = new Map<number, unknown>(
      a1.log
        .filter((m): m is EventMsg => m.type === 'event' && m.seat === seatA.seat)
        .map((m) => [m.seq, m.event]),
    );

    a1.close();
    b1.close();
    await server1.stop(); // kill the whole wrangler/workerd tree

    // ---- Phase 2: new process, same persist dir → resume. ----
    const server2 = await startServer({ persistDir });

    // Client A reconnects claiming it last saw the START (a real gap →
    // exercises the delta path); client B reconnects fully caught-up.
    const { client: a2, welcome: welcomeA } = await connectAndWelcome(server2, code, {
      tokens: [seatA.token],
      lastSeenSeq: startedSeq,
      label: 'a2',
    });
    const { client: b2, welcome: welcomeB } = await connectAndWelcome(server2, code, {
      tokens: [seatB.token],
      lastSeenSeq: preKillSeq,
      label: 'b2',
    });
    try {
      // The DO state survived the process death: same room, still playing,
      // seq did not rewind, and both tokens still resolve to their seats.
      expect(welcomeA.room.status).toBe('playing');
      expect(welcomeA.seats).toEqual([seatA.seat]);
      expect(welcomeB.seats).toEqual([seatB.seat]);
      expect(welcomeA.seq).toBeGreaterThanOrEqual(preKillSeq);

      const resyncA = await a2.waitFor<ResyncMsg>((m) => m.type === 'resync' && m.seat === seatA.seat);
      const resyncB = await b2.waitFor<ResyncMsg>((m) => m.type === 'resync' && m.seat === seatB.seat);
      const resumedView = resyncA.view as GNView;

      // The pre-kill history is a prefix of the resumed state's history —
      // exact equality when nothing moved while we were away. (welcome.seq
      // can exceed preKillSeq only if the turn-timeout alarm auto-played
      // during the restart window; the prefix checks keep the test
      // deterministic either way, and the strict branch is the normal one.)
      expect(resumedView.guesses.slice(0, preKillViewA.guesses.length)).toEqual(preKillViewA.guesses);
      if (welcomeA.seq === preKillSeq) {
        expect(resumedView).toEqual(preKillViewA);
        expect(resyncB.view).toEqual(preKillViewB);
        // B was fully caught up → snapshot-only resync, no delta.
        expect(resyncB.events).toBeUndefined();
      }

      // A's gap is covered by the retained log → delta present, contiguous,
      // and identical (for the pre-kill span) to what was delivered live.
      expect(resyncA.events).toBeDefined();
      const deltaSeqs = resyncA.events!.map((e) => e.seq);
      const expectedSeqs = [];
      for (let s = startedSeq + 1; s <= welcomeA.seq; s++) expectedSeqs.push(s);
      expect(deltaSeqs).toEqual(expectedSeqs);
      for (const entry of resyncA.events!) {
        if (entry.seq <= preKillSeq) {
          expect(entry.event).toEqual(liveEventsBySeq.get(entry.seq));
        }
      }

      // ---- Phase 3: FINISH the game on the resumed server. ----
      const holders: SeatHolder[] = [
        { client: a2, seats: [seatA.seat] },
        { client: b2, seats: [seatB.seat] },
      ];
      const { view: finalView } = await driveToMatchEnd(holders, {
        view: resumedView,
        seq: resyncA.seq,
      });
      expect(finalView.phase).toBe('matchEnd');
      expect(finalView.winner).not.toBeNull();
      const info = await getRoomInfo(server2, code);
      expect(info.status).toBe('finished');
    } finally {
      closeAll([a2, b2]);
      await server2.stop();
    }
  });

  test('seat token authority', async () => {
    const code = await createRoom(server, null);
    const opened: WsClient[] = [];
    try {
      // Socket A holds seats 0 AND 1; B and C hold 2 and 3.
      const { client: a } = await connectAndWelcome(server, code, { label: 'a' });
      opened.push(a);
      const s0 = await claimSeat(a, 'ada-zero');
      const s1 = await claimSeat(a, 'ada-one');
      const { client: b } = await connectAndWelcome(server, code, { label: 'b' });
      opened.push(b);
      const s2 = await claimSeat(b, 'bea');
      const { client: c } = await connectAndWelcome(server, code, { label: 'c' });
      opened.push(c);
      await claimSeat(c, 'cal');

      a.setConfig(VALID_CONFIG);
      await a.waitFor((m) => m.type === 'configChanged');
      a.start();
      const started = await a.waitFor((m) => m.type === 'started');
      const start = await awaitInitialView(a, started.seq);

      // (1) No token for seat 2 on socket A → the action is rejected with
      // the semantic seat-authority error, regardless of game legality.
      const mark1 = a.mark();
      const badId = a.action(s2.seat, { type: 'guess', value: 50 }, { expectedSeq: start.seq });
      const rej = await a.waitFor<RejectedMsg>(
        (m) => m.type === 'rejected' && m.actionId === badId,
        { from: mark1 },
      );
      expect(rej.error.code).toBe('seat.notHeld');

      // (1b) Codex M2 audit: the 'timeout:' actionId namespace is reserved
      // for alarm-applied default actions — a forged id there could swallow
      // a future genuine timeout. Must be rejected even for a held seat.
      const mark1b = a.mark();
      const forged = a.action(s1.seat, { type: 'guess', value: 50 }, {
        expectedSeq: start.seq,
        actionId: `timeout:${s1.seat}:${start.seq + 1}`,
      });
      const rejForged = await a.waitFor<RejectedMsg>(
        (m) => m.type === 'rejected' && m.actionId === forged,
        { from: mark1b },
      );
      expect(rejForged.error.code).toBe('action.reservedActionId');

      // (2) TAKEOVER: a new socket presenting seat 0's token takes over
      // seat-0 delivery; A keeps only its other seat (1).
      const { client: taker, welcome } = await connectAndWelcome(server, code, {
        tokens: [s0.token],
        label: 'taker',
      });
      opened.push(taker);
      expect(welcome.seats).toEqual([s0.seat]);
      const takerResync = await taker.waitFor<ResyncMsg>(
        (m) => m.type === 'resync' && m.seat === s0.seat,
      );

      // Seat 0 opens the round, so the taker can act immediately.
      const takerView = takerResync.view as GNView;
      expect(takerView.toAct).toBe(s0.seat);
      const aMark = a.mark();
      const bMark = b.mark();
      taker.action(s0.seat, { type: 'guess', value: nextGuess(takerView) }, { expectedSeq: takerResync.seq });
      const applied = await taker.waitFor<EventMsg>(
        (m) => m.type === 'event' && m.seat === s0.seat && m.seq > takerResync.seq,
      );

      // Fan-out proof: wait until B (uninvolved) has this seq, then check
      // the old socket's deliveries for the same seq.
      await b.waitFor((m) => m.type === 'event' && m.seq === applied.seq, { from: bMark });
      const aCopies = a.log
        .slice(aMark)
        .filter((m): m is EventMsg => m.type === 'event' && m.seq === applied.seq);
      // Old socket still gets its OTHER seat's copy — and ONLY that one.
      expect(aCopies.map((m) => m.seat)).toEqual([s1.seat]);
      expect(
        a.log.slice(aMark).some((m) => m.type === 'event' && m.seat === s0.seat),
      ).toBe(false);

      // And authority moved with delivery: A acting as seat 0 is now rejected.
      const mark2 = a.mark();
      const staleId = a.action(s0.seat, { type: 'guess', value: 50 }, { expectedSeq: applied.seq });
      const rej2 = await a.waitFor<RejectedMsg>(
        (m) => m.type === 'rejected' && m.actionId === staleId,
        { from: mark2 },
      );
      expect(rej2.error.code).toBe('seat.notHeld');
    } finally {
      closeAll(opened);
    }
  });
});
