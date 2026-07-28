> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Joker faces BUILT local (2026-07-22) — the owner's three parts compose both variants; awaiting the owner's deploy word

The owner's three SVGs (figure illustration / JOKER wordmark / dollar-J
logo) are now the joker rendering for BOTH themes, through the same
registry seam the suits established: joker-art-data.ts (145/5/1 paths,
extracted VERBATIM from the supplied files — transcription by script,
never by hand) + jokers.tsx (JokerFace: wordmark top reading on from
the top-left corner logo, the logo mirrored bottom-right by a 180 turn
about the card center, the figure filling the body; composition per the
owner's reference). Variants: small joker entirely monochrome
currentColor; big joker's logo/wordmark red via the face class and the
illustration FULL COLOR — 18 flat patches in the traditional
red/gold/black court palette (+ regal purple vest) painted UNDER the
open linework, palette in ONE place (JOKER_PALETTE). Both themes' old
joker code deleted (lacquer's star/lozenge marks; cinnabar-court's
jester figures + emblems out of the frozen art.tsx — the disclosed
edit; courts untouched). No text nodes on joker faces (the wordmark is
paths); the letter-stack era is fully gone.

THE NAMED CONSTRAINT — big vs small WITHOUT color: evaluated the
owner's offered options by screenshot (outline logo dies at small
sizes; bars looked tacked-on) and landed on: both corners keep the
solid logo, the BIG joker adds a solid five-point star under each
corner logo (presence-of-glyph survives every size), with the big
joker's shaded body vs the small's white line art as the second cue.
Verified at 50/36px, in grayscale, and in a REAL fan sliver at true 390
zh-Hant (a live hand holding BJ+SJ side by side — crops in the round
records; the corner star measures 4.6px at 390). Grok mutation-tested
the property (star drops and color swaps each fail pins — one pin
hardened same-round to count both corners per theme); Codex re-derived
the composition geometry independently (corner column inside the 0.40w
sliver; rotated corner correct). The supplied art carries NO
id/defs/gradients (verified at intake + pinned, source AND rendered).

Audits: Codex zero findings; Grok no HIGH (1 MED pin-hardening + LOWs,
all fixed); an 11-agent five-modality workflow sweep (surfaces walk
total — every joker path routes through the one part; geometry
recomputed clean; contract/prior-round regressions none; 2 stale
comments + 1 inline-label LOW fixed). docs/audits/joker-faces.md.
Detail ladder: no reduced form needed — the line-art illustration reads
as texture at hand size, verified in shots, no mud. Gate 1069/1069 (45
files) + typecheck + lint:hooks + build (+34KB gzip: the art's real
cost). NOT pushed — this round's order carries no deploy word (the suit
round's 43b45e5 is also local-only, same reason).
