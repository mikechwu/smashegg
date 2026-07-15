// RoomConnection — the client's reconnecting transport (M3, PLAN.md §1.5,
// §4, §5). Wraps partysocket's ReconnectingWebSocket (exponential backoff +
// jitter) against the plain DO endpoint ws(s)://…/api/rooms/CODE/ws and
// implements the client side of the wire protocol:
//
//  - hello{tokens, lastSeenSeq} on EVERY 'open' — reconnects therefore
//    auto-resync (PLAN §5 flow step 2) with no extra choreography;
//  - bare-'ping' keepalive every 25s — the literal string OUTSIDE the JSON
//    envelope, matched by the DO's auto-response while hibernated (PLAN §4);
//  - action envelopes gain a crypto.randomUUID actionId (exactly-once across
//    retries) and the store's current seq as the advisory expectedSeq;
//  - every inbound ServerMessage is dispatched to the store's reducer.
//
// We deliberately do NOT rely on partysocket's send-buffering for game
// actions (PLAN §1.5): actions are only ever submitted through this
// idempotent protocol, and a resubmission after resync is the client's
// explicit decision, not a transport replay.

import ReconnectingWebSocket from 'partysocket/ws';
import type { Seat } from '../../engine/core/game';
import type { ClientMessage, ServerMessage } from '../../shared/protocol';
import type { RoomTiming } from '../../shared/timing';
import type { RoomStore } from './store';

/** Under the DO's idle limits with margin; the runtime answers 'ping' with
 *  'pong' without waking the DO (PLAN §4 hibernation discipline). */
const PING_INTERVAL_MS = 25_000;

/** ws(s) URL for a room's socket, derived from the page origin so the same
 *  build works under wrangler dev and on *.workers.dev (PLAN §1.1). */
export function roomSocketUrl(code: string, base: string = window.location.origin): string {
  const url = new URL(`/api/rooms/${code}/ws`, base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

export class RoomConnection {
  private readonly ws: ReconnectingWebSocket;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;
  /** Resume revalidation (socket-liveness.md §3/§5): after an iOS lock or a
   *  background freeze the socket often LOOKS open (readyState lies) while the
   *  transport is long dead — an immediate ping forces the truth: either the
   *  edge pongs (genuinely alive) or the send trips the failure path and the
   *  reconnect+hello handshake runs NOW instead of at the next 25s tick. */
  private readonly onVisible = (): void => {
    if (document.visibilityState === 'visible' && this.ws.readyState === ReconnectingWebSocket.OPEN) {
      this.ws.send('ping');
    }
  };

  constructor(
    private readonly store: RoomStore,
    url: string = roomSocketUrl(store.code),
  ) {
    store.bindSender(this);
    this.ws = new ReconnectingWebSocket(url);

    this.ws.addEventListener('open', () => {
      // The (re)connect handshake: presenting our held tokens moves per-seat
      // delivery to this socket, and lastSeenSeq lets the DO answer with a
      // missed-events delta or a snapshot resync (PLAN §5 step 3).
      this.sendMsg({
        v: 1,
        type: 'hello',
        tokens: this.store.heldTokens(),
        lastSeenSeq: this.store.lastSeenSeq,
      });
      this.store.setConnected(true);
      this.startPing();
    });

    this.ws.addEventListener('close', () => {
      this.stopPing();
      this.store.setConnected(false);
    });

    document.addEventListener('visibilitychange', this.onVisible);

    this.ws.addEventListener('message', (ev: MessageEvent) => {
      if (typeof ev.data !== 'string') return; // protocol is text frames only
      if (ev.data === 'pong') return; // keepalive auto-response, not an envelope
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data) as ServerMessage;
      } catch {
        return; // a malformed frame must never take the client down
      }
      this.store.dispatch(msg);
    });
  }

  // --- RoomSender (the store's transport interface) ------------------------

  claimSeat(name: string): void {
    this.sendMsg({ v: 1, type: 'claimSeat', name });
  }

  setConfig(config: unknown): void {
    this.sendMsg({ v: 1, type: 'setConfig', config });
  }

  setTiming(timing: RoomTiming): void {
    this.sendMsg({ v: 1, type: 'setTiming', timing });
  }

  start(): void {
    this.sendMsg({ v: 1, type: 'start' });
  }

  /** Submit a game action; returns the generated actionId so a caller can
   *  correlate a later 'rejected' (or deliberately re-submit after a resync
   *  with the SAME id — the server dedups via actions_seen, PLAN §5). */
  act(seat: Seat, action: unknown, actionId: string = crypto.randomUUID()): string {
    this.sendMsg({
      v: 1,
      type: 'action',
      seat,
      actionId,
      // Advisory only (PLAN §5): the engine's own validation is the guard.
      expectedSeq: this.store.lastSeenSeq,
      action,
    });
    return actionId;
  }

  /** Permanently close: stops reconnection attempts and the keepalive. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    document.removeEventListener('visibilitychange', this.onVisible);
    this.stopPing();
    this.store.setConnected(false);
    this.ws.close();
  }

  // --- internals -----------------------------------------------------------

  private sendMsg(msg: ClientMessage): void {
    this.ws.send(JSON.stringify(msg));
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      // Guarded: after a drop, partysocket would buffer sends until the next
      // open — queued stale pings are useless, so only ping a live socket.
      if (this.ws.readyState === ReconnectingWebSocket.OPEN) {
        this.ws.send('ping');
      }
    }, PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}
