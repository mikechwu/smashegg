// THE AXIS REGISTRY — every dimension a measurement can vary, and what each gate
// pins it to.
//
// WHY THIS EXISTS. Three times now, a measurement has been found to be pinned at a
// value the product is not in, and all three were found BY ACCIDENT:
//   - inner height 844, a phone SCREEN size no browser presents, found while
//     re-reading a comment;
//   - deck theme, held at lacquer while cinnabar-court measured 95.8% below fold,
//     found because the owner asked what had never been varied;
//   - room timing, held UNTIMED while the product default is the 45s/90s standard
//     preset, found while closing an unrelated limitation about a clock.
// Three instances of one class, none of them found by a check. The registry turns
// "which axes are pinned?" from a question somebody has to think to ask into a
// property a test can decide.
//
// THE RULE THE TEST ENFORCES (tests/unit/client/gate-axes.test.ts):
//   1. every gate driver declares a value for EVERY registered axis;
//   2. any axis pinned away from the PRODUCT DEFAULT carries a named justification.
// Not "no gate may deviate" — deviating is often the point (a gate that only ever
// measured the default would never measure the worst case). The rule is that a
// deviation must be DELIBERATE and SAID, because what went wrong three times was
// never the value itself; it was that nobody knew a choice had been made.

/**
 * `productDefault` is what a real player gets with no action on their part. Where
 * that is genuinely a range rather than a value (viewport), the field records the
 * range and the test only requires a declaration, not a match.
 */
export const AXES = {
  viewportWidth: {
    productDefault: 'range',
    note: 'Inner width. 320 (iOS Display Zoom) .. 1440+. The fan\'s per-line capacity is width-dependent: floor(contentW/pitch) is 8 at 320, 9 at 360-390, 14 at 768, 18 at 1366.',
  },
  viewportHeight: {
    productDefault: 'range',
    note: 'Inner height, chrome EXCLUDED. ~664 iOS Safari with toolbars, ~748 minimized, ~681 a maximized 1366x768 laptop. 844 is a SCREEN size and no browser presents it.',
  },
  deckTheme: {
    productDefault: 'lacquer',
    note: 'cinnabar-court ships and is one tap from the header picker. Its stackStripW is 0.841 against lacquer\'s 0.42, so its piles are far taller at the COMMON depths 3-4 (though the 2.95w spread budget caps both to ~0.42 at depth 8, so the structural maximum barely differs).',
  },
  locale: {
    productDefault: 'zh-Hant',
    note: 'en strings are typically longer; a title row that wraps costs ~27px of desk outright.',
  },
  roomTiming: {
    productDefault: 'standard',
    note: 'TIMING_PRESETS.standard (45s/90s) is what room creation applies when timing is omitted. A timed room renders the desk countdown bar: +8.0px of desk, which crosses a 21.3px lattice step.',
  },
  shelf: {
    productDefault: 'none',
    note: 'A set-aside shelf costs ~137px of span. Opening one is a deliberate player action, so "none" is the default state, not the only one worth measuring.',
  },
  handSort: {
    productDefault: 'ascending',
    note: 'The player toggles it; a fresh player is ASCENDING (readHandSortDescending returns true only when localStorage holds "desc" — GameTable.tsx:201). Reversing column order moves the deepest column between fan lines, so it changes fanHeight: measured, the two orderings differ by 7.65% vs 9.28% infeasible at 390x664. A BOUND must hold at the taller ordering; a RATE must use the rendered one, and conflating those was the fan model\'s error.',
  },
  manualAreas: {
    productDefault: 'none',
    note: 'Manual area assignment changes the fan\'s band structure.',
  },
  leadOrFollow: {
    productDefault: 'both',
    note: 'A LEADING turn renders an empty 0x0 trick well and therefore carries 132.5px more simultaneity slack. Pooling the two populations averages one that essentially cannot fail with one that can.',
  },
  turnDecidability: {
    productDefault: 'both',
    note: 'A forced-pass turn has no choice to make AND suppresses the desk clock and countdown bar, so it renders the untimed desk inside a timed room. Measuring one under the other\'s label is the mislabelling class.',
  },
  orientation: {
    productDefault: 'portrait',
    note: 'Landscape has not been measured at all; the app is not orientation-locked.',
  },
  textScale: {
    productDefault: '100%',
    note: 'iOS Dynamic Type and browser zoom scale rem-based sizes. Elders are the population most likely to raise it, and every desk/headline height here is rem-derived.',
  },
  browserChrome: {
    productDefault: 'safari-toolbars',
    note: 'In-app webviews (LINE, WeChat) have FIXED chrome that cannot collapse, and this product is shared by room code in a zh-Hant context, so a webview is a plausible primary entry path. Their inner height has never been measured.',
  },
  handSize: {
    productDefault: '27',
    note: 'A fresh deal. The hand only shrinks, and fanHeight is monotone in it, so the first decision is the deal\'s worst case — which is why a per-deal-at-first-decision rate is the conservative unit.',
  },
};

export const AXIS_NAMES = Object.keys(AXES);
