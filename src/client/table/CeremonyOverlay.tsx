// CeremonyOverlay — the hand-1 翻牌定先 opening (firstLeadMethod='drawCard'),
// restyled into the Lacquer Ledger system (ceremony-marker round): the
// information order follows the ritual — who cut → the flipped card(s) → the
// count → where the marker lands → who leads — with goldleaf reserved for the
// leader line, like everywhere else. Animates EXACTLY the handStarted.ceremony
// payload (engine contract: the UI computes nothing but display labels).
//
// The ceremony is PUBLICLY VERIFIABLE (owner rule): all four seats see the
// same two cards — the count card (the walk's last flip; re-flips fade with a
// 重翻 label) and the face-up 明牌 marker — legibly enough to derive the
// drawer and the leader themselves. The marker is a specific card INSTANCE
// (deck position; two decks mean twins), so copy names SEATS, never "the 8♥".
// ~4–6s total, skippable by tap; prefers-reduced-motion renders a one-line
// summary instead.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Seat } from '../../engine/core/game';
import { naturalValue, rankOf, type Rank } from '../../engine/guandan/cards';
import { CardFace, cardLabel } from './CardFace';
import { type Ceremony } from './helpers';
import { t } from '../i18n';

export interface CeremonyOverlayProps {
  ceremony: Ceremony;
  /** Current level — flips are REAL cards, so they render as true faces (a
   *  flipped level card even shows its wild marker). */
  level: Rank;
  /** True under ceremonyCardCount=2 (the owner form): the marker is a card
   *  DISTINCT from the count card and renders separately; under the official
   *  one-card form the counted flip IS the marker and carries both labels. */
  twoCard: boolean;
  nameFor: (seat: Seat) => string;
  onDone: () => void;
}

type Step =
  | { kind: 'shuffle' }
  | { kind: 'cut' }
  | { kind: 'flip'; index: number }
  | { kind: 'reveal' } // the 明牌 turns over
  | { kind: 'count' }
  | { kind: 'landing' } // 明牌落在
  | { kind: 'banner' };

const STEP_MS: Record<Step['kind'], number> = {
  shuffle: 700,
  cut: 700,
  flip: 400,
  reveal: 700,
  count: 800,
  landing: 700,
  banner: 1200,
};

/** The physical count-around-the-table value (owner rule: A counts 1). */
function countValue(rank: Rank): number {
  return rank === 'A' ? 1 : naturalValue(rank);
}

function buildSteps(ceremony: Ceremony): Step[] {
  return [
    { kind: 'shuffle' },
    { kind: 'cut' },
    ...ceremony.flips.map((_, index): Step => ({ kind: 'flip', index })),
    { kind: 'reveal' },
    { kind: 'count' },
    { kind: 'landing' },
    { kind: 'banner' },
  ];
}

function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function CeremonyOverlay({ ceremony, level, twoCard, nameFor, onDone }: CeremonyOverlayProps) {
  const reduced = useMemo(prefersReducedMotion, []);
  const steps = useMemo(() => buildSteps(ceremony), [ceremony]);
  const [stepIdx, setStepIdx] = useState(0);

  // onDone goes through a ref, NOT the effect deps: the parent passes a fresh
  // closure every render, and while a turn deadline is outstanding GameTable
  // re-renders every 500ms (the countdown tick). With onDone as a dep each
  // re-render's cleanup cleared the pending step timeout before it could fire
  // (500ms tick < every step duration), freezing the overlay on 洗牌中…
  // forever. The ref keeps the timer chain untouchable by parent re-renders
  // while still calling the LATEST callback.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (reduced) return;
    if (stepIdx >= steps.length) {
      onDoneRef.current();
      return;
    }
    const step = steps[stepIdx]!;
    const timer = setTimeout(() => setStepIdx((i) => i + 1), STEP_MS[step.kind]);
    return () => clearTimeout(timer);
  }, [reduced, stepIdx, steps]);

  const summary = t('game.ceremony.summary', { name: nameFor(ceremony.markerSeat) });

  if (reduced) {
    return (
      <div className="gd-overlay" role="dialog" aria-label={t('game.ceremony.title')}>
        <div className="gd-ceremony">
          <p className="gd-ceremony__banner">{summary}</p>
          <button type="button" onClick={onDone}>
            {t('game.action.dismiss')}
          </button>
        </div>
      </div>
    );
  }

  const step = steps[Math.min(stepIdx, steps.length - 1)]!;
  const stage = step.kind;
  const flipsShown =
    stage === 'flip' ? step.index + 1 : stage === 'shuffle' || stage === 'cut' ? 0 : ceremony.flips.length;
  const markerShown = stage === 'reveal' || stage === 'count' || stage === 'landing' || stage === 'banner';
  const countedRank = rankOf(ceremony.flips[ceremony.flips.length - 1]!);

  return (
    <div
      className="gd-overlay gd-overlay--tappable"
      role="dialog"
      aria-label={t('game.ceremony.title')}
      onClick={onDone}
    >
      <div className="gd-ceremony">
        <h3 className="gd-ceremony__title">{t('game.ceremony.title')}</h3>

        {/* 1. Who cut */}
        {stage === 'shuffle' && <p className="gd-ceremony__line">{t('game.ceremony.shuffling')}</p>}
        {stage !== 'shuffle' && (
          <p className={`gd-ceremony__line ${stage === 'cut' ? 'gd-ceremony__line--pulse' : ''}`}>
            {t('game.ceremony.cutter', { name: nameFor(ceremony.cutter) })}
          </p>
        )}

        {/* 2. The flipped card(s): the count walk, then the 明牌 beside it */}
        {(flipsShown > 0 || markerShown) && (
          <div className="gd-ceremony__cards">
            {ceremony.flips.slice(0, flipsShown).map((flip, i) => {
              const isCounted = i === ceremony.flips.length - 1;
              const superseded = !isCounted && (i < flipsShown - 1 || stage !== 'flip');
              return (
                <span
                  key={i}
                  className={`gd-ceremony__flip ${!isCounted ? 'gd-ceremony__flip--reflip' : ''} ${superseded ? 'gd-ceremony__flip--gone' : ''}`}
                  role="img"
                  aria-label={cardLabel(flip, level)}
                >
                  <CardFace card={flip} level={level} size="mini" />
                  <span className="gd-ceremony__cardLabel">
                    {isCounted
                      ? twoCard
                        ? t('game.ceremony.countLabel')
                        : `${t('game.ceremony.countLabel')}・${t('game.ceremony.markerLabel')}`
                      : t('game.ceremony.reflip')}
                  </span>
                </span>
              );
            })}
            {twoCard && markerShown && (
              <span
                className="gd-ceremony__flip gd-ceremony__flip--marker"
                role="img"
                aria-label={cardLabel(ceremony.marker, level)}
              >
                <CardFace card={ceremony.marker} level={level} size="mini" />
                <span className="gd-ceremony__cardLabel gd-ceremony__cardLabel--marker">
                  {t('game.ceremony.markerLabel')}
                </span>
              </span>
            )}
          </div>
        )}

        {/* 3. The count → first drawer */}
        {(stage === 'count' || stage === 'landing' || stage === 'banner') && countedRank !== null && (
          <p className="gd-ceremony__line">
            {t('game.ceremony.count', {
              value: countValue(countedRank),
              name: nameFor(ceremony.firstDrawer),
            })}
          </p>
        )}

        {/* 4. Where the marker lands */}
        {(stage === 'landing' || stage === 'banner') && (
          <p className="gd-ceremony__line gd-ceremony__line--marker">
            {t('game.ceremony.marker', { name: nameFor(ceremony.markerSeat) })}
          </p>
        )}

        {/* 5. Who leads — the one goldleaf moment */}
        {stage === 'banner' && (
          <p className="gd-ceremony__banner">
            {t('game.ceremony.leader', { name: nameFor(ceremony.markerSeat) })}
          </p>
        )}

        <p className="gd-ceremony__skip">{t('game.ceremony.skipHint')}</p>
      </div>
    </div>
  );
}
