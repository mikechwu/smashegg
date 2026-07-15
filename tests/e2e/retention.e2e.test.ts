// Q3 pause + retention TTL e2e (pause-and-retention.md §7): the DO INTEGRATION
// seam the unit/property tests can't reach — the pause stamp actually lands over
// the wire (the stamp≡pause ORDERING that stamp==pause silently relies on), a
// paused room does NOT auto-play, resume clears the stamp and the game continues,
// an abandoned lobby self-purges (a real deleteAll), and — the only test that
// catches a mis-bound seat/socket count — a SEATLESS live socket is never purged.
// Wire + dump only, like every e2e file; the tiny retention window is injected
// via --var RETENTION_TEST_WINDOW_MS so a purge is observable in-test not in 48h.

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { RoomTiming } from '../../src/shared/timing';
import {
  claimSeat,
  connectAndWelcome,
  createRoom,
  createRoomFor,
  getDump,
  startServer,
  stopAllServers,
  type DevServer,
  type WelcomeMsg,
} from './helpers';

const TINY_WINDOW_MS = 1_500;
/** Both classes short (still ≥ the 5s clamp floor) so "no auto-play while paused"
 *  is observable in seconds — without Q3 the actor's deadline auto-plays at ~5s. */
const SHORT_TURN: RoomTiming = { perTurnMs: 5_000, planningMs: 5_000 };
const GN_CONFIG = { rangeMax: 100, suddenDeath: false };

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function roomInfoStatus(server: DevServer, code: string): Promise<number> {
  return (await fetch(`${server.url}/api/rooms/${code}`)).status;
}

describe('Q3 pause + retention TTL (e2e)', () => {
  let server: DevServer;
  beforeAll(async () => {
    server = await startServer({ retentionWindowMs: TINY_WINDOW_MS });
  });
  afterAll(async () => {
    await stopAllServers();
  });

  test('stamp≡pause + no auto-play while paused + resume clears it and the game continues', async () => {
    const code = await createRoomFor(server, 'guess-number', GN_CONFIG, SHORT_TURN);
    // One hot-seat socket drives all four seats, so closing it empties the room.
    const { client } = await connectAndWelcome(server, code, { label: 'solo' });
    const tokens: string[] = [];
    for (let i = 0; i < 4; i++) tokens.push((await claimSeat(client, `p${i}`)).token);
    client.start();
    await sleep(400);

    const beforeDrop = await getDump(server, code);
    expect(beforeDrop.room.status, 'playing after start').toBe('playing');
    expect(beforeDrop.room.pauseStartedAt, 'not paused while connected').toBeNull();
    const seqAtPause = beforeDrop.snapshot.seq;

    // Drop the only socket → the room empties → PAUSE. The stamp must be set
    // by the time the disconnect is processed (stamp≡pause ordering — the very
    // property the accessor-refactor made depend on statement order).
    client.close();
    await sleep(400);
    const paused = await getDump(server, code);
    expect(
      paused.room.pauseStartedAt,
      'stamp≡pause: pause_started_at set the moment the room emptied',
    ).not.toBeNull();

    // Wait PAST the 5s per-turn: a paused room arms no alarm, so it must NOT
    // auto-play (without Q3 the deadline would have fired at ~5s and bumped seq).
    await sleep(6_000);
    const stillPaused = await getDump(server, code);
    expect(
      stillPaused.snapshot.seq,
      'no auto-play while paused (seq unchanged past the turn deadline)',
    ).toBe(seqAtPause);
    expect(stillPaused.room.pauseStartedAt, 'still paused').not.toBeNull();

    // Reconnect → resume: the stamp clears and the game is playable again.
    const { client: back, welcome } = await connectAndWelcome(server, code, {
      label: 'back',
      tokens,
    });
    expect((welcome as WelcomeMsg).seats.length, 'reconnected to the held seats').toBeGreaterThan(0);
    await sleep(300);
    const resumed = await getDump(server, code);
    expect(resumed.room.pauseStartedAt, 'resume cleared the pause origin').toBeNull();
    expect(resumed.room.status, 'still the same playing match').toBe('playing');
    back.close();
  }, 25_000);

  test('an abandoned lobby self-purges after the retention window (real deleteAll → 404)', async () => {
    const code = await createRoom(server, GN_CONFIG);
    expect(await roomInfoStatus(server, code), 'exists right after creation').toBe(200);
    // Nobody joins; the lobby TTL armed at creation fires after the tiny window.
    await sleep(TINY_WINDOW_MS + 2_000);
    expect(await roomInfoStatus(server, code), 'self-purged: GET /info is 404').toBe(404);
  }, 15_000);

  test('T3: a SEATLESS live socket keeps a lobby alive past the window (never purged)', async () => {
    // The ONLY test that catches a mis-bound seat/socket count: this client
    // connects but never claims a seat → 0 connected SEATS, 1 live SOCKET. A
    // purge keyed on seats (the bug) would deleteAll() it; keyed on sockets it
    // survives.
    const code = await createRoom(server, GN_CONFIG);
    const { client } = await connectAndWelcome(server, code, { label: 'lurker', tokens: [] });
    await sleep(TINY_WINDOW_MS + 2_000); // well past the window
    expect(
      await roomInfoStatus(server, code),
      'NOT purged: a live socket keeps an occupied lobby (T3)',
    ).toBe(200);
    client.close();
  }, 15_000);
});
