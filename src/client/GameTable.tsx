// <GameTable/> placeholder (M3 shell): the table-UI task replaces this
// component's INTERNALS — its contract (props + the active-seat tab bar for
// multi-seat self-play, PLAN §4) is the shell it plugs into. For now each
// held seat's authoritative view/hints render as JSON.

import { useState } from 'react';
import type { Seat } from '../engine/core/game';
import type { RoomSnapshot } from './room/store';
import { t } from './i18n';

export interface GameTableProps {
  snapshot: RoomSnapshot;
}

export function GameTable({ snapshot }: GameTableProps) {
  const heldSeats: Seat[] = [...snapshot.seats.keys()].sort((a, b) => a - b);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);

  if (heldSeats.length === 0) {
    // Connected without any seat token (e.g. joined a game already going):
    // nothing to render — per-seat views only flow to token holders (PLAN §4).
    return <p>{t('room.spectating')}</p>;
  }

  // The selected tab must always be a seat we still hold (a takeover by
  // another tab can shrink the held set); fall back to the lowest seat.
  const firstSeat = heldSeats[0] as Seat;
  const activeSeat =
    selectedSeat !== null && heldSeats.includes(selectedSeat) ? selectedSeat : firstSeat;
  const perSeat = snapshot.perSeat.get(activeSeat);

  return (
    <section>
      {heldSeats.length > 1 && (
        <nav aria-label={t('room.seatTabsLabel')}>
          {heldSeats.map((seat) => (
            <button
              key={seat}
              type="button"
              disabled={seat === activeSeat}
              onClick={() => setSelectedSeat(seat)}
            >
              {t('room.seatTab', { seat: seat + 1 })}
            </button>
          ))}
        </nav>
      )}
      <h3>{t('room.seatTab', { seat: activeSeat + 1 })}</h3>
      {perSeat === undefined ? (
        <p>{t('room.waitingForView')}</p>
      ) : (
        <pre>
          {JSON.stringify(
            { view: perSeat.view, hints: perSeat.hints, lastEventBatch: perSeat.lastEventBatch },
            null,
            2,
          )}
        </pre>
      )}
    </section>
  );
}
