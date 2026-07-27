## 1. The Constraint Itself

Set `stackStripW` conformance ceiling to **0.42 for phone-guaranteed themes**, derived from the only measured shipping state that preserves the accepted layout behavior: lacquer at `390x844`, zh-Hant, real dealt hands, no shelf, with **4.2% below fold**, under the owner’s accepted **12.5%** tolerance.

That is not an aesthetic number. It is the highest currently proven theme value that keeps the primary action mostly above fold on the target phone layout. `0.841` is inside the declared range but consumes too much of the fixed vertical budget at the statistically common pile depths:

- depth 4 occurs in **57.6%** of deals
- cinnabar adds about **64px** over lacquer at depth 4
- that moves the Play button from mostly acceptable to below-fold on **~95.8%** of deals

So the immediate rule should be:

```ts
phoneSafeStackStripWMax = 0.42
```

Longer term, I would define the constraint as:

```ts
stackStripW <= maxStripForFoldBudget(viewportClass, cardWidth, acceptedBelowFoldRate)
```

But until that formula is actually measured and validated, the enforceable ceiling should be the proven value: **0.42**.

## 2. Where It Lives

It should live in several places, with different jobs:

1. **Type/schema documentation**
   `DeckThemeMetrics.stackStripW` should no longer say `[0.3, 1.0]` as if any value in that range is layout-safe. It should distinguish “renderable” from “phone-layout conforming.”

2. **Theme conformance test**
   A future theme with `stackStripW > 0.42` should fail the theme conformance test unless it declares itself non-phone-safe or ships with a measured fold-gate exception.

3. **Fold gate**
   The fold gate should include all selectable shipping themes at least once before release. A theme picker means every theme is product behavior, not an optional skin.

4. **Runtime framework clamp**
   I would also clamp at runtime as a last-resort safety net:

   ```ts
   effectiveStackStripW = min(theme.stackStripW, phoneSafeStackStripWMax)
   ```

   But this should not be silent in development. In dev/test, warn or fail loudly. In production, clamp to protect the user.

Future violating themes should be **caught by tests before shipping**. Runtime correction is only defense in depth.

## 3. What Breaks For Cinnabar-Court

Cinnabar-court’s `0.841` is not arbitrary. Its identity depends on a vertical rank+suit strip, so shrinking it to `0.42` may make the stacked cards less readable or less visually distinctive.

I would tell the designer:

The current strip design asks the card stack to spend vertical layout budget the phone table does not have. The theme can keep the cinnabar identity, but the readable information has to fit inside the same exposed-strip budget as the default theme.

Practical options:

- Redesign the vertical rank+suit mark to read within a `0.42 * cardWidth` exposed strip.
- Move more identity into color, border, backplate, typography, or the visible card face, rather than requiring taller pile spread.
- Use an alternate compact stacking treatment on phone.
- Allow the large vertical strip only on wider viewports where the fold budget has been measured.

The theme does not get to require scrolling for the primary action on nearly every deal.

## 4. Whether The Fold Gate Should Vary Theme Routinely

Yes, but not exhaustively every time.

A full per-theme sweep multiplies an already slow manual gate, so I would split it:

- Regular layout gate: default theme only.
- Theme conformance gate: cheap deterministic or sampled check for every shipping theme’s layout-sensitive metrics.
- Release or visual-regression gate: run the full fold sweep across every selectable shipping theme.

The miss happened because the fold number was treated as a layout property independent of theme. It is not. Any theme metric that feeds geometry must be part of layout validation.

## 5. General Lesson

Extension points that feed a global layout budget are not free theme parameters.

Reusable rule:

A plugin/theme may choose values only inside the budget allocated to that extension point. The framework owns the budget; the plugin owns expression within that budget.

So the contract should separate:

- **Artistic preference:** what the theme would like.
- **Renderable range:** what the renderer can draw.
- **Conforming range:** what preserves product guarantees.
- **Effective value:** what the framework actually uses.

If a parameter can move a primary control below the fold, it is a layout parameter first and an art parameter second.

## 6. Riskiest Assumption

The riskiest assumption is that `0.42` is the right ceiling rather than merely the only currently measured safe point.

Cheapest measurement to kill that assumption:

Run the existing 390x844 fold gate with synthetic effective `stackStripW` values:

```text
0.42, 0.48, 0.55, 0.65, 0.75, 0.841
```

Use the same zh-Hant setup, real dealt hands, and document-coordinate Play/Pass measurement. The result gives an empirical curve from strip width to below-fold rate. If `0.48` or `0.55` stays under 12.5%, the ceiling can move. If not, `0.42` is confirmed.

## What I Would Not Do

I would not keep `[0.3, 1.0]` as the conformance range. That range describes what can render, not what preserves the phone layout.

I would not make `2.95` theme-aware. That lets themes negotiate the global layout budget indirectly and makes the fold behavior harder to reason about.

I would not rely only on manual fold testing with the default theme. That already missed the bug.

I would not silently clamp without telling theme authors. That protects users but creates confusing art review failures.

## Risks

The proposed `0.42` ceiling may be stricter than necessary.

Cinnabar-court may need real art changes, not just a metric tweak.

A runtime clamp can make screenshots differ from designer intent unless tooling exposes the effective value.

A viewport-aware future rule may be correct, but it adds width-reactive behavior the project currently avoids. I would not take that cost until measurements show a meaningful benefit.

PROPOSAL COMPLETE: 6 distinct decisions