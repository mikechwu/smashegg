// ActionBar — the acting seat's controls. Play is enabled iff the current
// selection has some PLAYABLE reading (matchSelection, unit-tested); when
// the selection admits several declared forms (the wild-ambiguity case,
// spec §4.4.4 / v1.4 disambiguation) a chooser lists the FULL meaningful-
// distinct set strongest-first (SF end-positions larger-on-top) as CARD
// FACES (docs/research/wild-chooser-ux.md §2.1): substitution chips (the
// physical wild → the face it plays as; identical pairs collapsed ×2), the
// combo name + key rank + SF run demoted to a secondary cue, then the
// post-substitution combo as hand faces. Options whose wilds all play as
// themselves (or with no wilds) render no chips. Unplayable readings stay
// listed (marked) — picking one submits and the server rejects it as
// usual, so the UI never hides a reading a raw client could attempt.
//
// Both playing-phase buttons ALWAYS render in a fixed order (Play left,
// wide gap, Pass right) so a mid-tick reflow can never swap what sits under
// the pointer; Play disables (with a localized reason line, in reserved
// space) when the selection matches nothing, and Pass disables when leading.
// Passing while cards are selected takes a two-tap confirm (Confirm pass?).
// Tribute phases collapse to a single confirm (pay tribute/return tribute) over the glowing
// eligible card. Rejections surface as a dismissible toast, localized by
// error code.

import { useEffect, useState } from 'react';
import type { GuandanAction } from '../../engine/guandan/types';
import { rankOf, suitOf, type Rank } from '../../engine/guandan/cards';
import {
  beatState,
  comboKey,
  declRunText,
  rankText,
  resolveComboFaces,
  substitutionChips,
  wildSubstitutions,
  type PlayMatch,
  type ResolvedFace,
} from './helpers';
import { CardFace, GhostFace, cardLabel, comboRankLabel } from './CardFace';
import { t } from '../i18n';

/** Accessible name of one resolved face: the identity that hits the table
 *  (naturals via cardLabel; suit-blind ghosts as the bare rank). */
function faceLabel(face: ResolvedFace, level: Rank): string {
  if (face.displayRank === null) return face.card === 'BJ' ? t('game.card.bj') : t('game.card.sj');
  if (face.displaySuit === null) return rankText(face.displayRank);
  if (face.displayRank === rankOf(face.card) && face.displaySuit === suitOf(face.card)) {
    return cardLabel(face.card, level);
  }
  return t('game.card.label', {
    suit: t(`game.suit.${face.displaySuit}` as const),
    rank: rankText(face.displayRank),
  });
}

/** The chooser option's aria-label (wild-chooser-ux.md §6): combo label,
 *  one sentence per substitution chip, then the played-as face list — the
 *  card faces themselves are aria-hidden. */
export function optionAria(match: PlayMatch, level: Rank): string {
  const parts: string[] = [];
  const run = declRunText(match.decl);
  parts.push(
    `${t(comboKey(match.decl))} ${comboRankLabel(match.decl)}${run !== null ? ` (${run})` : ''}`,
  );
  for (const chip of substitutionChips(wildSubstitutions(match.cards, match.decl, level))) {
    const card =
      chip.becomesSuit === null
        ? rankText(chip.becomesRank)
        : t('game.card.label', {
            suit: t(`game.suit.${chip.becomesSuit}` as const),
            rank: rankText(chip.becomesRank),
          });
    parts.push(t(chip.count > 1 ? 'game.chooser.becomesBoth' : 'game.chooser.becomes', { card }));
  }
  const faces = resolveComboFaces(match.cards, match.decl, level)
    .map((face) => faceLabel(face, level))
    .join(' ');
  parts.push(`${t('game.chooser.playedAs')} ${faces}`);
  if (!match.playable) parts.push(t('game.chooser.cannotBeat'));
  return parts.join(' · ');
}

export interface ActionBarProps {
  /** null = this seat is not an expected actor right now. */
  hints: readonly GuandanAction[] | null;
  phase: string;
  /** Current level — drives the wild-substitution derivation and marker. */
  level: Rank;
  /** Distinct decl interpretations of the current selection. */
  matches: readonly PlayMatch[];
  passAvailable: boolean;
  /** How many cards are currently selected — drives the disabled-Play
   *  reason line and the pass-with-selection confirm step. */
  selectionCount: number;
  /** Tribute confirm: which action the single selected eligible card maps
   *  to, or null when the selection doesn't qualify. */
  tributeAction: Extract<GuandanAction, { type: 'payTribute' | 'returnTribute' }> | null;
  tributePhase: 'payTribute' | 'returnTribute' | null;
  chooserOpen: boolean;
  onPlay: (match: PlayMatch) => void;
  onOpenChooser: () => void;
  onCloseChooser: () => void;
  onPass: () => void;
  onTribute: () => void;
  onAntiDecision: (invoke: boolean) => void;
}

export function ActionBar(props: ActionBarProps) {
  const {
    hints,
    phase,
    level,
    matches,
    passAvailable,
    selectionCount,
    tributeAction,
    tributePhase,
    chooserOpen,
  } = props;

  // Two-tap pass confirm: armed by the first Pass tap while cards are
  // selected; any selection or hint change disarms it.
  const [passArmed, setPassArmed] = useState(false);
  useEffect(() => {
    setPassArmed(false);
  }, [selectionCount, hints]);

  if (hints === null) return null;

  if (phase === 'antiTributeDecision') {
    return (
      <div className="gd-actions">
        <button type="button" className="gd-actions__primary" onClick={() => props.onAntiDecision(true)}>
          {t('game.action.antiInvoke')}
        </button>
        <button type="button" onClick={() => props.onAntiDecision(false)}>
          {t('game.action.antiDecline')}
        </button>
      </div>
    );
  }

  if (tributePhase !== null) {
    return (
      <div className="gd-actions">
        {/* The selection hint moved onto the PLAY DESK (elder round, D1) —
            this branch is the confirm button alone now. */}
        <button
          type="button"
          className="gd-actions__primary"
          disabled={tributeAction === null}
          onClick={props.onTribute}
        >
          {tributePhase === 'payTribute' ? t('game.action.payTribute') : t('game.action.returnTribute')}
        </button>
      </div>
    );
  }

  // Playing phase. Fixed geometry: BOTH buttons always render in the same
  // slots, so nothing that happens between render ticks can move Pass under
  // a tap aimed at Play (or vice versa). The old reason line moved onto the
  // PLAY DESK (elder round, D1: the desk's status line names the staged
  // combo and the beat verdict BEFORE commit — a failure-only line here was
  // half the misread problem); beatState still decides which button carries
  // the primary treatment.
  // Play enables iff SOME reading is playable; a valid-but-multi-reading
  // selection always opens the chooser (declaration required, spec §4.4.4)
  // — with a non-empty selection the primary action can never silently do
  // nothing, and Pass keeps its own two-tap confirm below.
  const playableCount = matches.reduce((n, m) => n + (m.playable ? 1 : 0), 0);
  const beat = beatState(hints, passAvailable);
  const cannotBeat = beat === 'cannotBeat';
  return (
    <div className="gd-actions">
      <div className="gd-actions__slots">
        <button
          type="button"
          className={cannotBeat ? undefined : 'gd-actions__primary'}
          disabled={playableCount === 0}
          onClick={() => {
            if (matches.length === 1) props.onPlay(matches[0]!);
            else if (matches.length > 1) props.onOpenChooser();
          }}
        >
          {t('game.action.play')}
        </button>
        <span className="gd-actions__passSlot">
          {passArmed && <span className="gd-actions__confirm">{t('game.action.passConfirm')}</span>}
          <button
            type="button"
            className={cannotBeat ? 'gd-actions__primary' : undefined}
            disabled={!passAvailable}
            onClick={() => {
              if (selectionCount > 0 && !passArmed) {
                setPassArmed(true);
                return;
              }
              setPassArmed(false);
              props.onPass();
            }}
          >
            {t('game.action.pass')}
          </button>
        </span>
      </div>
      {chooserOpen && matches.length > 1 && (
        <div className="gd-chooser" role="dialog" aria-label={t('game.chooser.title')}>
          <p className="gd-chooser__title">{t('game.chooser.title')}</p>
          {/* Options scroll internally beyond ~3 entries (non-default
              configs); title and Cancel stay outside the scroll region so
              Cancel is always reachable (§3.2). */}
          <div className="gd-chooser__options">
            {matches.map((match, i) => {
              // Full offered set, strongest first (matchSelection preserves
              // classifyPlays's R5 order — no client re-sorting). Header:
              // substitution chips + the type label (secondary cue; also
              // the zero-chip fallback for wild-free ambiguity); below it
              // the combo as it will hit the table.
              const run = declRunText(match.decl);
              const chips = substitutionChips(wildSubstitutions(match.cards, match.decl, level));
              const faces = resolveComboFaces(match.cards, match.decl, level);
              return (
                <button
                  key={i}
                  type="button"
                  className={'gd-chooser__option' + (match.playable ? '' : ' gd-chooser__unplayable')}
                  aria-label={optionAria(match, level)}
                  onClick={() => props.onPlay(match)}
                >
                  <span className="gd-chooser__header">
                    {chips.map((chip, j) => (
                      <span className="gd-chooser__chip" key={j}>
                        <CardFace card={chip.wild} level={level} size="hand" />
                        <span className="gd-chooser__arrow" aria-hidden="true">
                          →
                        </span>
                        <GhostFace rank={chip.becomesRank} suit={chip.becomesSuit} size="hand" />
                        {chip.count > 1 && <span className="gd-chooser__mult">×{chip.count}</span>}
                      </span>
                    ))}
                    <span className="gd-chooser__label">
                      {t(comboKey(match.decl))} {comboRankLabel(match.decl)}
                      {run !== null && ` (${run})`}
                      {!match.playable && (
                        <span className="gd-chooser__note"> · {t('game.chooser.cannotBeat')}</span>
                      )}
                    </span>
                  </span>
                  <span className="gd-chooser__result" aria-hidden="true">
                    {faces.map((face, j) =>
                      face.viaWild &&
                      (face.displayRank !== rankOf(face.card) ||
                        face.displaySuit !== suitOf(face.card)) ? (
                        <GhostFace
                          key={j}
                          rank={face.displayRank!}
                          suit={face.displaySuit}
                          size="hand"
                        />
                      ) : (
                        <CardFace key={j} card={face.card} level={level} size="hand" />
                      ),
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <button type="button" onClick={props.onCloseChooser}>
            {t('game.chooser.cancel')}
          </button>
        </div>
      )}
    </div>
  );
}
