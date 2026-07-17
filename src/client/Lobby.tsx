// Lobby screen (M3 shell, PLAN.md §4 lobby phase). Owner-designed redesign:
// a SEPARATE name panel above a round card table. The table is a felt disc
// with a rosewood rim — the thing people gather around — carrying the room
// code and its copy-link button ON the felt. Four seats sit around it in
// FIXED geographic positions (0 bottom, 1 right, 2 top, 3 left) that never
// re-anchor to the viewer, so partners (0&2, 1&3) always face ACROSS the
// table and the geometry itself carries the team structure. Each empty seat
// is a take-a-seat button that claims EXACTLY that seat (multi-seat self-play
// stays: one client may claim several seats, one name typed per claim); a
// held seat shows a connection dot, the name, a you-badge, and a leave button.

import { useEffect, useState } from 'react';
import type { Seat } from '../engine/core/game';
import type { RoomInfo } from '../shared/protocol';
import type { RoomSnapshot, RoomStore } from './room/store';
import { RulePicker } from './RulePicker';
import { TimingPicker } from './TimingPicker';
import { roomHash } from './router';
import { t, type TranslationKey } from './i18n';

export interface LobbyProps {
  snapshot: RoomSnapshot;
  store: RoomStore;
}

/** The rule & timing pickers are editable only in the lobby AND only once you
 *  hold a seat (pre-M5 F3): an unseated player's edit is server-rejected, so
 *  the pickers must READ as disabled-until-seated rather than look editable
 *  and fail with a rejection. Pure + exported for the unit test (the client
 *  suite is DOM-free, so this predicate is the testable gate). */
export function configEditable(status: RoomInfo['status'], holdsSeat: boolean): boolean {
  return status === 'lobby' && holdsSeat;
}

type CopyState = 'idle' | 'copied' | 'failed';

/** The four seats in a FIXED render order (owner design §3). This order is
 *  the DOM order of the chips and never re-anchors to the viewer — geography
 *  is the identity, so seat 0 is always bottom, 1 right, 2 top, 3 left, and
 *  partners always sit across. */
const SEATS: readonly Seat[] = [0, 1, 2, 3];

/** Localized position word per seat, for aria ONLY (§4): the visual carries
 *  no seat index, but assistive tech still needs to tell the four
 *  take-a-seat buttons apart, so their accessible names name the position. */
const POSITION_KEY: Record<number, TranslationKey> = {
  0: 'lobby.position.bottom',
  1: 'lobby.position.right',
  2: 'lobby.position.top',
  3: 'lobby.position.left',
};

/** A take-a-seat button claims EXACTLY its own seat with the panel's trimmed
 *  name, then resets the panel to empty (the returned next value). The seat
 *  is always the button's own index — there is never a defaulted target
 *  (owner bugs: the old first-empty-seat form both submitted to the WRONG
 *  seat and let a pre-filled name MIGRATE). Clearing the name on every claim
 *  is what stops it pre-filling or migrating to another seat. Pure over the
 *  store (a recorder in tests) so the seat→claimSeat(_, seat) mapping and the
 *  name-clear are both unit-pinned with no DOM. */
export function takeSeat(store: RoomStore, name: string, seat: Seat): string {
  store.claim(name.trim(), seat);
  return '';
}

export function Lobby({ snapshot, store }: LobbyProps) {
  const [name, setName] = useState('');
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const room = snapshot.room as RoomInfo; // RoomPage only renders Lobby with a room

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = setTimeout(() => setCopyState('idle'), 2500);
    return () => clearTimeout(timer);
  }, [copyState]);

  // Seat status is read against the FIXED 0..3 set, never against whatever
  // subset room.seats happens to carry (owner bug 6c: a short/partial roster
  // must not collapse the ring to a lone card — every seat below renders a
  // chip regardless).
  const claimedOf = (s: Seat): boolean =>
    room.seats.find((x) => x.seat === s)?.claimed ?? false;
  const freeSeats = SEATS.filter((s) => !claimedOf(s)).length;
  const allClaimed = freeSeats === 0;
  const holdsSeat = snapshot.seats.size > 0;
  const editable = configEditable(room.status, holdsSeat);
  const nameReady = name.trim().length > 0;
  // Start rule (PLAN §4): any seated player may start once all seats are
  // claimed. The server re-validates; this only gates the button.
  const canStart = snapshot.connected && holdsSeat && allClaimed;

  const startReason = !allClaimed
    ? t('lobby.waitingForSeats', { count: freeSeats })
    : !holdsSeat
      ? t('lobby.startNeedSeat')
      : !snapshot.connected
        ? t('room.statusDisconnected')
        : null;

  const copyLink = async () => {
    const url = `${location.origin}${location.pathname}${roomHash(store.code)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyState('copied');
    } catch {
      // clipboard unavailable (insecure context / permission denied)
      setCopyState('failed');
    }
  };

  const seatChip = (s: Seat) => {
    const seat = room.seats.find((x) => x.seat === s);
    const claimed = seat?.claimed ?? false;
    const isYou = snapshot.seats.has(s);
    const positionLabel = t(POSITION_KEY[s]!);
    // An empty seat is claimable directly (multi-seat self-play): the button
    // claims THIS seat with the name panel's current name; disabled while the
    // name is blank, we're disconnected, or the seat is already taken.
    const canTake = snapshot.connected && nameReady && !claimed;
    return (
      <div key={s} className={`lobby-tableseat lobby-tableseat--s${s}`}>
        <div
          className={claimed ? 'lobby-seat lobby-seat--taken' : 'lobby-seat lobby-seat--empty'}
        >
          {claimed ? (
            <>
              <span className="lobby-seat__row">
                <span
                  className={
                    seat!.connected
                      ? 'lobby-seat__dot lobby-seat__dot--on'
                      : 'lobby-seat__dot lobby-seat__dot--off'
                  }
                  role="img"
                  aria-label={
                    seat!.connected ? t('lobby.seatConnected') : t('lobby.seatDisconnected')
                  }
                />
                <span className="lobby-seat__name">{seat!.name ?? ''}</span>
                {isYou && <span className="lobby-seat__you">{t('lobby.seatYou')}</span>}
              </span>
              {isYou && (
                <button
                  type="button"
                  className="lobby-seat__leave"
                  onClick={() => store.release(s)}
                >
                  {t('lobby.leaveSeat')}
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              className="lobby-seat__take"
              disabled={!canTake}
              // Aria carries the position word so the four otherwise-identical
              // take-a-seat buttons are distinguishable (§4); the visible label
              // is the same plain "take a seat" for every seat.
              aria-label={t('lobby.takeSeatAt', { position: positionLabel })}
              onClick={() => setName(takeSeat(store, name, s))}
            >
              {t('lobby.claimButton')}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="lobby">
      <h2 className="lobby-heading">{t('lobby.heading')}</h2>

      {/* Name panel (§1): a SEPARATE input above the table. Deliberately NOT a
          <form> — Enter/submit here must claim NOTHING (there is no default
          seat; you claim only by clicking a specific chip, owner bug 6b). */}
      <div className="lobby-namepanel">
        <label className="lobby-namepanel__label" htmlFor="lobby-name">
          {t('lobby.nameLabel')}
        </label>
        <input
          id="lobby-name"
          className="lobby-namepanel__input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('lobby.namePlaceholder')}
          maxLength={32}
        />
        <p className="lobby-namepanel__hint">{t('lobby.nameHint')}</p>
      </div>

      {/* The round table (§2): a felt disc with a rosewood rim ring. The room
          code and its copy-link button live ON the felt, centered — the table
          earns its existence as the thing people gather around. Four seats
          (§3) sit around it in FIXED geographic positions, so partners face
          across. */}
      <div className="lobby-table" role="group" aria-label={t('lobby.heading')}>
        <div className="lobby-table__disc">
          <span className="lobby-table__codelabel">{t('lobby.roomCode')}</span>
          <strong className="lobby-table__code">{store.code}</strong>
          <button
            type="button"
            className="lobby-table__copy"
            onClick={() => {
              void copyLink();
            }}
          >
            {t('lobby.copyLink')}
          </button>
          {/* Persistent live region: the copied-toast swaps into a reserved
              line, so announcing works and the felt never reflows. */}
          <p className="lobby-table__status" role="status">
            {copyState === 'copied'
              ? t('lobby.copied')
              : copyState === 'failed'
                ? t('lobby.copyFailed')
                : ' '}
          </p>
        </div>
        {SEATS.map((s) => seatChip(s))}
      </div>

      <button
        type="button"
        className="btn-primary lobby-start"
        disabled={!canStart}
        onClick={() => store.start()}
      >
        {t('lobby.startButton')}
      </button>
      {startReason !== null && <p className="lobby-start__reason">{startReason}</p>}

      {/* Config-panel slot: the curated Guandan rule-picker (a subset of the
          25 RuleVariant keys over the opaque setConfig transport, PLAN
          §4/§9). Any seated player may edit; edits broadcast live via
          configChanged (RulePicker is fully controlled by room.config), and
          the panel disables itself once the match config is frozen
          (room.status !== 'lobby'). */}
      <section className="lobby-config" data-slot="config-panel">
        <h3>{t('lobby.configHeading')}</h3>
        {room.status === 'lobby' && !holdsSeat && (
          <p className="lobby-config__needSeat">{t('lobby.configNeedSeat')}</p>
        )}
        <RulePicker
          config={room.config}
          disabled={!editable}
          onChange={(config) => store.setConfig(config)}
        />
      </section>

      {/* Timing-panel slot (M4): the four-preset timing picker over the
          setTiming transport — same authority and freeze rules as the rule
          picker (any seated player edits, live via roomChanged, frozen once
          the match starts). Its legend is the panel heading. */}
      <section className="lobby-config" data-slot="timing-panel">
        <TimingPicker
          timing={room.timing}
          disabled={!editable}
          onChange={(timing) => store.setTiming(timing)}
        />
      </section>
    </section>
  );
}
