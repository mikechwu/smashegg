# Card face redesign — verification, research, three independent proposals

**Date:** 2026-07-16 · **Status:** PICKED — the owner chose a figurative Eastern-minimalist
court reimagining (overriding unanimous point 5, see the dated note in §2; everything else in
the foundation stands). Build record: docs/design/deck-themes/cinnabar-court/DESIGN.md.
Mode: DESIGN panel (independent proposals, anchoring-free — none of the three saw another's
answer), not an audit panel. Lead: Fable (owner-requested, logged per the model-dispatch rule);
proposers: Fable, Codex, Grok. Implementation later: Sonnet-class per the ladder.

## 0. Item-0 verification (empirical, 2026-07-16, live build)

Method: hunted a room where seat 0 holds the wild (2H) adjacent to jokers; measured with an
elementFromPoint grid over the marker; [zh-Hant + en] x [desktop 1033px + true 390px iframe],
ascending AND descending sort.

- **The wild marker is NOT occluded** — it sits bottom-LEFT (moved there in an earlier round),
  83% of its triangle visible with the glyph centre readable in every tested configuration.
  The owner's proposed mechanism (bottom-right, covered) is not what is happening.
- **The mis-attribution is REAL anyway:** the triangle rides the sliver JUNCTION — its clipped
  edge tucks under the neighbour and its diagonal mass grows toward it, so it reads as sitting
  "between" the wild and the next card (confirmed visually at both widths). The defect is the
  marker's SHAPE-AND-POSITION at the junction, not occlusion.
- **English jokers are broken outright:** `writing-mode: vertical-rl` + `text-orientation:
  upright` letter-stacks "Joker"/"Big Joker" into colliding red columns that overflow the card
  bottom. Geometry bug, exactly the sliver reframe's symptom.
- **The design envelope, measured:** true 390px → card 42.9px wide, fan pitch 17.2px (the
  visible sliver is the left 40%); rank glyph 18px; marker glyph 12px. Desktop → card ~52px,
  pitch ~21px. Anything identity-critical must live inside x ∈ [0, 0.40w].

Ratchet note: these finds are design constraints; their regressions land WITH the new theme's
conformance pins (see the unanimous contract additions below).

## 1. Research (fetched 2026-07-16)

- Corner indices were invented FOR the fan: "squeezers" enabled one-handed fans reading only
  corners; indices standardised after 1875-76 and GREW over decades to today's size — bigger
  indices won historically. Sources: [World of Playing Cards — Corner Indices]
  (https://www.wopc.co.uk/playing-cards/corner-indices), [IPCS — Indices]
  (https://www.i-p-c-s.org/faq/history_8.php), [PlayingCardDecks — history]
  (https://playingcarddecks.com/blogs/all-in/history-playing-cards-modern-deck).
- Jumbo vs standard index is the standing legibility trade (rank ~2x, less art; preferred for
  hard-to-read hands / distance): [DK Gameroom]
  (https://www.dkgameroomoutlet.com/blog/2012/10/19/playing-cards-jumbo-index-vs-regular-or-standard-index/),
  [ClassicDecks](https://classicdecks.com/pages/jumbo-index-vs-standard-index-playing-cards).
- Balatro is the modern small-screen touchstone: readability-first faces, a High Contrast
  Cards accessibility mode (suit separation beyond colour), praised mobile port:
  [Engadget](https://www.engadget.com/gaming/balatro-is-an-almost-perfect-mobile-port-163050971.html),
  [design analysis](https://medium.com/@yyh19971004/balatro-design-analysis-visual-packaging-and-interactive-feedback-cc6fa6a65370).
- Joker convention matches the owner's direction: big = full-colour/red, small = monochrome
  (USPCC prints exactly this pair); distinction carried by colour AMOUNT + art, not words:
  [Wikipedia — Joker (playing card)](https://en.wikipedia.org/wiki/Joker_(playing_card)).
- Mainstream Guandan apps (Tencent Guandan etc.) trend cartoon-styled with vertical-stack hand
  organisation — a direction the owner's 清楚簡約高級感 brief explicitly rejects; useful as the
  anti-reference: [App Store — 腾讯掼蛋](https://apps.apple.com/us/app/%E8%85%BE%E8%AE%AF%E6%8E%BC%E8%9B%8B/id6476842364).

## 2. The unanimous foundation (all three proposals, independently)

Adopt as settled unless the owner objects — three blind designers agreeing is the strongest
signal this exercise can produce:

1. **Identity column**: rank over suit over (wild seal), all inside the left 0.34-0.36w with a
   right safety gutter before 0.40w; nothing identity-critical crosses the occlude line. The
   junction triangle dies.
2. **The wild marker becomes a language-neutral SYMBOL** (a cinnabar "seal"), framework-owned,
   IN the column under the suit — attachment is structural, mis-attribution impossible.
   aria-labels stay localized; face ink goes locale-free.
3. **Jokers carry NO words in any locale** — shape-first monograms/medallions, big = colourful
   + one silhouette, small = monochrome + a different silhouette (never colour alone).
4. **ONE adaptive theme**, detail keyed to rendered card size (mini → index only; trick →
   reduced body; open/desktop → pips + double indices), never a second theme by viewport.
5. **Bodies**: real French pip layouts (public-domain geometry) at open sizes; NO figurative
   court art (IP + craft honesty) — abstract/typographic court treatment instead; goldleaf as
   hairline whisper only.
   > **OVERRIDDEN by owner decision, 2026-07-16** (this point only; the other five stand):
   > courts and jokers are reimagined FIGURATIVELY in the app's Eastern-minimalist idiom,
   > following the owner's five reference images filed at
   > docs/design/deck-themes/cinnabar-court/reference/ (direction, not spec). The override
   > answers both original reasons: IP by constraint (original Eastern-idiom art, no
   > reproduction of any published deck, no trademarks), craft by an explicit quality bar
   > with an abstract-treatment fallback if the art fails at ship sizes. Full record:
   > docs/design/deck-themes/cinnabar-court/DESIGN.md §0/§5.
6. **Contract additions** (testable, from Grok's spec): joker faces contain no text nodes; the
   wild overlay's paint box satisfies right ≤ 0.40 x cardw. Plus the existing ratchet.

## 3. The fork — three signatures (owner picks)

| | A "Celestial" (Fable) | B "Crest" (Codex) | C "Corner Seal" (Grok) |
|---|---|---|---|
| Big joker | SUN medallion (cinnabar core, goldleaf rays) | Crowned-sun crest; sparse jester line-art body | Filled cinnabar STAR seal + double stem |
| Small joker | MOON crescent (ink) | Crescent-disc crest; ink jester medallion | Hollow ink DIAMOND seal + single stem |
| Wild seal | Rounded-square chop, ivory four-petal cutout | Lozenge, ivory four-point spark | Circle, ivory four-petal/reference mark |
| Character | Warmest, most memorable; 大王=sun 小王=moon is naturally semantic | Middle path; jester body is its weakest/IP-adjacent element | Most disciplined; one seal vocabulary unifies wild+jokers+back |
| Risk at 12px | Sun rays blur → silhouette fallback (disc vs crescent) | Crest detail muddies → outline-first fallback | Star vs diamond at 18px needs crisp SVG paths (specified) |

**Recommendation:** C "Corner Seal" as the base — it is the strictest reading of
清楚簡約高級感,不花俏, its degradation ladder and conformance additions are the most
implementable/testable, and its seal vocabulary makes the deck OURS without a single decorative
element. Named compatible swap if the owner wants more family warmth: A's sun/moon jokers drop
into C's architecture cleanly (the fork is one component). B's jester bodies are the one element
recommended against (craft/IP-adjacent).

Full texts: scratchpad design/{fable,codex,grok}-proposal.md (this doc is the durable record;
the proposals' full texts are preserved below in the repo history via this round's commit).

## 4. Sequencing (per the brief)

Owner picks → build as a NEW DeckTheme (Sonnet-class implementation) → conformance ratchet +
the new contract pins → visual verification (desktop + true 390, locale stated) → panel on
contract compliance (a different artifact from the aesthetics, so Codex stays clean even
though it proposed).
