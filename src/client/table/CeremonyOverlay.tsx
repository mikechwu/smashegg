// CeremonyOverlay — the hand-1 翻牌定先 opening (firstLeadMethod='drawCard').
// Animates EXACTLY the handStarted.ceremony payload (engine contract: the
// UI computes nothing): shuffle hint → cutter plate pulses → each flips[]
// card flips in sequence (jokers included; superseded flips slide away with
// a 重翻 label) → the count lands on firstDrawer → the marker travels to
// markerSeat → 該家先出 banner. ~4–6s total, skippable by tap; under
// prefers-reduced-motion it renders a static one-line summary instead.

import { useEffect, useMemo, useState } from 'react';
import type { Seat } from '../../engine/core/game';
import { rankText, type Ceremony } from './helpers';
import { t } from '../i18n';

export interface CeremonyOverlayProps {
  ceremony: Ceremony;
  nameFor: (seat: Seat) => string;
  onDone: () => void;
}

type Step =
  | { kind: 'shuffle' }
  | { kind: 'cut' }
  | { kind: 'flip'; index: number }
  | { kind: 'count' }
  | { kind: 'marker' }
  | { kind: 'banner' };

const STEP_MS: Record<Step['kind'], number> = {
  shuffle: 800,
  cut: 800,
  flip: 450,
  count: 900,
  marker: 800,
  banner: 1400,
};

function buildSteps(ceremony: Ceremony): Step[] {
  return [
    { kind: 'shuffle' },
    { kind: 'cut' },
    ...ceremony.flips.map((_, index): Step => ({ kind: 'flip', index })),
    { kind: 'count' },
    { kind: 'marker' },
    { kind: 'banner' },
  ];
}

function flipText(flip: Ceremony['flips'][number]): string {
  if (flip === 'SJ') return t('game.card.sj');
  if (flip === 'BJ') return t('game.card.bj');
  return rankText(flip);
}

function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function CeremonyOverlay({ ceremony, nameFor, onDone }: CeremonyOverlayProps) {
  const reduced = useMemo(prefersReducedMotion, []);
  const steps = useMemo(() => buildSteps(ceremony), [ceremony]);
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    if (reduced) return;
    if (stepIdx >= steps.length) {
      onDone();
      return;
    }
    const step = steps[stepIdx]!;
    const timer = setTimeout(() => setStepIdx((i) => i + 1), STEP_MS[step.kind]);
    return () => clearTimeout(timer);
  }, [reduced, stepIdx, steps, onDone]);

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
  const flipsShown = step.kind === 'flip' ? step.index + 1 : step.kind === 'shuffle' || step.kind === 'cut' ? 0 : ceremony.flips.length;

  return (
    <div
      className="gd-overlay gd-overlay--tappable"
      role="dialog"
      aria-label={t('game.ceremony.title')}
      onClick={onDone}
    >
      <div className="gd-ceremony">
        <h3 className="gd-ceremony__title">{t('game.ceremony.title')}</h3>

        {step.kind === 'shuffle' && <p className="gd-ceremony__line">{t('game.ceremony.shuffling')}</p>}
        {step.kind !== 'shuffle' && (
          <p className={`gd-ceremony__line ${step.kind === 'cut' ? 'gd-ceremony__line--pulse' : ''}`}>
            {t('game.ceremony.cutter', { name: nameFor(ceremony.cutter) })}
          </p>
        )}

        {flipsShown > 0 && (
          <div className="gd-ceremony__flips">
            {ceremony.flips.slice(0, flipsShown).map((flip, i) => {
              const isLast = i === ceremony.flips.length - 1;
              const superseded = i < flipsShown - 1 || (flipsShown === ceremony.flips.length && !isLast && step.kind !== 'flip');
              return (
                <span
                  key={i}
                  className={`gd-ceremony__flip ${!isLast ? 'gd-ceremony__flip--reflip' : ''} ${superseded ? 'gd-ceremony__flip--gone' : ''}`}
                >
                  <span className="gd-ceremony__flipcard">{flipText(flip)}</span>
                  {!isLast && <span className="gd-ceremony__reflip">{t('game.ceremony.reflip')}</span>}
                </span>
              );
            })}
          </div>
        )}

        {(step.kind === 'count' || step.kind === 'marker' || step.kind === 'banner') && (
          <p className="gd-ceremony__line">
            {t('game.ceremony.counting', { name: nameFor(ceremony.firstDrawer) })}
          </p>
        )}
        {(step.kind === 'marker' || step.kind === 'banner') && (
          <p className="gd-ceremony__line gd-ceremony__line--marker">
            {t('game.ceremony.marker', { name: nameFor(ceremony.markerSeat) })}
          </p>
        )}
        {step.kind === 'banner' && (
          <p className="gd-ceremony__banner">
            {t('game.ceremony.leader', { name: nameFor(ceremony.markerSeat) })}
          </p>
        )}

        <p className="gd-ceremony__skip">{t('game.ceremony.skipHint')}</p>
      </div>
    </div>
  );
}
