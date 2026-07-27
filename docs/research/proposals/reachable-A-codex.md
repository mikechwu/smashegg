### 1. THE DEFINITION

A phone table is **reachable** only if, after the product’s own `ScrollActionsIntoView` snap has completed for the viewer’s turn, the viewport contains not just an actionable Play/Pass control but the complete minimum decision set needed to choose between Play, Pass, or changing the selection: every required element in that set must have a nonzero rendered box, must not be clipped horizontally, and must be visible in viewport coordinates at or above its declared visibility floor; otherwise the auto-scroll reached the buttons but not the decision.

### 2. THE SET

- `.gd-actionsRow` / `ActionBar`: Tier 0. If Play/Pass is not visible and tappable, the turn cannot be acted on at all.

- `.gd-desk.gd-desk--play` or `.gd-desk.gd-desk--tribute` / `PlayDesk`: Tier 0. This is the own-turn surface carrying the title, clock, staged cards, combination reading, and beat verdict; without it the player can press a button but cannot know what the selected cards currently mean.

- `.gd-fan` plus `.gd-fan__card` / `HandFan`: Tier 1. The player must see their own hand enough to select, unselect, and verify lifted cards; a visible Play button with the hand scrolled away is only a commit affordance, not a decision interface.

- `.gd-well__cards` / `TrickWell`, when `view.trick.top !== null`: Tier 1. On a follow turn, these are the cards to beat; if they are not visible, the player is relying on memory or on a summary rather than seeing the current target.

- `.gd-desk__stage`, `.gd-desk__status`, `.gd-desk__statusHint`, when present: Tier 0. These are conditional decision facts: what is staged, whether it forms a legal reading, and whether it beats the table.

- `.gd-headline__teams` / `TableHeadline`: Tier 2. The team level badges and “in play” tag explain the level rail and current level context; useful for correctness and confidence, but not always necessary in the post-scroll own-turn viewport because card faces and desk copy carry the immediate play decision.

Exclusions: `.gd-headline__turn--echo` is excluded on phone when the loud desk owns the turn because CSS deliberately hides it under 720px; requiring it would contradict the product’s own information hierarchy. `.gd-handSort` is excluded because sort direction is a preference control, not a fact needed to decide Play or Pass. `.gd-bottombar` / feed and remote `.gd-ring__seat` counts are also excluded: useful table awareness, but the immediate Play/Pass decision is determined by own hand, current top play, staged interpretation, and legal actions.

### 3. THE MEASUREMENT

Drive a real untimed room with Playwright the same way `scripts/measure-fold.mjs` does: create a room, claim four seats, auto-play other actors using server hints until seat 0 has hints, then open the seat-0 page with `localStorage['room:CODE']` and a real inner viewport such as `390x664` and separately `390x748`; print that these are inner dimensions and browser chrome is excluded. Measure after the own-turn render has committed and the `ScrollActionsIntoView` effect has had time to run: wait for `.gd-actionsRow__bar button`, wait for `.gd-desk--play, .gd-desk--tribute`, then wait two `requestAnimationFrame`s and require `window.scrollY` to be stable across two more frames.

Use viewport-relative `getBoundingClientRect()` for the reachability predicate because the property is “what is visible after the snap,” but also print `scrollY`, `window.innerHeight`, `document.documentElement.scrollHeight`, and each element’s document top/bottom (`rect.top + scrollY`, `rect.bottom + scrollY`) so the compensating scroll is explicit. Query `.gd-actionsRow`, `.gd-desk`, `.gd-fan`, selected `.gd-fan__card[aria-pressed="true"]` if any, `.gd-desk__stage`/status lines when present, and `.gd-well__cards` only when the well has cards. For each element print visible height fraction, visible width fraction, and margins to the viewport edges. The summary statistic is the **minimum** visible fraction/margin per required tier and `violations/n` with a Wilson interval, never a median.

### 4. WHAT MAKES IT FAIL

For one rendered decision state, fail if:

`required(T0).some(el => visibleHeight(el) < 1 || visibleWidth(el) < 1)`

or

`required(T1).some(el => visibleHeight(el) < 0.5 || visibleWidth(el) < 1)`

or any required element has zero boxes, horizontal clipping, or a selector miss.

That predicate is structural for a fixed state. Across deals it becomes a sampled rate because hand height, selected cards, shelves, and trick contents are deal-dependent. I would run `n=40` first-turn decision states per viewport and theme, with `n=24` as the minimum floor, answering: “How often does a real own-turn snap leave the player without the full decision set?”

### 5. WHAT IT DOES NOT CATCH

This metric does not prove that the player understands the symbols, that the trick well is visually salient enough after the snap, or that remembering a just-seen trick is acceptable. It also does not measure tap accuracy, motor comfort, motion discomfort from the snap, or whether elderly players prefer the desk summary over seeing the original trick cards. Those require a real phone, real browser chrome, real fingers, and real people.

It also will not catch semantic bugs in `matchSelection`, server hints, card classification, or wrong localized copy. It only says the needed surfaces are present after auto-scroll.

### 6. HOW IT RANKS THE PENDING DECISIONS

The 24px vs 44px set-aside indicator is rankable if the indicator is in the required set at the moment it affects a decision. A 44px control is more likely to preserve the project’s press-target floor but costs vertical context; this metric prices that cost directly as added T0/T1 reachability violations after the snap. If 44px keeps the decision set visible, it wins on the existing target-size discipline. If it pushes the trick, hand, or desk context out of the reachable set while 24px does not, the trade-off is explicit rather than hidden behind the dead fold metric.

Overlay vs collapsed strip are in the same currency only while both are judged by the same post-scroll decision set. A collapsed inline strip competes for vertical reachability directly. An overlay must instead prove that it either contains the whole required decision set itself or deliberately suspends the table decision; if it covers the hand, trick well, or desk while Play/Pass remains reachable, it fails this property. If the overlay is a separate modal task with Play/Pass unavailable underneath, it is not comparable by this metric; that is a different interaction state.

PROPOSAL COMPLETE: 6 sections