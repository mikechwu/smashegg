// CeremonyOverlay — the hand-1 draw ceremony (flip-to-lead) opening (firstLeadMethod='drawCard'),
// restyled into the Lacquer Ledger system (ceremony-marker round): the
// information order follows the ritual — who cut → the flipped card(s) → the
// count → where the marker lands → who leads — with goldleaf reserved for the
// leader line, like everywhere else. Animates EXACTLY the handStarted.ceremony
// payload (engine contract: the UI computes nothing but display labels).
//
// The ceremony is PUBLICLY VERIFIABLE (owner rule): all four seats see the
// same two cards — the count card (the FINAL cut's flip; earlier attempts'
// uncountable flips fade with a re-cut label) and the face-up marker card —
// legibly enough to derive the
// drawer and the leader themselves. The marker is a specific card INSTANCE
// (deck position; two decks mean twins), so copy names SEATS, never "the
// heart 8".
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
  | { kind: 'reveal' } // the marker card turns over
  | { kind: 'count' }
  | { kind: 'identity' }; // "whoever draws it leads" — NEVER who gets it

const STEP_MS: Record<Step['kind'], number> = {
  shuffle: 700,
  cut: 700,
  flip: 400,
  reveal: 700,
  count: 800,
  identity: 1400,
};

/** The physical count-around-the-table value (owner rule: A counts 1). */
function countValue(rank: Rank): number {
  return rank === 'A' ? 1 : naturalValue(rank);
}

function buildSteps(): Step[] {
  // Owner rule (live-build feedback): the panel shows ONLY the final two
  // cards — the count card and the marker — never the earlier re-cut flips
  // (those already had their moment in the cut panel). One flip step.
  return [
    { kind: 'shuffle' },
    { kind: 'cut' },
    { kind: 'flip', index: 0 },
    { kind: 'reveal' },
    { kind: 'count' },
    { kind: 'identity' },
  ];
}

function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function CeremonyOverlay({ ceremony, level, twoCard, nameFor, onDone }: CeremonyOverlayProps) {
  const reduced = useMemo(prefersReducedMotion, []);
  const steps = useMemo(() => buildSteps(), []);
  const [stepIdx, setStepIdx] = useState(0);

  // onDone goes through a ref, NOT the effect deps: the parent passes a fresh
  // closure every render, and while a turn deadline is outstanding GameTable
  // re-renders every 500ms (the countdown tick). With onDone as a dep each
  // re-render's cleanup cleared the pending step timeout before it could fire
  // (500ms tick < every step duration), freezing the overlay on shuffling…
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
  const markerShown = stage === 'reveal' || stage === 'count' || stage === 'identity';
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

        {/* 2. The final two cards ONLY (owner rule): the count card and the
            face-up marker — earlier re-cut flips are deliberately not
            re-shown here. */}
        {(flipsShown > 0 || markerShown) && (
          <div className="gd-ceremony__cards">
            <span
              className="gd-ceremony__flip"
              role="img"
              aria-label={cardLabel(ceremony.flips[ceremony.flips.length - 1]!, level)}
            >
              <CardFace card={ceremony.flips[ceremony.flips.length - 1]!} level={level} size="hand" />
              <span className="gd-ceremony__cardLabel">
                {twoCard
                  ? t('game.ceremony.countLabel')
                  : `${t('game.ceremony.countLabel')}・${t('game.ceremony.markerLabel')}`}
              </span>
            </span>
            {twoCard && markerShown && (
              <span
                className="gd-ceremony__flip gd-ceremony__flip--marker"
                role="img"
                aria-label={cardLabel(ceremony.marker, level)}
              >
                <CardFace card={ceremony.marker} level={level} size="hand" />
                <span className="gd-ceremony__cardLabel gd-ceremony__cardLabel--marker">
                  {t('game.ceremony.markerLabel')}
                </span>
              </span>
            )}
          </div>
        )}

        {/* 3. The count → first drawer */}
        {(stage === 'count' || stage === 'identity') && countedRank !== null && (
          <p className="gd-ceremony__line">
            {t('game.ceremony.count', {
              value: countValue(countedRank),
              name: nameFor(ceremony.firstDrawer),
            })}
          </p>
        )}

        {/* 4. The marker's IDENTITY only — never who gets it (owner's
            suspense rule): the DEAL reveals the leader when the face-up
            marker lands. UI-level suspense, deliberately NOT concealment —
            the payload publishes markerSeat (and the client needs the deal
            depth to fly the marker), so devtools could peek; a presentation
            choice for a family game, stated honestly. */}
        {stage === 'identity' && (
          <p className="gd-ceremony__line gd-ceremony__line--marker">
            {t('game.ceremony.markerIdentity')}
          </p>
        )}

        <p className="gd-ceremony__skip">{t('game.ceremony.skipHint')}</p>
      </div>
    </div>
  );
}
