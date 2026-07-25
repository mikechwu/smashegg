// SfFinderSheet — the straight-flush finder's surface
// (docs/research/straight-flush-finder.md, owner Decisions 5 + 6).
//
// WRITTEN FROM THE PLAYER'S SIDE, not the data's. At a real table you pull a
// flush out of your hand, set it aside, and look at what is left; that is the
// whole feature, so the sheet answers exactly three questions, in the same
// place, every time:
//     SET ASIDE  — which cards go aside (real card faces; a wild shows as the
//                card it stands for, the wild-chooser precedent)
//     SEND IT    — put that flush in a sort area
//
// WHAT SORT AREAS CHANGED (owner round, after the areas UI landed). The panel
// used to DESCRIBE the remainder — tag chips, a short-read disclaimer, and a
// "see the cards left" reveal — because the player had nowhere to actually put
// a flush. Now they can pull it aside for real and look at their own hand, so
// the description was replaced by the thing itself. The remainder MODEL is
// untouched: the engine still computes remainder quality, because ranking is
// the Pareto frontier of (SF value, remainder quality) and without it the
// ranking would collapse to SF strength alone and bury the "break it and I have
// two bombs" arrangement this feature exists to surface. This round subtracted
// UI, not correctness.
//
// WHY ONE AT A TIME (owner Decision 5): 390px cannot hold N card fans side by
// side, and the senior-UI evidence is unambiguous — few controls, big faces,
// one thing to look at. So arrangements are STEPPED through, and the two zones
// keep their screen position across pages: flipping reads as ONE quantity
// changing in place (bomb x2 -> bomb x1), never a layout diff. The count in the
// header ("3 ways") is what tells the player alternatives exist — the
// sheet never dumps them.
//
// DECISION 6 UPGRADED, NOT REVERSED. The old rule was: a single flush may be
// staged (it is one legal bomb), a multi-flush arrangement is view-only. Its
// REASON was that two flushes are not one legal play, so they cannot both be
// staged for COMMIT. Sending to a sort area is not committing — it is
// organizing — so every flush in an arrangement now carries its own send
// button, and the reason for the old restriction simply does not apply to the
// new action. Nothing about what may be PLAYED changed.
//
// This component OWNS NO GAME LOGIC. Arrangements come from the pure engine
// finder; sending hands the parent a card set, which the parent moves into a
// sort area through the SAME applyMove every other area control uses.

import { useState } from 'react';
import type { Card, Rank } from '../../engine/guandan/cards';
import type {
  Decomposition,
  SfFinderResult,
  SfGroup,
} from '../../engine/guandan/straight-flush-finder';
import { SF_FINDER_PRIMARY_SHOWN } from '../../engine/guandan/straight-flush-finder';
import { resolveComboFaces } from './helpers';
import { CardFace, GhostFace, comboDeclNode } from './CardFace';
import { rankOf, suitOf } from '../../engine/guandan/cards';
import { t } from '../i18n';
import { tNode } from '../i18n/react';

export interface SfFinderSheetProps {
  result: SfFinderResult;
  level: Rank;
  /** Show every frontier row the engine returned, not just the primary few. */
  expanded: boolean;
  onExpand: () => void;
  onClose: () => void;
  /** Send ONE straight flush to a sort area. The parent maps the cards onto hand
   *  indices and moves them through the ordinary area machinery; nothing is
   *  submitted and nothing is staged for play. */
  onSendToArea: (cards: readonly Card[]) => void;
  /** Is this flush ALREADY sitting together in a set-aside area? Drives the
   *  row's confirmation state — pressing send again would move nothing, and a
   *  press that moves nothing must not be offered. */
  isSetAside: (cards: readonly Card[]) => boolean;
  /** Is there anywhere to send a flush at all? False only when the vertical
   *  budget cannot hold even one shelf. The send control is then HIDDEN rather
   *  than shown disabled with an explanation: a control that is not there cannot
   *  be pressed, so there is no unanswered press to explain. That is a different
   *  thing from swallowing a response, which is what the no-silent-no-op rule
   *  actually forbids. */
  canSendToArea: boolean;
}

/** One straight flush, drawn as it would hit the table — wild slots rendered as
 *  the identity they stand for (resolveComboFaces + GhostFace, exactly what the
 *  wild chooser does, so the player meets ONE convention in both places). */
function GroupFaces({ group, level }: { group: SfGroup; level: Rank }) {
  const faces = resolveComboFaces(group.cards, group.forms[0]!, level);
  return (
    <span className="gd-sf__faces">
      {faces.map((face, i) =>
        face.viaWild &&
        (face.displayRank !== rankOf(face.card) || face.displaySuit !== suitOf(face.card)) ? (
          <GhostFace key={i} rank={face.displayRank!} suit={face.displaySuit} size="hand" />
        ) : (
          <CardFace key={i} card={face.card} level={level} size="hand" />
        ),
      )}
    </span>
  );
}

function ArrangementPage({
  decomposition,
  level,
  onSendToArea,
  isSetAside,
  canSendToArea,
}: {
  decomposition: Decomposition;
  level: Rank;
  onSendToArea: (cards: readonly Card[]) => void;
  isSetAside: (cards: readonly Card[]) => boolean;
  canSendToArea: boolean;
}) {
  return (
    <div className="gd-sf__page">
      <p className="gd-sf__zoneLabel">{t('game.sf.take')}</p>
      {decomposition.groups.map((group, i) => {
        const sent = isSetAside(group.cards);
        return (
          <div className="gd-sf__group" key={i}>
            <GroupFaces group={group} level={level} />
            <p className="gd-sf__groupName">
              {comboDeclNode(group.forms[0]!)}
              {/* The end-position pair is ONE set-aside with two playable tops —
                  a footnote, never a second arrangement (research §1). */}
              {group.forms.length > 1 && (
                <span className="gd-sf__alt">
                  {' · '}
                  {tNode('game.sf.alsoPlayableAs', { combo: comboDeclNode(group.forms[1]!) })}
                </span>
              )}
            </p>
            {/* Every flush gets its OWN send control — see the header note on
                Decision 6 being upgraded rather than reversed. Once a flush is
                already set aside the control becomes a STATEMENT, not a button:
                pressing it again would move nothing, and this project does not
                ship presses that do nothing. */}
            {sent ? (
              <p className="gd-sf__sent" role="status">
                {t('game.sf.alreadySetAside')}
              </p>
            ) : (
              canSendToArea && (
                <button
                  type="button"
                  className="gd-sf__stage"
                  aria-label={t('game.sf.sendAria')}
                  onClick={() => onSendToArea(group.cards)}
                >
                  {t('game.sf.send')}
                </button>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SfFinderSheet(props: SfFinderSheetProps) {
  const { result, level, expanded, onExpand, onClose, onSendToArea, isSetAside, canSendToArea } =
    props;
  const [page, setPage] = useState(0);

  // Nothing found. The press STILL gets a visible answer (owner strengthen 2 —
  // the no-silent-no-op class: sit-with-no-name, play-becomes-pass). "Looked,
  // found none" is a different sentence from "did not look", and the player
  // deserves the first one.
  // `found` with an EMPTY list is not reachable from the engine today, but the
  // component would index past the end and crash on it (audit F3). Treat it as
  // the nothing-found state: a wrong-but-calm answer beats a blank screen, and
  // the press is still answered.
  if (!result.found || result.decompositions.length === 0) {
    return (
      <div className="gd-sf" role="dialog" aria-label={t('game.sf.title')}>
        <div className="gd-sf__head">
          <p className="gd-sf__title">{t('game.sf.title')}</p>
          <button type="button" className="gd-sf__close" onClick={onClose}>
            {t('game.sf.close')}
          </button>
        </div>
        <p className="gd-sf__empty" role="status">
          {t('game.sf.none')}
        </p>
      </div>
    );
  }

  const shown = expanded
    ? result.decompositions
    : result.decompositions.slice(0, SF_FINDER_PRIMARY_SHOWN);
  const index = Math.min(page, shown.length - 1);
  const current = shown[index]!;
  const total = shown.length;

  return (
    <div className="gd-sf gd-sf--paged" role="dialog" aria-label={t('game.sf.title')}>
      <div className="gd-sf__head">
        <p className="gd-sf__title">{t('game.sf.title')}</p>
        <span className="gd-sf__count">
          {result.totalFound === 1
            ? t('game.sf.foundOne')
            : t('game.sf.foundCount', { count: result.totalFound })}
        </span>
        <button type="button" className="gd-sf__close" onClick={onClose}>
          {t('game.sf.close')}
        </button>
      </div>

      {/* THE PAGER. Real players did not realise several arrangements existed:
          the old form was an arrow stepper whose position line ("way 1 of 3")
          was small header-adjacent text, and with a single arrangement it still
          rendered pager chrome that implied movement where there was none.
          Now: a sentence that says how many ways there are, and one directly
          tappable chip per way. Chips beat arrows here — any way is ONE press
          away instead of up to five, and "which of these am I on" is answered by
          position rather than by reading a number. The engine caps the shown
          list at 6, so at most 6 chips ever render and they fit 342px. */}
      {total > 1 ? (
        <div className="gd-sf__ways">
          <p className="gd-sf__waysLead" role="status">
            {t('game.sf.waysLead', { total })}
          </p>
          <div className="gd-sf__wayChips">
            {shown.map((_, i) => (
              <button
                key={i}
                type="button"
                className={i === index ? 'gd-sf__way gd-sf__way--on' : 'gd-sf__way'}
                aria-current={i === index ? 'true' : undefined}
                aria-label={t('game.sf.wayAria', { index: i + 1, total })}
                onClick={() => setPage(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ONE way: no chips, no arrows, nothing that suggests a second page
           exists. The sentence still ANSWERS the question the chips answer, so a
           later hand showing three chips is an increase in detail rather than a
           surprise. */
        <p className="gd-sf__waysLead" role="status">
          {t('game.sf.waysOne')}
        </p>
      )}

      {/* The display cap CAN hide non-dominated arrangements, so say so and offer
          the rest — never silent truncation (research §3). It sits HERE, directly
          under the stepper: at the bottom of the sheet it fell below the fold, so
          the player saw a header saying "7 ways" beside a stepper saying "of 4"
          with no explanation anywhere on screen (visual QA at 390px). */}
      {!expanded && result.decompositions.length > shown.length && (
        <div className="gd-sf__moreRow">
          <p className="gd-sf__more">
            {/* The total quoted here is the SAME number the header shows
                (totalFound — how many ways actually exist). Quoting the engine's
                internal return cap instead put THREE different numbers on screen
                at once — "7 ways" in the header, "of 6" here, "of 4" in the
                stepper — which reads as broken arithmetic (visual QA). */}
            {t('game.sf.moreExist', { shown: shown.length, total: result.totalFound })}
          </p>
          <button type="button" className="gd-sf__expand" onClick={onExpand}>
            {t('game.sf.showMore')}
          </button>
        </div>
      )}

      <ArrangementPage
        // Keyed by page so the per-page "see the cards" disclosure resets when
        // stepping — a page must never inherit the previous one's open state.
        key={index}
        decomposition={current}
        level={level}
        onSendToArea={onSendToArea}
        isSetAside={isSetAside}
        canSendToArea={canSendToArea}
      />
    </div>
  );
}
