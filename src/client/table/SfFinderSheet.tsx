// SfFinderSheet — the straight-flush finder's surface
// (docs/research/straight-flush-finder.md, owner Decisions 5 + 6).
//
// WRITTEN FROM THE PLAYER'S SIDE, not the data's. At a real table you pull a
// flush out of your hand, set it aside, and look at what is left; that is the
// whole feature, so the sheet answers exactly three questions, in the same
// place, every time:
//     SET ASIDE  — which cards go aside (real card faces; a wild shows as the
//                card it stands for, the wild-chooser precedent)
//     LEFT WITH  — what you would be left with (a short factual read, and the
//                cards themselves one tap away)
//     PICK THIS  — can I take it
//
// WHY ONE AT A TIME (owner Decision 5): 390px cannot hold N card fans side by
// side, and the senior-UI evidence is unambiguous — few controls, big faces,
// one thing to look at. So arrangements are STEPPED through, and the two zones
// keep their screen position across pages: flipping reads as ONE quantity
// changing in place (bomb x2 -> bomb x1), never a layout diff. The count in the
// header ("3 ways") is what tells the player alternatives exist — the
// sheet never dumps them.
//
// HONESTY (UX audit): the remainder line names only ONE holding, so it is NOT
// "the full quality at a glance". The copy says so in those terms ("only one
// holding is named here") — naming the RULE, not just pointing at the cards —
// and the real cards are always one tap away; the player's own judgement stays
// the authority. Nothing here advises: the tags are the engine's closed FACTUAL
// vocabulary, rendered verbatim, and the staging button says what it actually
// does ("put in the play area") because "pick this one" + a closing sheet read
// as "I already played".
//
// This component OWNS NO GAME LOGIC. Arrangements come from the pure engine
// finder; staging just hands the parent a set of hand indices, which flows
// through the ordinary selection → matchSelection → server path.

import { useState } from 'react';
import type { Card, Rank } from '../../engine/guandan/cards';
import type {
  Decomposition,
  RemainderTag,
  SfFinderResult,
  SfGroup,
} from '../../engine/guandan/straight-flush-finder';
import { SF_FINDER_PRIMARY_SHOWN } from '../../engine/guandan/straight-flush-finder';
import { resolveComboFaces } from './helpers';
import { CardFace, GhostFace, comboDeclNode } from './CardFace';
import { HandFan } from './HandFan';
import { rankOf, sortCards, suitOf } from '../../engine/guandan/cards';
import { t } from '../i18n';
import type { TranslationKey } from '../i18n';
import { tNode } from '../i18n/react';

export interface SfFinderSheetProps {
  result: SfFinderResult;
  level: Rank;
  /** Show every frontier row the engine returned, not just the primary few. */
  expanded: boolean;
  onExpand: () => void;
  onClose: () => void;
  /** Stage ONE straight flush's cards (owner Decision 6: a single SF is one
   *  legal bomb; a multi-SF arrangement is view-only). The parent maps the cards
   *  onto hand indices and populates the ordinary selection. */
  onStage: (cards: readonly Card[]) => void;
}

/** The closed factual tag vocabulary → its localized phrase. Counted kinds carry
 *  their count; presence kinds are a bare word. Exhaustive by construction: a
 *  new tag kind is a COMPILE error here, which is the point — the vocabulary is
 *  pinned so nobody can quietly add an advisory word. */
const TAG_KEYS: Record<RemainderTag['kind'], TranslationKey> = {
  bomb: 'game.tag.bomb',
  straightFlush: 'game.tag.straightFlush',
  run: 'game.tag.run',
  fullHouse: 'game.tag.fullHouse',
  triple: 'game.tag.triple',
  pair: 'game.tag.pair',
  scatter: 'game.tag.scatter',
  cardsLeft: 'game.tag.cardsLeft',
};

/** Stable empty collections + no-op so the read-only fan never re-renders on new
 *  object identities and can never be interacted with. */
const EMPTY_SELECTION: ReadonlySet<number> = new Set<number>();
const EMPTY_GLOW: ReadonlySet<Card> = new Set<Card>();
const noop = (): void => {};

export function tagText(tag: RemainderTag): string {
  const key = TAG_KEYS[tag.kind];
  return tag.count === undefined ? t(key) : t(key, { count: tag.count });
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
  onStage,
}: {
  decomposition: Decomposition;
  level: Rank;
  onStage: (cards: readonly Card[]) => void;
}) {
  const [showCards, setShowCards] = useState(false);
  const single = decomposition.groups.length === 1;

  return (
    <div className="gd-sf__page">
      {/* ZONE 1 — what goes aside. */}
      <p className="gd-sf__zoneLabel">{t('game.sf.take')}</p>
      {/* This frames the rows BELOW it, so it leads them rather than trailing
          them — where it sat before, it peeked out from under the sticky
          remainder footer (visual QA). */}
      {!single && <p className="gd-sf__viewOnly">{t('game.sf.viewOnly')}</p>}
      {decomposition.groups.map((group, i) => (
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
          {/* Owner Decision 6: a single SF is one legal bomb and can be staged;
              each row of a multi-SF arrangement is independently stageable. */}
          <button
            type="button"
            className="gd-sf__stage"
            aria-label={t('game.sf.stageAria')}
            onClick={() => onStage(group.cards)}
          >
            {t('game.sf.stage')}
          </button>
        </div>
      ))}
      {/* ZONE 2 — what is left. STICKY to the foot of the sheet: with three
          flush rows above it (a four-suit crosshatch) it was pushed below the
          fold, and its screen position moved with the number of flushes — which
          destroys the whole point, that stepping between arrangements reads as
          ONE quantity changing in the SAME place. Caught in visual QA at 390px. */}
      {/* Sticky while COLLAPSED (comparison mode: the footer holds one position so
          stepping moves one quantity). Once the cards are revealed the player has
          stopped comparing and started INSPECTING, so it becomes a normal block
          that scrolls with its own cards — otherwise the summary stayed pinned
          while the truth it summarises was pushed out of reach below it. */}
      <div className={showCards ? 'gd-sf__leaves gd-sf__leaves--open' : 'gd-sf__leaves'}>
        <p className="gd-sf__zoneLabel">{t('game.sf.leaves')}</p>
        <div className="gd-sf__scoreboard">
          {decomposition.tags.map((tag, i) => (
            <span className={`gd-sf__tag gd-sf__tag--${tag.kind}`} key={i}>
              {tagText(tag)}
            </span>
          ))}
        </div>
        {/* An EMPTY remainder has nothing to reveal — offering "see the cards
            left" there is a press that opens nothing (the no-silent-no-op rule
            cuts both ways: never offer an action that cannot answer). */}
        {decomposition.remainder.length > 0 && (
          <>
            <p className="gd-sf__partial">{t('game.sf.partialRead')}</p>
            <button
              type="button"
              className="gd-sf__reveal"
              aria-expanded={showCards}
              onClick={() => setShowCards((v) => !v)}
            >
              {showCards ? t('game.sf.hideRemainder') : t('game.sf.showRemainder')}
            </button>
          </>
        )}
        {showCards && decomposition.remainder.length > 0 && (
          // The remainder is drawn by the HAND FAN ITSELF, read-only. The player
          // reads "what I'd be left with" in exactly the layout they read their
          // own hand in — same same-value columns, same overlap, same faces —
          // instead of learning a second way to scan cards (owner). A plain
          // wrapped grid looked like a different kind of object to re-parse.
          <div className="gd-sf__remainderFan">
            <HandFan
              hand={sortCards(decomposition.remainder, level)}
              level={level}
              selected={EMPTY_SELECTION}
              onToggle={noop}
              glow={EMPTY_GLOW}
              readOnly
              label={t('game.sf.leaves')}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function SfFinderSheet(props: SfFinderSheetProps) {
  const { result, level, expanded, onExpand, onClose, onStage } = props;
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

      {/* The stepper. Big targets, and the position is stated in words as well
          as arrows so it is never arrow-only. */}
      <div className="gd-sf__stepper">
        <button
          type="button"
          className="gd-sf__step"
          aria-label={t('game.sf.prev')}
          disabled={index === 0}
          onClick={() => setPage(index - 1)}
        >
          ‹
        </button>
        <span className="gd-sf__position" role="status">
          {t('game.sf.position', { index: index + 1, total })}
        </span>
        <button
          type="button"
          className="gd-sf__step"
          aria-label={t('game.sf.next')}
          disabled={index >= total - 1}
          onClick={() => setPage(index + 1)}
        >
          ›
        </button>
      </div>

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
        onStage={onStage}
      />
    </div>
  );
}
