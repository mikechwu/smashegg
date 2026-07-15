// Lobby screen (M3 shell, PLAN.md §4 lobby phase). Layout (visual-iteration
// round 1): the room code is the page's hero — a large serif code chip with
// a copy-link button — followed by four rosewood seat plates (the nickname +
// claim flow lives inside the FIRST empty plate; claiming stays repeatable,
// one client may claim multiple seats for self-play), the big cinnabar
// start button (any seated player, once every seat is claimed, with a
// localized disabled-reason line), and the rule-picker panel beneath.

import { useEffect, useState } from 'react';
import type { Seat } from '../engine/core/game';
import type { RoomInfo } from '../shared/protocol';
import type { RoomSnapshot, RoomStore } from './room/store';
import { RulePicker } from './RulePicker';
import { TimingPicker } from './TimingPicker';
import { seatLayout } from './table/helpers';
import { roomHash } from './router';
import { t } from './i18n';

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

export function Lobby({ snapshot, store }: LobbyProps) {
  const [name, setName] = useState('');
  const [copyState, setCopyState] = useState<CopyState>('idle');
  // Inline rename (item 1): which of MY seats has its rename form open.
  const [renamingSeat, setRenamingSeat] = useState<Seat | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const room = snapshot.room as RoomInfo; // RoomPage only renders Lobby with a room

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = setTimeout(() => setCopyState('idle'), 2500);
    return () => clearTimeout(timer);
  }, [copyState]);

  const freeSeats = room.seats.filter((s) => !s.claimed).length;
  const allClaimed = freeSeats === 0;
  const holdsSeat = snapshot.seats.size > 0;
  const editable = configEditable(room.status, holdsSeat);
  const canClaim = snapshot.connected && freeSeats > 0 && name.trim().length > 0;
  // Start rule (PLAN §4): any seated player may start once all seats are
  // claimed. The server re-validates; this only gates the button.
  const canStart = snapshot.connected && holdsSeat && allClaimed;
  const firstEmptySeat = room.seats.find((s) => !s.claimed)?.seat ?? null;

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

  // Ring layout: anchor the viewer's first held seat at the bottom (south),
  // partner across the top (north), opponents left/right — the SAME seatLayout
  // convention as the table, so partnership reads identically in the lobby and
  // in play (§2). With no seat held yet, seat 1 anchors the bottom and the ring
  // still shows the team structure spatially (1&3 across, 2&4 across).
  const anchor: Seat = [...snapshot.seats.keys()].sort((a, b) => a - b)[0] ?? 0;
  const ring = seatLayout(anchor);

  const seatCell = (s: Seat) => {
    const seat = room.seats.find((x) => x.seat === s);
    if (seat === undefined) return null;
    const isYou = snapshot.seats.has(s);
    const isPartner = holdsSeat && s === ring.north && !isYou;
    return (
      <div className={seat.claimed ? 'lobby-seat' : 'lobby-seat lobby-seat--empty'}>
        <span className="lobby-seat__label">{t('lobby.seatLabel', { seat: s + 1 })}</span>
        {seat.claimed ? (
          <>
            <span className="lobby-seat__row">
              <span
                className={
                  seat.connected
                    ? 'lobby-seat__dot lobby-seat__dot--on'
                    : 'lobby-seat__dot lobby-seat__dot--off'
                }
                role="img"
                aria-label={seat.connected ? t('lobby.seatConnected') : t('lobby.seatDisconnected')}
              />
              <span className="lobby-seat__name">{seat.name ?? ''}</span>
              {isYou && <span className="lobby-seat__you">{t('lobby.seatYou')}</span>}
              {isPartner && <span className="lobby-seat__partner">{t('game.seat.partner')}</span>}
            </span>
            {isYou && renamingSeat === s && (
              <form
                className="lobby-claim"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = renameValue.trim();
                  if (v.length === 0) return;
                  store.rename(s, v);
                  setRenamingSeat(null);
                }}
              >
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  maxLength={32}
                  aria-label={t('lobby.nameLabel')}
                />
                <button type="submit" disabled={renameValue.trim().length === 0}>
                  {t('lobby.renameSave')}
                </button>
              </form>
            )}
            {isYou && (
              <span className="lobby-seat__controls">
                <button
                  type="button"
                  className="lobby-seat__ctl"
                  onClick={() => {
                    setRenamingSeat(renamingSeat === s ? null : s);
                    setRenameValue(seat.name ?? '');
                  }}
                >
                  {t('lobby.rename')}
                </button>
                <button type="button" className="lobby-seat__ctl" onClick={() => store.release(s)}>
                  {t('lobby.leaveSeat')}
                </button>
              </span>
            )}
          </>
        ) : s === firstEmptySeat ? (
          // The full claim flow (name input) lives in the first empty seat;
          // it claims THIS seat explicitly, so what you click is where you
          // sit (item 1 choose-your-seat).
          <form
            className="lobby-claim"
            onSubmit={(e) => {
              e.preventDefault();
              if (!canClaim) return;
              store.claim(name.trim(), s);
            }}
          >
            <label>
              {t('lobby.nameLabel')}
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('lobby.namePlaceholder')}
                maxLength={32}
              />
            </label>
            <button type="submit" disabled={!canClaim}>
              {t('lobby.claimButton')}
            </button>
          </form>
        ) : (
          // Any other empty seat is claimable directly with the name typed
          // in the form — sit exactly where you want (item 1).
          <span className="lobby-seat__row">
            <span className="lobby-seat__empty">{t('lobby.seatEmpty')}</span>
            <button
              type="button"
              className="lobby-seat__ctl"
              disabled={!canClaim}
              onClick={() => store.claim(name.trim(), s)}
            >
              {t('lobby.claimButton')}
            </button>
          </span>
        )}
      </div>
    );
  };

  return (
    <section className="lobby">
      <h2 className="lobby-heading">{t('lobby.heading')}</h2>

      <div className="lobby-code">
        <span className="lobby-code__label">{t('lobby.roomCode')}</span>
        <div className="lobby-code__row">
          <strong className="lobby-code__value">{store.code}</strong>
          <button
            type="button"
            className="lobby-code__copy"
            onClick={() => {
              void copyLink();
            }}
          >
            {t('lobby.copyLink')}
          </button>
        </div>
        {/* Persistent live region: the copied-toast swaps into a reserved
            line, so announcing works and the chip never jumps. */}
        <p className="lobby-code__status" role="status">
          {copyState === 'copied'
            ? t('lobby.copied')
            : copyState === 'failed'
              ? t('lobby.copyFailed')
              : ' '}
        </p>
      </div>

      <div className="lobby-ring" role="group" aria-label={t('lobby.heading')}>
        <div className="lobby-ring__seat lobby-ring__seat--north">{seatCell(ring.north)}</div>
        <div className="lobby-ring__seat lobby-ring__seat--west">{seatCell(ring.west)}</div>
        <div className="lobby-ring__center" aria-hidden="true" />
        <div className="lobby-ring__seat lobby-ring__seat--east">{seatCell(ring.east)}</div>
        <div className="lobby-ring__seat lobby-ring__seat--south">{seatCell(ring.south)}</div>
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
