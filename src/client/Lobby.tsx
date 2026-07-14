// Lobby screen (M3 shell, PLAN.md §4 lobby phase). Layout (visual-iteration
// round 1): the room code is the page's hero — a large serif code chip with
// a copy-link button — followed by four rosewood seat plates (the nickname +
// claim flow lives inside the FIRST empty plate; claiming stays repeatable,
// one client may claim multiple seats for self-play), the big cinnabar
// start button (any seated player, once every seat is claimed, with a
// localized disabled-reason line), and the rule-picker panel beneath.

import { useEffect, useState } from 'react';
import type { RoomInfo } from '../shared/protocol';
import type { RoomSnapshot, RoomStore } from './room/store';
import { RulePicker } from './RulePicker';
import { TimingPicker } from './TimingPicker';
import { roomHash } from './router';
import { t } from './i18n';

export interface LobbyProps {
  snapshot: RoomSnapshot;
  store: RoomStore;
}

type CopyState = 'idle' | 'copied' | 'failed';

export function Lobby({ snapshot, store }: LobbyProps) {
  const [name, setName] = useState('');
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const room = snapshot.room as RoomInfo; // RoomPage only renders Lobby with a room

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = setTimeout(() => setCopyState('idle'), 2500);
    return () => clearTimeout(timer);
  }, [copyState]);

  const freeSeats = room.seats.filter((s) => !s.claimed).length;
  const allClaimed = freeSeats === 0;
  const holdsSeat = snapshot.seats.size > 0;
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

      <ul className="lobby-seats">
        {room.seats.map((seat) => (
          <li
            key={seat.seat}
            className={seat.claimed ? 'lobby-seat' : 'lobby-seat lobby-seat--empty'}
          >
            <span className="lobby-seat__label">
              {t('lobby.seatLabel', { seat: seat.seat + 1 })}
            </span>
            {seat.claimed ? (
              <span className="lobby-seat__row">
                <span
                  className={
                    seat.connected
                      ? 'lobby-seat__dot lobby-seat__dot--on'
                      : 'lobby-seat__dot lobby-seat__dot--off'
                  }
                  role="img"
                  aria-label={
                    seat.connected ? t('lobby.seatConnected') : t('lobby.seatDisconnected')
                  }
                />
                <span className="lobby-seat__name">{seat.name ?? ''}</span>
                {snapshot.seats.has(seat.seat) && (
                  <span className="lobby-seat__you">{t('lobby.seatYou')}</span>
                )}
              </span>
            ) : seat.seat === firstEmptySeat ? (
              // The claim flow lives inside the first empty plate; it
              // disappears entirely once every seat is claimed.
              <form
                className="lobby-claim"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!canClaim) return;
                  store.claim(name.trim());
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
              <span className="lobby-seat__empty">{t('lobby.seatEmpty')}</span>
            )}
          </li>
        ))}
      </ul>

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
        <RulePicker
          config={room.config}
          disabled={room.status !== 'lobby'}
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
          disabled={room.status !== 'lobby'}
          onChange={(timing) => store.setTiming(timing)}
        />
      </section>
    </section>
  );
}
