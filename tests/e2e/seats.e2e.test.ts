// Item 1 (design-refinement round) e2e: seat release / rename / choose-seat
// over the real wire. THE LOAD-BEARING PINS ARE THE REDACTION ONES: releasing
// a seat INVALIDATES its token — the stale token is granted nothing at hello,
// can act on nothing, and its socket receives NOTHING for that seat once the
// game runs, while the fresh claimant receives everything. Uses guess-number
// (the release machinery is game-agnostic; GN is the cheap 4-seat game).

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import {
  awaitInitialView,
  claimSeat,
  connectAndWelcome,
  createRoom,
  nextGuess,
  startServer,
  stopAllServers,
  WsClient,
  type DevServer,
  type EventMsg,
  type RejectedMsg,
} from './helpers';

/** Valid GN config for the tests that START a game (a null config is fine
 *  for lobby-only flows but start would fail room.startFailed). */
const GN_CONFIG = { rangeMax: 100, suddenDeath: true };

let server: DevServer;
const clients: WsClient[] = [];

function track<T extends WsClient>(c: T): T {
  clients.push(c);
  return c;
}

beforeAll(async () => {
  server = await startServer();
}, 120_000);

afterAll(async () => {
  for (const c of clients) c.close();
  await stopAllServers();
});

describe('seat release / rename / choose-your-seat (item 1)', () => {
  test(
    'release invalidates the token: fresh mint for the next claimant; stale token gets nothing and starves',
    { timeout: 60_000 },
    async () => {
      const code = await createRoom(server, GN_CONFIG);

      // A claims seat 0 and then releases it.
      const { client: a } = await connectAndWelcome(server, code, { label: 'A' });
      track(a);
      const first = await claimSeat(a, 'ana');
      expect(first.seat).toBe(0);
      const markA = a.mark();
      a.releaseSeat(0);
      await a.waitFor((m) => m.type === 'seatReleased' && m.seat === 0, { from: markA });
      const roster = await a.waitFor<Extract<import('../../src/shared/protocol').ServerMessage, { type: 'roomChanged' }>>(
        (m) => m.type === 'roomChanged' && m.room.seats[0]?.claimed === false,
        { from: markA },
      );
      expect(roster.room.seats[0]).toMatchObject({ claimed: false });

      // B claims the SAME seat explicitly — a fresh token, never the old one.
      const { client: b } = await connectAndWelcome(server, code, { label: 'B' });
      track(b);
      const re = await claimSeat(b, 'ben', 0);
      expect(re.seat).toBe(0);
      expect(re.token).not.toBe(first.token);

      // A fresh connection presenting the STALE token is granted no seat…
      const { client: a2, welcome: w2 } = await connectAndWelcome(server, code, {
        tokens: [first.token],
        label: 'A-stale',
      });
      track(a2);
      expect(w2.seats).toEqual([]);

      // …and cannot act as the seat.
      const markA2 = a2.mark();
      const actionId = a2.action(0, { type: 'guess', value: 1 });
      const rej = await a2.waitFor<RejectedMsg>(
        (m) => m.type === 'rejected' && m.actionId === actionId,
        { from: markA2 },
      );
      expect(rej.error.code).toBe('seat.notHeld');

      // Fill the room from B (multi-seat self-play), start, play one action:
      // the fresh claimant receives seat 0's view; the stale sockets receive
      // ZERO per-seat messages for seat 0 — the starvation pin.
      await claimSeat(b, 'ben', 1);
      await claimSeat(b, 'ben', 2);
      await claimSeat(b, 'ben', 3);
      const aEventsBefore = a.log.filter(
        (m) => (m.type === 'event' || m.type === 'resync') && m.seat === 0,
      ).length;
      const markB = b.mark();
      b.start();
      const started = await b.waitFor((m) => m.type === 'started', { from: markB });
      const { view, seq } = await awaitInitialView(b, started.seq);
      const guess = { type: 'guess', value: nextGuess(view) };
      const markB2 = b.mark();
      b.action(view.toAct, guess, { expectedSeq: seq });
      const reply = await b.waitFor<EventMsg>(
        (m) => m.type === 'event' && m.seat === 0 && m.seq > seq,
        { from: markB2 },
      );
      expect(reply.view).toBeDefined(); // fresh claimant IS receiving seat 0

      // Stale sockets: no event/resync for seat 0, ever (a and a2 both).
      for (const stale of [a, a2]) {
        const copies = stale.log.filter(
          (m) => (m.type === 'event' || m.type === 'resync') && m.seat === 0,
        );
        expect(copies.length, `${stale.label} must be starved of seat 0`).toBe(
          stale === a ? aEventsBefore : 0,
        );
      }
    },
  );

  test('the race: claiming an occupied or invalid seat rejects with a precise code', { timeout: 30_000 }, async () => {
    const code = await createRoom(server, null);
    const { client: a } = await connectAndWelcome(server, code, { label: 'A' });
    track(a);
    await claimSeat(a, 'ana', 1);

    const { client: b } = await connectAndWelcome(server, code, { label: 'B' });
    track(b);
    const markB = b.mark();
    b.claimSeat('bob', 1); // just taken
    const taken = await b.waitFor<RejectedMsg>((m) => m.type === 'rejected', { from: markB });
    expect(taken.error.code).toBe('seat.taken');

    const markB2 = b.mark();
    b.claimSeat('bob', 9); // out of range
    const malformed = await b.waitFor<RejectedMsg>((m) => m.type === 'rejected', { from: markB2 });
    expect(malformed.error.code).toBe('protocol.malformed');
  });

  test('multi-seat holder releases ONE seat and keeps the others', { timeout: 30_000 }, async () => {
    const code = await createRoom(server, null);
    const { client: c } = await connectAndWelcome(server, code, { label: 'C' });
    track(c);
    const s0 = await claimSeat(c, 'solo', 0);
    const s1 = await claimSeat(c, 'solo', 1);
    const markC = c.mark();
    c.releaseSeat(0);
    await c.waitFor((m) => m.type === 'seatReleased' && m.seat === 0, { from: markC });

    // The kept seat still works (rename applies)…
    const markC2 = c.mark();
    c.renameSeat(1, 'solo-two');
    await c.waitFor(
      (m) => m.type === 'roomChanged' && m.room.seats[1]?.name === 'solo-two',
      { from: markC2 },
    );
    // …the released seat does not.
    const markC3 = c.mark();
    c.renameSeat(0, 'ghost');
    const rej = await c.waitFor<RejectedMsg>((m) => m.type === 'rejected', { from: markC3 });
    expect(rej.error.code).toBe('seat.notHeld');

    // Reconnect presenting BOTH tokens: only the kept seat resolves.
    const { welcome } = await connectAndWelcome(server, code, {
      tokens: [s0.token, s1.token],
      label: 'C-reconnect',
    }).then((r) => (track(r.client), r));
    expect(welcome.seats).toEqual([1]);
  });

  test('rename works anytime (incl. in-game); release is lobby-only', { timeout: 60_000 }, async () => {
    const code = await createRoom(server, GN_CONFIG);
    const { client: d } = await connectAndWelcome(server, code, { label: 'D' });
    track(d);
    for (let s = 0; s < 4; s++) await claimSeat(d, `p${s}`, s);

    // Lobby rename.
    const mark1 = d.mark();
    d.renameSeat(2, 'renamed-lobby');
    await d.waitFor((m) => m.type === 'roomChanged' && m.room.seats[2]?.name === 'renamed-lobby', {
      from: mark1,
    });

    const mark2 = d.mark();
    d.start();
    await d.waitFor((m) => m.type === 'started', { from: mark2 });

    // In-game rename still applies (names are cosmetic; engine never sees them).
    const mark3 = d.mark();
    d.renameSeat(2, 'renamed-ingame');
    await d.waitFor((m) => m.type === 'roomChanged' && m.room.seats[2]?.name === 'renamed-ingame', {
      from: mark3,
    });

    // In-game release is refused: mid-match a seat owns a dealt hand.
    const mark4 = d.mark();
    d.releaseSeat(2);
    const rej = await d.waitFor<RejectedMsg>((m) => m.type === 'rejected', { from: mark4 });
    expect(rej.error.code).toBe('room.notLobby');
  });
});
