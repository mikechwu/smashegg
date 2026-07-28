> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Suit registry BUILT local (2026-07-22) — SVG suit parts replace every Unicode glyph; awaiting the owner's deploy word

The owner's four suit SVGs are now the SINGLE SOURCE OF TRUTH for suit
shapes: src/client/table/suits.tsx (paths normalized as a family from
typeface-convention measurements — near-equal ink height, heart
x-squeezed 10%, diamond +6%; SuitMark, fill=currentColor, the seam the
jokers/court cards plug into next). Every render site consumes it:
lacquer corner + body pip, GhostFace, cinnabar-court corner/pip
field/court cartouche (art.tsx's own 24x28 paths deleted — the one
disclosed edit to the frozen module: shape source + cartouche transform
only, court/joker geometry untouched), and the desk/chooser SF run
labels (declRunText is rank-window-only; the suit renders as SuitMark
visually and the localized suit WORD in aria, via the new
i18n/react.tsx tNode rich-interpolation seam). suitGlyph is gone.

The structural pin (the round's strongest verifiable artifact): a scan
over EVERY file in src/client bans suit codepoints in every known
encoding — literals, JS/CSS escapes, HTML entities, surrogate pairs,
fromCharCode/fromCodePoint construction, the U+1F0A0 card-emoji block,
U+2763/2764 heart stand-ins — with a self-test proving each smuggling
form is caught. Completeness verified three ways (Codex, Grok with the
suite green in its clone, and a 17-agent six-modality workflow sweep
with adversarial verification): TOTAL — zero rendered-surface suit
codepoints repo-wide; all inert hits (docs prose, engine comments, test
names) individually refuted. Panel MEDs (escape blind spot; the
local-helper hole) hardened same-round; docs/audits/suit-registry.md.

Live (zh-Hant, TRUE 390×844 + desktop, both themes): 13/13 — every
corner/pip/ghost/desk suit is the shared part, zero Unicode suit text
nodes in the DOM, pip ink clears the wild seal 3.4px / the corner index
11.4px (re-measured per the CSS comment's own rule), cinnabar corner
fill=currentColor resolving to the theme palette, the desk naming a
staged pair through the node-built status. The ~12px named check:
corner ink ~12.0px at 390 and the four silhouettes separate (family
screenshots). **Boundary stated: desktop/iPhone rendered the OLD glyphs
fine too — the Chinese-brand Android emoji render is NOT verifiable
here; the scan removes the cause structurally, and the emoji-gone
confirmation is a named M5 real-device check (Xiaomi/Huawei/OPPO/vivo),
batched with the elder session.** Gate 1060/1060 (44 files) + typecheck
+ lint:hooks + build. NOT pushed — this round's order carries no deploy
word.
