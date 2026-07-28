// DeckTheme — the FOURTH axis of variation (item 5), following the same
// discipline as the other three (game → pluggable engine; rules → config;
// locale → i18n resources): data-driven, no hardcoding, and the ENGINE
// NEVER LEARNS IT EXISTS — card presentation is pure client rendering keyed
// on (rank, suit).
//
// Contract boundary (enforced structurally, not by convention): a theme
// provides ONLY face content, back art and metrics. Everything that encodes
// GAME STATE is drawn by the framework (CardFace/GhostFace in CardFace.tsx)
// OVER the theme's face — the cinnabar wild marker, selection lift,
// focus ring, tribute glow. Precisely what that guarantees: the REAL marker
// always renders (the framework appends it; a theme has no code path to
// omit it) and always PAINTS ON TOP (.gd-cardframe is an isolated stacking
// context with the marker on its own layer — CSS-pinned by the conformance
// suite), and a theme emitting the marker's own markup fails conformance.
// What it deliberately does NOT claim: code cannot detect a LOOKALIKE decoy
// a hostile theme paints inside its face — that is the 390px eyes-gate's
// job, like every other purely visual property. F11 (2-vs-27 legibility) is
// carried by SeatStack rendering one REAL theme Back per remaining card —
// the stack length IS the count — so it survives any back design by
// construction. TRUE-390px legibility is the hard gate a theme must pass
// visually before shipping (conformance suite covers the code-checkable
// half; the eyes-gate covers the rest — a theme that fails it does not
// ship).

import type { ComponentType } from 'react';
import type { Card, Rank } from '../../engine/guandan/cards';
import type { TranslationKey } from '../i18n';

export type CardFaceSize = 'hand' | 'trick' | 'mini';

export interface DeckThemeMetrics {
  /** Card height/width ratio (1.45 today). Dependent layout math (fan
   *  overlap, chooser 390px arithmetic) reads THIS, never a hardcoded
   *  number. Conformance range: [1.3, 1.6]. */
  aspect: number;
  /** The corner-index legibility floor (px) this theme claims at its
   *  smallest shipped size. Conformance: ≥ 10. */
  cornerIndexMinPx: number;
  /** Fraction of card WIDTH exposed (as a height, in --gd-cardw units) per
   *  covered card in a same-value settled-layout pile — the strip tall
   *  enough to show this theme's OWN covered-card identity mark and no more
   *  (HandFan.tsx's stackOffsetW reads this as its cap). A theme with a
   *  one-line index (lacquer) needs less height than one with a taller
   *  identity column (cinnabar-court's vertical rank+suit strip).
   *  Conformance range: [0.3, 1.0]. */
  stackStripW: number;
  /** CSS color describing this theme's back-art edge. Honest status
   *  (seat-zone round): the F11 mini-fan slivers — the last framework
   *  consumer — were replaced by real CardBack stacks (SeatStack), so no
   *  framework CSS reads this today; it stays in the metrics contract
   *  (conformance-pinned) as the declared token for any future surface that
   *  needs the back palette without rendering the Back component. */
  backEdge: string;
  /** CSS background describing this theme's back fill — same status as
   *  backEdge above: contract-retained, currently consumer-free. */
  backGradient: string;
}

export interface DeckThemeFaceProps {
  card: Card;
  /** Current level — a theme may style the level rank, but the WILD MARKER
   *  itself is framework-drawn and outside the theme's reach. */
  level: Rank;
  size: CardFaceSize;
}

export interface DeckTheme {
  id: string;
  /** Localized display name (the App header switcher, item 3). */
  name: TranslationKey;
  /** Face CONTENT only — rank/suit/joker identity at a size. */
  Face: ComponentType<DeckThemeFaceProps>;
  /** Back art (the deck pile, deal flights, any face-down card). */
  Back: ComponentType<{ size: CardFaceSize }>;
  metrics: DeckThemeMetrics;
}

// --- registry ---------------------------------------------------------------

const registry = new Map<string, DeckTheme>();

export function registerDeckTheme(theme: DeckTheme): void {
  registry.set(theme.id, theme);
}

// ---------------------------------------------------------------------------
// THE COVERED-CARD REVEAL IS A SHARED BUDGET, NOT ART FREEDOM (round M2).
//
// `stackStripW` is declared per theme as the height its covered-card identity mark needs.
// It is also the single largest multiplier on the hand fan's HEIGHT: a stacked column of n
// cards is `aspect + reveal*(n-1)` card widths tall, so the strip spends the same vertical
// budget the trick well, the desk and the action row spend. The type has always allowed
// [0.3, 1.0], which presents a layout-unsafe value as conforming — and one shipped: a 0.841
// strip puts the must-see set out of reach at one scroll position on roughly half of deals.
//
// So the contract is now: A THEME REQUESTS A STRIP; THE FRAMEWORK OWNS THE CEILING. The
// ceiling is DERIVED, not stored, so it cannot go stale when the card size or the depth
// floor moves — both have moved twice in the last four rounds.
//
// This is deliberately NOT a silent clamp. A theme rendered at a strip its designer did not
// choose is a different design, and quietly substituting one is the failure mode the whole
// arc has been unpicking. `stripCeilingFor` states the number; callers decide.
// ---------------------------------------------------------------------------

/** The largest covered-card reveal that still fits hands of total depth `K` at card width
 *  `w`, in card-width units. See status/MODEL.md `stripCeiling`.
 *
 *  `spanBudget` is the vertical room the fan has once the desk, the trick well and the fan's
 *  own chrome are paid for, at the reference inner height. */
export function stripCeilingFor(cardW: number, depthFloor: number, spanBudget = 436.0, aspect = 1.45): number {
  return (spanBudget / cardW - 4 * aspect) / (depthFloor - 2);
}

/** The largest reveal for which the COLLAPSED fan-height form stays exact at every depth the
 *  shoe can produce — `revealBudget / (maxColumnDepth - 1)`, i.e. 2.95/7 = 0.4214.
 *
 *  THIS IS A DIFFERENT THRESHOLD FROM `stripCeilingFor`, AND IT IS THE LOOSER-LOOKING ONE
 *  THAT BITES. The ceiling above asks "do hands of depth K still fit?" — a gate on
 *  FEASIBILITY. This asks "is the simple height formula still exact for this theme?" — a
 *  condition on whether that theme's RATES can be computed the cheap way. At the shipped
 *  card the two are 0.447 and 0.4214, so a theme requesting 0.43 passes the gate and yet its
 *  depth-8 columns hit the reveal budget, which makes every rate computed for it from the
 *  collapsed form wrong while the gate stays green. That is a smaller version of the defect
 *  found in round M0.
 *
 *  Exceeding this is LEGAL. It is not a defect, it is a fact about which formula that
 *  theme's rates need — so it is detected and reported, never refused. Lacquer's 0.42 sits
 *  0.00143 below the line, which is the whole margin on which "every lacquer figure stands"
 *  rests. */
export function collapsedExactCeilingFor(maxColumnDepth = 8, revealBudget = 2.95): number {
  return revealBudget / (maxColumnDepth - 1);
}

/** Themes whose rates must be computed with the CAPPED height form rather than the collapsed
 *  one. Not an error state — a routing fact about those themes' arithmetic. */
export function themesNeedingCappedRates(maxColumnDepth = 8): { id: string; requested: number; ceiling: number }[] {
  const ceiling = collapsedExactCeilingFor(maxColumnDepth);
  return deckThemes()
    .filter((t) => t.metrics.stackStripW > ceiling)
    .map((t) => ({ id: t.id, requested: t.metrics.stackStripW, ceiling }));
}

/** Themes whose requested strip exceeds the ceiling at the shipped card. Empty is the
 *  healthy state; a non-empty result is a layout defect with a name attached. */
export function themesOverStripCeiling(cardW: number, depthFloor: number): { id: string; requested: number; ceiling: number }[] {
  const ceiling = stripCeilingFor(cardW, depthFloor);
  return deckThemes()
    .filter((t) => t.metrics.stackStripW > ceiling)
    .map((t) => ({ id: t.id, requested: t.metrics.stackStripW, ceiling }));
}

export function deckThemes(): DeckTheme[] {
  return [...registry.values()];
}

export const DEFAULT_DECK_THEME_ID = 'lacquer';
const THEME_STORAGE_KEY = 'pref:deckTheme';

// In-memory override (item 2): set by setDeckTheme(), read first by
// activeDeckTheme(). Kept SEPARATE from the localStorage read below rather
// than an eagerly-initialized cache, because registration is a SIDE EFFECT
// of importing a theme module (CardFace.tsx's `import './themes/lacquer'`)
// that can run after this module's top-level code — an eager read here
// could race an empty registry. null means "no override; fall through to
// storage", so the switch still applies for the session even when
// localStorage itself is unavailable (private mode, storage quota, etc).
let overrideThemeId: string | null = null;

const listeners = new Set<() => void>();

/** The active theme: a per-client preference (same idiom as handSort),
 *  defaulting to DEFAULT_DECK_THEME_ID. Every render site goes through this
 *  (directly, or via useDeckTheme() in components — see sibling
 *  useDeckTheme.ts). */
export function activeDeckTheme(): DeckTheme {
  let id = overrideThemeId ?? DEFAULT_DECK_THEME_ID;
  if (overrideThemeId === null) {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored !== null && registry.has(stored)) id = stored;
      }
    } catch {
      // storage unavailable — the default carries.
    }
  }
  const theme = registry.get(id);
  if (!theme) throw new Error(`deck theme registry empty: missing '${id}'`);
  return theme;
}

/** Set the active deck-theme preference (item 2, the switcher's write
 *  side): an unregistered id is silently rejected — no crash, no persist,
 *  no notify — the same "invalid input is a no-op" idiom as setLocale.
 *  Notifies every subscriber (useDeckTheme() render sites — faces, backs,
 *  SeatStack's aspect metric) so the switch is a pure re-render everywhere
 *  at once. */
export function setDeckTheme(id: string): void {
  if (!registry.has(id)) return;
  overrideThemeId = id;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    // storage unavailable — overrideThemeId still carries the switch for
    // this session, it just doesn't persist.
  }
  for (const listener of listeners) listener();
}

/** Subscribe to deck-theme preference changes. Returns an unsubscribe
 *  function — the useSyncExternalStore subscribe half (see useDeckTheme.ts,
 *  kept out of this module so theme.ts stays React-free). */
export function subscribeDeckTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
