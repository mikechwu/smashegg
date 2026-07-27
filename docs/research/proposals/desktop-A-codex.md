## 1. Mode Structure

I would use **four discrete modes**, all derived from the measured thresholds:

1. **Phone: `<720px`**
   - Purpose: preserve the existing phone-first table.
   - Rule: byte-identical CSS/markup below 720px, except only if a separate phone bugfix is explicitly scoped and pinned.
   - Reason: existing CSS already treats 720px as the first desktop-air breakpoint, and the owner requires the phone not regress.

2. **Bridge / Short Laptop: `720px–1023px`**
   - Purpose: fix vertical debt, not chase width.
   - Keep 68px cards and current hand overlap.
   - Remove or reduce the ≥720px vertical inflation that caused Play/Pass to fall below the fold at 1024×768.
   - This mode exists because the current “desktop” block makes the layout taller before the viewport is tall enough to pay for it.

3. **Laptop Table: `1024px–1439px`**
   - Purpose: spend surplus width first on **de-overlapping the player hand at current card size** and widening the ring.
   - At ≥1024px, measured hands fit one line with zero overlap at 68px.
   - At ≥1280px, zero overlap plus small gaps fits every measured deal, but 1280×800 still has a fold problem, so vertical compaction remains active.

4. **Desktop Table: `≥1440px`**
   - Purpose: larger cards, real table geometry, richer side space.
   - Use ~90px own-hand cards with zero overlap.
   - Widen the ring substantially beyond 608px.
   - Do not jump to 110px until ≥1728px and only if scan-cost measurements support it.

I would not use 523px as a mode boundary. It is useful as a diagnosis: the app stops scaling there today. But the real layout behavior changes at 720px, and the measured no-overlap thresholds start at 1024px.

## 2. The Hand

My proposal: **zero overlap for the player’s settled hand on desktop**, with card size stepping up only after overlap is gone.

- `<1024px`: current hand behavior.
- `1024–1279px`: 68px cards, zero overlap, no deliberate gaps.
- `1280–1439px`: 68px cards, zero overlap, 4–6px gaps if fold still passes.
- `1440–1719px`: 90px cards, zero overlap.
- `≥1728px`: test 100–110px cards, but do not assume bigger is better.

Reason: desktop abundance removes the original reason for overlap. The phone design’s overlap is a constraint workaround, not a sacred table identity. On desktop, exposed full faces are more elder-friendly and reduce the need for sliver-specific tricks.

The ceiling I would measure: time and error rate for finding a prompted card or combination in a 27-card hand at 90px, 100px, and 110px, across 1440, 1728, and 1920 widths. If 110px increases eye/head travel or slows combination finding, stop at 90–100px.

## 3. The Ring

“Genuine table geometry” should mean the opponents are physically across a table, not packed into a 608px ornament.

Surplus width should buy:

- West/east separation growing from 608px toward roughly 900–1100px on desktop.
- A larger center well, enough for common plays to read without feeling like a postage stamp.
- Clear counter-clockwise turn direction: active state should travel around visible seats with enough spatial distance that direction is obvious.
- Tribute and 接风 should read as spatial events: card/attention from one seat to another, then to the center, not just a feed sentence.

I would widen the ring before making remote seat plates louder. Remote seats already have value-dependent mini fans; the win is distance, orientation, and event travel path.

## 4. The Rest Of The Surplus

Use extra space selectively:

- **Event feed:** on desktop, move from thin bottom strip to a right-side rail or wider bottom rail showing 4–6 recent lines. It should remain quiet and scrollable, not become a chat panel.
- **Play desk:** modestly wider, not much taller. The desk is already the loud own-turn object; give it horizontal room for staged cards and text before adding vertical rows.
- **Sort-area shelves:** desktop may allow a third shelf, but only as an explicit cap change. `AREA_HARD_MAX = 2` means this does not appear naturally.
- **Trick well:** deserves meaningful growth. Current max around 149.6×98.6px is too small for desktop.
- **What should stay small:** headline height, sort toggle, locale/theme chrome, inactive opponent-turn messaging, and decorative table padding.

## 5. Token Vs Structure

Reachable mostly by token/CSS mode changes:

- Card width tokens per mode.
- Font-size token bumps at desktop.
- Spacing/radius adjustments.
- Ring max-width removal or replacement.
- Handzone max-width growth.
- Trick well width growth.
- Desktop event feed max-height.

Structural changes needed:

- **Desktop hand de-overlap:** likely CSS-only for settled rows, but it changes interaction geometry and must be tested as a distinct hand mode.
- **Desktop ring geometry:** CSS grid changes are enough if markup stays north/west/center/east. Verification still doubles for deal/play flight rects because overlays query ring seats.
- **Event feed side rail:** structural if it moves out of `.gd-bottombar`. This creates a second placement to verify for feed, own plate, and scroll containment.
- **Third sort shelf:** structural/user-flow decision because merge becomes reachable and shelf controls multiply. This must verify area invariants, seam safety, tap targets, and fold separately.

I would avoid two React component trees. The current tree is already organized around stable zones, and CSS modes can do most of the work.

## 6. The Vertical Problem

At **1280×800**, Play/Pass must move above the fold without relying on auto-scroll.

My proposal:

- In `720–1439px` short-height modes, reduce the desktop ring vertical cost: smaller `.gd-table` padding, smaller ring padding, and ring center min row closer to the phone value.
- Let width grow horizontally before adding vertical air.
- Keep Play/Pass document bottom ≤780px at 1280×800 in zh-Hant across the measured sample, leaving about 20px tolerance under the 800px fold.
- Treat auto-scroll as a safety net only; document-coordinate measurement is the gate.

A desktop design that is still ~860px tall at 1280×800 fails the mission.

## 7. Gates

Pre-declared gates I would require:

- **Phone byte identity**
  - Viewport: true 390×844 and 390×664.
  - Axis varied: CSS bundle/DOM selectors below 720px.
  - Pass: below the first breakpoint, generated relevant table CSS blocks and zero-area fan markup match baseline, with no new split/seam/layout-mode classes emitted.

- **Tap target sweep**
  - Viewports: 390×844, 1024×768, 1280×800, 1440×900, 1728×1117.
  - Axis varied: viewport mode and dealt hand.
  - Sample: at least n=24 deals per mode.
  - Pass: every press target ≥44px; fan sweep reports zero victim cards and zero destructive-control steals.

- **Fold gate**
  - Viewports: 390×664, 390×844, 1024×768, 1280×800, 1440×900.
  - Axis varied: real deals.
  - Sample: n=40 per representative viewport.
  - Pass: report Play/Pass below-fold rate with Wilson 95% interval. For 1280×800, target 0/40 below fold, with documented doc-bottom buckets.

- **Hand readability gate**
  - Viewports: 1024, 1280, 1440, 1728 widths.
  - Axis varied: real dealt hands and card-size mode.
  - Pass: no wrap in settled hand for n=40 deals; no horizontal overflow; selected-card state remains visually and hit-test distinct.

- **Ring geometry gate**
  - Viewports: 1280×800, 1440×900, 1920×1080.
  - Axis varied: trick states, tribute, pass, jiefeng, deal animation.
  - Pass: west/east distance grows by mode; center well stays bounded but larger; play/deal overlays originate and land from correct seat rects.

## 8. Riskiest Assumption

The riskiest assumption is that **zero-overlap desktop hands are easier to use than overlapped large-sliver hands**.

The cheapest killing measurement: run a small timed visual-search test on real 27-card hands comparing:

- 68px overlapped current hand,
- 68px zero-overlap hand,
- 90px zero-overlap hand,
- 90px overlapped hand with larger sliver.

Ask users to find a named rank/suit, identify wilds, and select a prompted combination. If zero overlap is slower or causes more misses, the desktop hand should become “larger card with controlled overlap,” closer to the guandan.app prior-art direction.

## What I Would Not Do

I would not continuously scale everything with `vw`/`clamp`. The measurements already show why: the app silently stops responding after 523px today, and continuous scaling creates unbounded untested states.

I would not jump straight to 110px cards. It fits only at ≥1728px and may make scanning 27 cards worse.

I would not add a second desktop React table. The cost of verifying every future game state twice is not justified yet.

I would not raise `AREA_HARD_MAX` just because the screen is wide. A third shelf makes merge reachable and changes the interaction model; it is a product decision, not a responsive side effect.

I would not spend surplus on decorative felt, oversized badges, or a taller headline. Desktop’s win is legibility, table geometry, and action reachability.

## Risks

I think §3 is mostly measured correctly and interpreted correctly. The one interpretation I would soften is “zero overlap is the natural desktop answer.” The counterfactual proves it is possible, not that it is best. guandan.app’s larger-card, heavier-overlap choice is a real competing hypothesis.

The existing 720px breakpoint is also overloaded. It currently means “desktop air,” but 1024×768 and 1280×800 prove that some desktop-class widths are height-poor. The new modes need to consider height in gates even if the CSS breakpoints remain width-discrete.

PROPOSAL COMPLETE: 12 distinct design decisions