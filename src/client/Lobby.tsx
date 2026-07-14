// Lobby screen (M3 shell, PLAN.md §4 lobby phase): claimed-seat roster,
// claim button (repeatable — one client may claim MULTIPLE seats, up to all
// of them, for self-play), the config-panel placeholder slot the rule-picker
// task will fill, and the start button (any seated player, once every seat
// is claimed).

import { useState } from 'react';
import type { RoomInfo } from '../shared/protocol';
import type { RoomSnapshot, RoomStore } from './room/store';
import { t } from './i18n';

export interface LobbyProps {
  snapshot: RoomSnapshot;
  store: RoomStore;
}

export function Lobby({ snapshot, store }: LobbyProps) {
  const [name, setName] = useState('');
  const room = snapshot.room as RoomInfo; // RoomPage only renders Lobby with a room

  const freeSeats = room.seats.filter((s) => !s.claimed).length;
  const allClaimed = freeSeats === 0;
  const holdsSeat = snapshot.seats.size > 0;
  const canClaim = snapshot.connected && freeSeats > 0 && name.trim().length > 0;
  // Start rule (PLAN §4): any seated player may start once all seats are
  // claimed. The server re-validates; this only gates the button.
  const canStart = snapshot.connected && holdsSeat && allClaimed;

  return (
    <section>
      <h2>{t('lobby.heading')}</h2>

      <ul>
        {room.seats.map((seat) => (
          <li key={seat.seat}>
            {t('lobby.seatLabel', { seat: seat.seat + 1 })}
            {': '}
            {seat.claimed ? (seat.name ?? '') : t('lobby.seatEmpty')}
            {seat.claimed && snapshot.seats.has(seat.seat) && <> {t('lobby.seatYou')}</>}
            {seat.claimed && (
              <> — {seat.connected ? t('lobby.seatConnected') : t('lobby.seatDisconnected')}</>
            )}
          </li>
        ))}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!canClaim) return;
          store.claim(name.trim());
        }}
      >
        <label>
          {t('lobby.nameLabel')}{' '}
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

      {/* Config-panel slot: the Guandan rule-picker task mounts its editor
          here (curated RuleVariant subset over the opaque setConfig
          transport, PLAN §4/§9). Until then: read-only config + placeholder
          copy, so config broadcasts are already visible end to end. */}
      <section data-slot="config-panel">
        <h3>{t('lobby.configHeading')}</h3>
        <p>{t('lobby.configPlaceholder')}</p>
        {room.config !== null && <pre>{JSON.stringify(room.config, null, 2)}</pre>}
      </section>

      <button type="button" disabled={!canStart} onClick={() => store.start()}>
        {t('lobby.startButton')}
      </button>
      {!allClaimed && <p>{t('lobby.waitingForSeats', { count: freeSeats })}</p>}
    </section>
  );
}
