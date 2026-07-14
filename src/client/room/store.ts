// Framework-free client room store (M3, PLAN.md §4 seat-token authority +
// §5 reconnection flow). A single immutable snapshot reduced from
// ServerMessages, exposed through subscribe/getSnapshot so React consumes
// it via useSyncExternalStore — but nothing in this file imports React, so
// the reducer is unit-testable with plain recorded message fixtures.
//
// Persistence (PLAN §5 flow step 1): {tokens by seat, lastSeenSeq} go to
// localStorage under 'room:CODE', so seat authority and the resync cursor
// survive a full tab reload, not just a socket drop.

import type { Seat } from '../../engine/core/game';
import type { RoomInfo, ServerMessage, WireError } from '../../shared/protocol';

/** The credential minted by our own seatClaimed copy (PLAN §4): holding it
 *  IS the authority over that seat. Never logged, persisted only to this
 *  browser's localStorage. */
export interface SeatCredential {
  token: string;
}

/** Per-held-seat game data, straight from the seat's latest 'event'/'resync'
 *  copy. `view` is authoritative (view-carrying events, PLAN §5); the event
 *  batch only drives animation/log and is null after a resync jump. */
export interface PerSeatGame {
  view: unknown;
  /** The seat's server-provided legal actions — non-null iff the seat was an
   *  expected actor in its latest message (PLAN §5 hints). */
  hints: unknown[] | null;
  lastEventBatch: unknown[] | null;
}

export interface Rejection {
  seq: number;
  actionId?: string;
  error: WireError;
}

export interface RoomSnapshot {
  room: RoomInfo | null;
  /** Seats this client holds tokens for (multi-seat self-play, PLAN §4). */
  seats: ReadonlyMap<Seat, SeatCredential>;
  perSeat: ReadonlyMap<Seat, PerSeatGame>;
  /** Highest room seq seen — the resync cursor sent as hello.lastSeenSeq. */
  seq: number;
  /** Socket-level connectivity (set by RoomConnection, not by messages). */
  connected: boolean;
  /** Most recent rejections, oldest first, bounded. */
  rejections: readonly Rejection[];
}

/** What the store needs from the transport. RoomConnection implements this;
 *  tests substitute a recorder. Kept minimal so the store never touches a
 *  socket (or actionIds — the connection owns idempotency, PLAN §5). */
export interface RoomSender {
  claimSeat(name: string): void;
  setConfig(config: unknown): void;
  start(): void;
  act(seat: Seat, action: unknown): void;
}

/** The localStorage subset we use — injectable so node-environment unit
 *  tests (and localStorage-less browsers) never touch the real thing. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface PersistedRoom {
  /** seat (as a JSON object key, so string) → raw token. */
  tokens: Record<string, string>;
  lastSeenSeq: number;
}

const MAX_REJECTIONS = 20;

function defaultStorage(): StorageLike | null {
  // Same guard idiom as src/client/i18n: private-mode/older environments may
  // throw on ANY localStorage access, and vitest's node environment has none.
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function storageKeyFor(code: string): string {
  return `room:${code}`;
}

export class RoomStore {
  private state: RoomSnapshot;
  private readonly listeners = new Set<() => void>();
  private sender: RoomSender | null = null;

  constructor(
    readonly code: string,
    private readonly storage: StorageLike | null = defaultStorage(),
  ) {
    const persisted = this.readPersisted();
    const seats = new Map<Seat, SeatCredential>();
    if (persisted) {
      for (const [seatKey, token] of Object.entries(persisted.tokens)) {
        const seat = Number(seatKey);
        if (Number.isInteger(seat) && seat >= 0 && typeof token === 'string') {
          seats.set(seat, { token });
        }
      }
    }
    this.state = {
      room: null,
      seats,
      perSeat: new Map(),
      // Resuming from the persisted cursor lets the very first hello after a
      // tab reload request the missed-events delta (PLAN §5 steps 1-3).
      seq: persisted?.lastSeenSeq ?? 0,
      connected: false,
      rejections: [],
    };
  }

  // --- useSyncExternalStore surface (stable-bound: class fields) ----------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): RoomSnapshot => this.state;

  // --- transport-facing accessors ------------------------------------------

  /** Tokens to present in hello, in seat order (PLAN §4 multi-seat). */
  heldTokens(): string[] {
    return [...this.state.seats.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, cred]) => cred.token);
  }

  get lastSeenSeq(): number {
    return this.state.seq;
  }

  bindSender(sender: RoomSender): void {
    this.sender = sender;
  }

  /** Socket connectivity — driven by RoomConnection open/close, because no
   *  ServerMessage carries "you are disconnected". */
  setConnected(connected: boolean): void {
    if (this.state.connected === connected) return;
    this.commit({ ...this.state, connected });
  }

  // --- actions (thin delegates; the connection owns wire concerns) --------

  claim(name: string): void {
    this.sender?.claimSeat(name);
  }

  setConfig(config: unknown): void {
    this.sender?.setConfig(config);
  }

  start(): void {
    this.sender?.start();
  }

  act(seat: Seat, action: unknown): void {
    this.sender?.act(seat, action);
  }

  // --- reducer -------------------------------------------------------------

  dispatch(msg: ServerMessage): void {
    const prev = this.state;
    // Every ServerMessage carries the room seq at/after which it applies
    // (protocol.ts). Take the max so a late-delivered older message can
    // never move the resync cursor backwards.
    const seq = Math.max(prev.seq, msg.seq);

    switch (msg.type) {
      case 'welcome': {
        // welcome.seats is the server's word on which of our presented
        // tokens still resolve — prune credentials for seats it dropped
        // (e.g. the room was purged and recreated under the same code).
        const valid = new Set<Seat>(msg.seats);
        let seats = prev.seats;
        if ([...prev.seats.keys()].some((s) => !valid.has(s))) {
          seats = new Map([...prev.seats].filter(([s]) => valid.has(s)));
        }
        this.commit({ ...prev, room: msg.room, seats, seq });
        this.persist();
        return;
      }

      case 'roomChanged': {
        this.commit({ ...prev, room: msg.room, seq });
        this.persist();
        return;
      }

      case 'seatClaimed': {
        // Only OUR copy carries the minted token (PLAN §4); other clients'
        // claims still update the visible seat roster.
        let seats = prev.seats;
        if (msg.token !== undefined) {
          const next = new Map(prev.seats);
          next.set(msg.seat, { token: msg.token });
          seats = next;
        }
        this.commit({
          ...prev,
          seats,
          room: patchSeat(prev.room, msg.seat, { claimed: true, name: msg.name }),
          seq,
        });
        this.persist();
        return;
      }

      case 'configChanged': {
        this.commit({
          ...prev,
          room: prev.room === null ? null : { ...prev.room, config: msg.config },
          seq,
        });
        this.persist();
        return;
      }

      case 'started': {
        this.commit({
          ...prev,
          room: prev.room === null ? null : { ...prev.room, status: 'playing' },
          seq,
        });
        this.persist();
        return;
      }

      case 'event': {
        const perSeat = new Map(prev.perSeat);
        perSeat.set(msg.seat, {
          view: msg.view,
          hints: msg.hints ?? null,
          // The server sends the seq's redacted event ARRAY (see
          // game-room fan-out); normalize defensively so consumers can
          // always iterate.
          lastEventBatch: Array.isArray(msg.event) ? msg.event : [msg.event],
        });
        this.commit({ ...prev, perSeat, seq });
        this.persist();
        return;
      }

      case 'resync': {
        const perSeat = new Map(prev.perSeat);
        perSeat.set(msg.seat, {
          view: msg.view,
          hints: msg.hints ?? null,
          // A resync is a state JUMP: the view alone is authoritative
          // (PLAN §5 step 3), so no stale batch is left around to animate.
          lastEventBatch: null,
        });
        this.commit({ ...prev, perSeat, seq });
        this.persist();
        return;
      }

      case 'presence': {
        this.commit({
          ...prev,
          room: patchSeat(prev.room, msg.seat, { connected: msg.connected }),
          seq,
        });
        this.persist();
        return;
      }

      case 'rejected': {
        const rejection: Rejection = { seq: msg.seq, error: msg.error };
        if (msg.actionId !== undefined) rejection.actionId = msg.actionId;
        const rejections = [...prev.rejections, rejection].slice(-MAX_REJECTIONS);
        this.commit({ ...prev, rejections, seq });
        return;
      }
    }
  }

  // --- internals -----------------------------------------------------------

  private commit(next: RoomSnapshot): void {
    this.state = next;
    for (const listener of this.listeners) listener();
  }

  private readPersisted(): PersistedRoom | null {
    if (!this.storage) return null;
    try {
      const raw = this.storage.getItem(storageKeyFor(this.code));
      if (raw === null) return null;
      const parsed = JSON.parse(raw) as Partial<PersistedRoom>;
      return {
        tokens:
          typeof parsed.tokens === 'object' && parsed.tokens !== null ? parsed.tokens : {},
        lastSeenSeq:
          typeof parsed.lastSeenSeq === 'number' && Number.isInteger(parsed.lastSeenSeq)
            ? Math.max(0, parsed.lastSeenSeq)
            : 0,
      };
    } catch {
      // Corrupt/unavailable storage must never take the client down — worst
      // case is a fresh (snapshot-only) resync instead of a delta.
      return null;
    }
  }

  private persist(): void {
    if (!this.storage) return;
    const tokens: Record<string, string> = {};
    for (const [seat, cred] of this.state.seats) tokens[String(seat)] = cred.token;
    const value: PersistedRoom = { tokens, lastSeenSeq: this.state.seq };
    try {
      this.storage.setItem(storageKeyFor(this.code), JSON.stringify(value));
    } catch {
      // Quota/private-mode failure: in-memory state still works this session.
    }
  }
}

/** Immutable single-seat patch of RoomInfo.seats; identity-preserving when
 *  there is no room or no such seat (server roomChanged remains the
 *  authoritative roster — this just keeps the UI live between broadcasts). */
function patchSeat(
  room: RoomInfo | null,
  seat: Seat,
  patch: Partial<Pick<RoomInfo['seats'][number], 'claimed' | 'name' | 'connected'>>,
): RoomInfo | null {
  if (room === null) return null;
  if (!room.seats.some((s) => s.seat === seat)) return room;
  return {
    ...room,
    seats: room.seats.map((s) => (s.seat === seat ? { ...s, ...patch } : s)),
  };
}
