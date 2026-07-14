// Unit tests for the pure GameRoom helpers (src/server/room-helpers.ts) —
// hashing, room-code generation, deadline math (the PLAN §4 rule verbatim),
// redaction fan-out, and the resync gap check. No DO runtime needed.

import { describe, expect, it } from 'vitest';
import type { Seat } from '../../../src/engine/core/game';
import type { AnyGameDefinition } from '../../../src/shared/games';
import { ROOM_CODE_RE } from '../../../src/shared/protocol';
import {
  ACTION_TIMEOUT_MAX_MS,
  ACTION_TIMEOUT_MIN_MS,
  DISCONNECT_GRACE_MS,
  bytesToHex,
  computeDeadlines,
  deltaCoversGap,
  redactEventsFor,
  roomCodeFromBytes,
  sha256Hex,
  timeoutActionId,
} from '../../../src/server/room-helpers';

describe('bytesToHex', () => {
  it('renders each byte as two lowercase hex chars', () => {
    expect(bytesToHex(new Uint8Array([0, 1, 15, 16, 255]))).toBe('00010f10ff');
  });

  it('renders the empty array as the empty string', () => {
    expect(bytesToHex(new Uint8Array([]))).toBe('');
  });

  it('produces a 64-char string for 32 bytes (the seat-token shape)', () => {
    expect(bytesToHex(new Uint8Array(32).fill(0xab))).toHaveLength(64);
  });
});

describe('sha256Hex', () => {
  it('matches the FIPS-180 known vector for "abc"', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('matches the known vector for the empty string', async () => {
    expect(await sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('is deterministic and collision-distinct for distinct tokens', async () => {
    const a1 = await sha256Hex('token-a');
    const a2 = await sha256Hex('token-a');
    const b = await sha256Hex('token-b');
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
  });
});

describe('roomCodeFromBytes', () => {
  it('maps 6 bytes to a 6-char code matching the wire regex', () => {
    const code = roomCodeFromBytes(new Uint8Array([0, 31, 32, 64, 255, 128]));
    expect(code).toHaveLength(6);
    expect(code).toMatch(ROOM_CODE_RE);
  });

  it('is deterministic in the byte values (mod 32)', () => {
    // byte % 32 indexes the alphabet, so 0, 32, 64 all map to 'A'.
    expect(roomCodeFromBytes(new Uint8Array([0, 32, 64, 96, 128, 160]))).toBe('AAAAAA');
    expect(roomCodeFromBytes(new Uint8Array([31, 63, 95, 127, 159, 191]))).toBe('999999');
  });

  it('never emits an ambiguous character (0/O/1/I) for any byte value', () => {
    const allBytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) allBytes[i] = i;
    const chars = roomCodeFromBytes(allBytes);
    expect(chars).not.toMatch(/[0O1I]/);
  });
});

describe('computeDeadlines (PLAN §4 deadline rule)', () => {
  const NOW = 1_000_000;
  const connected = (...seats: Seat[]): ReadonlySet<Seat> => new Set(seats);

  it('gives each connected expected actor now + timeout', () => {
    expect(computeDeadlines([0, 2], 30_000, connected(0, 2), NOW)).toEqual([
      { seat: 0, dueAt: NOW + 30_000 },
      { seat: 2, dueAt: NOW + 30_000 },
    ]);
  });

  it('clamps the timeout to the 5s floor', () => {
    expect(computeDeadlines([1], 1_000, connected(1), NOW)).toEqual([
      { seat: 1, dueAt: NOW + ACTION_TIMEOUT_MIN_MS },
    ]);
  });

  it('clamps the timeout to the 120s ceiling', () => {
    expect(computeDeadlines([1], 600_000, connected(1), NOW)).toEqual([
      { seat: 1, dueAt: NOW + ACTION_TIMEOUT_MAX_MS },
    ]);
  });

  it('caps a DISCONNECTED actor at now + 60s even with a longer timeout', () => {
    expect(computeDeadlines([3], 90_000, connected(), NOW)).toEqual([
      { seat: 3, dueAt: NOW + DISCONNECT_GRACE_MS },
    ]);
  });

  it('keeps the shorter game timeout for a disconnected actor when it beats the grace', () => {
    expect(computeDeadlines([3], 15_000, connected(), NOW)).toEqual([
      { seat: 3, dueAt: NOW + 15_000 },
    ]);
  });

  it('null timeout: NO deadline for a connected actor (untimed phase)', () => {
    expect(computeDeadlines([0], null, connected(0), NOW)).toEqual([]);
  });

  it('null timeout: a DISCONNECTED actor STILL gets now + 60s (deadlock freedom)', () => {
    expect(computeDeadlines([0], null, connected(), NOW)).toEqual([
      { seat: 0, dueAt: NOW + DISCONNECT_GRACE_MS },
    ]);
  });

  it('mixes connected and disconnected actors independently', () => {
    expect(computeDeadlines([0, 1], 90_000, connected(0), NOW)).toEqual([
      { seat: 0, dueAt: NOW + 90_000 },
      { seat: 1, dueAt: NOW + DISCONNECT_GRACE_MS },
    ]);
  });

  it('returns nothing when there are no expected actors (terminal state)', () => {
    expect(computeDeadlines([], 30_000, connected(0, 1), NOW)).toEqual([]);
  });
});

describe('timeoutActionId', () => {
  it('is deterministic in (seat, seq) so alarm retries dedup via actions_seen', () => {
    expect(timeoutActionId(2, 17)).toBe('timeout:2:17');
    expect(timeoutActionId(2, 17)).toBe(timeoutActionId(2, 17));
    expect(timeoutActionId(2, 18)).not.toBe(timeoutActionId(2, 17));
  });
});

describe('redactEventsFor', () => {
  // A stub game whose viewEvent hides events not addressed to the seat and
  // strips a 'secret' field from public ones — enough to prove the fan-out
  // applies viewEvent per event, threads config, and drops nulls.
  const stubGame = {
    viewEvent(event: unknown, seat: Seat, config: unknown): unknown {
      const e = event as { to?: number; kind: string; secret?: string };
      if (e.to !== undefined && e.to !== seat) return null; // hidden entirely
      const redactSecrets = (config as { redactSecrets?: boolean })?.redactSecrets === true;
      if (redactSecrets && e.secret !== undefined) {
        const { secret: _secret, ...rest } = e;
        return rest;
      }
      return e;
    },
  } as unknown as AnyGameDefinition;

  const events = [
    { kind: 'public' },
    { kind: 'private', to: 0, secret: 's0' },
    { kind: 'private', to: 1, secret: 's1' },
  ];

  it('keeps only events visible to the seat, in order, dropping nulls', () => {
    expect(redactEventsFor(stubGame, events, 0, {})).toEqual([
      { kind: 'public' },
      { kind: 'private', to: 0, secret: 's0' },
    ]);
    expect(redactEventsFor(stubGame, events, 1, {})).toEqual([
      { kind: 'public' },
      { kind: 'private', to: 1, secret: 's1' },
    ]);
  });

  it('threads the (opaque) config through to viewEvent', () => {
    expect(redactEventsFor(stubGame, events, 0, { redactSecrets: true })).toEqual([
      { kind: 'public' },
      { kind: 'private', to: 0 },
    ]);
  });

  it('returns an empty array when every event is hidden', () => {
    expect(redactEventsFor(stubGame, [{ kind: 'x', to: 3 }], 0, {})).toEqual([]);
  });
});

describe('deltaCoversGap (resync delta vs snapshot-only)', () => {
  it('true when the retained rows exactly cover lastSeenSeq+1..seq', () => {
    expect(deltaCoversGap(3, 6, [4, 5, 6])).toBe(true);
  });

  it('false when the client is already caught up (lastSeenSeq === seq)', () => {
    expect(deltaCoversGap(6, 6, [])).toBe(false);
  });

  it('false when the client claims to be ahead of the room', () => {
    expect(deltaCoversGap(9, 6, [])).toBe(false);
  });

  it('false when the log has a leading gap (lobby seqs wrote no events rows)', () => {
    // Room started at seq 3 → events rows begin at 3; a client whose
    // lastSeenSeq is 1 (lobby-era) cannot get a delta.
    expect(deltaCoversGap(1, 4, [3, 4])).toBe(false);
  });

  it('false when a row is missing mid-range (trimmed log)', () => {
    expect(deltaCoversGap(3, 6, [4, 6])).toBe(false);
  });

  it('false when there are extra unexpected rows', () => {
    expect(deltaCoversGap(3, 6, [4, 5, 6, 7])).toBe(false);
  });

  it('handles the single-event gap', () => {
    expect(deltaCoversGap(5, 6, [6])).toBe(true);
  });
});
