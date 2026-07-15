// Socket-liveness e2e (socket-liveness.md §5): the staleness sweep over the
// wire. The platform never closes a silent socket (measured: 30 min on
// production) and locked/frozen mobile pages stop pinging WITHOUT a close
// frame — so the DO reaps sockets whose ping-silence reaches the deadline and
// lets the ORDINARY disconnect machinery (presence → grace → Q3 pause → TTL)
// run from there. STALE_SOCKET_TEST_MS shrinks the 3-min deadline so a real
// reap is observable in seconds; the keep-alive control proves a pinging
// client is never reaped.

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
} from './helpers';

const TINY_STALE_MS = 1_500;
const TINY_WINDOW_MS = 1_500;
/** Short (≥ the 5s clamp floor) so "the reap paused the room BEFORE its turn
 *  deadline could auto-play an absent human" is observable in seconds. */
const SHORT_TURN: RoomTiming = { perTurnMs: 5_000, planningMs: 5_000 };
const GN_CONFIG = { rangeMax: 100, suddenDeath: false };

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function roomInfoStatus(server: DevServer, code: string): Promise<number> {
  return (await fetch(`${server.url}/api/rooms/${code}`)).status;
}

describe('socket liveness — staleness sweep (e2e)', () => {
  let server: DevServer;
  beforeAll(async () => {
    server = await startServer({ staleSocketMs: TINY_STALE_MS, retentionWindowMs: TINY_WINDOW_MS });
  });
  afterAll(async () => {
    await stopAllServers();
  });

  test('a silent playing client is reaped → the room PAUSES instead of auto-playing an absent human', async () => {
    // The M5 locked-phone scenario end-to-end: this client claims all seats,
    // starts the match, then goes silent (the e2e client never sends the bare
    // 'ping' keepalive — exactly a frozen tab). The sweep must close it and
    // the room must pause BEFORE the 5s turn deadline can auto-play.
    const code = await createRoomFor(server, 'guess-number', GN_CONFIG, SHORT_TURN);
    const { client } = await connectAndWelcome(server, code, { label: 'locked-phone' });
    for (let i = 0; i < 4; i++) await claimSeat(client, `p${i}`);
    client.start();
    await sleep(400);
    const started = await getDump(server, code);
    expect(started.room.status).toBe('playing');
    const seqAtStart = started.snapshot.seq;

    // The sweep alarm (accept + 1.5s) beats the turn deadline (start + 5s).
    await sleep(2_500);
    expect(client.closeInfo, 'the server closed the stale socket').not.toBeNull();
    expect(client.closeInfo!.code, 'app-range staleness close code').toBe(4002);
    const paused = await getDump(server, code);
    expect(
      paused.room.pauseStartedAt,
      'the reap emptied the room → Q3 pause stamped (no fresh machinery — the ordinary disconnect path)',
    ).not.toBeNull();

    // Past the 5s turn deadline: a paused room arms no seat alarm → no
    // auto-play burn against the absent human.
    await sleep(4_000);
    const after = await getDump(server, code);
    expect(after.snapshot.seq, 'seq frozen: nothing auto-played').toBe(seqAtStart);
  }, 20_000);

  test('a pinging client is NEVER reaped (the keep-alive control)', async () => {
    // Same tiny deadline, but this client sends the real keepalive — the bare
    // 'ping' the edge answers and timestamps. Sweep wakes fire (the sweep
    // candidate re-arms each time) and must find it fresh every time.
    const code = await createRoom(server, GN_CONFIG);
    const { client } = await connectAndWelcome(server, code, { label: 'alive', tokens: [] });
    await claimSeat(client, 'present');
    const pinger = setInterval(() => client.ping(), 400);
    try {
      await sleep(4 * TINY_STALE_MS); // several sweep cycles
      expect(client.closeInfo, 'never closed').toBeNull();
      const info = (await (await fetch(`${server.url}/api/rooms/${code}`)).json()) as {
        seats: { seat: number; connected: boolean }[];
      };
      expect(info.seats[0]!.connected, 'still connected after every sweep').toBe(true);
    } finally {
      clearInterval(pinger);
      client.close();
    }
  }, 20_000);

  test('a PHANTOM lobby socket cannot immortalize the room: reap → TTL → 404, no client close ever', async () => {
    // T3's known limitation, closed: a half-open (never-closing, never-pinging)
    // socket used to suppress the TTL forever with no future wake to reap it.
    // Now: the TTL wake is refused (T3, correct) but re-arms the SWEEP; the
    // sweep reaps the phantom; the seatless departure re-arms the TTL; the
    // room self-purges — all without the client ever sending a close frame.
    const code = await createRoom(server, GN_CONFIG);
    const { client } = await connectAndWelcome(server, code, { label: 'phantom', tokens: [] });

    let purged = false;
    for (let i = 0; i < 24 && !purged; i++) {
      await sleep(500);
      purged = (await roomInfoStatus(server, code)) === 404;
    }
    expect(purged, 'reap → seatless re-arm → TTL purge → 404').toBe(true);
    expect(client.closeInfo, 'the phantom was closed by the SERVER').not.toBeNull();
    expect(client.closeInfo!.code).toBe(4002);
  }, 25_000);
});
