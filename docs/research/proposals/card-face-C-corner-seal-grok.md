I'll study the current lacquer theme, CardFace framework, and fan/sliver CSS so the proposal is grounded in how cards actually render.I have enough from the live geometry and the current face/wild/joker markup. Below is a single opinionated direction, driven by the corner-sliver reframe.

---

# Design Direction: **「角印」 Corner Seal**

**One sentence.** Treat every card as a **left-column identity seal on ivory paper** — rank, suit (or joker monogram), and wild badge stacked in a single tight column that lives entirely inside the fan’s ~17px strip; body craft appears only when the full face is exposed.

**Why this beats “prettier lacquer.”** The client’s complaint is not colour; it is that the current faces read as **UI chips**, not **deck artifacts**. A real deck survives as corner indices under a thumb. We design the thumb-strip first, the open face second.

---

## 0. Diagnosis of the live build (what we refuse to keep)

| Element | Live behaviour | Why it fails the sliver |
|---|---|---|
| Index | Rank `0.42w` + suit `0.36w`, top-left stack | Correct *region*; still the only good idea |
| Wild | Cinnabar **bottom-left triangle** `0.62w × 0.62w` + glyph `配`/`W` | Triangle width **~27px** at hand-390 while sliver is **~17px** — the mass straddles the junction; players attach it to the *next* card |
| Joker | Localized vertical-rl string (`Joker` / `Big Joker` / `大王`…) | Geometry broken in English; language on a physical face; no craft |
| Body | None | Last card / trick well look empty → “test build” |

Overlap math (confirmed by CSS): pitch = `0.4 × cardw` (`margin-left: -0.6 × hand width`). At true 390, only the **left ~40%** is a reliable canvas. **Anything outside `x ∈ [0, 0.36w]` is not owned by this card.**

---

## 1. SLIVER ARCHITECTURE

### The column (all sizes, same fractions of `cardw`)

A single left-aligned **identity column** of width **`0.34w`**, inset from the left edge by **`0.06w`**, so the whole stack sits in roughly the left **40%** with a **~0.06w air gap** before the neighbour’s leading edge. Nothing identity-critical may cross `x = 0.40w`.

**Top → bottom of the visible strip** (natural ranks):

```
 y=0.06w  ┌─ padding ─────────────────┐
          │  RANK          0.38w tall │  ← primary; weight 650; tabular nums
          │  (tracking tight on "10") │
 y≈0.48w  │  SUIT          0.30w tall │  ← shape-first glyph (see §4)
          │                           │
 y≈0.82w  │  [wild seal]   Ø 0.22w    │  ← ONLY if wild; framework-owned
          │     (see §2)              │
          └───────────────────────────┘
          column width = 0.34w
          left inset   = 0.06w
          right of col ends at 0.40w  ← hard occlude line
```

**Sizes as fractions of card width** (not px — one design survives hand/trick/mini):

| Slot | Element | Size | Notes |
|---|---|---|---|
| Rank | `A`…`K`, `10` | **0.38w** (floor 10px via theme metric) | `10` uses condensed tracking `−0.06em`, never two loose glyphs |
| Suit | ♠♥♣♦ | **0.30w** | Optical balance: diamonds slightly heavier stroke so mass matches spades |
| Wild seal | framework | **Ø 0.22w** | Centered on column axis; never wider than column |
| Joker monogram | theme | **0.42w** tall “seal” | Replaces rank+suit (see §3) |
| Edge whisper | all faces | **0.035w** rosewood hairline inside border | Craft, not info |

**What is *forbidden* in the sliver:** body pips, court art, multi-character words, bottom-corner wedges, anything centered on the card.

### ASCII — fanned run of five (viewer sees left slivers; last card open)

Scenario: `A♠ · BJ · SJ · K♥(wild) · 7♦`  (last card fully readable)

```
 pitch≈0.40w each step; only left ~0.40w of non-terminal cards is seen

   A♠          BJ          SJ        K♥ + wild      7♦ (open / last)
 ┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐    ┌──────────────┐
 │ A   │    │ ┌─┐ │    │ ┌─┐ │    │ K   │    │ 7            │
 │ ♠   │    │ │★│ │    │ │◇│ │    │ ♥   │    │ ♦            │
 │     │    │ └─┘ │    │ └─┘ │    │ ●   │    │              │
 │     │    │  ║  │    │  │  │    │     │    │    ♦   ♦     │
 │     │    │  ║  │    │  │  │    │     │    │  ♦   ♦   ♦   │
 │     │    │     │    │     │    │     │    │    ♦   ♦     │
 └─────┘    └─────┘    └─────┘    └─────┘    └──────────────┘
  rank+     filled      hollow     rank+suit   full body:
  suit      cinnabar    ink        + seal-dot  pips in field
            star seal   diamond    (wild)      (desktop denser)
            + double    + single
              stem         stem

 ● = cinnabar filled circle Ø0.22w, ivory ※ inside — wholly under K♥'s suit
 ★/◇ seals live in the SAME column band as rank — never at the junction
```

**Reading order in the fan is always top-down in one column.** Players never hunt the bottom edge for game state.

---

## 2. WILD MARKER (framework-owned)

### Decision: **language-neutral SYMBOL — no `W`, no `配`**

**Justify hard.**

1. **Owner already demands language-neutral jokers** because a real deck is one artifact in every locale. The wild is the *same* physical card (level-rank hearts); printing locale text on it reintroduces the defect we just banned on jokers.
2. **Sliver budget.** Rank already owns the column. A CJK `配` or Latin `W` at readable size collides with rank/suit and forces the marker into a fat corner (today’s triangle). A **Ø 0.22w disk** is smaller, rounder, and scannable without type.
3. **A11y stays localized.** `aria-label` / `cardLabel` still says “Wild / 逢人配”; only the *face ink* is neutral. Screen readers are not the fan.

### Form

- **Shape:** perfect circle (a **seal**, 印) — not a triangle, not a ribbon, not a corner bite.
- **Fill:** solid `cinnabar #c3392b`.
- **Inner mark:** ivory **`※`** (reference mark) or a four-petaled “match” cross drawn as pure geometry — reads as “this stands in for another,” without spelling it. Prefer geometry over the Unicode glyph if font metrics wobble; either way: **one mark, high contrast**.
- **No second language layer.**

### Position (the anti-misattribution rule)

```
column axis x = 0.06w + 0.17w = 0.23w   (center of 0.34w column)
seal center  = (0.23w,  just below suit, gap 0.04w)
seal diameter = 0.22w
rightmost ink of seal = 0.23w + 0.11w = 0.34w   ← still inside 0.40w sliver
```

**Why it cannot be mis-attributed:**

1. **Horizontal ownership:** entire seal sits **≥ 0.06w left of the occlude line**; the neighbour’s left edge covers only *their* column, never this seal.
2. **Vertical attachment:** seal hangs from *this* card’s suit glyph by a fixed gap — same stack as rank. The eye reads “K · ♥ · ●” as one object, not a floating badge at the seam.
3. **Kill the triangle:** today’s `clip-path` wedge is a **diagonal mass** that grows toward the junction — the worst possible silhouette for fan pitch. Circles have no diagonal reaching for the neighbour.

Ghost faces keep the **identical** seal (framework already unifies this) so “wild at work” stays one convention.

**Rejected alternatives (and why):**  
- Left full-height stripe — elegant, but costs 0.05–0.08w of rank width and looks like selection chrome.  
- Top-edge tab — competes with selection lift / glow rings.  
- Corner triangle kept but shrunk — still a junction-seeking diagonal; shape is the problem, not only size.

---

## 3. JOKERS — language-neutral craft

### Principle

A joker is a **different species of card**, not a rank with a long name. Real decks signal big/small by **figure colour + silhouette**, never by the word “Joker.” We do the same: **seal monogram in the sliver; medallion in the body; zero letters on the face.**

### Big vs small — triple encoding (shape + fill + colour)

Colour alone is forbidden; shape alone would work in monochrome printouts; together they are bulletproof.

| | **Small joker (SJ)** | **Big joker (BJ)** |
|---|---|---|
| Convention | black / white | colourful (red) |
| Sliver monogram | **Hollow diamond** `◇` ink stroke | **Filled star** `★` cinnabar |
| Stem under monogram | **Single** vertical hairline, ink | **Double** parallel hairlines, cinnabar |
| Body medallion | Line-only circular seal, ink on ivory | Filled cinnabar seal, goldleaf inner ring, ivory star |
| Field | Ivory, quiet | Ivory, quiet — colour lives *in the seal*, not a painted whole face |

**Sliver alone:** hollow diamond + single stem vs filled star + double stem. Even greyscale or colourblind modes separate them by **outer silhouette** (4-point diamond vs 5-point star) and **stem count**.

### Sliver vs body

**Sliver (always):** monogram + stem only, top-aligned in the identity column at **0.42w** monogram size — larger than rank, because jokers must pop in a bomb scan.

**Body (last card / trick / ceremony / desktop):**

- Centered **seal medallion** Ø ~`0.55w`, vertically centered in the remaining field.
- Thin **goldleaf hairline ring** inset (echo of the lacquer back’s gold inset — same craft language).
- Big: medallion filled cinnabar, gold ring, ivory star; optional second tiny star above/below for ceremony size only.
- Small: medallion **stroke-only** ink, no fill, single diamond inside; no gold (monochrome discipline).
- **No 大王/小王/Joker/Big Joker text. Ever.** Localized names stay in `aria-label` / feed copy only.

### What dies from the current theme

- `writing-mode: vertical-rl` + `text-orientation: upright` letter stacks  
- Theme calling `t('game.card.bj'|'sj')` for **face paint**  
- “Plain text on ivory” emptiness — replaced by seal craft

**IP note:** star/diamond monograms and abstract seal medallions are generic geometry, not a publisher’s jester IP. Do **not** draw a Bicycle-style jester figure or copy any commercial joker portrait.

---

## 4. FACE BODY (last card, trick well, ceremony, desktop)

### Natural ranks (A–10)

**Pips, French-suited free convention** — standard mirror layouts (2–10), large centered suit for A. This is public domain structure, not a deck copy.

- **Pip colour:** red suits cinnabar, black suits ink — **but suit identity is the glyph shape**; colour is reinforcement only (owner rule).
- **No indices on the right/bottom** at hand-mobile (saves noise in the fan; double-ended indices appear only when `cardw ≥ ~48px` — desktop hand / large trick).

### Courts (J / Q / K)

**Not full court illustration.** Full courts at 43px are mud and invite “which published deck is this?” risk.

Instead: **cartouche courts** — a thin oval or rounded lozenge in the body field containing a single geometric court emblem + large suit:

| Rank | Emblem (abstract, not a portrait) |
|---|---|
| J | Vertical staff / baton with one crossbar |
| Q | Crescent + single petal (not a face) |
| K | Three-point crown outline |

Emblems are **stroke drawings** in the suit colour, weight comparable to pips. Spirit of a classic deck; **no rider-back faces, no named court art.**

### Detail ladder (one theme, size-adaptive — see §5)

| Render width (approx) | What the body shows |
|---|---|
| **mini ~32px** | Index column only. No pips, no cartouche, no medallion fill detail. Joker = monogram only. Wild seal may grow to **Ø 0.26w** so it clears the 10px floor. |
| **trick ~36px** | Index + **reduced pips** (A, face cards: single large suit; 2–10: simplified  center cluster max 5 dots, not full layout). |
| **hand mobile ~43px** | Full index; body pips **only if fully exposed** (last in fan / selected lift still mostly covered — don’t fight occlusion). When open: full pip layout for 2–10; courts = cartouche. |
| **hand desktop ~52px+** | Double-ended indices; full pip maps; court cartouches with slightly finer stroke; joker medallion shows gold ring. |
| **ceremony / marker flip** | Maximum: medallion + gold ring + optional micro ornament; still no locale text. |

### What “closer to a real deck” means here

Desktop earns: **double indices, true pip constellations, court cartouches, joker medallion with gold ring.**  
It does **not** earn: photoreal courts, ornate borders, patterned ivory fields, gaudy gradients. Premium is **restraint on lacquer**, not denser decoration.

---

## 5. ONE-THEME-ADAPTIVE vs TWO-THEMES

### Call: **ONE adaptive theme** (commit)

**Argument.**

1. **Client lean + coherence.** The table is one lacquer surface. Two face systems (mobile-simple / desktop-deck) will drift within a month: different joker marks, different wild geometry, bug-fix only one path.
2. **The reframe already unifies sizes.** Hand / trick / mini are the same object under different `cardw`. Detail must be a function of **pixels available**, not of viewport breakpoints that disagree with actual rendered size (a desktop mini chooser chip is still 32px).
3. **Implementation shape fits the framework.** Theme already receives `size: 'hand'|'trick'|'mini'` and `--gd-cardw`. Prefer **container-driven thresholds on `cardw`** (e.g. show double index when `cardw ≥ 3rem`) over a second registered `DeckTheme`.
4. **Two themes fail the 390 gate twice.** Every wild/joker fix would need dual QA; the empirical defects are geometric, not “mobile aesthetic vs desktop aesthetic.”

**What “adaptive” is not:** a single bitmap scaled. It is **one vector grammar** with three disclosure levels (index-only → pips → double-index + cartouche), all sharing Corner Seal geometry.

---

## 6. TOKENS & SIGNATURE

### Palette (stay inside the table; deliberate micro-extensions marked)

| Token | Hex | Role |
|---|---|---|
| `lacquer` | `#2b1a18` | Table (context only) |
| `rosewood` | `#4a2c27` | Card border, stem ink for SJ |
| `ivory` | `#f5efe3` | Face field |
| `cinnabar` | `#c3392b` | Red suits, BJ, wild seal |
| `ink` | `#1f2430` | Black suits, SJ, ranks |
| `goldleaf` | `#c9a227` | Back hairline; **BJ medallion ring**; ceremony only — never large fills |
| `seal-ivory` | `#f5efe3` | Glyph on cinnabar seals (alias of ivory) |
| `paper-shadow` *(extend)* | `color-mix(in srgb, #1f2430 18%, transparent)` | 1px outer soften on open faces in the well — optional, desktop only |

No neon, no second red, no pure black `#000`.

### Type

- **Rank / monogram:** `Noto Serif TC` / Songti stack already implied by `--font-card` — keep **serif** for ranks (premium paper).  
- **Suit glyphs:** system or embedded suit symbols with **optical sizing**, not the serif (suits are shapes, not letters).  
- **No sans on the face.** Sans belongs to UI chrome (action bar), not the deck.

### Geometry

| Token | Value | Why |
|---|---|---|
| Aspect | **1.45** (keep) | Fan math & conformance already pinned |
| Corner radius | **6px** at hand (≥36px wide); **5px** mini | Current **8px** reads “app chip”; real cards are tighter |
| Border | **1.5px rosewood** (1px at mini) | Current 2px is slightly crude/heavy on ivory |
| Inset whisper | optional **0.5px** goldleaf at 25% opacity, inset 2px — **desktop open faces only** | Echo of back craft; off by default on mobile for simplicity |

### THE SIGNATURE — what makes this deck ours

**The cinnabar seal vocabulary on ivory, under lacquer light.**

One family of marks:

1. **Wild** = small filled cinnabar seal under the suit  
2. **Big joker** = large filled cinnabar star-seal  
3. **Small joker** = hollow ink diamond-seal  
4. **Back** = rosewood field + goldleaf hairline (already present)  
5. **Open face (desktop)** = that same gold hairline whispering around the ivory  

Competitors will either over-illustrate (gaudy) or stay index-only (crude). **Corner Seal** is the middle path the art direction asked for: 清楚、簡約、高級感 — clear hierarchy, almost no ornament, but the ornament that remains is **seal-cut and intentional**, like a stamp on rice paper, not a badge on a Bootstrap button.

---

## 7. RISKS at true 390 — and graceful degradation

| Risk | Failure mode | Degradation |
|---|---|---|
| **`10` rank width** | Serif “10” at 0.38w may approach sliver width | Condensed tracking; if still tight, rank steps to **0.34w** only for `T`; never wrap |
| **Wild seal vs short cards** | On `A`/`7` with small suit, seal could feel low | Cap seal top at `y ≤ 0.95w` from top of card; prefer attachment to suit over absolute bottom |
| **Two adjacent wilds** | Two seals in neighbouring slivers | Harmless — each seal is column-centered; misattribution was a *junction* problem, not a density problem |
| **Joker monogram anti-alias** | Star/diamond muddy at ~18px | Use **filled geometric SVG paths** with 1px minimum stroke in device px; avoid emoji presentation of ★/◇ |
| **27 cards / 2 rows** | Overflow if cardw or pitch grows | Keep pitch `0.40w`; max 14/row already; **do not add left padding** that eats the first card’s sliver. Verify: `14 × 0.40w + 0.60w ≈ 6.2w` ≤ content width at 390 |
| **Mini chooser 32px** | Seal + rank fight | Mini: if wild, **drop suit glyph** and show rank + seal only (wild’s suit is always hearts/level identity — known); jokers monogram-only |
| **Colourblind** | Red/black merge | Shape stack remains: suit glyphs differ; BJ star ≠ SJ diamond; wild is **circle under suit**, not a recolour of the rank |
| **Selection cinnabar ring** | Ring + wild seal both cinnabar | Selection is **outer box-shadow** (framework); seal is **inner face**. Keep seal Ø small so they don’t fuse visually |
| **IP / “looks like X deck”** | Court cartouches get too figurative | Hard rule: **no faces, no hands, no branded jester**; strokes only; if doubtful, fall back to large suit + rank in a plain oval |
| **English a11y regression** | Removing face text confuses sighted EN users briefly | Acceptable: physical decks have no English on jokers either; tooltips/aria carry words |

### Graceful summary

When space collapses, **shed body first, then suit (wild-only), then never shed rank/monogram/seal.** The fan must still answer: *what rank, what suit (or which joker), is it wild?* — in that order — from the 17px strip alone.

---

## 8. Framework / theme boundary (for implementers later)

| Concern | Owner |
|---|---|
| Wild seal form, position, symbol | **Framework** (`CardFace` / `GhostFace` + CSS) — theme must leave bottom/mid column clear |
| Rank, suit, pip maps, court cartouches, joker monogram+medallion | **Theme** (`lacquer` / Corner Seal) |
| Localized names | **i18n + aria only** — not face paint |
| Selection / glow / tribute | Framework (unchanged) |

Theme conformance addition (proposal): **no text nodes** on joker faces; wild overlay paint box must satisfy `right ≤ 0.40 × cardw`.

---

## 9. Borderline IP flags

| Element | Status |
|---|---|
| Corner indices, A–10 pip layouts, red/black suit split | Free French-suited convention |
| Abstract J/Q/K cartouche emblems (staff/crescent/crown) | Free if geometric; **borderline** if they start resembling a named publisher’s courts — keep stroke-simple |
| Jester character, “rider” poses, bike-back pattern | **Do not use** |
| Seal/star/diamond monograms | Free geometry; not a trademarked joker |
| Wordmarks, ace-of-spades ornate logos | **Do not use** |

---

## 10. Why this proposal should win a comparison

Other designers may (a) pretty-up the full face and ignore the 17px truth, (b) keep localized joker type and only fix CSS alignment, or (c) invent a second mobile theme. **Corner Seal** starts from the measured fan, moves the wild into the identity column as a **locale-free seal**, replaces jokers with **shape-first monograms**, and earns “real deck” only when pixels allow — one grammar, lacquer table, no gaud.

**Standing art direction check:** 清楚 (column hierarchy) · 簡約 (almost no ornament) · 高級感 (seal + gold whisper + tighter radius) · 不花俏 (no gradients-as-decoration, no court portraits, no locale stickers on cardboard).

---

*Proposal only — no code changes. Empirical defects and 390 measures as given 2026-07-16; geometry derived from `table.css` fan overlap `−0.6 × hand cardw` and live widths stated in the brief.*
