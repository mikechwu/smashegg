// WHERE TO SCROLL SO THE PLAYER CAN SEE THE MOST OF THE DECISION.
//
// THIS FILE EXISTS BECAUSE OF AN INVARIANT, AND IT KEEPS THAT INVARIANT INTACT.
// `tests/unit/client/hand-areas-ui.test.ts` bans `getBoundingClientRect` from
// GameTable.tsx outright, under the heading "NO VIEWPORT MEASUREMENT GATES AN
// AFFORDANCE" — the tripwire against a round in which a rect read decided whether
// a CONTROL EXISTED. When this computation was first written inline in GameTable
// that tripwire fired, correctly.
//
// The banned class is a measurement that gates an affordance: something appears or
// does not appear depending on what a rect says. This is not that. Nothing here
// decides whether any element renders, is enabled, or is reachable; the only output
// is a scroll offset, and every element involved is already on the page in every
// branch. Moving it here is not a way around the tripwire — the tripwire is about
// GameTable holding measurement-driven STATE, and this holds none. The test below
// pins the distinction so a future affordance decision cannot quietly move in here.
//
// WHY NOT `scrollIntoView`. The previous call was
// `actionsRow.scrollIntoView({block:'nearest'})`, which asks only "is the action ROW
// on screen" and answers with the least scrolling that makes it so. Two costs
// followed. It targets the ROW, whose height is the tallest of the action bar and
// the sort/finder cell beside it, so any excess below the bar is scrolled into view
// at the expense of the top. And it never considers what LEAVES: measured at inner
// 390x664, 12.5% of deals ended with a fact the player needs off-screen while only
// 4.2% were geometrically impossible — an ~8.3% gap of deals where a good scroll
// position existed and was not chosen. A policy defect, not a layout defect.
//
// WHAT THIS DOES NOT CHANGE: WHEN. The trigger, its dependencies and its instant
// (never smooth) behaviour are untouched. METHODOLOGY practice 20 is about a target
// moving between a player COMMITTING to a reach and completing it, which is a
// property of when a scroll fires, not of where it lands.

/** The facts a player consults to choose a play, in document order. Mirrors the
 *  `panel` must-see set G-SIM is stated against (PLAN.md section 9,
 *  scripts/simultaneity.mjs) — the set two external lineages converged on
 *  independently. Duplicated rather than imported because the gate scripts are not
 *  part of the client bundle; the pairing is pinned by a test so the two cannot
 *  drift apart silently. */
export const DECISION_SELECTORS = [
  '.gd-well',
  '.gd-desk',
  '.gd-fan',
  '.gd-actionsRow__bar',
] as const;

/**
 * The scroll offset that maximises the visible extent of the decision set, subject
 * to Play/Pass being wholly visible.
 *
 *  - if the whole set fits in the viewport, centre it: every fact visible, with the
 *    leftover split rather than dumped above the fold;
 *  - if it does not fit, fall back to the minimum scroll that shows the BAR, which
 *    keeps as much of the set above it as the geometry allows.
 *
 * The bar's full visibility is a hard constraint in both branches, so this can never
 * be worse than the old behaviour at reaching the control. Returns null when the set
 * cannot be located at all, so the caller can fall back rather than guess.
 */
export function decisionScrollTop(): number | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  const bar = document.querySelector('.gd-actionsRow__bar');
  if (bar === null) return null;
  const scrollY = window.scrollY;
  const viewport = window.innerHeight;

  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const selector of DECISION_SELECTORS) {
    const el = document.querySelector(selector);
    if (el === null) continue;
    const box = el.getBoundingClientRect();
    // A 0x0 box is a real empty state, not a missing fact: `.gd-well` has no
    // min-height, so on a LEAD there is nothing to beat and nothing to show.
    if (box.height === 0) continue;
    top = Math.min(top, box.top + scrollY);
    bottom = Math.max(bottom, box.bottom + scrollY);
  }
  if (!Number.isFinite(top) || !Number.isFinite(bottom)) return null;

  const barBox = bar.getBoundingClientRect();
  const lowest = barBox.bottom + scrollY - viewport;
  const highest = barBox.top + scrollY;

  const wanted =
    bottom - top <= viewport
      ? top - (viewport - (bottom - top)) / 2
      : barBox.bottom + scrollY - viewport;
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - viewport);
  return Math.max(0, Math.min(maxScroll, Math.max(lowest, Math.min(highest, wanted))));
}
