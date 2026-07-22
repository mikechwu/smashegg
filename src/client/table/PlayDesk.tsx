// PlayDesk — the play desk (elder-visibility round, docs/research/
// state-visibility.md, D1–D7): ONE surface between the fan and the action
// buttons that concentrates the four facts an elder loses in distributed
// micro-chrome — whose turn it is, the running clock, what is staged, and
// what combination it forms — the digital translation of pulling intended
// cards proud of the fan into a little group before the throw.
//
// The loudness hierarchy is the design's spine and is non-negotiable:
// the loud shell (cinnabar edge, title, big clock) exists ONLY for the
// viewer's own turn ('play'/'tribute'); the quiet pre-stage ('quiet',
// D2) is faces + naming with no shell and no clock; on everyone else's
// turn the desk is absent entirely (the parent unmounts it) — absence
// from the hand zone IS the "not your moment" signal. One ~200ms
// entrance, then STEADY: no blink, no loop (WCAG 2.3.1; elders disengage
// slowly from attentional capture). Urgency is D5's discrete calm ramp —
// stage classes + the fraction bar + bold copy at ≤10s — never a pulse,
// so reduced motion loses nothing (color + weight + words carry it).
//
// Guard 5: no classification logic lives here. Naming = deskStage's
// decls (matchSelection's matches on your turn, the engine's
// classifyPlays in the quiet form) rendered through the same
// comboDeclNode label (comboKey + comboRankLabel + declRunText + the
// shared SuitMark part) the chooser uses; the beat verdict is beatState
// over the server's own hints. Untimed rooms: dueSeconds stays null, the
// clock column simply never renders — no empty chrome, no fake numbers.

import type { ReactNode } from 'react';
import type { Card, Rank } from '../../engine/guandan/cards';
import { CardFace, cardLabel, comboDeclNode } from './CardFace';
import { deskFraction, deskUrgency, DESK_STAGE_MAX_FACES, type DeskStage } from './helpers';
import { t } from '../i18n';
import { tNode } from '../i18n/react';

export interface PlayDeskProps {
  mode: 'quiet' | 'play' | 'tribute';
  /** Whole seconds on the VIEWER's own running clock — the parent passes
   *  null in the quiet form and in untimed rooms (no clock chrome). */
  dueSeconds: number | null;
  /** The running budget from the room's timing preset (shared
   *  timeoutMsFor) — null hides the support bar, never the seconds. */
  totalMs: number | null;
  /** True when the running clock is the post-deal planning window. */
  planning: boolean;
  level: Rank;
  /** Staged cards with their ORIGINAL hand indices (tap = unstage). */
  staged: readonly { card: Card; index: number }[];
  stage: DeskStage;
  /** beatState over the server's hints — play mode only, else null. */
  beat: 'lead' | 'canBeat' | 'cannotBeat' | null;
  tributePhase: 'payTribute' | 'returnTribute' | null;
  /** True when the staged tribute card is an eligible one (the confirm
   *  button would act) — drives the about-to-pay/return line. */
  tributeReady: boolean;
  onUnstage: (index: number) => void;
  /** One-tap clear (playtest round: one-by-one deselection is painful at
   *  elder finger precision). Renders ONLY with a non-empty stage; the
   *  parent empties the ONE selection set, which zeroes every derived
   *  surface at once — the fan's lifts AND this desk's faces/combo line. */
  onClearAll: () => void;
}

export function PlayDesk(props: PlayDeskProps) {
  const { mode, dueSeconds, totalMs, planning, level, staged, stage, beat, tributePhase, tributeReady, onUnstage, onClearAll } = props;
  const loud = mode !== 'quiet';
  const urgency = loud ? deskUrgency(dueSeconds, totalMs) : null;
  const fraction = loud ? deskFraction(dueSeconds, totalMs) : null;

  // At URGENT the hurry copy BECOMES the title (visual-round find: a
  // separate hurry line pushed the Play/Pass row below the 390px fold at
  // the exact moment the elder must reach it — the title slot is the
  // desk's biggest text and costs zero extra height).
  const title = !loud
    ? null
    : mode === 'tribute'
      ? tributePhase === 'returnTribute'
        ? t('game.desk.tributeReturn')
        : t('game.desk.tributePay')
      : urgency === 'urgent' && dueSeconds !== null
        ? t('game.desk.hurry', { seconds: dueSeconds })
        : planning
          ? t('game.desk.yourTurnPlanning')
          : t('game.desk.yourTurn');

  // The status line: what the staged set IS (or what to do when nothing is
  // staged). The quiet form only ever names — playability needs hints.
  // A node, not a string: the single-reading line embeds comboDeclNode
  // (the chooser's own vocabulary — never a parallel naming path), whose
  // straight-flush run draws its suit as the shared SuitMark part.
  let status: ReactNode = null;
  let statusHint: string | null = null;
  if (staged.length === 0) {
    if (mode === 'tribute') {
      status = t('game.desk.tributeEmpty');
    } else if (mode === 'play') {
      status =
        beat === 'lead'
          ? t('game.desk.lead')
          : beat === 'cannotBeat'
            ? t('game.desk.cannotBeat')
            : t('game.desk.canBeat');
      if (beat !== 'cannotBeat') statusHint = t('game.desk.emptyHint');
    }
  } else if (mode === 'tribute') {
    status = tributeReady
      ? tributePhase === 'returnTribute'
        ? t('game.desk.aboutToReturn')
        : t('game.desk.aboutToPay')
      : t('game.desk.tributeEmpty');
  } else if (stage.decls.length === 0) {
    status = t('game.desk.noForm');
  } else if (stage.decls.length === 1) {
    // The beat verdict rides the staged line BOTH ways (panel MED, Grok:
    // the plan's copy carries the positive verdict too, not cannot-only):
    // a playable FOLLOWING reading says it beats the table; an unplayable
    // one says it does not. A lead has nothing to beat — no suffix; the
    // quiet form cannot know playability (playableCount null) — no suffix.
    const verdict =
      stage.playableCount === 0
        ? t('game.desk.cannotBeatTop')
        : mode === 'play' && beat === 'canBeat' && (stage.playableCount ?? 0) > 0
          ? t('game.desk.beatsTop')
          : null;
    status = (
      <>
        {tNode('game.desk.aboutToPlay', { combo: comboDeclNode(stage.decls[0]!) })}
        {verdict !== null && ` · ${verdict}`}
      </>
    );
  } else {
    status = t('game.desk.multiReading');
    if (mode === 'play') statusHint = t('game.desk.multiReadingHint');
  }

  const shown = staged.slice(0, DESK_STAGE_MAX_FACES);
  const overflow = staged.length - shown.length;

  const classes = ['gd-desk', `gd-desk--${mode}`];
  if (urgency !== null && urgency !== 'calm') classes.push(`gd-desk--${urgency}`);
  // The planning window is its own visual REGISTER (plan §2b; panel MED,
  // Grok: the copy alone was half the register) — goldleaf edge instead
  // of cinnabar, so a long first think never reads as turn pressure.
  if (loud && planning) classes.push('gd-desk--planning');

  return (
    <div className={classes.join(' ')}>
      {title !== null && (
        <div className="gd-desk__titleRow">
          <p className="gd-desk__title" role="status">
            {title}
          </p>
          {dueSeconds !== null && (
            <span className="gd-desk__clock" aria-label={t('game.turn.countdown', { seconds: dueSeconds })}>
              {dueSeconds}
            </span>
          )}
        </div>
      )}
      {fraction !== null && (
        <span className="gd-desk__bar" aria-hidden="true">
          <span className="gd-desk__barFill" style={{ width: `${Math.round(fraction * 1000) / 10}%` }} />
        </span>
      )}
      {staged.length > 0 && (
        <div className="gd-desk__stage">
          {shown.map(({ card, index }) => (
            <button
              key={index}
              type="button"
              className="gd-desk__stagedCard"
              aria-label={t('game.desk.unstage', { card: cardLabel(card, level) })}
              onClick={() => onUnstage(index)}
            >
              <CardFace card={card} level={level} size="hand" />
            </button>
          ))}
          {overflow > 0 && <span className="gd-desk__more">+{overflow}</span>}
          <button
            type="button"
            className="gd-desk__clear"
            aria-label={t('game.desk.clearAllAria')}
            onClick={onClearAll}
          >
            {t('game.desk.clearAll')}
          </button>
        </div>
      )}
      {status !== null && <p className="gd-desk__status">{status}</p>}
      {statusHint !== null && <p className="gd-desk__statusHint">{statusHint}</p>}
    </div>
  );
}
