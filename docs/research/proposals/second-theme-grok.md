I'll read the theme faces, HandFan strip math, and the round status notes, then answer the appearance questions without changing any files.Next I'll inspect the CSS that sizes the vertical index, the design brief, and how card width flows through the rest of the table.## Q1

**No — not in the sense that matters for this theme.**

What the face actually draws (not the marketing description):

| Layer | What ships | Sizes from CSS / code |
|---|---|---|
| Index | Vertical column: rank over suit (`flex-direction: column`, no `--row`) | Rank `0.42w` (ten: `0.34w`); suit box `0.38w` (~`0.315w` ink) |
| Body | Full-card SVG under the index — court busts or pip field | Fills the 200×290 box |
| Jokers | Shared `JokerFace` registry parts | Same for both themes |
| Wild | Framework seal at `top: 0.92w` | **Already outside** even a 0.841 strip |

At ~35px wide, with glyph basis tied to the box:

- Rank ink ≈ **15px**, suit box ≈ **13px**, column width from the design record’s 0.34–0.36w band ≈ **12px**.
- Vertical index stack (padding + rank + suit) is still ~**30px** tall — almost the whole card.
- The theme’s own craft bar (`DESIGN.md`) was judged at **42.9 / 36 / 32**, with hand courts expected to read as “royal figure” at 42.9 and only as “figure, maybe lean on index” at 36. **35 sits at the trick tier**, not the hand tier the figurative work was signed off for.

So at 35px you still *have* a vertical rank-over-suit column and some body art, but you have paid for the column by shrinking everything the column was meant to crown. Court silhouettes that barely cleared 36px become texture; the “cinnabar-court” reading collapses to **palette + a cramped index**, not vertical index *plus* body art. The defining property survives as a DOM structure, not as a legible identity at hand size.

A theme that only still works when you shrink the whole table out from under it is not still itself. It is a smaller, weaker copy of a design that assumed a larger card.

---

## Q2

**No. A per-theme card scale is not an acceptable cosmetic.**

Theme is already a **client-local pure re-render** (`pref:deckTheme`, not room/protocol). Card width is not: `--gd-handcardw` is a **single root constant** that HandFan, staged cards, seat stacks, cut/deal geometry, and half the table CSS hang off. Giving cinnabar its own ~35px means that constant becomes theme-keyed and every surface that follows the card follows with it.

What breaks that is not the obvious “cards look smaller”:

1. **The gate stops being one product.** All of the J0/K0/K2 work treats one `w` against one vertical budget and one capacity formula. Two theme-local widths are two products that both have to pass fold, capacity, and setback — or you ship one theme un-gated.
2. **Shared table language dies.** Same phone model, same room: one player’s staged king is a different physical size from the other’s. Trick well, seat-stack depth, and “how big is a card on this table” stop being shared facts.
3. **Motion and measurement drift.** Deal overlay rects, play flight, sort FLIP, seat-stack reservation all assume one hand card box. Theme mid-session becomes a **layout reflow**, not a paint change — contradicting the design record’s “switch disturbs nothing.”
4. **Tap geometry changes with cosmetics.** Column pitch is `-0.6 × cardw`. A 25% smaller card is a 25% tighter fan of hit targets and a denser desk — elder/accessibility load shifts with a skin choice.
5. **Theme becomes a layout preference.** Players will pick lacquer “because Play is reachable,” not for ivory vs cinnabar. The picker stops being appearance and starts being **a fold-budget control**.
6. **Support and screenshots bifurcate.** Every future “does this fit?” answer needs “on which theme?” That is how the current defect was missed once already.

If two clients can disagree on card size for the same deal, the table is no longer one instrument with skins. It is two instruments.

---

## Q3

**Not as drawn. Only if the covered-card mark is redesigned — and even then the theme stays distinct only if you keep body art / palette, not if you only change the number.**

Arithmetic you already settled: depth-10 at 46.51px needs strip **≤ ~0.447**. Lacquer’s **0.42** is the only measured phone-safe point. Cinnabar’s current index does not fit that strip:

- At 46.51px, a 0.42 strip is ≈ **19.5px** tall.
- Current vertical pair wants roughly rank `0.42w` + suit `0.38w` + padding ≈ **30px+**.
- So option 3 as “set `stackStripW: 0.42` and ship” **hides the suit under the next card** on every multi-card pile. That is a worse product than a missing theme: primary action returns, **stack identity does not**.

What would have to change on the face for a 0.42 strip to work:

| Approach | Covered strip shows | Full top card | Still “cinnabar”? |
|---|---|---|---|
| A. Compress vertical pair into ≤0.42w height | Tiny rank+suit (~10px floor each, zero air) | Unchanged column | Borderline; glyphs at the contract floor, ugly “10” |
| B. Rank-only strip; suit on full face only | Rank | Vertical rank+suit + body | Yes for full face; stacks become lacquer-like for suit |
| C. Horizontal index in the strip (or always) | One-line rank+suit | Body art + palette + back | **Re-skin of lacquer’s index grammar** with cinnabar body |
| D. Metric-only change | Mostly rank, suit clipped | Looks fine until you stack | **No** — silent defect |

Note already on the record (round 026): even at 0.841 the wild **seal never appears in stacked strips** (seal at 0.92w). Covered identity has always been rank+suit only. So the strip’s job is narrow; it does not need to be 0.841 of breathing room.

**Verdict on option 3:** the cheapest *structural* fix is not the metric alone — it is **framework-owned strip budget + a covered mark designed for that budget**. Naked 0.42 is a re-skin that also breaks stacks. Redesigned 0.42 can still be a distinct theme if courts, pips, palette, and back carry the identity and the index becomes a compact mark (likely closer to lacquer’s one-line job even if you keep a tight vertical pair at min px).

---

## Q4

**Take option 1 — withdraw the theme from the picker — now. Treat a redesigned re-entry (not naked option 3) as the only path back.**

### Why withdraw is the right first move

- The incompatibility is **structural**: vertical index height budget × two-line stack fan × phone fold. Not a one-pixel miss.
- It has shipped broken **the whole time**. Silence is information: either almost nobody picks it (picker is noise), or people who pick it do not care enough to report (theme is not carrying value), or both. None of those argue for keeping a broken path in the header.
- Default is already **lacquer** (owner flipped it back in the stacked-hand round). Cinnabar is alternate cosmetics, not the product spine.
- Options 2 and naked 3 are **worse** than absence (see Q1–Q3). Option 4 is a multi-week layout fork to save a theme with no demand signal.
- Withdraw is **reversible**: code stays in tree if you want; remove the select entry and registration surface. No protocol, no engine, no room state.

### What I would need to believe for that to be wrong

Any one of these would flip me:

1. **Usage or owner intent:** telemetry or a hard owner call that cinnabar must remain selectable (or become default again) in the next ship.
2. **Willingness to fund face work:** a designer pass that redesigns the *covered* mark for ≤0.42–0.45 strip and re-runs fold + eyes-gate — then re-entry is option-3-with-redesign, not withdraw-forever.
3. **Evidence that players treat body art as the theme** and will accept a horizontal (or rank-only) strip without feeling the theme was gutted — measured, not hoped.
4. **A decision that option 4 is product strategy** (theme owns a layout variant), with capacity to gate two fan geometries — I do not believe that today.

If (1)+(2) are true, skip long-term withdraw and go straight to **redesigned strip under a framework CAP**, then re-ship. Until then, **do not leave a broken alternate in the header**.

### Ranking the four as stated

| # | Option | Call |
|---|---|---|
| **1** | Withdraw | **Do this now** |
| 3 | `stackStripW ≈ 0.42` alone | Only with face redesign; alone is a new defect |
| 4 | Own fan layout | Correct only if theme is strategically load-bearing; too expensive for silence |
| 2 | ~35px card | **Reject** — sacrifices product geometry for a mark that still fails its own craft bar |

---

## Q5

**What I would not do — and what is wrong in the framing.**

### Would not do

- **Per-theme card scale** (option 2). Ever, unless the theme stops being a client cosmetic and becomes a declared layout profile with its own gates.
- **Metric-only option 3** — clamp or rewrite `stackStripW` without redesigning the covered index. That trades fold failure for unreadable stacks.
- **Silent runtime clamp** that gaslights the designer (“we ship 0.841 but use 0.42”). Loud conformance failure or withdraw; not quiet muting.
- **Option 4 first.** Own fan layout is how you *invest* in a validated theme, not how you mop up an unreported ship defect.
- **Treat “no reports” as proof the product is fine** while leaving the picker entry live. Silence licenses *removal*, not neglect.
- **Re-derive the arithmetic** or reopen the fold numbers as the decision. The decision is appearance/product; the math is already binding.

### What is wrong in this framing

1. **It treats the four options as equal dials on one object.** The real bug is contractual: `stackStripW` was allowed as art freedom inside `[0.3, 1.0]` while it spends a **shared vertical product budget**. Both independent proposals in round 098 said the same thing: theme *requests*, framework *owns*. The four options skip that structural repair.
2. **Option 3 is mis-specified.** “Set strip to 0.42” is not the cheap fix; “design the covered mark for the budget lacquer already proved” is. As written, option 3 confuses a CSS number with a face redesign.
3. **It over-identifies “defining property” with the vertical index.** On a full face, cinnabar is body art + palette + back + index. On a **stack**, only the strip is visible — and the seal never was. The incompatibility is between **tall covered mark** and **stack fan**, not between “being cinnabar” and “having a fan.” A theme can stay cinnabar with a short covered mark.
4. **It underweights that default already rejected this theme as product spine.** Keeping a broken alternate in a always-visible header is product surface area without product value.
5. **“Two-line fan cannot hold” is slightly too strong as eternal law.** What cannot hold is *this* strip at *this* card size under *this* fold budget. A future compact stack mode could, but that is option 4 with a new design problem — not a free escape hatch for 0.841.

---

## Checked clean

| Examined | Finding |
|---|---|
| `themes/cinnabar-court/index.tsx` | Face = body (court/pips) + vertical `.gd-card__index`; `stackStripW: 0.841` documented for that column; no game-state chrome |
| `themes/lacquer.tsx` | Horizontal `--row` index; `stackStripW: 0.42`; single large body pip — correct contrast case |
| `HandFan.tsx` `stackOffsetW` / `stackMarginTopW` | Strip multiplies into stack height via `marginTop: calc(var(--gd-cardw) * …)`; theme metric is the only per-theme height lever in the settled fan |
| `table.css` index / `.gd-ccourt__*` | Rank/suit fractions and 0.38w suit box confirm ~30px vertical demand at 46px; seal at 0.92w never in strip |
| `theme.ts` contract | `stackStripW` range `[0.3, 1.0]` presents layout-unsafe values as conforming — contract smell, not a second math error |
| `app.css` `--gd-handcardw` | One global box (44 / 48.15 / desktop clamp) — no theme axis; per-theme scale would be a new system |
| `SeatStack.tsx` | Aspect from theme, width from global hand card — partial theme coupling already; full scale split would widen the split |
| `DESIGN.md` cinnabar | Craft bar at 42.9/36/32; identity column 0.34–0.36w; theme is client pref; default was intended cinnabar then **owner flipped to lacquer** (round 026) |
| `status/rounds/098-*.md` | First fold measurement with theme varied; 95.8% vs 4.2% directional; panel convergence on framework CAP |
| Round 026 note | Stacked wild seal already hidden at 0.841 — covered identity has always been rank+suit only |
| `status/CURRENT.md` / `VALIDATED.md` | Model stripW is lacquer-only; cinnabar 0.841 is out-of-model — consistent with “theme axis was missing” |
| Arithmetic tables in the brief | Taken as given; not re-derived |

THEME VERDICT: 1 recommendation
