// <GameTable/> — the M3 Guandan table UI. The shell contract is unchanged:
// per-seat views/hints come from the RoomSnapshot, the active-seat tab bar
// drives multi-seat self-play (PLAN §4), and every panel renders the ACTIVE
// seat's view. Internals: lacquer table layout (design system), LevelRail
// signature element, HandFan selection → hint matching → ActionBar, trick
// well / tribute panel, hand-1 draw ceremony, result overlay, event feed.
//
// The store keeps only each seat's LATEST event batch (view-carrying
// events, PLAN §5) — so trick-local presentation state (pass markers,
// 接風 banner, 抗貢 reveals, the ceremony payload, the feed) is folded
// here from batches as they arrive.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Seat } from '../engine/core/game';
import { teamOf } from '../engine/guandan/types';
import type { GuandanAction, GuandanEvent } from '../engine/guandan/types';
import type { Card, Rank } from '../engine/guandan/cards';
import type { RoomSnapshot, RoomStore } from './room/store';
import { ActionBar } from './table/ActionBar';
import { cardLabel } from './table/CardFace';
import { CeremonyOverlay } from './table/CeremonyOverlay';
import { EventFeed, FEED_LIMIT, type FeedLine } from './table/EventFeed';
import { HandFan } from './table/HandFan';
import { LevelRail } from './table/LevelRail';
import { ResultOverlay } from './table/ResultOverlay';
import { SeatPlate } from './table/SeatPlate';
import { TributePanel } from './table/TributePanel';
import { TrickWell } from './table/TrickWell';
import {
  activeSeats,
  asGuandanEvents,
  asGuandanView,
  asRuleVariant,
  comboKey,
  errorKeyFor,
  matchSelection,
  multisetKey,
  placeKey,
  placeOf,
  rankText,
  seatLayout,
  tributeEligibleCards,
  tributeKind,
  type Ceremony,
  type PlayMatch,
} from './table/helpers';
import { t } from './i18n';
import './table/table.css';

export interface GameTableProps {
  snapshot: RoomSnapshot;
  store: RoomStore;
}

// ---------------------------------------------------------------------------
// Hand-sort direction — a per-client UI preference (owner §3), NOT room
// state: it never touches the server, so it's read/written straight to
// localStorage rather than folded through the snapshot/store like the rest
// of this file's state.
// ---------------------------------------------------------------------------

const HAND_SORT_STORAGE_KEY = 'pref:handSort';

function readHandSortDescending(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(HAND_SORT_STORAGE_KEY) === 'desc';
  } catch {
    return false;
  }
}

function writeHandSortDescending(descending: boolean): void {
  try {
    localStorage.setItem(HAND_SORT_STORAGE_KEY, descending ? 'desc' : 'asc');
  } catch {
    // localStorage unavailable (e.g. private mode) — the toggle still
    // works for the current session, just doesn't persist.
  }
}

// ---------------------------------------------------------------------------
// Per-seat presentation state folded from event batches.
// ---------------------------------------------------------------------------

interface SeatDerived {
  feed: FeedLine[];
  passed: Seat[];
  jiefeng: { finisher: Seat; leader: Seat } | null;
  anti: { seat: Seat; card: Card }[] | null;
  ceremony: Ceremony | null;
  level: Rank;
  sweep: number;
}

const EMPTY_DERIVED: SeatDerived = {
  feed: [],
  passed: [],
  jiefeng: null,
  anti: null,
  ceremony: null,
  level: '2',
  sweep: 0,
};

function foldEvents(
  prev: SeatDerived,
  events: readonly GuandanEvent[],
  viewerTeam: 0 | 1,
  nameFor: (seat: Seat) => string,
  nextId: () => number,
): SeatDerived {
  let d = { ...prev, feed: [...prev.feed] };
  const push = (key: FeedLine['key'], params?: FeedLine['params']) => {
    d.feed.push({ id: nextId(), key, params });
  };
  for (const ev of events) {
    switch (ev.type) {
      case 'handStarted':
        d = { ...d, passed: [], jiefeng: null, anti: null, level: ev.currentLevel };
        if (ev.ceremony !== undefined) d.ceremony = ev.ceremony;
        push('game.feed.handStarted', { hand: ev.handNo, rank: rankText(ev.currentLevel) });
        break;
      case 'played':
        d.passed = d.passed.filter((s) => s !== ev.seat);
        d.jiefeng = null;
        d.anti = null; // the 抗貢 reveal yields the center back to the trick
        push('game.feed.played', {
          name: nameFor(ev.seat),
          combo: `${t(comboKey(ev.decl))} ${rankText(ev.decl.keyRank)}`,
        });
        break;
      case 'passed':
        if (!d.passed.includes(ev.seat)) d.passed = [...d.passed, ev.seat];
        push('game.feed.passed', { name: nameFor(ev.seat) });
        break;
      case 'trickWon':
        d = { ...d, passed: [], anti: null, sweep: d.sweep + 1 };
        push('game.feed.trickWon', { name: nameFor(ev.seat) });
        break;
      case 'jiefeng':
        d.jiefeng = { finisher: ev.finisher, leader: ev.leader };
        push('game.feed.jiefeng', { name: nameFor(ev.leader) });
        break;
      case 'playerFinished': {
        const key = placeKey(ev.place);
        push('game.feed.playerFinished', {
          name: nameFor(ev.seat),
          place: key === null ? String(ev.place) : t(key),
        });
        break;
      }
      case 'tributeCommitted':
        push('game.feed.tributeCommitted', { name: nameFor(ev.seat) });
        break;
      case 'tributePaid':
        for (const p of ev.pairings) {
          push('game.feed.tributePaid', {
            from: nameFor(p.from),
            to: nameFor(p.to),
            card: cardLabel(p.card, d.level),
          });
        }
        break;
      case 'tributeReturned':
        for (const p of ev.pairings) {
          push('game.feed.tributeReturned', {
            from: nameFor(p.from),
            to: nameFor(p.to),
            card: cardLabel(p.card, d.level),
          });
        }
        break;
      case 'antiTribute':
        d.anti = ev.reveals;
        push('game.feed.antiTribute');
        break;
      case 'handEnded':
        d.passed = [];
        push('game.feed.handEnded', {
          us: rankText(ev.newLevels[viewerTeam]),
          them: rankText(ev.newLevels[(1 - viewerTeam) as 0 | 1]),
        });
        break;
      case 'matchEnded':
        push('game.feed.matchEnded');
        break;
      default:
        break;
    }
  }
  d.feed = d.feed.slice(-FEED_LIMIT);
  return d;
}

// ---------------------------------------------------------------------------

export function GameTable({ snapshot, store }: GameTableProps) {
  const heldSeats: Seat[] = [...snapshot.seats.keys()].sort((a, b) => a - b);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);

  // --- presentation folds & local UI state (hooks before any early return) --
  const [derivedBySeat, setDerivedBySeat] = useState<ReadonlyMap<Seat, SeatDerived>>(new Map());
  const processedRef = useRef(new Map<Seat, unknown>());
  const feedIdRef = useRef(0);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [chooserOpen, setChooserOpen] = useState(false);
  const [ceremonyDone, setCeremonyDone] = useState(false);
  const [dismissedRejections, setDismissedRejections] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [handDescending, setHandDescending] = useState(() => readHandSortDescending());
  const toggleHandSort = () => {
    setHandDescending((prev) => {
      const next = !prev;
      writeHandSortDescending(next);
      return next;
    });
  };

  const room = snapshot.room;
  const nameFor = (seat: Seat): string =>
    room?.seats.find((s) => s.seat === seat)?.name ?? t('room.seatTab', { seat: seat + 1 });

  // Fold newly arrived event batches into per-seat presentation state.
  useEffect(() => {
    let next: Map<Seat, SeatDerived> | null = null;
    for (const [seat, perSeat] of snapshot.perSeat) {
      const batch = perSeat.lastEventBatch;
      if (batch === null || processedRef.current.get(seat) === batch) continue;
      processedRef.current.set(seat, batch);
      const events = asGuandanEvents(batch);
      if (events.length === 0) continue;
      if (next === null) next = new Map(derivedBySeat);
      next.set(
        seat,
        foldEvents(next.get(seat) ?? EMPTY_DERIVED, events, teamOf(seat), nameFor, () => feedIdRef.current++),
      );
    }
    if (next !== null) setDerivedBySeat(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot]);

  // Countdown tick — only while a deadline is outstanding.
  const deadlines = snapshot.deadlines;
  useEffect(() => {
    if (deadlines.length === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [deadlines.length]);

  // The selected tab must always be a seat we still hold (a takeover by
  // another tab can shrink the held set); fall back to the lowest seat.
  const firstSeat = heldSeats[0] as Seat | undefined;
  const activeSeat =
    selectedSeat !== null && heldSeats.includes(selectedSeat) ? selectedSeat : firstSeat;
  const perSeat = activeSeat === undefined ? undefined : snapshot.perSeat.get(activeSeat);
  const view = perSeat === undefined ? null : asGuandanView(perSeat.view);
  const hints =
    perSeat?.hints == null ? null : (perSeat.hints as GuandanAction[]);

  // Selection resets whenever the active seat or the hand contents change
  // (a play/tribute/deal replaced the cards under the indices), whenever
  // this seat's expected-actor status ends (hints → null: the turn was
  // resolved — possibly by the server clock), and whenever the trick
  // context changes (a new top play, a new leader, or a trick sweep): a
  // lifted card must never survive the situation it was lifted for.
  const trickKey =
    view === null || view.trick === null
      ? 'noTrick'
      : `${view.trick.leader}|${view.trick.top === null ? 'lead' : multisetKey(view.trick.top.cards)}`;
  const handKey =
    view === null
      ? ''
      : `${activeSeat}|${multisetKey(view.hand)}|${hints === null ? 'idle' : 'actor'}|${trickKey}`;
  useEffect(() => {
    setSelected(new Set());
    setChooserOpen(false);
  }, [handKey]);

  const selectionCards: Card[] = useMemo(() => {
    if (view === null) return [];
    return [...selected]
      .sort((a, b) => a - b)
      .map((i) => view.hand[i])
      .filter((c): c is Card => c !== undefined);
  }, [selected, view]);

  // classifyPlays needs the room's rule variant (coerced defensively —
  // helpers.asRuleVariant; the server's hints still gate legality).
  const roomConfig = room?.config;
  const variant = useMemo(() => asRuleVariant(roomConfig), [roomConfig]);

  const matches: PlayMatch[] = useMemo(() => {
    if (view === null || hints === null || view.phase !== 'playing') return [];
    return matchSelection(selectionCards, hints, view.currentLevel, variant);
  }, [selectionCards, hints, view, variant]);

  if (activeSeat === undefined) {
    // Connected without any seat token (e.g. joined a game already going):
    // nothing to render — per-seat views only flow to token holders (PLAN §4).
    return <p>{t('room.spectating')}</p>;
  }

  const derived = derivedBySeat.get(activeSeat) ?? EMPTY_DERIVED;

  if (view === null) {
    return (
      <section className="gd-table">
        <SeatTabs heldSeats={heldSeats} activeSeat={activeSeat} onSelect={setSelectedSeat} />
        <p>{t('room.waitingForView')}</p>
      </section>
    );
  }

  const viewerTeam = teamOf(activeSeat);
  const layout = seatLayout(activeSeat);
  const dueBySeat = new Map(deadlines.map((d) => [d.seat, d.dueAt]));
  const ringSeats = new Set<Seat>(activeSeats(view));
  if (view.phase === 'antiTributeDecision') for (const d of deadlines) ringSeats.add(d.seat);

  const tributePhase = tributeKind(hints ?? []);
  const eligible = tributeEligibleCards(hints ?? []);
  const selectedEligible =
    selectionCards.length === 1 && eligible.has(selectionCards[0]!) ? selectionCards[0]! : null;
  const tributeAction =
    tributePhase === null || selectedEligible === null
      ? null
      : tributePhase === 'payTribute'
        ? { type: 'payTribute' as const, card: selectedEligible }
        : { type: 'returnTribute' as const, card: selectedEligible };

  const inTributeCenter =
    view.phase === 'tribute' || view.phase === 'returnTribute' || view.phase === 'antiTributeDecision';
  const showAnti = derived.anti !== null;

  const lastRejection = snapshot.rejections[snapshot.rejections.length - 1];
  const showToast = snapshot.rejections.length > dismissedRejections && lastRejection !== undefined;

  const committedSet = new Set<Seat>(view.tribute?.committed ?? []);

  const plate = (seat: Seat) => (
    <SeatPlate
      seat={seat}
      name={nameFor(seat)}
      connected={room?.seats.find((s) => s.seat === seat)?.connected ?? false}
      isViewer={seat === activeSeat}
      cardCount={view.cardCounts[seat] ?? null}
      place={placeOf(view.finishOrder, seat)}
      active={ringSeats.has(seat)}
      dueAt={dueBySeat.get(seat) ?? null}
      now={now}
      passed={derived.passed.includes(seat)}
      committed={inTributeCenter && committedSet.has(seat)}
    />
  );

  const act = (action: GuandanAction) => {
    store.act(activeSeat, action);
    setSelected(new Set());
    setChooserOpen(false);
  };

  return (
    <section className="gd-table">
      <SeatTabs heldSeats={heldSeats} activeSeat={activeSeat} onSelect={setSelectedSeat} />
      <div className="gd-layout">
        <LevelRail
          levels={view.levels}
          aAttempts={view.aAttempts}
          aAttemptsExhausted={view.aAttemptsExhausted}
          currentLevel={view.currentLevel}
          viewerTeam={viewerTeam}
        />
        <div className="gd-main">
          <div className="gd-plates">
            <div className="gd-plates__west">{plate(layout.west)}</div>
            <div className="gd-plates__north">{plate(layout.north)}</div>
            <div className="gd-plates__east">{plate(layout.east)}</div>
          </div>

          <div className="gd-center">
            {inTributeCenter || showAnti ? (
              <TributePanel view={view} nameFor={nameFor} antiReveals={derived.anti} />
            ) : (
              <TrickWell
                trick={view.trick}
                level={view.currentLevel}
                nameFor={nameFor}
                sweepKey={derived.sweep}
                jiefeng={derived.jiefeng}
              />
            )}
          </div>

          <EventFeed lines={derived.feed} />

          <div className="gd-south">
            {plate(layout.south)}
            <button
              type="button"
              className="gd-handSort"
              aria-label={t('game.sort.label')}
              aria-pressed={handDescending}
              onClick={toggleHandSort}
            >
              {handDescending ? t('game.sort.descending') : t('game.sort.ascending')}
            </button>
            <HandFan
              hand={view.hand}
              level={view.currentLevel}
              selected={selected}
              onToggle={(i) =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (next.has(i)) next.delete(i);
                  else next.add(i);
                  return next;
                })
              }
              glow={eligible}
              descending={handDescending}
            />
            <ActionBar
              hints={hints}
              phase={view.phase}
              matches={matches}
              passAvailable={hints !== null && hints.some((h) => h.type === 'pass')}
              selectionCount={selected.size}
              tributeAction={tributeAction}
              tributePhase={tributePhase}
              chooserOpen={chooserOpen}
              onPlay={(match) => act({ type: 'play', cards: match.cards, decl: match.decl })}
              onOpenChooser={() => setChooserOpen(true)}
              onCloseChooser={() => setChooserOpen(false)}
              onPass={() => act({ type: 'pass' })}
              onTribute={() => {
                if (tributeAction !== null) act(tributeAction);
              }}
              onAntiDecision={(invoke) => act({ type: 'antiTributeDecision', invoke })}
            />
          </div>
        </div>
      </div>

      {showToast && lastRejection !== undefined && (
        <div className="gd-toast" role="alert">
          <span>
            {errorKeyFor(lastRejection.error.code) === 'game.error.unknown'
              ? t('game.error.unknown', { code: lastRejection.error.code })
              : t(errorKeyFor(lastRejection.error.code))}
          </span>
          <button type="button" onClick={() => setDismissedRejections(snapshot.rejections.length)}>
            {t('game.action.dismiss')}
          </button>
        </div>
      )}

      {derived.ceremony !== null && !ceremonyDone && view.handNo === 1 && view.matchWinner === null && (
        <CeremonyOverlay
          ceremony={derived.ceremony}
          nameFor={nameFor}
          onDone={() => setCeremonyDone(true)}
        />
      )}

      {view.matchWinner !== null && (
        <ResultOverlay
          winnerTeam={view.matchWinner}
          viewerTeam={viewerTeam}
          levels={view.levels}
          nameFor={nameFor}
        />
      )}
    </section>
  );
}

function SeatTabs({
  heldSeats,
  activeSeat,
  onSelect,
}: {
  heldSeats: Seat[];
  activeSeat: Seat;
  onSelect: (seat: Seat) => void;
}) {
  if (heldSeats.length <= 1) return null;
  return (
    <nav className="gd-tabs" aria-label={t('room.seatTabsLabel')}>
      {heldSeats.map((seat) => (
        <button
          key={seat}
          type="button"
          disabled={seat === activeSeat}
          onClick={() => onSelect(seat)}
        >
          {t('room.seatTab', { seat: seat + 1 })}
        </button>
      ))}
    </nav>
  );
}
